// scripts\utils\damage.js
import * as mc from "@minecraft/server";
import { applyKnockback } from "./knockback";
import { debugMessage, debugWarn } from "./debug.js";
import { entityDamageConfig } from "./entityConfig.js";
export function applyDamageAndKnockback(projectile, target, cfg, shooter) {
    var _a, _b;
    debugWarn(`damage`, `Proyectil disparado por: ${shooter.typeId}, impacta objetivo: ${target.typeId}, proyectil: ${projectile.typeId}`, "blue");
    const entityCfg = entityDamageConfig[target.typeId];
    const hasEntityCfg = !!entityCfg;
    const canDamage = hasEntityCfg && Object.prototype.hasOwnProperty.call(entityCfg, "damage")
        ? (typeof entityCfg.damage === "function"
            ? Boolean(entityCfg.damage(target))
            : Boolean(entityCfg.damage))
        : true; // por defecto true si no existe la propiedad
    const canKnockback = hasEntityCfg && Object.prototype.hasOwnProperty.call(entityCfg, "knockback")
        ? (typeof entityCfg.knockback === "function"
            ? Boolean(entityCfg.knockback(target))
            : Boolean(entityCfg.knockback))
        : true; // por defecto true si no existe la propiedad
    // DEBUG: mostrar información útil para verificar por qué una entidad recibe knockback
    try {
        debugWarn(`damage`, `entityCfg existe: ${hasEntityCfg}; tiene damage: ${hasEntityCfg && Object.prototype.hasOwnProperty.call(entityCfg, 'damage')}; tipo(damage): ${hasEntityCfg && typeof entityCfg.damage}; valor calculado canDamage: ${canDamage}`);
        debugWarn(`applyKnockback`, `tiene knockback: ${hasEntityCfg && Object.prototype.hasOwnProperty.call(entityCfg, 'knockback')}; tipo(knockback): ${hasEntityCfg && typeof entityCfg.knockback}; valor calculado canKnockback: ${canKnockback}`);
    }
    catch (e) {
        // no bloquear ejecución si falla el stringify o algo raro
        debugWarn(`damage`, `Error al loggear entityCfg: ${(_a = e === null || e === void 0 ? void 0 : e.message) !== null && _a !== void 0 ? _a : e}`, "red");
    }
    if (!canDamage) {
        debugWarn(`damage`, `Daño bloqueado para ${target.typeId}`, "purple");
    }
    else if (((_b = cfg.damage) !== null && _b !== void 0 ? _b : 0) > 0) {
        const dmg = getModifiedDamageNumber(cfg.damage, target);
        if (dmg > 0) {
            target.applyDamage(dmg, {
                cause: mc.EntityDamageCause.override,
                damagingEntity: shooter,
                damagingProjectile: projectile
            });
        }
    }
    if (!canKnockback) {
        debugWarn(`applyKnockback`, `Knockback bloqueado para ${target.typeId}`, "purple");
    }
    else {
        applyKnockback(target, projectile, cfg.knockback);
    }
}
// Función de cálculo de daño, la dejé igual
export function getModifiedDamageNumber(damage, entity) {
    var _a, _b, _c, _d, _e, _f;
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
            debugMessage("modifiedDamageNumber", `Daño original: ${originalDamage} | Resistencia nivel ${res.amplifier + 1} (-${Math.round(reduction * 100)}%) => ${damage}`);
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
        let defensePoints = 0, armorToughness = 0, epf = 0;
        for (const slot of [mc.EquipmentSlot.Head, mc.EquipmentSlot.Chest, mc.EquipmentSlot.Legs, mc.EquipmentSlot.Feet]) {
            const item = equippable.getEquipment(slot);
            if (!item)
                continue;
            const eqComp = item.getComponent("equippable");
            defensePoints += (_a = eqComp === null || eqComp === void 0 ? void 0 : eqComp.defense) !== null && _a !== void 0 ? _a : 0;
            armorToughness += (_b = eqComp === null || eqComp === void 0 ? void 0 : eqComp.armorToughness) !== null && _b !== void 0 ? _b : 0;
            const ench = item.getComponent("enchantable");
            epf += ((_d = (_c = ench === null || ench === void 0 ? void 0 : ench.getEnchantment("protection")) === null || _c === void 0 ? void 0 : _c.level) !== null && _d !== void 0 ? _d : 0) + ((_f = (_e = ench === null || ench === void 0 ? void 0 : ench.getEnchantment("projectile_protection")) === null || _e === void 0 ? void 0 : _e.level) !== null && _f !== void 0 ? _f : 0) * 2;
        }
        const armorReduction = Math.min(20, Math.max(defensePoints / 5, defensePoints - (4 * damage) / (armorToughness + 8))) / 25;
        damage = Math.floor(damage * (1 - armorReduction) - Math.min(20, epf) / 25);
        if (damage <= 0) {
            debugMessage("modifiedDamageNumber", "Daño final: 0 (anulado por armadura/encantamientos)");
            return 0;
        }
        debugMessage("modifiedDamageNumber", `Daño final tras armadura/encantamientos: ${damage}`);
        return damage;
    }
    catch (error) {
        debugWarn("modifiedDamageNumber", `Error al calcular el daño: ${error.message}`, "red");
        return damage; // Devolver el daño sin cambios en caso de error
    }
}
//# sourceMappingURL=damage.js.map