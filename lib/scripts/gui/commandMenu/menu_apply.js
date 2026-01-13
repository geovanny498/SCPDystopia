// scripts/gui/commandMenu/menu_apply.js
import { world } from "@minecraft/server";
import { debugWarn } from "../../utils/debug.js";
import { ControlType, getSystemEvents } from "./menu_config.js";
import { canApplySystem } from "./menu_rules.js";
import { getEntityFactionInfo, isValidSoldier } from "./menu_faction.js";
import { loadScope, isEntityInScope } from "./menu_scope.js";
// Importar funciones de menu_events (se inyectarán para evitar ciclos)
let getMenuSystemStates = null;
let getMenuSoldiers = null;
let getMenuSpecialSoldiers = null;
/**
 * Inyecta las funciones de menu_events para evitar importaciones circulares
 */
export function injectMenuEventAccessors(accessors) {
    getMenuSystemStates = accessors.getMenuSystemStates;
    getMenuSoldiers = accessors.getMenuSoldiers;
    getMenuSpecialSoldiers = accessors.getMenuSpecialSoldiers;
}
/**
 * Trigger seguro de eventos en entidades
 * @param {Entity} ent
 * @param {string} eventName
 */
function safeTriggerEvent(ent, eventName) {
    if (!ent || !eventName)
        return;
    try {
        ent.triggerEvent(eventName);
    }
    catch (e) {
        debugWarn("menuApply:entity", `Error en evento ${eventName}: ${e}`, "red");
    }
}
// isValidSoldier ahora se importa desde menu_faction.js
/**
 * Aplica un sistema a una entidad específica usando eventos de la configuración
 * IMPORTANTE: Esta función NO verifica el scope. El llamador debe verificar isEntityInScope() antes de llamar.
 * @param {string} systemId
 * @param {Object} systemConfig
 * @param {Entity} ent
 * @param {Object} stateOverride - Estado opcional (si no se pasa, usa el de memoria)
 * @param {boolean} skipCompatibilityCheck - Si es true, omite la verificación de compatibilidad
 * @param {string} factionOverride - Facción pre-calculada (opcional, para optimización)
 * @param {boolean} isSpecialOverride - Si es especial pre-calculado (opcional, para optimización)
 */
export function applySystemToEntity(systemId, systemConfig, ent, stateOverride = null, skipCompatibilityCheck = false, factionOverride = null, isSpecialOverride = null) {
    var _a;
    try {
        const specials = getMenuSpecialSoldiers ? getMenuSpecialSoldiers() : { foundation: [], chaos: [] };
        if (!ent || !isValidSoldier(ent, specials))
            return;
        const systemStates = getMenuSystemStates ? getMenuSystemStates() : {};
        const state = stateOverride || systemStates[systemId];
        if (!state) {
            debugWarn("menuApply:entity", `Sistema ${systemId}: Sin estado configurado`, "red");
            return;
        }
        // Usar facción pre-calculada o calcularla
        let faction, isSpecial;
        if (factionOverride !== null && isSpecialOverride !== null) {
            faction = factionOverride;
            isSpecial = isSpecialOverride;
        }
        else {
            // Determinar el bando y si es especial usando el módulo centralizado
            const factionInfo = getEntityFactionInfo(ent, specials);
            if (!factionInfo) {
                debugWarn("menuApply:entity", `${ent.nameTag || ent.typeId}: No se pudo determinar facción`, "red");
                return;
            }
            faction = factionInfo.faction;
            isSpecial = factionInfo.isSpecial;
        }
        const nameTag = (_a = ent.nameTag) !== null && _a !== void 0 ? _a : "";
        // Verificar compatibilidad con otros sistemas (a menos que se omita explícitamente)
        if (!skipCompatibilityCheck) {
            const allStates = stateOverride ? Object.assign(Object.assign({}, systemStates), { [systemId]: stateOverride }) : systemStates;
            const result = canApplySystem(systemId, allStates, faction, isSpecial);
            if (!result.canApply) {
                debugWarn("menuApply:entity", `${systemId} → ${nameTag}: NO aplicado (${result.reason})`, "yellow");
                return;
            }
        }
        const factionState = state[faction];
        if (!factionState) {
            debugWarn("menuApply:entity", `Sistema ${systemId}: Sin configuración para ${faction}`, "red");
            return;
        }
        // Aplicar según el tipo de control
        if (systemConfig.controlType === ControlType.TOGGLE) {
            // Para toggle, determinar si está habilitado
            const isEnabled = isSpecial
                ? factionState.includeSpecial
                : factionState.enable;
            // Obtener eventos
            const events = getSystemEvents(systemId, isEnabled);
            if (events.event) {
                safeTriggerEvent(ent, events.event);
                debugWarn("menuApply:entity", `${systemId} → ${nameTag} [${faction}${isSpecial ? '-especial' : '-normal'}]: ${isEnabled ? 'ON' : 'OFF'}`, isEnabled ? "green" : "gray");
            }
            else {
                debugWarn("menuApply:entity", `Sistema ${systemId}: Sin evento configurado`, "yellow");
            }
        }
        else if (systemConfig.controlType === ControlType.DROPDOWN) {
            // Para dropdown, obtener el modo seleccionado
            const mode = isSpecial
                ? factionState.includeSpecial
                : factionState.mode;
            // Obtener eventos para este modo
            const events = getSystemEvents(systemId, mode);
            // Primero detener cualquier modo anterior
            if (events.stop) {
                safeTriggerEvent(ent, events.stop);
            }
            // Luego iniciar el nuevo modo (si no es "false" u "off")
            if (events.start && mode !== "false" && mode !== "off") {
                safeTriggerEvent(ent, events.start);
                debugWarn("menuApply:entity", `${systemId} → ${nameTag} [${faction}${isSpecial ? '-especial' : '-normal'}]: modo=${mode}`, "green");
            }
            else {
                debugWarn("menuApply:entity", `${systemId} → ${nameTag} [${faction}${isSpecial ? '-especial' : '-normal'}]: desactivado`, "gray");
            }
        }
    }
    catch (e) {
        debugWarn("menuApply:entity", `Error aplicando ${systemId} a ${(ent === null || ent === void 0 ? void 0 : ent.nameTag) || "<noName>"}: ${e}`, "red");
    }
}
/**
 * Aplica un sistema a todas las entidades usando eventos de la configuración
 * @param {string} systemId
 * @param {Object} systemConfig
 * @param {Dimension} dimension
 */
export function applySystemWithEvents(systemId, systemConfig, dimension = null) {
    var _a, _b, _c;
    try {
        const seen = new Set();
        let appliedCount = 0;
        let skippedCount = 0;
        const specials = getMenuSpecialSoldiers ? getMenuSpecialSoldiers() : { foundation: [], chaos: [] };
        // Cargar scope una sola vez para optimización
        const scope = loadScope();
        debugWarn("menuApply", `=== Aplicando sistema ${systemId} ===`, "cyan");
        debugWarn("menuApply", `Scope actual: ${JSON.stringify(scope)}`, "gray");
        // 1) Escanear entidades en la dimensión solicitada o en todas
        const dims = dimension
            ? [dimension]
            : ["overworld", "nether", "the_end"].map(id => world.getDimension(id)).filter(Boolean);
        for (const dim of dims) {
            const ents = dim.getEntities();
            for (const ent of ents) {
                if (!ent || !ent.id)
                    continue;
                if (seen.has(ent.id))
                    continue;
                seen.add(ent.id);
                if (!isValidSoldier(ent, specials))
                    continue;
                // Verificar si está en scope antes de aplicar
                const factionInfo = getEntityFactionInfo(ent, specials);
                if (!factionInfo)
                    continue;
                const { faction, isSpecial } = factionInfo;
                const nameTag = (_a = ent.nameTag) !== null && _a !== void 0 ? _a : "";
                if (!isEntityInScope(ent, faction, isSpecial, nameTag, scope)) {
                    skippedCount++;
                    continue;
                }
                applySystemToEntity(systemId, systemConfig, ent, null, false);
                appliedCount += 1;
            }
        }
        // 2) Procesar lista auxiliar de soldados conocida
        const allSoldiers = getMenuSoldiers ? getMenuSoldiers() : null;
        if (Array.isArray(allSoldiers)) {
            for (const id of allSoldiers) {
                if (seen.has(id))
                    continue;
                try {
                    const ent = world.getEntity(id);
                    if (!ent)
                        continue;
                    seen.add(id);
                    if (!isValidSoldier(ent, specials))
                        continue;
                    // Verificar si está en scope antes de aplicar
                    const factionInfo = getEntityFactionInfo(ent, specials);
                    if (!factionInfo)
                        continue;
                    const { faction, isSpecial } = factionInfo;
                    const nameTag = (_b = ent.nameTag) !== null && _b !== void 0 ? _b : "";
                    if (!isEntityInScope(ent, faction, isSpecial, nameTag, scope)) {
                        skippedCount++;
                        continue;
                    }
                    applySystemToEntity(systemId, systemConfig, ent, null, false);
                    appliedCount += 1;
                }
                catch (_d) { }
            }
        }
        const dimLabel = dimension ? ((_c = dimension === null || dimension === void 0 ? void 0 : dimension.id) !== null && _c !== void 0 ? _c : "custom") : "all";
        debugWarn("menuApply", `Sistema ${systemId} aplicado a ${appliedCount} entidades (${skippedCount} fuera de scope) en dim=${dimLabel}`, "green");
    }
    catch (e) {
        debugWarn("menuApply", `Error en applySystemWithEvents(${systemId}): ${e}`, "red");
    }
}
//# sourceMappingURL=menu_apply.js.map