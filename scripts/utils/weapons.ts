// scripts\utils\weapons.js
import { world, system, Player, EntityProjectileComponent } from "@minecraft/server";
import { debugMessage, debugWarn } from "./debug.js";
import * as mc from "@minecraft/server";

export type WeaponData = {
  projectile: string;
  speed: number;
  fireRate: number;
  isAutomatic: boolean;
  onEntryCommands: string[];
  zoomFov?: number;
  zoomEnabled?: boolean;
};

const weaponData: Record<string, WeaponData> = {
  "gabrielaplok:m4a1": {
    projectile: "lc:dt_hk416_player_bullet",
    speed: 25.0,
    fireRate: 2,
    isAutomatic: true,
    onEntryCommands: ["function aplokguns/fire_m4a1"],
  },
  "gabrielaplok:m249": {
    projectile: "lc:dt_scar_player_bullet",
    speed: 25.0,
    fireRate: 1,
    isAutomatic: true,
    onEntryCommands: ["function aplokguns/fire_m249"],
  },
  "gabrielaplok:mp5a5": {
    projectile: "lc:dt_p90_player_bullet",
    speed: 25.0,
    fireRate: 2,
    isAutomatic: true,
    onEntryCommands: ["function aplokguns/fire_mp5a5"],
  },
  "gabrielaplok:ak47": {
    projectile: "lc:dt_ak47_player_bullet",
    speed: 25.0,
    fireRate: 3,
    isAutomatic: true,
    onEntryCommands: ["function aplokguns/fire_ak47"],
  },
  "gabrielaplok:awp": {
    projectile: "lc:dt_dtrifle_player_bullet",
    speed: 25.0,
    fireRate: 30,
    isAutomatic: false,
    onEntryCommands: ["function aplokguns/fire_awp"],
    zoomFov: 30,
    zoomEnabled: true,
  },
};

const firingPlayers = new Map(); // Para automáticas: player.id -> intervalId
const cooldownMap = new Map(); // Para semiautomáticas: player.id -> tick

// Estado de zoom por arma
const playerZoomIntervals = new Map<string, number>();
const playerZoomConfigs = new Map<string, { zoomFov: number; itemTypeId: string }>();

function startPlayerZoom(player: Player, itemTypeId: string, zoomFov: number) {
  if (playerZoomIntervals.has(player.id)) {
    debugWarn("zoom", `[start] Jugador ${player.id} ya tiene intervalo de zoom activo`, "yellow");
    return;
  }

  debugWarn("zoom", `[start] Creando zoom para jugador ${player.id} con ${itemTypeId} FOV=${zoomFov}`, "green");

  const intervalId = system.runInterval(() => {
    const currentItem = player.getComponent("minecraft:inventory")?.container?.getItem(player.selectedSlotIndex);
    const currentTypeId = currentItem?.typeId;
    const config = playerZoomConfigs.get(player.id);
    debugWarn(
      "zoom",
      `[interval] Jugador ${player.id} tiene item actual=${currentTypeId}, esperado=${config?.itemTypeId}`,
      "blue"
    );
    if (!config || currentTypeId !== config.itemTypeId) {
      debugWarn(
        "zoom",
        `[interval] Jugador ${player.id} ya no tiene el arma con zoom (actual=${currentTypeId}, esperado=${config?.itemTypeId}), deteniendo zoom`,
        "red"
      );
      clearZoomIfActive(player);
      return;
    }

    if (player.isSneaking) {
      player.camera.setFov({
        fov: config.zoomFov,
        easeOptions: {
          easeTime: 0.3,
          easeType: mc.EasingType.OutSine,
        },
      });
    } else {
      player.camera.clear();
    }
  }, 2);

  playerZoomIntervals.set(player.id, intervalId);
  playerZoomConfigs.set(player.id, { zoomFov, itemTypeId });
}

function clearZoomIfActive(player: Player) {
  const intervalId = playerZoomIntervals.get(player.id);
  if (intervalId !== undefined) {
    system.clearRun(intervalId);
    playerZoomIntervals.delete(player.id);
    playerZoomConfigs.delete(player.id);
    player.camera.clear();
    debugWarn("zoom", `[clear] Cámara limpiada y zoom detenido para jugador ${player.id}`, "cyan");
  }
}

// Detectar cambio de slot en la hotbar
world.afterEvents.playerHotbarSelectedSlotChange.subscribe((event) => {
  const player = event.player;
  const itemTypeId = event.itemStack?.typeId;
  const data = itemTypeId ? weaponData[itemTypeId] : undefined;

  debugWarn("zoom", `[hotbar] Jugador ${player.id} cambió a slot ${event.newSlotSelected} item=${itemTypeId}`, "blue");

  if (data?.zoomEnabled && data.zoomFov !== undefined) {
    const zoomFov = data.zoomFov;
    startPlayerZoom(player, itemTypeId!, zoomFov);
  } else {
    clearZoomIfActive(player);
  }
});

// Detectar cambios dentro de la hotbar (equipar, soltar, consumir)
world.afterEvents.playerInventoryItemChange.subscribe((event) => {
  if (event.inventoryType !== mc.PlayerInventoryType.Hotbar) return;

  const player = event.player;
  if (event.slot !== player.selectedSlotIndex) return;

  const itemTypeId = event.itemStack?.typeId;
  const data = itemTypeId ? weaponData[itemTypeId] : undefined;

  debugWarn(
    "zoom",
    `[inventory] Jugador ${player.id} cambió item en hotbar slot=${event.slot} item=${itemTypeId}`,
    "blue"
  );

  if (data?.zoomEnabled && data.zoomFov !== undefined) {
    const zoomFov = data.zoomFov;
    startPlayerZoom(player, itemTypeId!, zoomFov);
  } else {
    clearZoomIfActive(player);
  }
});

// Como respaldo de proyectil -> jugador
// export const projectileShooterMap = new Map();

function getProjectileSpawnPosition(player: Player) {
  const direction = player.getViewDirection();
  const { x, y, z } = player.getHeadLocation();
  return {
    x: x + direction.x,
    y: y + direction.y,
    z: z + direction.z,
  };
}

function shoot(player: Player, itemId: string) {
  const data = weaponData[itemId];
  if (!data) {
    debugWarn("player", `No se encontró la configuración del arma: ${itemId}`, "yellow");
    return;
  }

  const spawnPos = getProjectileSpawnPosition(player);

  const direction = player.getViewDirection();

  try {
    const projectile = player.dimension.spawnEntity(data.projectile, spawnPos);
    if (!projectile) {
      debugWarn("player", `No se pudo crear el proyectil: ${data.projectile}`, "red");
      return;
    }

    // Mantener el map por compatibilidad
    // projectileShooterMap.set(projectile.id, player);

    // Asignar propietario nativo
    const projComp = projectile.getComponent("minecraft:projectile") as EntityProjectileComponent;
    if (projComp) {
      projComp.owner = player;
    }

    const velocity = {
      x: direction.x * data.speed,
      y: direction.y * data.speed,
      z: direction.z * data.speed,
    };

    projComp?.shoot(velocity);
    // } else {
    //     projectile.applyImpulse(velocity);
    // }

    // Depuración del player
    debugWarn(
      "player",
      `[DEBUG] Player id=${player.id}, typeId=${player.typeId}, location=(${player.location.x.toFixed(2)}, ${player.location.y.toFixed(2)}, ${player.location.z.toFixed(2)}), properties=${Object.getOwnPropertyNames(player).join(", ")}`,
      "blue"
    );

    // Depuración de armadura usando el componente equippable
    if (player.typeId === "minecraft:player") {
      const equippable = player.getComponent("equippable");
      if (equippable) {
        const helmet = equippable.getEquipment(mc.EquipmentSlot.Head);
        const chest = equippable.getEquipment(mc.EquipmentSlot.Chest);
        const legs = equippable.getEquipment(mc.EquipmentSlot.Legs);
        const boots = equippable.getEquipment(mc.EquipmentSlot.Feet);

        debugWarn(
          "player",
          `[DEBUG] Player armadura: Head=${helmet?.typeId || "Ninguno"}, Chest=${chest?.typeId || "Ninguno"}, Legs=${legs?.typeId || "Ninguno"}, Feet=${boots?.typeId || "Ninguno"}`,
          "cyan"
        );
      } else {
        debugWarn("player", `[DEBUG] Player armadura: Ninguna (equippable no disponible)`, "cyan");
      }
    }

    debugWarn("player", `Disparando ${itemId} → ${data.projectile}`, "green");

    if (data.onEntryCommands) {
      for (const cmd of data.onEntryCommands) {
        try {
          const result = player.runCommand(cmd);
          debugWarn("player", `Ejecutando "${cmd}" → éxito=${result.successCount}`, "cyan");
        } catch (err) {
          debugWarn("player", `Error ejecutando comando "${cmd}": ${err}`, "red");
        }
      }
    }
  } catch (e) {
    debugWarn("player", `[Disparo] Error al crear proyectil: ${e}`, "red");
  }
}

// itemUse → al presionar clic
world.afterEvents.itemUse.subscribe((event) => {
  const player = event.source;
  if (!player) return;

  const slot = player.selectedSlotIndex;
  const item = player.getComponent("minecraft:inventory")?.container?.getItem(slot);
  if (!item) return;

  const data = weaponData[item.typeId];
  if (!data) return;

  const spawnPos = getProjectileSpawnPosition(player);
  if (spawnPos.y > 321) {
    const message = `[Disparo] Posición demasiado alta para generar proyectil: Y=${spawnPos.y}`;
    player.sendMessage(`§c${message}`);
    debugWarn("player", message, "red");
    return;
  }

  if (data.isAutomatic) {
    if (firingPlayers.has(player.id)) return;

    const intervalId = system.runInterval(() => {
      const inventory = player.getComponent("minecraft:inventory")?.container;
      const currentItem = inventory?.getItem(player.selectedSlotIndex);
      if (!currentItem || currentItem.typeId !== item.typeId) {
        stopShooting(player.id);
        return;
      }
      shoot(player, item.typeId);
    }, data.fireRate);

    firingPlayers.set(player.id, intervalId);
  } else {
    const currentTick = system.currentTick;
    const nextAllowedTick = cooldownMap.get(player.id) ?? 0;

    if (currentTick < nextAllowedTick) {
      debugWarn(`Jugador ${player.id} está en cooldown.`, "cyan");
      return;
    }

    shoot(player, item.typeId);
    cooldownMap.set(player.id, currentTick + data.fireRate);
  }
});

// itemReleaseUse → al soltar el clic
world.afterEvents.itemReleaseUse.subscribe((event) => {
  const player = event.source;
  if (!player) return;
  stopShooting(player.id);
});

function stopShooting(playerId: string) {
  const intervalId = firingPlayers.get(playerId);
  if (intervalId !== undefined) {
    system.clearRun(intervalId);
    firingPlayers.delete(playerId);
    debugWarn(`Jugador ${playerId} dejó de disparar.`, "cyan");
  }
}

world.beforeEvents.playerLeave.subscribe((event) => {
  const playerId = event.player.id;

  // Borrar cooldownMap
  cooldownMap.delete(playerId);
  debugWarn(`Borrando a Jugador ${playerId} del cooldownMap`, "cyan");

  // Borrar firingPlayers y limpiar interval si existía
  stopShooting(playerId);

  // Limpiar zoom si estaba activo
  clearZoomIfActive(event.player);
});
