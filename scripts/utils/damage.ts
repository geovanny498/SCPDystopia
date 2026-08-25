// scripts\utils\damage.js
import * as mc from "@minecraft/server";
import { EntityDamageCause, type Entity } from "@minecraft/server";
import { debugMessage, debugWarn } from "./debug.js";
import { entityDamageConfig } from "./entityConfig.js";

/**
 * Aplicar daño y knockback a una entidad objetivo basado en la configuración del proyectil y la entidad.
 * @param projectile
 * @param target Entidad que recibe el daño
 * @param cfg Configuración de daño y knockback del proyectil
 * @param [shooter] Entidad que disparó el proyectil (opcional)
 *  */
export function applyDamageAndCfg(
  projectile: Entity,
  target: Entity,
  cfg: { damage?: number; knockback?: number },
  shooter?: Entity
) {
  debugWarn(
    `damage`,
    `Proyectil disparado por: ${shooter?.typeId ?? "desconocido/sin tirador"}, impacta objetivo: ${target.typeId}, proyectil: ${projectile.typeId}`,
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
    const dmg = getModifiedDamage(cfg.damage ?? 0, target);
    debugMessage(
      `damage`,
      `Aplicando ${dmg} de daño a ${target.typeId} (proyectil: ${projectile.typeId}, tirador: ${shooter?.typeId ?? "desconocido/sin tirador"})`,
      "green"
    );
    if (dmg > 0) {
      // Se evita damagingEntity para evitar knockback no configurable y caotico provocado por applyDamage junto con override, el soporte de bandos se hizo en scripts\utils\teams.ts y el de entidades en scripts\utils\entityConfig.ts
      target.applyDamage(dmg, {
        cause: EntityDamageCause.override,
        // damagingEntity: shooter,
        // damagingProjectile: projectile,
      });
      debugMessage(`damage`, `Daño aplicado correctamente a ${target.typeId}: ${dmg}`, "green");
    } else {
      debugWarn(`damage`, `Daño calculado es 0 o menor para ${target.typeId}. No se aplica daño.`, "yellow");
    }
  }
}
/**
 * Función de cálculo de daño para tener en cuenta la resistencia, armadura y encantamientos de la entidad.
 * @param damage
 * @param entity
 * @returns daño calculado
 */
export function getModifiedDamage(damage: number, entity: Entity) {
  if (damage <= 0) {
    debugMessage("modifiedDamageNumber", "Daño negativo o nulo, no se aplicará.");
    return 0;
  }

  const originalDamage = damage;

  try {
    // 1) Reducción por efecto de Resistencia
    const res = entity.getEffect("minecraft:resistance");
    if (res) {
      const reduction = (res.amplifier + 1) * 0.2;
      damage = Math.floor(damage * (1 - reduction));
      debugMessage(
        "modifiedDamageNumber",
        `Daño original: ${originalDamage} | Resistencia nivel ${res.amplifier + 1} (-${Math.round(reduction * 100)}%) => ${damage}`
      );
    }

    if (damage <= 0) {
      debugWarn("modifiedDamageNumber", "Daño final: 0 (anulado por resistencia)", "green");
      return 0;
    }

    // 2) Reducción por Armadura y Encantamientos
    const equippable = entity.getComponent("equippable");
    if (!equippable) {
      debugWarn("modifiedDamageNumber", `Daño final sin armadura: ${damage}`, "green");
      return damage;
    }

    let defensePoints = 0,
      armorToughness = 0,
      epf = 0;
    for (const slot of [mc.EquipmentSlot.Head, mc.EquipmentSlot.Chest, mc.EquipmentSlot.Legs, mc.EquipmentSlot.Feet]) {
      const item = equippable.getEquipment(slot);
      if (!item) continue;

      const eqComp = item.getComponent("equippable") as { defense?: number; armorToughness?: number } | null;
      defensePoints += eqComp?.defense ?? 0;
      armorToughness += eqComp?.armorToughness ?? 0;

      const ench = item.getComponent("enchantable");
      epf +=
        (ench?.getEnchantment("protection")?.level ?? 0) +
        (ench?.getEnchantment("projectile_protection")?.level ?? 0) * 2;
    }

    const armorReduction =
      Math.min(20, Math.max(defensePoints / 5, defensePoints - (4 * damage) / (armorToughness + 8))) / 25;
    damage = Math.floor(damage * (1 - armorReduction) - Math.min(20, epf) / 25);

    if (damage <= 0) {
      debugMessage("modifiedDamageNumber", "Daño final: 0 (anulado por armadura/encantamientos)");
      return 0;
    }

    debugMessage("modifiedDamageNumber", `Daño final tras armadura/encantamientos: ${damage}`);
    return damage;
  } catch (error) {
    const err = error as Error;
    debugWarn("modifiedDamageNumber", `Error al calcular el daño: ${err?.message ?? String(error)}`, "red");
    return damage; // Devolver el daño sin cambios en caso de error
  }
}
