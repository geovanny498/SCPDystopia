// scripts\utils\damage.js
import * as mc from "@minecraft/server";
import { EntityDamageCause, type Entity } from "@minecraft/server";
import { debug } from "./debug.js";
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
  debug(
    "damage",
    `Proyectil disparado por: §b${shooter?.typeId ?? "desconocido/sin tirador"}§r, impacta objetivo: §b${target.typeId}§r, proyectil: §b${projectile.typeId}§r`,
    { level: "debug", color: "blue" }
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
    debug(
      "damage",
      `entityCfg existe: §6${hasEntityCfg}§r; tiene damage: §6${hasEntityCfg && Object.prototype.hasOwnProperty.call(entityCfg, "damage")}§r; tipo(damage): §6${hasEntityCfg && typeof entityCfg.damage}§r; valor calculado canDamage: §6${canDamage}§r`,
      { level: "debug", color: "gray" }
    );
    debug(
      "applyKnockback",
      `tiene knockback: §6${hasEntityCfg && Object.prototype.hasOwnProperty.call(entityCfg, "knockback")}§r; tipo(knockback): §6${hasEntityCfg && typeof entityCfg.knockback}§r; valor calculado canKnockback: §6${canKnockback}§r`,
      { level: "debug", color: "gray" }
    );
  } catch (e) {
    // no bloquear ejecución si falla el stringify o algo raro
    const err = e as Error;
    debug("damage", `Error al loggear entityCfg: ${err?.message ?? String(e)}§r`, {
      level: "error",
      color: "red",
    });
  }

  if (!canDamage) {
    debug("damage", `Daño bloqueado para §b${target.typeId}§r`, { level: "warn", color: "yellow" });
  } else {
    const dmg = getModifiedDamage(cfg.damage ?? 0, target);
    debug(
      "damage",
      `Aplicando §6${dmg}§r de daño a §b${target.typeId}§r (proyectil: §b${projectile.typeId}§r, tirador: §b${shooter?.typeId ?? "desconocido/sin tirador"}§r)`,
      { level: "debug", color: "blue" }
    );
    if (dmg > 0) {
      // Se evita damagingEntity para evitar knockback no configurable y caotico provocado por applyDamage junto con override, el soporte de bandos se hizo en scripts\utils\teams.ts y el de entidades en scripts\utils\entityConfig.ts
      target.applyDamage(dmg, {
        cause: EntityDamageCause.override,
        // damagingEntity: shooter,
        // damagingProjectile: projectile,
      });
      debug("damage", `Daño aplicado correctamente a §b${target.typeId}§r: §6${dmg}§r`, {
        level: "debug",
        color: "green",
      });
    } else {
      debug("damage", `Daño calculado es §c0 o menor§r para §b${target.typeId}§r. No se aplica daño.§r`, {
        level: "warn",
        color: "yellow",
      });
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
    debug("modifiedDamageNumber", "Daño §cnegativo o nulo§r, no se aplicará.§r", {
      level: "warn",
      color: "yellow",
    });
    return 0;
  }

  const originalDamage = damage;

  try {
    // 1) Reducción por efecto de Resistencia
    const res = entity.getEffect("minecraft:resistance");
    if (res) {
      const reduction = (res.amplifier + 1) * 0.2;
      damage = Math.floor(damage * (1 - reduction));
      debug(
        "modifiedDamageNumber",
        `Daño original: §6${originalDamage}§r | Resistencia nivel §6${res.amplifier + 1}§r (-§6${Math.round(reduction * 100)}%§r) => §6${damage}§r`,
        { level: "debug", color: "gray" }
      );
    }

    if (damage <= 0) {
      debug("modifiedDamageNumber", `Daño final: §60§r (anulado por §aresistencia§r)§r`, {
        level: "debug",
        color: "blue",
      });
      return 0;
    }

    // 2) Reducción por Armadura y Encantamientos
    const equippable = entity.getComponent("equippable");
    if (!equippable) {
      debug("modifiedDamageNumber", `Daño final sin armadura: §6${damage}§r`, {
        level: "debug",
        color: "blue",
      });
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
      debug("modifiedDamageNumber", `Daño final: §60§r (anulado por §aarmadura/encantamientos§r)§r`, {
        level: "debug",
        color: "blue",
      });
      return 0;
    }

    debug("modifiedDamageNumber", `Daño final tras armadura/encantamientos: §6${damage}§r`, {
      level: "debug",
      color: "blue",
    });
    return damage;
  } catch (error) {
    const err = error as Error;
    debug("modifiedDamageNumber", `Error al calcular el daño: ${err?.message ?? String(error)}§r`, {
      level: "error",
      color: "red",
    });
    return damage; // Devolver el daño sin cambios en caso de error
  }
}
