// scripts/gui/commandMenu/menu_events.js
import { world } from "@minecraft/server";
import { debugWarn } from "../../../utils/debug.js";
import { systems, invalidateScanCache, invalidateEntityQueryCache, getEntitiesCached } from "../menu_config.js";
import { loadSystemOrDefault } from "./menu_state.js";
import { shouldApplyToFutureEntities, canApplySystem } from "../menu_rules.js";
import { getEntityFactionInfo, isValidSoldier } from "../model/menu_faction.js";
import { loadScope, isEntityInScope } from "../model/menu_scope.js";
import { applySystemToEntity } from "./menu_apply.js";
import { teamFamilies } from "../../../utils/teams.js";

/**
 * Lista de soldados conocidos (independiente de toggle_system)
 */
const menuSoldiers = [];

/**
 * Estados de sistemas en memoria (independiente de toggle_system)
 */
const menuSystemStates = {};

// ═══════════════════════════════════════════════════════════════════════════════
// §  ESTADOS DE SISTEMAS
// ═══════════════════════════════════════════════════════════════════════════════

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
 * v4.0 — sin listas estáticas. Devuelve estructura vacía; la validación real
 * se hace por familias de facción en isValidSoldier / getEntityFactionInfo.
 */
export function getMenuSpecialSoldiers() {
  return { foundation: { all: [] }, chaos: { all: [] } };
}

/**
 * Maneja una entidad cuando spawna o se carga
 * @param {Entity} ent
 * @param {Object} options
 * @param {boolean} [options.forceApply=false] - Si true, ignora el scope y forza aplicar sistemas
 */
function handleSoldierEntity(ent, { forceApply = false } = {}) {
  try {
    if (!ent || !isValidSoldier(ent)) return;

    // Agregar a la lista si no está
    if (!menuSoldiers.includes(ent.id)) {
      menuSoldiers.push(ent.id);
    }

    // Invalidar cache de escaneo si el nametag cambió (v4.0 detección de conversión)
    const currentNametag = ent.nameTag ?? "";
    const prevNametag = ent.getDynamicProperty("scpd:prev_nametag") ?? "";
    if (currentNametag !== prevNametag) {
      invalidateScanCache();
      ent.setDynamicProperty("scpd:prev_nametag", currentNametag);
    }

    // Determinar faction e info usando el módulo centralizado
    const factionInfo = getEntityFactionInfo(ent);
    if (!factionInfo) return;

    const { faction } = factionInfo;

    // Si la entidad no tiene typeFamilies (spawneada por mcfunction:
    // entitySpawn dispara antes que minecraft:entity_spawned agregue
    // los component_groups con typeFamilies), deferir 2 ticks.
    const hasTypeFamilies = !!ent.getComponent("minecraft:type_family");
    debugWarn(
      "menuEvents:spawn",
      `[typeFamilyCheck] ${currentNametag || ent.typeId} faction=${faction} hasTypeFamilies=${hasTypeFamilies}`,
      "dark_gray"
    );
    if (!hasTypeFamilies) {
      debugWarn(
        "menuEvents:spawn",
        `[DEFER] ${currentNametag || ent.typeId}: sin typeFamilies, difiriendo 2 ticks`,
        "yellow"
      );
      system.runTimeout(() => {
        handleSoldierEntity(ent, { forceApply });
      }, 2);
      return;
    }

    // Sincronizar grupo: si la entidad es especial y no tiene grupo asignado,
    // buscar otra entidad con el mismo nametag que SÍ tenga grupo y copiárselo.
    // Se filtra por las familias de la facción de la entidad para no recorrer
    // todo el mundo.
    if (currentNametag) {
      try {
        const existingGroup = ent.getDynamicProperty("scpd:group");
        debugWarn(
          "menuEvents:spawn",
          `[sync] ${currentNametag}: existingGroup="${existingGroup}" faction=${faction}`,
          "dark_gray"
        );
        if (!existingGroup) {
          // Usar cache por dimensión+facción: getEntities se llama una sola vez por ráfaga de spawn
          const allForTag = getEntitiesCached(ent.dimension, faction);
          debugWarn("menuEvents:spawn", `[sync] allForTag.length=${allForTag.length}`, "dark_gray");
          for (var i = 0; i < allForTag.length; i++) {
            var other = allForTag[i];
            if (other.id === ent.id) continue;
            var otherNametag = (other.nameTag ?? "").trim();
            if (otherNametag !== currentNametag) continue;
            var otherGroup = other.getDynamicProperty("scpd:group");
            debugWarn(
              "menuEvents:spawn",
              `[sync] match found: other=${other.typeId} otherGroup="${otherGroup}"`,
              "dark_gray"
            );
            if (otherGroup) {
              ent.setDynamicProperty("scpd:group", otherGroup);
              debugWarn(
                "menuEvents:spawn",
                `${currentNametag}: grupo sincronizado desde entidad existente -> ${otherGroup}`,
                "green"
              );
              break;
            }
          }
          debugWarn(
            "menuEvents:spawn",
            `[sync] ${currentNametag}: sync completado, group final=${ent.getDynamicProperty("scpd:group")}`,
            "cyan"
          );
        }
      } catch (syncErr) {
        debugWarn("menuEvents:spawn", `Error sincronizando grupo: ${syncErr} stack=${syncErr.stack}`, "red");
      }
    }

    const { isSpecial, hierarchy, group } = factionInfo;
    const nameTag = ent.nameTag ?? "";

    const entityLabel = isSpecial
      ? `${nameTag} [${faction}-especial-${group}]`
      : `${nameTag} [${faction}-${hierarchy}]`;

    debugWarn("menuEvents:spawn", `Entidad: ${entityLabel}`, "cyan");

    // VERIFICAR SCOPE (pasando jerarquía para no especiales)
    if (!forceApply) {
      const scope = loadScope();
      if (!isEntityInScope(ent, faction, isSpecial, nameTag, scope, hierarchy)) {
        debugWarn("menuEvents:spawn", `${nameTag}: FUERA DE SCOPE, no se aplican reglas`, "yellow");
        return;
      }

      debugWarn("menuEvents:spawn", `${nameTag}: EN SCOPE, aplicando sistemas...`, "green");
    } else {
      debugWarn("menuEvents:spawn", `EntitySpawn${nameTag}: FORCE APPLY activado, omitiendo scope`, "cyan");
    }

    // Aplicar sistemas que correspondan
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

      // Aplicar usando la función unificada
      applySystemToEntity(systemId, systemConfig, ent, state, true, factionInfo);
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

    // Event listener para cuando una entidad spawnea (forzar aplicación)
    world.afterEvents.entitySpawn.subscribe((ev) => {
      handleSoldierEntity(ev.entity, { forceApply: true });
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
      // Invalidar cache de escaneo y de consultas de entidades
      try {
        invalidateScanCache();
        invalidateEntityQueryCache();
      } catch (e) {
        debugWarn("menuEvents:remove", "Error invalidando cache al remover entidad: " + e, "yellow");
      }
    });

    debugWarn("menuEvents", "Event listeners del menú inicializados", "green");
  } catch (e) {
    debugWarn("menuEvents", `Error inicializando event listeners: ${e}`, "red");
  }
}

/**
 * Actualiza el estado de un sistema en memoria
 */
export function updateMenuSystemState(systemId, state) {
  menuSystemStates[systemId] = state;
  debugWarn("menuEvents", `Estado actualizado en memoria: ${systemId}`, "green");
}

/**
 * Reinicia todos los estados del menú a valores por defecto
 */
export function resetMenuSystemStates() {
  debugWarn("menuEvents", "=== Reiniciando estados del menú ===", "yellow");

  // Limpiar estados en memoria
  for (const key in menuSystemStates) {
    delete menuSystemStates[key];
  }

  // Recargar todos los estados
  loadAllSystemStates();

  debugWarn("menuEvents", "Estados del menú reiniciados correctamente", "green");
}
