// main.ts
import { world, system, Entity } from "@minecraft/server";
import { getTeam } from "./utils/teams.js";
import { projectileConfig } from "./utils/projectileConfig.js";
import { applyDamageAndCfg } from "./utils/damage.js";
import { debugMessage, debugWarn } from "./utils/debug.js";
import { cleanupEntityData, cleanupSessionsByEntity } from "./gui/interactMenu/interact_ddui_shared.js";

interface ProjectileConfigEntry {
  damage: number;
  knockback: number;
  pierce: number;
}

const projectilePierceMap = new WeakMap<Entity, number>();

world.afterEvents.projectileHitEntity.subscribe((event) => {
  const projectile = event.projectile as Entity | undefined;
  const target = event.getEntityHit()?.entity as Entity | undefined;
  const shooter = event.source as Entity;
  if (!projectile || !target) {
    debugWarn("projectileHitEntity", "Falta objeto necesario o es fuego amigo.", "yellow");
    return;
  }

  const teamShooter = shooter ? getTeam(shooter) : null;
  const teamTarget = getTeam(target);

  if (shooter && target.id === shooter.id) {
    debugWarn("projectileHitEntity", `El proyectil intentó dañar a su propio tirador. Cancelando daño.`, "yellow");
    return;
  }

  if (teamShooter && teamTarget && teamShooter === teamTarget) {
    debugWarn(
      "projectileHitEntity",
      `Fuego amigo detectado. Disparador: ${teamShooter}, Objetivo: ${teamTarget}`,
      "cyan"
    );
    return;
  }

  const cfg = (projectileConfig as Record<string, ProjectileConfigEntry>)[projectile.typeId];
  if (!cfg) {
    debugWarn("projectileHitEntity", `No se encontró configuración para el proyectil.`, "red");
    return;
  }

  try {
    if (cfg.pierce === Infinity) {
      debugWarn("projectileHitEntity", `Pierce es Infinity. Solo aplicamos daño y knockback.`, "green");
      applyDamageAndCfg(projectile, target, cfg, shooter);
      return;
    }

    let pierced = projectilePierceMap.get(projectile) ?? 0;
    const pierceLimit = cfg.pierce ?? 1;
    if (pierced >= pierceLimit) {
      debugWarn("projectileHitEntity", `Pierce actual: ${pierced}. Límite de pierce: ${pierceLimit}`, "cyan");
      debugWarn("projectileHitEntity", "Límite de pierce alcanzado. Eliminando proyectil.", "cyan");
      return;
    }

    debugWarn("projectileHitEntity", `Pierce actual: ${pierced}. Límite de pierce: ${pierceLimit}`, "green");
    applyDamageAndCfg(projectile, target, cfg, shooter);

    projectilePierceMap.set(projectile, pierced + 1);
  } catch (e) {
    debugWarn("projectileHitEntity", `Error general al aplicar daño: ${e}`, "red");
  }
});

world.afterEvents.entityRemove.subscribe((event) => {
  const removedEntityId = event.removedEntityId;
  const entityType = event.typeId;
  debugWarn("projectileHitEntity", `Entidad eliminada: ${entityType} Id: ${removedEntityId}`, "magenta");
  cleanupEntityData(removedEntityId);
  cleanupSessionsByEntity(removedEntityId);
});
