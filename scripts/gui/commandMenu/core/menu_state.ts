// scripts/gui/commandMenu/menu_state.ts
import { world, Dimension, Player } from "@minecraft/server";
import { saveSystemState, loadSystemState } from "../../../commands/worldSave.js";
import { SystemState, AllSystemStates } from "../menu_rules.js";
import { getSystemDefaults, Factions, UnitHierarchy, SpecialGroups } from "../menu_config.js";
import { CATALOG_SYSTEMS, type SystemId } from "../../shared/systemCatalog.js";
import {
  applySystemWithEvents,
  getEligibleSoldiers,
  applySystemsToEntities,
  getMenuSystemStates,
} from "./menu_apply.js";
import { updateMenuSystemState } from "./menu_events.js";
import { debug } from "../../../utils/debug.js";
import { loadScope } from "../model/menu_scope.js";

/**
 * Carga el estado de un sistema desde propiedades dinámicas
 * Si no existe, retorna los valores por defecto
 */
export function loadSystemOrDefault(systemId: string): SystemState {
  const loaded = loadSystemState(systemId);
  if (loaded && typeof loaded === "object") return loaded as SystemState;
  return getSystemDefaults(systemId);
}

/**
 * Carga los estados de múltiples sistemas
 */
export function loadSystemStates(systemIds: string[]): Record<string, SystemState> {
  const states: Record<string, SystemState> = {};

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
function mergeSavedState(systemId: string, partialState: Record<string, unknown>): SystemState {
  const saved: SystemState = (loadSystemState(systemId) as SystemState) || ({} as SystemState);
  const defaults: SystemState = getSystemDefaults(systemId);
  const completed: Record<string, SystemState> = {};

  const factions = [Factions.FOUNDATION, Factions.CHAOS] as const;

  for (const faction of factions) {
    completed[faction] = {};

    const partialFaction: Record<string, unknown> = (partialState[faction] as Record<string, unknown>) || {};
    const savedFaction: Record<string, unknown> = (saved[faction] as Record<string, unknown>) || {};
    const defaultsFaction: Record<string, unknown> = (defaults[faction] as Record<string, unknown>) || {};

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
export function saveSystemAndUpdateMemory(systemId: string, state: SystemState): void {
  try {
    // Fusionar con estado guardado en DP para preservar valores de grupos sin entidades
    const completeState = mergeSavedState(systemId, state);

    // Guardar en propiedades dinámicas (estado COMPLETO)
    saveSystemState(systemId, completeState);

    // Actualizar estado en memoria del menú (estado COMPLETO)
    updateMenuSystemState(systemId, completeState);

    debug("menuState", `Sistema §b${systemId}§r guardado y actualizado en memoria`, { level: "debug", color: "light_purple" });
  } catch (e) {
    debug("menuState", `§cError§r guardando sistema §b${systemId}§r: ${e}`, { level: "error", color: "red" });
  }
}

/**
 * Guarda los estados de múltiples sistemas
 */
export function saveSystemStates(parsedStates: AllSystemStates): void {
  for (const systemId in parsedStates) {
    saveSystemAndUpdateMemory(systemId, parsedStates[systemId]);
  }
}

/**
 * Aplica un sistema a todas las entidades usando los eventos de la configuración
 */
export function applySystemToAll(
  systemId: string,
  dimension: Dimension | null = null,
  player: Player | null = null
): void {
  try {
    const systemConfig = CATALOG_SYSTEMS[systemId as SystemId];
    if (!systemConfig) {
      debug("menuState", `Sistema §b${systemId}§r no encontrado en configuración`, { level: "warn", color: "yellow" });
      return;
    }

    applySystemWithEvents(systemId, systemConfig, dimension, player);
    debug("menuState", `Sistema §b${systemId}§r aplicado`, { level: "debug", color: "light_purple" });
  } catch (e) {
    debug("menuState", `§cError§r aplicando sistema §b${systemId}§r: ${e}`, { level: "error", color: "red" });
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
    debug("menuState", `[applySystemsToAll] systemIds=§b${JSON.stringify(systemIds)}§r`, { level: "debug", color: "gray" });
    debug(
      "menuState",
      `[applySystemsToAll] cachedStates keys=${JSON.stringify(Object.keys(cachedStates))}`,
      { level: "debug", color: "dark_gray" }
    );

    // PRECOMPUTAR ESTADOS PARA OPTIMIZACIÓN MASIVA
    const cached = {
      systemStates: cachedStates,
    };

    // 1. Obtener soldados elegibles (una sola vez)
    const eligible = getEligibleSoldiers(dims as any, scope);
    debug("menuState", `[applySystemsToAll] eligible=§b${eligible.length}§r entidades`, { level: "debug", color: "gray" });

    // 2. Aplicar todos los sistemas elegidos (en un solo pase) con caché precomputado
    applySystemsToEntities(eligible, systemIds, { player, cached });

    debug("menuState", `Sistemas §b${systemIds.join(", ")}§r aplicados a §b${eligible.length}§r entidades`, { level: "debug", color: "light_purple" });
  } catch (e) {
    debug("menuState", `§cError§r en applySystemsToAll: ${e}`, { level: "error", color: "red" });
  }
}
