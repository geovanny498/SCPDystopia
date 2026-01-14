// scripts/gui/commandMenu/menu_events.js
import { world } from "@minecraft/server";
import { debugWarn } from "../../utils/debug.js";
import { systems, specialUnits } from "./menu_config.js";
import { loadSystemOrDefault } from "./menu_state.js";
import { shouldApplyToFutureEntities, canApplySystem } from "./menu_rules.js";
import { getEntityFactionInfo, isValidSoldier } from "./menu_faction.js";
import { loadScope, isEntityInScope } from "./menu_scope.js";
import { applySystemToEntity } from "./menu_apply.js";

/**
 * Lista de soldados conocidos (independiente de toggle_system)
 */
const menuSoldiers = [];

/**
 * Estados de sistemas en memoria (independiente de toggle_system)
 */
const menuSystemStates = {};

// isValidSoldier ahora se importa desde menu_faction.js

/**
 * Carga todos los estados de sistemas desde propiedades dinámicas
 */
function loadAllSystemStates() {
  debugWarn("menuEvents", "=== Cargando estados de sistemas ===", "cyan");
  for (const systemId in systems) {
    const loaded = loadSystemOrDefault(systemId);
    menuSystemStates[systemId] = loaded;
    debugWarn("menuEvents", `Sistema ${systemId}: ${JSON.stringify(loaded)}`, "gray");
  }
  debugWarn("menuEvents", `Estados cargados: ${Object.keys(menuSystemStates).length} sistemas`, "green");
}

/**
 * Obtiene los estados en memoria (para menu_apply.js)
 */
export function getMenuSystemStates() {
  return menuSystemStates;
}

/**
 * Obtiene la lista de soldados (para menu_apply.js)
 */
export function getMenuSoldiers() {
  return menuSoldiers;
}

/**
 * Obtiene las unidades especiales (para menu_apply.js)
 */
export function getMenuSpecialSoldiers() {
  return specialUnits;
}

/**
 * Maneja una entidad cuando spawna o se carga
 * @param {Entity} ent
 */
function handleSoldierEntity(ent) {
  try {
    if (!ent || !isValidSoldier(ent, specialUnits)) return;

    // Agregar a la lista si no está
    if (!menuSoldiers.includes(ent.id)) {
      menuSoldiers.push(ent.id);
    }

    // Determinar faction e isSpecial usando el módulo centralizado
    const factionInfo = getEntityFactionInfo(ent, specialUnits);
    if (!factionInfo) return;

    const { faction, isSpecial } = factionInfo;
    const nameTag = ent.nameTag ?? "";

    debugWarn(
      "menuEvents:spawn",
      `Nueva entidad: ${nameTag} [${faction}${isSpecial ? "-especial" : "-normal"}]`,
      "cyan"
    );

    // VERIFICAR SCOPE: Si la entidad no está en el scope, ignorar silenciosamente
    const scope = loadScope();
    if (!isEntityInScope(ent, faction, isSpecial, nameTag, scope)) {
      debugWarn("menuEvents:spawn", `${nameTag}: FUERA DE SCOPE, no se aplican reglas`, "yellow");
      return; // Silencioso, sin aplicar nada
    }

    debugWarn("menuEvents:spawn", `${nameTag}: EN SCOPE, aplicando sistemas...`, "green");

    // Aplicar solo los sistemas que:
    // 1. Tienen applyMode: "all" (se aplican a futuras entidades)
    // 2. Cumplen con las reglas de compatibilidad
    for (const systemId in systems) {
      const systemConfig = systems[systemId];
      const state = menuSystemStates[systemId];

      if (!state || !systemConfig) continue;

      // Verificar si el sistema debe aplicarse a entidades futuras
      if (!shouldApplyToFutureEntities(systemId)) {
        debugWarn(
          "menuEvents:spawn",
          `Sistema ${systemId} NO se aplica a entidad futura (applyMode: existing_only)`,
          "gray"
        );
        continue;
      }

      // Verificar compatibilidad
      const compatResult = canApplySystem(systemId, menuSystemStates, faction, isSpecial);
      if (!compatResult.canApply) {
        debugWarn("menuEvents:spawn", `${systemId} → ${nameTag}: NO aplicado (incompatible)`, "gray");
        continue;
      }

      // Aplicar usando la función unificada (pasando faction e isSpecial pre-calculados)
      // skipCompatibilityCheck=true porque ya verificamos arriba
      applySystemToEntity(systemId, systemConfig, ent, state, true, faction, isSpecial);
    }
  } catch (e) {
    debugWarn("menuEvents:spawn", `Error manejando entidad: ${e}`, "red");
  }
}

/**
 * Inicializa los event listeners para el sistema de menú
 */
export function initializeMenuEvents() {
  try {
    // Cargar estados iniciales
    loadAllSystemStates();

    // Event listener para cuando una entidad spawna
    // Usar runTimeout con 0 ticks para ejecutar al final del tick (después de la inicialización completa)
    world.afterEvents.entitySpawn.subscribe((ev) => {
      handleSoldierEntity(ev.entity);
    });

    // Event listener para cuando una entidad se carga
    world.afterEvents.entityLoad.subscribe((ev) => {
      handleSoldierEntity(ev.entity);
    });

    // Event listener para cuando una entidad se remueve
    world.afterEvents.entityRemove.subscribe((ev) => {
      const idx = menuSoldiers.indexOf(ev.removedEntityId);
      if (idx !== -1) {
        menuSoldiers.splice(idx, 1);
      }
    });

    debugWarn("menuEvents", "Event listeners del menú inicializados", "green");
  } catch (e) {
    debugWarn("menuEvents", `Error inicializando event listeners: ${e}`, "red");
  }
}

/**
 * Actualiza el estado de un sistema en memoria
 * @param {string} systemId
 * @param {Object} state
 */
export function updateMenuSystemState(systemId, state) {
  menuSystemStates[systemId] = state;
  debugWarn("menuEvents", `Estado actualizado en memoria: ${systemId}`, "green");
}

/**
 * Reinicia todos los estados del menú a valores por defecto
 * Limpia la memoria y recarga desde propiedades dinámicas (o defaults si no existen)
 */
export function resetMenuSystemStates() {
  debugWarn("menuEvents", "=== Reiniciando estados del menú ===", "yellow");

  // Limpiar estados en memoria
  for (const key in menuSystemStates) {
    delete menuSystemStates[key];
  }

  // Recargar todos los estados (esto cargará los defaults si no hay propiedades dinámicas)
  loadAllSystemStates();

  debugWarn("menuEvents", "Estados del menú reiniciados correctamente", "green");
}
