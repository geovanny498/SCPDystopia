// main.js
import { world, system } from "@minecraft/server";
import { getTeam } from "./utils/teams.ts";
import { projectileConfig } from "./utils/projectileConfig.js";
import { applyDamageAndKnockback } from "./utils/damage.js";
import { debugMessage, debugWarn } from "./utils/debug.js";

const projectilePierceMap = new WeakMap();

// Evento cuando un proyectil impacta a una entidad
world.afterEvents.projectileHitEntity.subscribe((event) => {
  const projectile = event.projectile;
  const target = event.getEntityHit()?.entity;
  if (!projectile || !target) {
    debugWarn("projectileHitEntity", "Falta objeto necesario o es fuego amigo.", "yellow");
    return;
  }
  const shooter = event.source ? event.source : null;
  const teamShooter = getTeam(shooter);
  const teamTarget = getTeam(target);

  if (shooter && target.id === shooter.id) {
    debugWarn("projectileHitEntity", "El proyectil intentó dañar a su propio tirador. Cancelando daño.", "yellow");
    return;
  }

  // Verificación de equipo para evitar fuego amigo
  if (teamShooter && teamTarget && teamShooter === teamTarget) {
    debugWarn(
      "projectileHitEntity",
      `Fuego amigo detectado. Disparador: ${teamShooter}, Objetivo: ${teamTarget}`,
      "cyan"
    );
    return;
  }
  const cfg = projectileConfig[projectile.typeId];
  if (!cfg) {
    debugWarn("projectileHitEntity", "No se encontró configuración para el proyectil.", "red");
    return;
  }
  try {
    // Caso especial: Pierce infinito
    if (cfg.pierce === Infinity) {
      debugWarn("projectileHitEntity", "Pierce es Infinity. Solo aplicamos daño y knockback.", "green");
      applyDamageAndKnockback(projectile, target, cfg, shooter);
      return;
    }

    let pierced = projectilePierceMap.get(projectile) ?? 0;
    const pierceLimit = cfg.pierce ?? 1;
    if (pierced >= pierceLimit) {
      debugWarn("projectileHitEntity", `Pierce actual: ${pierced}. Límite de pierce: ${pierceLimit}`, "cyan");
      debugWarn("projectileHitEntity", "Límite de pierce alcanzado. Eliminando proyectil.", "cyan");
      return; // única manera actual de cancelar daño (no borra proyectil)
    }

    debugWarn("projectileHitEntity", `Pierce actual: ${pierced}. Límite de pierce: ${pierceLimit}`, "green");
    applyDamageAndKnockback(projectile, target, cfg, shooter);

    projectilePierceMap.set(projectile, pierced + 1);
  } catch (e) {
    debugWarn("projectileHitEntity", `Error general al aplicar daño: ${e}`, "red");
  }
});

world.afterEvents.entityRemove.subscribe((event) => {
  const removedEntityId = event.removedEntityId;
  const entityType = event.typeId;
  debugWarn("projectileHitEntity", `Entidad eliminada: ${entityType} Id: ${removedEntityId}`, "magenta");
});
