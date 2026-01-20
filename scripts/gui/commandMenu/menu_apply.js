// scripts/gui/commandMenu/menu_apply.js
import { world } from "@minecraft/server";
import { debugMessage, debugWarn } from "../../utils/debug.js";
import { ControlType, getSystemEvents, SpecialGroups, UnitHierarchy } from "./menu_config.js";
import { canApplySystem } from "./menu_rules.js";
import { getEntityFactionInfo, isValidSoldier, getEntityConfigValue } from "./menu_faction.js";
import { loadScope, isEntityInScope } from "./menu_scope.js";
import { teamFamilies } from "../../utils/teams.js";

// Importar funciones de menu_events (se inyectarán para evitar ciclos)
let getMenuSystemStates = null;
let getMenuSoldiers = null;
let getMenuSpecialSoldiers = null;

/**
 * Inyecta las funciones de menu_events para evitar importaciones circulares
 */
export function injectMenuEventAccessors(accessors) {
  getMenuSystemStates = accessors.getMenuSystemStates;
  getMenuSoldiers = accessors.getMenuSoldiers;
  getMenuSpecialSoldiers = accessors.getMenuSpecialSoldiers;
}

/**
 * Trigger seguro de eventos en entidades
 */
function safeTriggerEvent(ent, eventName) {
  if (!ent || !eventName) return;
  try {
    ent.triggerEvent(eventName);
  } catch (e) {
    debugWarn("menuApply:entity", `Error en evento ${eventName}: ${e}`, "red");
  }
}

/**
 * Aplica un sistema a una entidad específica usando eventos de la configuración
 * NUEVO: Usa jerarquías para no especiales y grupos para especiales
 */
export function applySystemToEntity(
  systemId,
  systemConfig,
  ent,
  stateOverride = null,
  skipCompatibilityCheck = false,
  factionInfoOverride = null
) {
  try {
    const specials = getMenuSpecialSoldiers
      ? getMenuSpecialSoldiers()
      : { foundation: { all: [] }, chaos: { all: [] } };

    if (!ent || !isValidSoldier(ent, specials)) return;

    const systemStates = getMenuSystemStates ? getMenuSystemStates() : {};
    const state = stateOverride || systemStates[systemId];

    if (!state) {
      debugWarn("menuApply:entity", `Sistema ${systemId}: Sin estado configurado`, "red");
      return;
    }

    // Obtener información de facción
    const factionInfo = factionInfoOverride || getEntityFactionInfo(ent, specials);
    if (!factionInfo) {
      debugWarn("menuApply:entity", `${ent.nameTag || ent.typeId}: No se pudo determinar facción`, "red");
      return;
    }

    const { faction, isSpecial, hierarchy, group } = factionInfo;
    const nameTag = ent.nameTag ?? "";

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
        safeTriggerEvent(ent, events.event);
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
      if (events.stop) {
        safeTriggerEvent(ent, events.stop);
      }

      // Luego iniciar el nuevo modo
      if (events.start && mode !== "false" && mode !== "off") {
        safeTriggerEvent(ent, events.start);
        debugWarn("menuApply:entity", `${systemId} → ${entityLabel}: modo=${mode}`, "green");
      } else {
        debugWarn("menuApply:entity", `${systemId} → ${entityLabel}: desactivado`, "gray");
      }
    }
  } catch (e) {
    debugWarn("menuApply:entity", `Error aplicando ${systemId} a ${ent?.nameTag || "<noName>"}: ${e}`, "red");
  }
}

/**
 * Aplica un sistema a todas las entidades usando eventos de la configuración
 */
export function applySystemWithEvents(systemId, systemConfig, dimension = null) {
  try {
    const seen = new Set();
    let appliedCount = 0;
    let skippedCount = 0;
    const specials = getMenuSpecialSoldiers
      ? getMenuSpecialSoldiers()
      : { foundation: { all: [] }, chaos: { all: [] } };

    // Cargar scope una sola vez para optimización
    const scope = loadScope();

    debugWarn("menuApply", `=== Aplicando sistema ${systemId} ===`, "cyan");

    // Construir array de familias válidas desde teamFamilies
    const validFamilies = [...teamFamilies.chaos, ...teamFamilies.foundation];

    // Escanear entidades en la dimensión solicitada o en todas
    const dims = dimension
      ? [dimension]
      : ["overworld", "nether", "the_end"].map((id) => world.getDimension(id)).filter(Boolean);

    for (const dim of dims) {
      for (const family of validFamilies) {
        const ents = dim.getEntities({ families: [family] });

        for (const ent of ents) {
          if (!ent || !ent.id) continue;
          if (seen.has(ent.id)) continue;
          seen.add(ent.id);
          if (!isValidSoldier(ent, specials)) continue;

          // Obtener información de facción
          const factionInfo = getEntityFactionInfo(ent, specials);
          if (!factionInfo) continue;

          const { faction, isSpecial } = factionInfo;
          const nameTag = ent.nameTag ?? "";

          // Verificar scope (pasando jerarquía para no especiales)
          if (!isEntityInScope(ent, faction, isSpecial, nameTag, scope, factionInfo.hierarchy)) {
            skippedCount++;
            continue;
          }

          applySystemToEntity(systemId, systemConfig, ent, null, false, factionInfo);
          appliedCount += 1;
        }
      }
    }

    // Procesar lista auxiliar de soldados conocida
    const allSoldiers = getMenuSoldiers ? getMenuSoldiers() : null;
    if (Array.isArray(allSoldiers)) {
      for (const id of allSoldiers) {
        if (seen.has(id)) continue;
        try {
          const ent = world.getEntity(id);
          if (!ent) continue;
          seen.add(id);
          if (!isValidSoldier(ent, specials)) continue;

          const factionInfo = getEntityFactionInfo(ent, specials);
          if (!factionInfo) continue;

          const { faction, isSpecial } = factionInfo;
          const nameTag = ent.nameTag ?? "";

          if (!isEntityInScope(ent, faction, isSpecial, nameTag, scope, factionInfo.hierarchy)) {
            skippedCount++;
            continue;
          }

          applySystemToEntity(systemId, systemConfig, ent, null, false, factionInfo);
          appliedCount += 1;
        } catch {}
      }
    }

    const dimLabel = dimension ? (dimension?.id ?? "custom") : "all";
    debugWarn(
      "menuApply",
      `Sistema ${systemId} aplicado a ${appliedCount} entidades (${skippedCount} fuera de scope) en dim=${dimLabel}`,
      "green"
    );
  } catch (e) {
    debugWarn("menuApply", `Error en applySystemWithEvents(${systemId}): ${e}`, "red");
  }
}
