// scripts\utils\weapons.js
import { world, system, Player, EntityProjectileComponent } from "@minecraft/server";
import { debug } from "./debug.js";
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
    fireRate: 2,
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

type PlayerZoomState = {
  intervalId: number;
  zoomFov: number;
  itemTypeId: string;
};

const playerZoomStates = new Map<string, PlayerZoomState>();

function startPlayerZoom(player: Player, itemTypeId: string, zoomFov: number) {
  if (playerZoomStates.has(player.id)) {
    debug("zoom", `[start] Jugador §b${player.id}§r ya tiene intervalo de zoom activo§r`, {
      level: "warn",
      color: "yellow",
    });
    return;
  }

  debug("zoom", `[start] Creando zoom para jugador §b${player.id}§r con §a${itemTypeId}§r FOV=§6${zoomFov}§r`, {
    level: "debug",
    color: "blue",
  });

  const intervalId = system.runInterval(() => {
    const currentItem = player.getComponent("minecraft:inventory")?.container?.getItem(player.selectedSlotIndex);
    const currentTypeId = currentItem?.typeId;
    const state = playerZoomStates.get(player.id);
    debug(
      "zoom",
      `[interval] Jugador §b${player.id}§r tiene item actual=§a${currentTypeId}§r, esperado=§a${state?.itemTypeId}§r`,
      { level: "debug", color: "blue" }
    );
    if (!state || currentTypeId !== state.itemTypeId) {
      debug(
        "zoom",
        `[interval] Jugador §b${player.id}§r ya no tiene el arma con zoom (actual=§a${currentTypeId}§r, esperado=§a${state?.itemTypeId}§r), deteniendo zoom§r`,
        { level: "warn", color: "yellow" }
      );
      clearZoomIfActive(player);
      return;
    }

    if (player.isSneaking) {
      player.camera.setFov({
        fov: state.zoomFov,
        easeOptions: {
          easeTime: 0.3,
          easeType: mc.EasingType.OutSine,
        },
      });
    } else {
      player.camera.clear();
    }
  }, 2);

  playerZoomStates.set(player.id, { intervalId, zoomFov, itemTypeId });
}

function clearZoomIfActive(player: Player) {
  const state = playerZoomStates.get(player.id);
  if (state) {
    system.clearRun(state.intervalId);
    playerZoomStates.delete(player.id);
    player.camera.clear();
    debug("zoom", `[clear] Cámara limpiada y zoom detenido para jugador §b${player.id}§r`, {
      level: "debug",
      color: "blue",
    });
  }
}

// Detectar cambio de slot en la hotbar
world.afterEvents.playerHotbarSelectedSlotChange.subscribe((event) => {
  const player = event.player;
  const itemTypeId = event.itemStack?.typeId;
  const data = itemTypeId ? weaponData[itemTypeId] : undefined;

  debug("zoom", `[hotbar] Jugador §b${player.id}§r cambió a slot §6${event.newSlotSelected}§r item=§a${itemTypeId}§r`, {
    level: "debug",
    color: "blue",
  });

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

  debug(
    "zoom",
    `[inventory] Jugador §b${player.id}§r cambió item en hotbar slot=§6${event.slot}§r item=§a${itemTypeId}§r`,
    { level: "debug", color: "blue" }
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
    debug("player", `No se encontró la configuración del arma: §a${itemId}§r`, {
      level: "warn",
      color: "yellow",
    });
    return;
  }

  const spawnPos = getProjectileSpawnPosition(player);

  const direction = player.getViewDirection();

  try {
    const projectile = player.dimension.spawnEntity(data.projectile, spawnPos);
    if (!projectile) {
      debug("player", `No se pudo crear el proyectil: §c${data.projectile}§r`, {
        level: "error",
        color: "red",
      });
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
    debug(
      "player",
      `[DEBUG] Player id=§b${player.id}§r, typeId=§b${player.typeId}§r, location=(§6${player.location.x.toFixed(2)}§r, §6${player.location.y.toFixed(2)}§r, §6${player.location.z.toFixed(2)}§r), properties=${Object.getOwnPropertyNames(player).join(", ")}`,
      { level: "debug", color: "gray" }
    );

    // Depuración de armadura usando el componente equippable
    if (player.typeId === "minecraft:player") {
      const equippable = player.getComponent("equippable");
      if (equippable) {
        const helmet = equippable.getEquipment(mc.EquipmentSlot.Head);
        const chest = equippable.getEquipment(mc.EquipmentSlot.Chest);
        const legs = equippable.getEquipment(mc.EquipmentSlot.Legs);
        const boots = equippable.getEquipment(mc.EquipmentSlot.Feet);

        debug(
          "player",
          `[DEBUG] Player armadura: Head=§a${helmet?.typeId || "Ninguno"}§r, Chest=§a${chest?.typeId || "Ninguno"}§r, Legs=§a${legs?.typeId || "Ninguno"}§r, Feet=§a${boots?.typeId || "Ninguno"}§r`,
          { level: "debug", color: "gray" }
        );
      } else {
        debug("player", `[DEBUG] Player armadura: Ninguna (equippable no disponible)`, {
          level: "debug",
          color: "gray",
        });
      }
    }

    debug("player", `Disparando §a${itemId}§r → §b${data.projectile}§r`, {
      level: "debug",
      color: "blue",
    });

    if (data.onEntryCommands) {
      for (const cmd of data.onEntryCommands) {
        try {
          const result = player.runCommand(cmd);
          debug("player", `Ejecutando "§a${cmd}§r" → éxito=§6${result.successCount}§r`, {
            level: "debug",
            color: "blue",
          });
        } catch (err) {
          debug("player", `Error ejecutando comando "${cmd}": ${err}§r`, {
            level: "error",
            color: "red",
          });
        }
      }
    }
  } catch (e) {
    debug("player", `[Disparo] Error al crear proyectil: ${e}§r`, {
      level: "error",
      color: "red",
    });
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
    debug("player", `[Disparo] Posición demasiado alta para generar proyectil: Y=§6${spawnPos.y}§r`, {
      level: "error",
      color: "red",
    });
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
      debug("player", `Jugador §b${player.id}§r está en §6cooldown§r.§r`, {
        level: "debug",
        color: "blue",
      });
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
    debug("player", `Jugador §b${playerId}§r dejó de disparar.§r`, {
      level: "debug",
      color: "blue",
    });
  }
}

world.beforeEvents.playerLeave.subscribe((event) => {
  const playerId = event.player.id;

  // Borrar cooldownMap
  cooldownMap.delete(playerId);
  debug("player", `Borrando a Jugador §b${playerId}§r del cooldownMap§r`, {
    level: "debug",
    color: "blue",
  });

  // Borrar firingPlayers y limpiar interval si existía
  stopShooting(playerId);

  // Limpiar zoom si estaba activo
  clearZoomIfActive(event.player);
});
