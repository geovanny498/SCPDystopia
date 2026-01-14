// scripts/commands/worldSave.js
import { world } from "@minecraft/server";
import { debugMessage, debugWarn } from "../utils/debug";

/**
 * Guarda el estado de un sistema
 * @param {string} systemName
 * @param {Object} state
 */
export function saveSystemState(systemName, state) {
  try {
    const propName = `scpd_system_${systemName}`;
    world.setDynamicProperty(propName, JSON.stringify(state));
    debugMessage("dynamicProperties", `[SCPDystopia] Propiedad guardada: ${propName}`, "blue");
  } catch (err) {
    debugWarn("dynamicProperties", `[SCPDystopia] Error al guardar sistema ${systemName}: ${err}`, "red");
  }
}

/**
 * Carga el estado de un sistema
 * @param {string} systemName
 * @returns {Object|undefined}
 */
export function loadSystemState(systemName) {
  try {
    const prop = world.getDynamicProperty(`scpd_system_${systemName}`);
    if (!prop) return undefined;
    return JSON.parse(prop);
  } catch (err) {
    debugWarn("dynamicProperties", `[SCPDystopia] Error al cargar sistema ${systemName}: ${err}`, "red");
    return undefined;
  }
}

/**
 * Resetea todos los sistemas guardados
 * NO hardcodea valores, usa los defaults de menu_config.js
 */
export function resetAllSystems() {
  try {
    // Limpiar todas las propiedades dinámicas
    world.clearDynamicProperties();

    console.log("[SCPDystopia] Todas las propiedades dinámicas limpiadas");
    console.log("[SCPDystopia] Los sistemas usarán valores por defecto de menu_config.js");
  } catch (err) {
    console.warn(`[SCPDystopia] Error al resetear todos los sistemas: ${err}`);
  }
}
