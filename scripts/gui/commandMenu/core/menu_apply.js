// scripts/gui/commandMenu/menu_apply.js
import { world, system } from "@minecraft/server";
import { debugMessage, debugWarn } from "../../../utils/debug.js";
import {
  ControlType,
  getSystemEvents,
  setEntitySystemState,
  getEntitySystemState,
  SpecialGroups,
  UnitHierarchy,
  getSystemConfig,
} from "../menu_config.js";
import { canApplySystem } from "../menu_rules.js";
import { getEntityFactionInfo, isValidSoldier, getEntityConfigValue } from "../model/menu_faction.js";
import { loadScope, isEntityInScope } from "../model/menu_scope.js";
import { getAllAddonEntitiesInDimensions } from "../../../utils/entityQuery.js";

// Importar funciones de menu_events (se inyectarán para evitar ciclos)
let _getMenuSystemStates = null;

// Exportar funciones de acceso para uso externo
export function getMenuSystemStates() {
  return _getMenuSystemStates ? _getMenuSystemStates() : {};
}

// eventos que, al activarse, deberían intentar domesticar la entidad
import { isAutoTameEvent } from "../menu_config.js";

export function tryAutoTame(ent, player) {
  if (!ent || !player) return;

  try {
    const comp = ent.getComponent("minecraft:tameable");
    if (comp) {
      if (!comp.isTamed) {
        comp.tame(player);
        debugMessage("menuApply:entity", `autoTame normal: entidad domesticada ${ent.nameTag || ent.typeId}`, "green");
      }

      return;
    }

    debugWarn(
      "menuApply:entity",
      "autoTame: componente minecraft:tameable no encontrado, ejecutando minecraft:on_calm",
      "yellow"
    );

    try {
      ent.triggerEvent("minecraft:on_calm");
    } catch (calmError) {
      debugWarn("menuApply:entity", `autoTame: minecraft:on_calm falló: ${calmError}`, "yellow");
    }

    system.runTimeout(() => {
      try {
        const delayedComp = ent.getComponent("minecraft:tameable");
        if (delayedComp && !delayedComp.isTamed) {
          delayedComp.tame(player);
          debugMessage(
            "menuApply:entity",
            `autoTame tardío: entidad domesticada ${ent.nameTag || ent.typeId}`,
            "green"
          );
        }
      } catch (delayedError) {
        debugWarn("menuApply:entity", `autoTame tardío falló: ${delayedError}`, "yellow");
      }
    }, 1);
  } catch (e) {
    debugWarn("menuApply:entity", `autoTame falló: ${e}`, "yellow");
  }
}

/**
 * Inyecta las funciones de menu_events para evitar importaciones circulares
 */
export function injectMenuEventAccessors(accessors) {
  _getMenuSystemStates = accessors.getMenuSystemStates;
}

/**
 * Trigger seguro de eventos en entidades
 */
function safeTriggerEvent(ent, eventName, player = null) {
  if (!ent || !eventName) return false;
  try {
    if (player && isAutoTameEvent(eventName)) {
      tryAutoTame(ent, player);
    }
    ent.triggerEvent(eventName);
    return true;
  } catch (e) {
    debugWarn("menuApply:entity", `Error en evento ${eventName}: ${e}`, "red");
    return false;
  }
}

/**
 * Aplica un sistema a una entidad específica usando eventos de la configuración
 */
export function applySystemToEntity(
  systemId,
  systemConfig,
  ent,
  stateOverride = null,
  skipCompatibilityCheck = false,
  factionInfoOverride = null,
  player = null,
  cached = {} // Datos precomputados para aplicaciones masivas
) {
  // DEBUG CACHE: Verificar si la cache se está usando en applySystemToEntity
  const cacheUsed = !!cached?.systemStates;
  if (!cacheUsed) {
    debugWarn("menuApply:entity", `[CACHE WARNING] ${systemId} - NO se usó cache, ejecutando fallback`, "red");
  }
  try {
    if (!ent || !isValidSoldier(ent)) return;

    const systemStates = cached?.systemStates || (_getMenuSystemStates ? _getMenuSystemStates() : {});
    const state = stateOverride || systemStates[systemId];

    if (!state) {
      debugWarn("menuApply:entity", `Sistema ${systemId}: Sin estado configurado`, "red");
      return;
    }

    const factionInfo = factionInfoOverride || getEntityFactionInfo(ent);
    if (!factionInfo) {
      debugWarn("menuApply:entity", `${ent.nameTag || ent.typeId}: No se pudo determinar facción`, "red");
      return;
    }

    const { faction, isSpecial, hierarchy, group } = factionInfo;
    const nameTag = ent.nameTag ?? "";

    // usar NO_GROUP como fallback para que los sistemas se apliquen de todas formas.
    if (isSpecial && !group) {
      factionInfo.group = SpecialGroups.NO_GROUP;
    }
    // Para no-especiales la jerarquía (hierarchy) ya está validada en getEntityFactionInfo

    // Verificar compatibilidad con otros sistemas
    if (!skipCompatibilityCheck) {
      const allStates = stateOverride ? { ...systemStates, [systemId]: stateOverride } : systemStates;
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

    // Obtener el valor de configuración según jerarquía/grupo
    const configValue = getEntityConfigValue(factionState, factionInfo);

    if (configValue === undefined) {
      debugWarn("menuApply:entity", `Sistema ${systemId}: Sin valor para ${isSpecial ? group : hierarchy}`, "yellow");
      return;
    }

    // Construir etiqueta para debug
    const entityLabel = isSpecial
      ? `${nameTag} [${faction}-especial-${group}]`
      : `${nameTag} [${faction}-${hierarchy}]`;

    // Aplicar según el tipo de control
    if (systemConfig.controlType === ControlType.TOGGLE) {
      const isEnabled = !!configValue;
      const events = getSystemEvents(systemId, isEnabled);

      if (events.event) {
        const triggered = safeTriggerEvent(ent, events.event, player);
        if (triggered) setEntitySystemState(ent, systemId, isEnabled);
        debugWarn(
          "menuApply:entity",
          `${systemId} → ${entityLabel}: ${isEnabled ? "ON" : "OFF"}`,
          isEnabled ? "green" : "gray"
        );
      }
    } else if (systemConfig.controlType === ControlType.DROPDOWN) {
      const mode = configValue;
      const events = getSystemEvents(systemId, mode);

      // Primero detener cualquier modo anterior
      const stopped = events.stop ? safeTriggerEvent(ent, events.stop, player) : true;

      // Luego iniciar el nuevo modo
      if (events.start && mode !== "false" && mode !== "off") {
        const triggered = safeTriggerEvent(ent, events.start, player);
        if (triggered) setEntitySystemState(ent, systemId, mode);
        debugWarn("menuApply:entity", `${systemId} → ${entityLabel}: modo=${mode}`, "green");
      } else {
        if (events.stop && stopped) {
          setEntitySystemState(ent, systemId, mode);
        }
        debugWarn("menuApply:entity", `${systemId} → ${entityLabel}: desactivado`, "gray");
      }
    }
  } catch (e) {
    debugWarn("menuApply:entity", `Error aplicando ${systemId} a ${ent?.nameTag || "<noName>"}: ${e}`, "red");
  }
}

/**
 * Obtiene la lista de soldados elegibles basándose en dimensiones y scope
 */
export function getEligibleSoldiers(dimensions, scope = null) {
  const seen = new Set();
  const eligible = [];

  const entities = getAllAddonEntitiesInDimensions(dimensions);
  for (const ent of entities) {
    if (!ent?.id || seen.has(ent.id)) continue;
    seen.add(ent.id);
    if (!isValidSoldier(ent)) continue;

    const factionInfo = getEntityFactionInfo(ent);
    if (!factionInfo) continue;
    if (factionInfo.isSpecial && !factionInfo.group) continue;

    const nameTag = ent.nameTag ?? "";
    if (
      scope &&
      !isEntityInScope(ent, factionInfo.faction, factionInfo.isSpecial, nameTag, scope, factionInfo.hierarchy)
    )
      continue;

    eligible.push({ entity: ent, factionInfo });
  }

  return eligible;
}

/**
 * Aplica múltiples sistemas a un conjunto de entidades ya filtradas
 */
export function applySystemsToEntities(eligibleSoldiers, systemIds, options = {}) {
  const { player = null, skipCompatibilityCheck = false, cached = {} } = options;

  // DEBUG CACHE: Verificar si la cache se está usando
  const cacheUsed = !!cached?.systemStates;
  debugWarn(
    "menuApply",
    `[CACHE] Entrada: cached=${cacheUsed ? "ACTIVA" : "FALLBACK"} (systemStates: ${cached?.systemStates ? "sí" : "no"})`,
    "yellow"
  );

  const systemStates = cached.systemStates || (_getMenuSystemStates ? _getMenuSystemStates() : {});

  let totalChecked = 0;
  let skippedNoChange = 0;
  let appliedCount = 0;

  for (const { entity, factionInfo } of eligibleSoldiers) {
    for (const systemId of systemIds) {
      totalChecked++;
      const systemConfig = getSystemConfig(systemId);
      const state = systemStates[systemId];

      // Debug detallado para diagnóstico
      if (!systemConfig) {
        debugWarn("menuApply", `DEBUG: ${systemId} - sin systemConfig`, "red");
        continue;
      }
      if (!state) {
        debugWarn(
          "menuApply",
          `DEBUG: ${systemId} - sin state en systemStates (keys: ${JSON.stringify(Object.keys(systemStates))})`,
          "red"
        );
        continue;
      }

      const factionState = state[factionInfo.faction];
      const configValue = getEntityConfigValue(factionState, factionInfo);
      if (configValue === undefined) {
        // Debug CRÍTICO: ver qué está pasando con el estado
        debugWarn(
          "menuApply",
          `DEBUG: ${systemId} - configValue UNDEFINED para ${entity.nameTag || entity.typeId}`,
          "red"
        );
        debugWarn("menuApply", `DEBUG: state keys=${JSON.stringify(Object.keys(state || {}))}`, "dark_gray");
        debugWarn("menuApply", `DEBUG: factionState=${JSON.stringify(factionState)}`, "dark_gray");
        debugWarn("menuApply", `DEBUG: factionInfo=${JSON.stringify(factionInfo)}`, "dark_gray");
        continue;
      }

      // Guardia ANTES de llamar a applySystemToEntity - evita eventos innecesarios
      const currentValue = getEntitySystemState(entity, systemId);
      debugWarn(
        "menuApply",
        `DEBUG: ${systemId} - currentValue="${currentValue}" vs configValue="${configValue}"`,
        "dark_gray"
      );
      if (currentValue !== undefined && currentValue === configValue) {
        skippedNoChange++;
        continue;
      }

      applySystemToEntity(systemId, systemConfig, entity, null, skipCompatibilityCheck, factionInfo, player, {
        systemStates,
      });
      appliedCount++;
    }
  }

  debugWarn(
    "menuApply",
    `applySystemsToEntities: ${totalChecked} verificados, ${skippedNoChange} sin cambios, ${appliedCount} aplicados`,
    "cyan"
  );
}

/**
 * Aplica un sistema a todas las entidades usando eventos de la configuración
 */
export function applySystemWithEvents(systemId, systemConfig, dimension = null, player = null) {
  try {
    const dims = dimension
      ? [dimension]
      : ["overworld", "nether", "the_end"].map((id) => world.getDimension(id)).filter(Boolean);
    const scope = loadScope();

    debugWarn("menuApply", `=== Aplicando sistema ${systemId} ===`, "cyan");

    const cached = {
      systemStates: _getMenuSystemStates ? _getMenuSystemStates() : {},
    };

    const eligible = getEligibleSoldiers(dims, scope);
    applySystemsToEntities(eligible, [systemId], { player, cached });

    const dimLabel = dimension ? (dimension?.id ?? "custom") : "all";
    debugWarn("menuApply", `Sistema ${systemId} aplicado a ${eligible.length} entidades en dim=${dimLabel}`, "green");
  } catch (e) {
    debugWarn("menuApply", `Error en applySystemWithEvents(${systemId}): ${e}`, "red");
  }
}
