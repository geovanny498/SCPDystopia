// scripts/gui/commandMenu/menu_events.ts
import {
  world,
  system,
  Entity,
  EntitySpawnAfterEvent,
  EntityLoadAfterEvent,
  EntityRemoveAfterEvent,
} from "@minecraft/server";
import { debug } from "../../../utils/debug.js";
import { systems, invalidateScanCache, invalidateEntityQueryCache, getEntitiesCached } from "../menu_config.js";
import { loadSystemOrDefault } from "./menu_state.js";
import { shouldApplyToFutureEntities, canApplySystem } from "../menu_rules.js";
import { getEntityFactionInfo, isValidSoldier } from "../model/menu_faction.js";
import { loadScope, isEntityInScope } from "../model/menu_scope.js";
import { applySystemToEntity } from "./menu_apply.js";
import { teamFamilies } from "../../../utils/teams.js";
import { ENTITY_GROUP_DP } from "../../shared/entityGroups.js";
import type { AllSystemStates, SystemState } from "../model/menu_system_state.js";

/**
 * Lista de soldados conocidos (independiente de toggle_system)
 */
const menuSoldiers: string[] = [];

/**
 * Estados de sistemas en memoria (independiente de toggle_system)
 */
const menuSystemStates: AllSystemStates = {};

// ═══════════════════════════════════════════════════════════════════════════════
// §  ESTADOS DE SISTEMAS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Carga todos los estados de sistemas desde propiedades dinámicas
 */
function loadAllSystemStates() {
  debug("menuEvents", "=== Cargando estados de sistemas ===", { color: "aqua", level: "debug" });
  for (const systemId in systems) {
    const loaded = loadSystemOrDefault(systemId);
    menuSystemStates[systemId] = loaded;
    debug("menuEvents", `Sistema §a${systemId}§r: ${JSON.stringify(loaded)}`, { color: "gray", level: "debug" });
  }
  debug("menuEvents", `Estados cargados: §a${Object.keys(menuSystemStates).length}§r sistemas`, {
    color: "gray",
    level: "debug",
  });
}

/**
 * Obtiene los estados en memoria (para menu_apply.ts)
 *
 * @returns Colección dispersa de estados cargados por sistema.
 */
export function getMenuSystemStates(): AllSystemStates {
  return menuSystemStates;
}

/**
 * Maneja una entidad cuando spawna o se carga
 * @param {Entity} ent
 * @param {Object} options
 * @param {boolean} [options.forceApply=false] - Si true, ignora el scope y forza aplicar sistemas
 */
function handleSoldierEntity(ent: Entity, { forceApply = false } = {}) {
  try {
    if (!ent || !isValidSoldier(ent)) return;

    // Agregar a la lista si no está
    if (!menuSoldiers.includes(ent.id)) {
      menuSoldiers.push(ent.id);
    }

    const currentNametag = ent.nameTag ?? "";

    // Determinar faction e info usando el módulo centralizado
    const factionInfo = getEntityFactionInfo(ent);
    if (!factionInfo) return;

    const { faction } = factionInfo;

    // Si la entidad no tiene typeFamilies (spawneada por mcfunction:
    // entitySpawn dispara antes que minecraft:entity_spawned agregue
    // los component_groups con typeFamilies), diferir 2 ticks.
    const hasTypeFamilies = !!ent.getComponent("minecraft:type_family");
    debug(
      "menuEvents:spawn",
      `[typeFamilyCheck] ${currentNametag ? `§r§f${currentNametag}§r` : `§b${ent.typeId}§r`} faction=§9${faction}§r hasTypeFamilies=§a${hasTypeFamilies}§r`,
      { color: "gray", level: "debug" }
    );
    if (!hasTypeFamilies) {
      debug(
        "menuEvents:spawn",
        `[§cDEFER§r] ${currentNametag ? `§r§f${currentNametag}§r` : `§b${ent.typeId}§r`}: sin typeFamilies, difiriendo 2 ticks`,
        {
          color: "yellow",
          level: "warn",
        }
      );
      system.runTimeout(() => {
        handleSoldierEntity(ent, { forceApply });
      }, 2);
      return;
    }

    const { isSpecial, hierarchy, group } = factionInfo;
    const nameTag = ent.nameTag ?? "";
    const displayLabel = nameTag ? `§r§f${nameTag}§r` : `§b${ent.typeId}§r`;

    const entityLabel = isSpecial
      ? `${displayLabel} [${faction}-especial-${group}]`
      : `${displayLabel} [${faction}-${hierarchy}]`;

    debug("menuEvents:spawn", `Entidad: ${entityLabel}§r`, { color: "blue", level: "debug" });

    // VERIFICAR SCOPE
    if (!forceApply) {
      const scope = loadScope();
      if (!isEntityInScope(ent, faction, scope, nameTag)) {
        debug("menuEvents:spawn", `${displayLabel}: §cFUERA DE SCOPE§r, no se aplican reglas`, {
          color: "yellow",
          level: "warn",
        });
        return;
      }

      debug("menuEvents:spawn", `${displayLabel}: §aEN SCOPE§r, aplicando sistemas...`, {
        color: "aqua",
        level: "debug",
      });
    } else {
      debug("menuEvents:spawn", `EntitySpawn ${displayLabel}: §6FORCE APPLY§r activado, omitiendo scope`, {
        color: "light_purple",
        level: "debug",
      });
    }

    // Aplicar sistemas que correspondan
    for (const systemId in systems) {
      const systemConfig = systems[systemId];
      const state = menuSystemStates[systemId];

      if (!state || !systemConfig) continue;

      // Verificar si el sistema debe aplicarse a entidades futuras
      if (!shouldApplyToFutureEntities(systemId, forceApply)) {
        debug("menuEvents:spawn", `§a${systemId}§r NO se aplica a entidad futura (applyMode: existing_only)`, {
          color: "gray",
          level: "warn",
        });
        continue;
      }

      // Verificar compatibilidad
      const compatResult = canApplySystem(
        systemId,
        menuSystemStates,
        faction,
        isSpecial
      );
      if (!compatResult.canApply) {
        debug("menuEvents:spawn", `§a${systemId}§r → ${displayLabel}: §cNO aplicado§r (incompatible)`, {
          color: "gray",
          level: "warn",
        });
        continue;
      }

      // Aplicar usando la función unificada
      applySystemToEntity(systemId, systemConfig, ent, state, true, factionInfo);
    }
  } catch (e) {
    debug("menuEvents:spawn", `Error manejando entidad: ${e}`, { color: "red", level: "error" });
  }
}

/**
 * Inicializa los event listeners para el sistema de menú
 * No requieren limpieza
 */
export function initializeMenuEvents() {
  try {
    // Cargar estados iniciales
    loadAllSystemStates();

    // Event listener para cuando una entidad spawnea (forzar aplicación)
    world.afterEvents.entitySpawn.subscribe((ev: EntitySpawnAfterEvent) => {
      handleSoldierEntity(ev.entity, { forceApply: true });
    });

    world.afterEvents.entityLoad.subscribe((ev: EntityLoadAfterEvent) => {
      handleSoldierEntity(ev.entity);
    });

    world.afterEvents.entityRemove.subscribe((ev: EntityRemoveAfterEvent) => {
      const idx = menuSoldiers.indexOf(ev.removedEntityId);
      if (idx !== -1) {
        menuSoldiers.splice(idx, 1);
      }
      // Invalidar cache de escaneo y de consultas de entidades
      try {
        invalidateScanCache();
        invalidateEntityQueryCache();
      } catch (e) {
        debug("menuEvents:remove", "Error invalidando cache al remover entidad: " + e, {
          color: "red",
          level: "error",
        });
      }
    });

    debug("menuEvents", "Event listeners del menú inicializados", { color: "green", level: "debug" });
  } catch (e) {
    debug("menuEvents", `Error inicializando event listeners: ${e}`, { color: "red", level: "error" });
  }
}

/**
 * Actualiza el estado de un sistema en memoria
 *
 * @param systemId - ID textual del sistema actualizado.
 * @param state - Estado completo que sustituirá al valor en memoria.
 * @returns No devuelve ningún valor.
 */
export function updateMenuSystemState(systemId: string, state: SystemState): void {
  menuSystemStates[systemId] = state;
  debug("menuEvents", `Estado actualizado en memoria: §a${systemId}§r`, { color: "gray", level: "debug" });
}

/**
 * Reinicia todos los estados del menú a valores por defecto
 */
export function resetMenuSystemStates() {
  debug("menuEvents", "=== Reiniciando estados del menú ===", { color: "aqua", level: "debug" });

  // Limpiar estados en memoria
  for (const key in menuSystemStates) {
    delete menuSystemStates[key];
  }

  // Recargar todos los estados
  loadAllSystemStates();

  debug("menuEvents", "Estados del menú reiniciados correctamente", { color: "green", level: "debug" });
}
