// scripts/commands/worldSave.ts
import { world } from "@minecraft/server";
import { systems as menuSystems } from "../gui/commandMenu/menu_config";
import { debugMessage, debugWarn } from "../utils/debug";

type SystemState = Record<string, unknown> | string | boolean | number | undefined;

/**
 * Guarda el estado de un sistema
 * @param {string} systemName
 * @param {Object} state
 */
export function saveSystemState(systemName: string, state: SystemState): void {
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
export function loadSystemState(systemName: string): SystemState | undefined {
  try {
    const prop = world.getDynamicProperty(`scpd_system_${systemName}`);
    if (!prop) return undefined;
    return JSON.parse(String(prop));
  } catch (err) {
    debugWarn("dynamicProperties", `[SCPDystopia] Error al cargar sistema ${systemName}: ${err}`, "red");
    return undefined;
  }
}

/**
 * Resetea las propiedades dinámicas de un único sistema a sus valores por defecto
 * @param {string} systemName
 */
export function resetOneSystemState(systemName: string): boolean {
  try {
    const systemConfig = menuSystems[systemName];
    if (!systemConfig?.dynamicProperty) return false;
    world.setDynamicProperty(systemConfig.dynamicProperty, undefined);
    return true;
  } catch (err) {
    console.warn(`[SCPDystopia] Error al reiniciar sistema ${systemName}: ${err}`);
    return false;
  }
}

/**
 * Resetea solo las propiedades dinámicas de los sistemas a sus valores por defecto
 */
export function resetAllSystemStates(): void {
  try {
    for (const systemConfig of Object.values(menuSystems)) {
      if (!systemConfig?.dynamicProperty) continue;
      world.setDynamicProperty(systemConfig.dynamicProperty, undefined);
    }
    console.log("[SCPDystopia] Propiedades dinámicas de sistemas reiniciadas a valores por defecto");
  } catch (err) {
    console.warn(`[SCPDystopia] Error al reiniciar propiedades de sistemas: ${err}`);
  }
}

/**
 * Resetea todos los sistemas guardados
 * NO hardcodea valores, usa los defaults de menu_config.js
 */
export function resetAllSystems(): void {
  try {
    // Limpiar todas las propiedades dinámicas
    world.clearDynamicProperties();

    console.log("[SCPDystopia] Todas las propiedades dinámicas limpiadas");
    console.log("[SCPDystopia] Los sistemas usarán valores por defecto de menu_config.js");
  } catch (err) {
    console.warn(`[SCPDystopia] Error al resetear todos los sistemas: ${err}`);
  }
}
