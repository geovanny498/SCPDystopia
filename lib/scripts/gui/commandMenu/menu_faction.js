// scripts/gui/commandMenu/menu_faction.js
import { getTeam } from "../../utils/teams.js";
/**
 * Módulo centralizado para determinar el bando, facción y si una entidad es especial
 *
 * Este módulo evita duplicación de código en menu_events.js y menu_apply.js
 */
/**
 * Determina el bando, facción y si una entidad es especial
 * @param {Entity} ent - La entidad a evaluar
 * @param {Object} specialUnits - Objeto con arrays de unidades especiales { foundation: [], chaos: [] }
 * @returns {Object|null} - { faction: string, isSpecial: boolean } o null si no se pudo determinar
 */
export function getEntityFactionInfo(ent, specialUnits) {
    var _a, _b, _c, _d, _e;
    if (!ent)
        return null;
    const name = (_a = ent.nameTag) !== null && _a !== void 0 ? _a : "";
    // Usar la lista plana .all para compatibilidad
    const isSpecialFoundation = (_c = (_b = specialUnits === null || specialUnits === void 0 ? void 0 : specialUnits.foundation) === null || _b === void 0 ? void 0 : _b.all) === null || _c === void 0 ? void 0 : _c.includes(name);
    const isSpecialChaos = (_e = (_d = specialUnits === null || specialUnits === void 0 ? void 0 : specialUnits.chaos) === null || _d === void 0 ? void 0 : _d.all) === null || _e === void 0 ? void 0 : _e.includes(name);
    let faction = null;
    let isSpecial = false;
    if (isSpecialFoundation) {
        faction = "foundation";
        isSpecial = true;
    }
    else if (isSpecialChaos) {
        faction = "chaos";
        isSpecial = true;
    }
    else {
        faction = getTeam(ent);
        isSpecial = false;
    }
    if (!faction)
        return null;
    return { faction, isSpecial };
}
/**
 * Verifica si una entidad es un soldado válido
 * @param {Entity} ent
 * @param {Object} specialUnits - Objeto con arrays de unidades especiales { foundation: [], chaos: [] }
 * @returns {boolean}
 */
export function isValidSoldier(ent, specialUnits) {
    var _a, _b, _c, _d, _e;
    if (!ent)
        return false;
    if (ent.typeId === "minecraft:player")
        return false;
    const name = (_a = ent.nameTag) !== null && _a !== void 0 ? _a : "";
    // Verificar si es especial usando la lista plana .all
    if ((_c = (_b = specialUnits === null || specialUnits === void 0 ? void 0 : specialUnits.foundation) === null || _b === void 0 ? void 0 : _b.all) === null || _c === void 0 ? void 0 : _c.includes(name))
        return true;
    if ((_e = (_d = specialUnits === null || specialUnits === void 0 ? void 0 : specialUnits.chaos) === null || _d === void 0 ? void 0 : _d.all) === null || _e === void 0 ? void 0 : _e.includes(name))
        return true;
    // Verificar si pertenece a un bando
    const team = getTeam(ent);
    return team === "foundation" || team === "chaos";
}
//# sourceMappingURL=menu_faction.js.map