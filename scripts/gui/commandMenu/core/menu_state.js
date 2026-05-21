// scripts/gui/commandMenu/menu_state.js
import { saveSystemState, loadSystemState } from "../../../commands/worldSave.js";
import { getSystemConfig, getSystemDefaults, Factions, UnitHierarchy, SpecialGroups } from "../menu_config.js";
import { applySystemWithEvents } from "./menu_apply.js";
import { updateMenuSystemState } from "./menu_events.js";
import { debugWarn } from "../../../utils/debug.js";

/**
 * Carga el estado de un sistema desde propiedades dinámicas
 * Si no existe, retorna los valores por defecto
 */
export function loadSystemOrDefault(systemId) {
  const loaded = loadSystemState(systemId);
  if (loaded) return loaded;
  return getSystemDefaults(systemId);
}

/**
 * Carga los estados de múltiples sistemas
 */
export function loadSystemStates(systemIds) {
  const states = {};

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
function mergeSavedState(systemId, partialState) {
  const saved = loadSystemState(systemId) || {};
  const defaults = getSystemDefaults(systemId);
  const completed = {};

  for (const faction of [Factions.FOUNDATION, Factions.CHAOS]) {
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
      completed[faction][key] =
        partialState[faction]?.[key] !== undefined
          ? partialState[faction][key] // 1. Valor del formulario (jugador lo cambió)
          : saved[faction]?.[key] !== undefined
            ? saved[faction][key] // 2. Valor ya guardado en DP (mantener último)
            : defaults[faction]?.[key]; // 3. Default (nunca configurado)
    }
  }

  return completed;
}

/**
 * Guarda el estado de un sistema en propiedades dinámicas
 * y actualiza el estado compartido en memoria
 */
export function saveSystemAndUpdateMemory(systemId, state) {
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
export function saveSystemStates(parsedStates) {
  for (const systemId in parsedStates) {
    saveSystemAndUpdateMemory(systemId, parsedStates[systemId]);
  }
}

/**
 * Aplica un sistema a todas las entidades usando los eventos de la configuración
 */
export function applySystemToAll(systemId, dimension, player = null) {
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
 * Aplica múltiples sistemas
 */
export function applySystemsToAll(systemIds, dimension, player = null) {
  systemIds.forEach((systemId) => {
    applySystemToAll(systemId, dimension, player);
  });
}
