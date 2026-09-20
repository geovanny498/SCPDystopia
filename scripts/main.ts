// main.ts
import { world, system, Entity } from "@minecraft/server";
import { getTeam } from "./utils/teams.js";
import { projectileConfig, type ProjectileConfigEntry } from "./utils/projectileConfig.js";
import { applyDamageAndCfg } from "./utils/damage.js";
import { debug } from "./utils/debug.js";
import { interactMenuSessionStore } from "./gui/interactMenu/ddui/interact_ddui_shared.js";
import { entityHistoryStore } from "./gui/shared/entityHistory.js";

const projectilePierceMap = new WeakMap<Entity, number>();

world.afterEvents.projectileHitEntity.subscribe((event) => {
  const projectile = event.projectile as Entity | undefined;
  const target = event.getEntityHit()?.entity as Entity | undefined;
  const shooter = event.source as Entity;
  if (!projectile || !target) {
    debug("projectileHitEntity", "Falta objeto necesario o es fuego amigo.", { level: "warn", color: "yellow" });
    return;
  }

  const teamShooter = shooter ? getTeam(shooter) : null;
  const teamTarget = getTeam(target);

  if (shooter && target.id === shooter.id) {
    debug("projectileHitEntity", `El proyectil intentó dañar a su propio tirador. Cancelando daño.`, { level: "warn", color: "yellow" });
    return;
  }

  if (teamShooter && teamTarget && teamShooter === teamTarget) {
    debug(
      "projectileHitEntity",
      `Fuego amigo detectado. Disparador: ${teamShooter}, Objetivo: ${teamTarget}`,
      { level: "warn", color: "yellow" }
    );
    return;
  }

  const cfg = (projectileConfig as Record<string, ProjectileConfigEntry>)[projectile.typeId];
  if (!cfg) {
    debug("projectileHitEntity", `No se encontró configuración para el proyectil.`, { level: "warn", color: "yellow" });
    return;
  }

  try {
    if (cfg.pierce === Infinity) {
      debug(
        "projectileHitEntity",
        `Projectile: §b${projectile.typeId}§r. Pierce es Infinity. Solo aplicamos daño y knockback.`,
        { level: "debug", color: "green" }
      );
      applyDamageAndCfg(projectile, target, cfg, shooter);
      return;
    }

    let pierced = projectilePierceMap.get(projectile) ?? 0;
    const pierceLimit = cfg.pierce ?? 1;
    if (pierced >= pierceLimit) {
      debug(
        "projectileHitEntity",
        `Projectile: §b${projectile.typeId}§r. Pierce actual: ${pierced}. Límite de pierce: ${pierceLimit}`,
        { level: "debug", color: "blue" }
      );
      debug("projectileHitEntity", "Límite de pierce alcanzado. Eliminando proyectil.", { level: "debug", color: "blue" });
      return;
    }

    debug(
      "projectileHitEntity",
      `Projectile: §b${projectile.typeId}§r. Pierce actual: ${pierced}. Límite de pierce: ${pierceLimit}`,
      { level: "debug", color: "green" }
    );
    applyDamageAndCfg(projectile, target, cfg, shooter);

    projectilePierceMap.set(projectile, pierced + 1);
  } catch (e) {
    debug("projectileHitEntity", `Error general al aplicar daño: ${e}`, { level: "error", color: "red" });
  }
});

// No es llamado por entity.remove()
// Si acepta EntityDamageCause.override
world.afterEvents.entityDie.subscribe((event) => {
  const deadEntity = event.deadEntity;
  const cause = event.damageSource.cause;
  const deadEntityId = deadEntity.id;
  const entityType = deadEntity.typeId;
  debug("entityDie", `Entidad eliminada: §b${entityType}§r por: ${cause}`, { level: "debug", color: "light_purple" });
  try {
    interactMenuSessionStore.clearEntityFeedbackForAll(deadEntityId);
  } catch (e) {
    debug("entityDie", `Error limpiando interactMenu feedback: ${e}`, { level: "error", color: "red" });
  }
  try {
    entityHistoryStore.clearEntity(deadEntityId);
  } catch (e) {
    debug("entityDie", `Error limpiando entityHistory: ${e}`, { level: "error", color: "red" });
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
  debug("projectileSound", `Projectile: §b${entity.typeId}§r. Sound: ${cfg.sound}`, { level: "debug", color: "blue" });
});
