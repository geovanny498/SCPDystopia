// scripts\utils\damage.js
import * as mc from "@minecraft/server";
import { EntityDamageCause, type Entity } from "@minecraft/server";
import { debugMessage, debugWarn } from "./debug.js";
import { entityDamageConfig } from "./entityConfig.js";

export function applyDamageAndCfg(
  projectile: Entity,
  target: Entity,
  cfg: { damage?: number; knockback?: number },
  shooter: Entity
) {
  debugWarn(
    `damage`,
    `Proyectil disparado por: ${shooter.typeId}, impacta objetivo: ${target.typeId}, proyectil: ${projectile.typeId}`,
    "blue"
  );

  const entityCfg = entityDamageConfig[target.typeId];
  const hasEntityCfg = !!entityCfg;

  const canDamage =
    hasEntityCfg && Object.prototype.hasOwnProperty.call(entityCfg, "damage")
      ? typeof entityCfg.damage === "function"
        ? Boolean(entityCfg.damage(target))
        : Boolean(entityCfg.damage)
      : true; // por defecto true si no existe la propiedad

  const canKnockback =
    hasEntityCfg && Object.prototype.hasOwnProperty.call(entityCfg, "knockback")
      ? typeof entityCfg.knockback === "function"
        ? Boolean(entityCfg.knockback(target))
        : Boolean(entityCfg.knockback)
      : true; // por defecto true si no existe la propiedad

  // DEBUG: mostrar información útil para verificar por qué una entidad recibe knockback
  try {
    debugWarn(
      `damage`,
      `entityCfg existe: ${hasEntityCfg}; tiene damage: ${hasEntityCfg && Object.prototype.hasOwnProperty.call(entityCfg, "damage")}; tipo(damage): ${hasEntityCfg && typeof entityCfg.damage}; valor calculado canDamage: ${canDamage}`
    );
    debugWarn(
      `applyKnockback`,
      `tiene knockback: ${hasEntityCfg && Object.prototype.hasOwnProperty.call(entityCfg, "knockback")}; tipo(knockback): ${hasEntityCfg && typeof entityCfg.knockback}; valor calculado canKnockback: ${canKnockback}`
    );
  } catch (e) {
    // no bloquear ejecución si falla el stringify o algo raro
    const err = e as Error;
    debugWarn(`damage`, `Error al loggear entityCfg: ${err?.message ?? String(e)}`, "red");
  }

  if (!canDamage) {
    debugWarn(`damage`, `Daño bloqueado para ${target.typeId}`, "purple");
  } else {
    const dmg = cfg.damage ?? 0;
    debugMessage(
      `damage`,
      `Aplicando ${dmg} de daño a ${target.typeId} (proyectil: ${projectile.typeId}, tirador: ${shooter.typeId})`,
      "green"
    );
    if (dmg > 0) {
      target.applyDamage(dmg, {
        damagingEntity: shooter,
        damagingProjectile: projectile,
      });
      debugMessage(`damage`, `Daño aplicado correctamente a ${target.typeId}: ${dmg}`, "green");
    } else {
      debugWarn(`damage`, `Daño calculado es 0 o menor para ${target.typeId}. No se aplica daño.`, "yellow");
    }
  }
}
