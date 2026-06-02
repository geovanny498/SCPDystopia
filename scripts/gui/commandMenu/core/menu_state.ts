// scripts/gui/commandMenu/menu_state.ts
import { world } from "@minecraft/server";
import { saveSystemState, loadSystemState } from "../../../commands/worldSave.js";
import { getSystemConfig, getSystemDefaults, Factions, UnitHierarchy, SpecialGroups } from "../menu_config.js";
import { applySystemWithEvents, getEligibleSoldiers, applySystemsToEntities, getMenuSystemStates } from "./menu_apply.js";
import { updateMenuSystemState } from "./menu_events.js";
import { debugWarn } from "../../../utils/debug.js";
import { loadScope } from "../model/menu_scope.js";

/**
 * Carga el estado de un sistema desde propiedades dinámicas
 * Si no existe, retorna los valores por defecto
 */
export function loadSystemOrDefault(systemId: string): any {
  const loaded = loadSystemState(systemId);
  if (loaded) return loaded;
  return getSystemDefaults(systemId);
}

/**
 * Carga los estados de múltiples sistemas
 */
export function loadSystemStates(systemIds: string[]): any {
  const states: any = {};

  systemIds.forEach((systemId) => {
    states[systemId] = loadSystemOrDefault(systemId);
  });

  return states;
}

/**
 * Fusiona el estado parcial del formulario con el estado ya guardado en el DP
 * y con los defaults como último recurso.
 *
 * Garantiza que todas las jerarquías y grupos queden presentes en el objeto final,
 * incluso si el formulario no mostró algunos grupos (por no tener entidades activas).
 *
 * Prioridad: formulario > DP guardado > defaults
 */
function mergeSavedState(systemId: string, partialState: any): any {
  const saved: any = loadSystemState(systemId) || {};
  const defaults: any = getSystemDefaults(systemId);
  const completed: any = {};

  const factions = [Factions.FOUNDATION, Factions.CHAOS] as const;

  for (const faction of factions) {
    completed[faction] = {};

    const sourceGroups = [
      UnitHierarchy.BASIC,
      UnitHierarchy.LEADER,
      UnitHierarchy.COMMANDER,
      SpecialGroups.GROUP_A,
      SpecialGroups.GROUP_B,
      SpecialGroups.GROUP_C,
      SpecialGroups.GROUP_D,
      SpecialGroups.NO_GROUP,
    ];

    for (const key of sourceGroups) {
      const partialFaction = partialState[faction] || {};
      const savedFaction = saved[faction] || {};
      const defaultsFaction = defaults[faction] || {};

      completed[faction][key] =
        partialFaction[key] !== undefined
          ? partialFaction[key] // 1. Valor del formulario (jugador lo cambió)
          : savedFaction[key] !== undefined
            ? savedFaction[key] // 2. Valor ya guardado en DP (mantener último)
            : defaultsFaction[key]; // 3. Default (nunca configurado)
    }
  }

  return completed;
}

/**
 * Guarda el estado de un sistema en propiedades dinámicas
 * y actualiza el estado compartido en memoria
 */
export function saveSystemAndUpdateMemory(systemId: string, state: any): void {
  try {
    // Fusionar con estado guardado en DP para preservar valores de grupos sin entidades
    const completeState = mergeSavedState(systemId, state);

    // Guardar en propiedades dinámicas (estado COMPLETO)
    saveSystemState(systemId, completeState);

    // Actualizar estado en memoria del menú (estado COMPLETO)
    updateMenuSystemState(systemId, completeState);

    debugWarn("menuState", `Sistema ${systemId} guardado y actualizado en memoria`, "green");
  } catch (e) {
    debugWarn("menuState", `Error guardando sistema ${systemId}: ${e}`, "red");
  }
}

/**
 * Guarda los estados de múltiples sistemas
 */
export function saveSystemStates(parsedStates: any): void {
  for (const systemId in parsedStates) {
    saveSystemAndUpdateMemory(systemId, parsedStates[systemId]);
  }
}

/**
 * Aplica un sistema a todas las entidades usando los eventos de la configuración
 */
export function applySystemToAll(systemId: string, dimension: any = null, player: any = null): void {
  try {
    const systemConfig = getSystemConfig(systemId);
    if (!systemConfig) {
      debugWarn("menuState", `Sistema ${systemId} no encontrado en configuración`, "red");
      return;
    }

    applySystemWithEvents(systemId, systemConfig, dimension, player);
    debugWarn("menuState", `Sistema ${systemId} aplicado`, "green");
  } catch (e) {
    debugWarn("menuState", `Error aplicando sistema ${systemId}: ${e}`, "red");
  }
}

/**
 * Aplica múltiples sistemas de forma optimizada usando una única consulta de entidades
 */
export function applySystemsToAll(systemIds: string[], dimension: any = null, player: any = null): void {
  try {
    const dims = dimension
      ? [dimension]
      : ["overworld", "nether", "the_end"].map((id) => world.getDimension(id)).filter(Boolean);
    const scope = loadScope();

    // Log para diagnosticar estados
    const cachedStates = getMenuSystemStates ? getMenuSystemStates() : {};
    debugWarn("menuState", `[applySystemsToAll] systemIds=${JSON.stringify(systemIds)}`, "yellow");
    debugWarn("menuState", `[applySystemsToAll] cachedStates keys=${JSON.stringify(Object.keys(cachedStates))}`, "dark_gray");

    // PRECOMPUTAR ESTADOS PARA OPTIMIZACIÓN MASIVA
    const cached = {
      systemStates: cachedStates,
    };

    // 1. Obtener soldados elegibles (una sola vez)
    const eligible = getEligibleSoldiers(dims as any, scope);
    debugWarn("menuState", `[applySystemsToAll] eligible=${eligible.length} entidades`, "cyan");

    // 2. Aplicar todos los sistemas elegidos (en un solo pase) con caché precomputado
    applySystemsToEntities(eligible, systemIds, { player, cached });

    debugWarn("menuState", `Sistemas ${systemIds.join(", ")} aplicados a ${eligible.length} entidades`, "green");
  } catch (e) {
    debugWarn("menuState", `Error en applySystemsToAll: ${e}`, "red");
  }
}
