// main.ts
import { world, system, Entity } from "@minecraft/server";
import { getTeam } from "./utils/teams.js";
import { projectileConfig, type ProjectileConfigEntry } from "./utils/projectileConfig.js";
import { applyDamageAndCfg } from "./utils/damage.js";
import { debugMessage, debugWarn } from "./utils/debug.js";
import { interactMenuSessionStore } from "./gui/interactMenu/ddui/interact_ddui_shared.js";

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
      debugWarn(
        "projectileHitEntity",
        `Projectile: ${projectile.typeId}. Pierce es Infinity. Solo aplicamos daño y knockback.`,
        "green"
      );
      applyDamageAndCfg(projectile, target, cfg, shooter);
      return;
    }

    let pierced = projectilePierceMap.get(projectile) ?? 0;
    const pierceLimit = cfg.pierce ?? 1;
    if (pierced >= pierceLimit) {
      debugWarn(
        "projectileHitEntity",
        `Projectile: ${projectile.typeId}. Pierce actual: ${pierced}. Límite de pierce: ${pierceLimit}`,
        "cyan"
      );
      debugWarn("projectileHitEntity", "Límite de pierce alcanzado. Eliminando proyectil.", "cyan");
      return;
    }

    debugWarn(
      "projectileHitEntity",
      `Projectile: ${projectile.typeId}. Pierce actual: ${pierced}. Límite de pierce: ${pierceLimit}`,
      "green"
    );
    applyDamageAndCfg(projectile, target, cfg, shooter);

    projectilePierceMap.set(projectile, pierced + 1);
  } catch (e) {
    debugWarn("projectileHitEntity", `Error general al aplicar daño: ${e}`, "red");
  }
});

// No es llamado por entity.remove()
// Si acepta EntityDamageCause.override
world.afterEvents.entityDie.subscribe((event) => {
  const deadEntity = event.deadEntity;
  const cause = event.damageSource.cause;
  const deadEntityId = deadEntity.id;
  const entityType = deadEntity.typeId;
  debugWarn("entityDie", `Entidad eliminada: ${entityType} por: ${cause}`, "magenta");
  try {
    interactMenuSessionStore.clearEntityFeedbackForAll(deadEntityId);
  } catch (e) {
    debugWarn("entityDie", `Error limpiando interactMenu feedback: ${e}`, "red");
  }
  interactMenuSessionStore.cleanupByEntity(deadEntityId);
});

world.afterEvents.entitySpawn.subscribe((event) => {
  const entity = event.entity;
  const cfg = (projectileConfig as Record<string, ProjectileConfigEntry>)[entity.typeId];
  if (!cfg?.sound) {
    return;
  }
  entity.dimension.playSound(cfg.sound, entity.location);
  debugWarn("projectileSound", `Projectile: ${entity.typeId}. Sound: ${cfg.sound}`, "blue");
});
