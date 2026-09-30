// scripts/gui/commandMenu/menu_state.ts
import { world, Dimension, Player } from "@minecraft/server";
import { saveSystemState, loadSystemState } from "../../../commands/worldSave.js";
import { getSystemDefaults, Factions, UnitHierarchy, SpecialGroups } from "../menu_config.js";
import {
  getEligibleSoldiers,
  applySystemsToEntities,
  getMenuSystemStates,
} from "./menu_apply.js";
import { updateMenuSystemState } from "./menu_events.js";
import { debug } from "../../../utils/debug.js";
import { loadScope } from "../model/menu_scope.js";
import type { AllSystemStates, SystemFactionState, SystemState } from "../model/menu_system_state.js";

/**
 * Lee un estado persistido conservando la validación superficial histórica.
 * La aserción concentra la confianza en datos deserializados sin imponer una
 * validación profunda que cambiaría la tolerancia actual a estados antiguos.
 *
 * @param systemId - ID textual de la propiedad dinámica del sistema.
 * @returns Estado persistido o `undefined` si falta o no es un objeto.
 */
function loadPersistedSystemState(systemId: string): SystemState | undefined {
  const loaded = loadSystemState(systemId);
  if (loaded && typeof loaded === "object") return loaded as SystemState;
  return undefined;
}

/**
 * Carga el estado de un sistema desde propiedades dinámicas
 * Si no existe, retorna los valores por defecto
 *
 * @param systemId - ID del sistema que se cargará.
 * @returns Estado persistido o defaults del catálogo.
 */
export function loadSystemOrDefault(systemId: string): SystemState {
  const loaded = loadPersistedSystemState(systemId);
  if (loaded) return loaded;
  return getSystemDefaults(systemId);
}

/**
 * Carga los estados de múltiples sistemas
 *
 * @param systemIds - IDs de los sistemas que se cargarán.
 * @returns Colección dispersa de estados indexada por ID.
 */
export function loadSystemStates(systemIds: string[]): AllSystemStates {
  const states: AllSystemStates = {};

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
function mergeSavedState(systemId: string, partialState: SystemState): SystemState {
  const saved: SystemState = loadPersistedSystemState(systemId) || {};
  const defaults: SystemState = getSystemDefaults(systemId);
  const completed: SystemState = {};

  const factions = [Factions.FOUNDATION, Factions.CHAOS] as const;

  for (const faction of factions) {
    const partialFaction: SystemFactionState = partialState[faction] || {};
    const savedFaction: SystemFactionState = saved[faction] || {};
    const defaultsFaction: SystemFactionState = defaults[faction] || {};
    const completedFaction: SystemFactionState = {};

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
      completedFaction[key] =
        partialFaction[key] !== undefined
          ? partialFaction[key] // 1. Valor del formulario (jugador lo cambió)
          : savedFaction[key] !== undefined
            ? savedFaction[key] // 2. Valor ya guardado en DP (mantener último)
            : defaultsFaction[key]; // 3. Default (nunca configurado)
    }
    completed[faction] = completedFaction;
  }

  return completed;
}

/**
 * Guarda el estado de un sistema en propiedades dinámicas
 * y actualiza el estado compartido en memoria
 *
 * @param systemId - ID textual del sistema que se persistirá.
 * @param state - Estado completo o parcial recibido desde DDUI.
 * @returns No devuelve ningún valor.
 */
export function saveSystemAndUpdateMemory(systemId: string, state: SystemState): void {
  try {
    // Fusionar con estado guardado en DP para preservar valores de grupos sin entidades
    const completeState = mergeSavedState(systemId, state);

    // Guardar en propiedades dinámicas (estado COMPLETO)
    saveSystemState(systemId, completeState);

    // Actualizar estado en memoria del menú (estado COMPLETO)
    updateMenuSystemState(systemId, completeState);

    debug("menuState", `Sistema §b${systemId}§r guardado y actualizado en memoria`, {
      level: "debug",
      color: "light_purple",
    });
  } catch (e) {
    debug("menuState", `§cError§r guardando sistema §b${systemId}§r: ${e}`, { level: "error", color: "red" });
  }
}

/**
 * Guarda los estados de múltiples sistemas
 *
 * @param parsedStates - Colección dispersa de estados a persistir.
 * @returns No devuelve ningún valor.
 */
export function saveSystemStates(parsedStates: AllSystemStates): void {
  for (const systemId in parsedStates) {
    const state = parsedStates[systemId];
    if (!state) continue;
    saveSystemAndUpdateMemory(systemId, state);
  }
}

/**
 * Aplica múltiples sistemas de forma optimizada usando una única consulta de entidades
 * @param systemIds - Lista de IDs de sistemas a aplicar
 * @param dimension - Dimensión opcional para filtrar entidades
 * @param player - Jugador opcional para contexto de aplicación
 */
export function applySystemsToAll(
  systemIds: string[],
  dimension: Dimension | null = null,
  player: Player | null = null
): void {
  try {
    const dims = dimension
      ? [dimension]
      : ["overworld", "nether", "the_end"].map((id) => world.getDimension(id)).filter(Boolean);
    const scope = loadScope();

    // Log para diagnosticar estados
    const cachedStates = getMenuSystemStates ? getMenuSystemStates() : {};
    debug("menuState", `[applySystemsToAll] systemIds=§b${JSON.stringify(systemIds)}§r`, {
      level: "debug",
      color: "gray",
    });
    debug("menuState", `[applySystemsToAll] cachedStates keys=${JSON.stringify(Object.keys(cachedStates))}`, {
      level: "debug",
      color: "dark_gray",
    });

    // PRECOMPUTAR ESTADOS PARA OPTIMIZACIÓN MASIVA
    const cached = {
      systemStates: cachedStates,
    };

    // 1. Obtener soldados elegibles (una sola vez)
    const eligible = getEligibleSoldiers(dims, scope);
    debug("menuState", `[applySystemsToAll] eligible=§b${eligible.length}§r entidades`, {
      level: "debug",
      color: "gray",
    });

    // 2. Aplicar todos los sistemas elegidos (en un solo pase) con caché precomputado
    applySystemsToEntities(eligible, systemIds, { player, cached });

    debug("menuState", `Sistemas §b${systemIds.join(", ")}§r aplicados a §b${eligible.length}§r entidades`, {
      level: "debug",
      color: "light_purple",
    });
  } catch (e) {
    debug("menuState", `§cError§r en applySystemsToAll: ${e}`, { level: "error", color: "red" });
  }
}
