// scripts/gui/commandMenu/menu_apply.ts
import { world, system, Entity, Player } from "@minecraft/server";
import { debug } from "../../../utils/debug.js";
import {
  ControlType,
  getSystemEvents,
  setEntitySystemState,
  getEntitySystemState,
  SpecialGroups,
  UnitHierarchy,
  formatEntitySystemStateLabel,
} from "../menu_config.js";
import { CATALOG_SYSTEMS, SYSTEM_SHORT_NAMES, type SystemId } from "../../shared/systemCatalog.js";
import { entityHistoryStore } from "../../shared/entityHistory.js";
import { canApplySystem } from "../menu_rules.js";
import { getEntityFactionInfo, isValidSoldier, getEntityConfigValue } from "../model/menu_faction.js";
import { loadScope, isEntityInScope } from "../model/menu_scope.js";
import { getAllAddonEntitiesInDimensions } from "../../../utils/entityQuery.js";

// eventos que, al activarse, deberían intentar domesticar la entidad
import { isAutoTameEvent } from "../menu_config.js";

/**
 * Registra en el historial por entidad un cambio de sistema aplicado por
 * commandMenu. Solo se registra cuando el cambio fue iniciado por un jugador
 * (`player != null`), excluyendo el auto-apply de spawn/load.
 * @param ent Entidad a la que se le aplicó el cambio.
 * @param systemId ID del sistema.
 * @param systemConfig Config de sistema (para displayName fallback).
 * @param configValue Valor aplicado.
 * @param player Jugador que originó el cambio (null en spawn/load).
 */
function recordCommandHistory(
  ent: Entity,
  systemId: string,
  systemConfig: any,
  configValue: unknown,
  player: Player | null
): void {
  if (player == null) return;
  const shortName = SYSTEM_SHORT_NAMES[systemId] ?? systemConfig?.displayName ?? systemId;
  const valueLabel = formatEntitySystemStateLabel(systemId, configValue);
  entityHistoryStore.pushHistory(ent.id, {
    source: "command",
    viewId: `system:${systemId}`,
    context: shortName,
    value: valueLabel,
  });
}

// Importar funciones de menu_events (se inyectarán para evitar ciclos)
let _getMenuSystemStates: any = null;

// Exportar funciones de acceso para uso externo
export function getMenuSystemStates(): any {
  return _getMenuSystemStates ? _getMenuSystemStates() : {};
}

/**
 * Intenta domesticar la entidad usando el componente tameable o minecraft:on_calm como fallback
 * @param ent Entidad a domesticar
 * @param player Jugador que realiza la domesticación
 *
 */
export function tryAutoTame(ent: Entity, player: Player): void {
  if (!ent || !player) return;

  try {
    const comp = ent.getComponent("minecraft:tameable");
    if (comp) {
      if (!comp.isTamed) {
        comp.tame(player);
        debug("menuApply:entity", `autoTame normal: entidad domesticada ${ent.nameTag ? `§r§f${ent.nameTag}§r` : `§b${ent.typeId}§r`}`, { level: "debug", color: "green" });
      }

      return;
    }

    debug(
      "menuApply:entity",
      `autoTame: componente minecraft:tameable §cno encontrado§r, ejecutando minecraft:on_calm`,
      { level: "warn", color: "yellow" }
    );

    try {
      ent.triggerEvent("minecraft:on_calm");
    } catch (calmError) {
      debug(
        "menuApply:entity",
        `autoTame: minecraft:on_calm §cfalló§r: ${calmError}`,
        { level: "error", color: "red" }
      );
    }

    system.runTimeout(() => {
      try {
        const delayedComp = ent.getComponent("minecraft:tameable");
        if (delayedComp && !delayedComp.isTamed) {
          delayedComp.tame(player);
          debug(
            "menuApply:entity",
            `autoTame tardío: entidad domesticada ${ent.nameTag ? `§r§f${ent.nameTag}§r` : `§b${ent.typeId}§r`}`,
            { level: "debug", color: "green" }
          );
        }
      } catch (delayedError) {
        debug(
          "menuApply:entity",
          `autoTame tardío §cfalló§r: ${delayedError}`,
          { level: "error", color: "red" }
        );
      }
    }, 1);
  } catch (e) {
    debug("menuApply:entity", `autoTame §cfalló§r: ${e}`, { level: "error", color: "red" });
  }
}

/**
 * Inyecta las funciones de menu_events para evitar importaciones circulares
 */
export function injectMenuEventAccessors(accessors: { getMenuSystemStates: () => any }): void {
  _getMenuSystemStates = accessors.getMenuSystemStates;
}

/**
 * Trigger seguro de eventos en entidades
 */
function safeTriggerEvent(ent: Entity, eventName: string, player: Player | null = null): boolean {
  if (!ent || !eventName) return false;
  try {
    if (player && isAutoTameEvent(eventName)) {
      tryAutoTame(ent, player);
    }
    ent.triggerEvent(eventName);
    return true;
  } catch (e) {
    debug("menuApply:entity", `§cError§r en evento §a${eventName}§r: ${e}`, { level: "error", color: "red" });
    return false;
  }
}

/**
 * Aplica un sistema a una entidad específica usando eventos de la configuración
 * @param systemId
 * @param systemConfig
 * @param ent
 * @param stateOverride
 * @param skipCompatibilityCheck
 * @param factionInfoOverride
 * @param player
 * @param cached
 * @returns boolean indicando si el sistema se aplicó exitosamente
 */
export function applySystemToEntity(
  systemId: string,
  systemConfig: any,
  ent: Entity,
  stateOverride: any = null,
  skipCompatibilityCheck = false,
  factionInfoOverride: any = null,
  player: Player | null = null,
  cached: any = {} // Datos precomputados para aplicaciones masivas
): boolean {
  // DEBUG CACHE: Verificar si la cache se está usando en applySystemToEntity
  const cacheUsed = !!cached?.systemStates;
  if (!cacheUsed) {
    debug("menuApply:entity", `[CACHE WARNING] §a${systemId}§r — §cNO se usó cache§r, ejecutando §cfallback§r`, { level: "warn", color: "yellow" });
  }
  try {
    if (!ent || !isValidSoldier(ent)) return false;

    const systemStates = cached?.systemStates || (_getMenuSystemStates ? _getMenuSystemStates() : {});
    const state = stateOverride || systemStates[systemId];

    if (!state) {
      debug("menuApply:entity", `Sistema §a${systemId}§r: §cSin estado configurado§r`, { level: "warn", color: "yellow" });
      return false;
    }

    const factionInfo = factionInfoOverride || getEntityFactionInfo(ent);
    if (!factionInfo) {
      debug("menuApply:entity", `${ent.nameTag ? `§r§f${ent.nameTag}§r` : `§b${ent.typeId}§r`}: §cNo se pudo determinar facción§r`, { level: "warn", color: "yellow" });
      return false;
    }

    const { faction, isSpecial, hierarchy, group } = factionInfo;
    const nameTag = ent.nameTag ?? "";
    const soldierName = nameTag ? `§r§f${nameTag}§r` : `§b${ent.typeId}§r`;

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
        debug("menuApply:entity", `§a${systemId}§r → ${soldierName}: §cNO aplicado§r (${result.reason})`, { level: "warn", color: "yellow" });
        return false;
      }
    }

    const factionState = state[faction];
    if (!factionState) {
      debug("menuApply:entity", `Sistema §a${systemId}§r: §cSin configuración§r para §a${faction}§r`, { level: "warn", color: "yellow" });
      return false;
    }

    // Obtener el valor de configuración según jerarquía/grupo
    const configValue = getEntityConfigValue(factionState, factionInfo);

    if (configValue === undefined) {
      debug("menuApply:entity", `Sistema §a${systemId}§r: §cSin valor§r para ${isSpecial ? group : hierarchy}`, { level: "warn", color: "yellow" });
      return false;
    }

    // Construir etiqueta para debug — soldierName con fallback a typeId
    const entityLabel = isSpecial
      ? `${soldierName} [§a${faction}§r-especial-§a${group}§r]`
      : `${soldierName} [§a${faction}§r-§a${hierarchy}§r]`;

    // Aplicar según el tipo de control
    if (systemConfig.controlType === ControlType.TOGGLE) {
      const isEnabled = !!configValue;
      const events = getSystemEvents(systemId, isEnabled);

      if (events.event) {
        const triggered = safeTriggerEvent(ent, events.event as string, player);
        if (triggered) {
          setEntitySystemState(ent, systemId, isEnabled);
          debug(
            "menuApply:entity",
            `§a${systemId}§r → ${entityLabel}: ${isEnabled ? "§6ON§r" : "§6OFF§r"}`,
            { level: "debug", color: isEnabled ? "green" : "gray" }
          );
          recordCommandHistory(ent, systemId, systemConfig, configValue, player);
          return true; // Aplicado exitosamente
        } else {
          // Evento no existe para esta entidad - contar como error, no como aplicado
          debug(
            "menuApply:entity",
            `§a${systemId}§r → ${entityLabel}: evento "${events.event}" §cno disponible§r`,
            { level: "warn", color: "yellow" }
          );
          return false; // No aplicado
        }
      }
    } else if (systemConfig.controlType === ControlType.DROPDOWN) {
      const mode = configValue;
      const events = getSystemEvents(systemId, mode as string);

      // Primero detener cualquier modo anterior
      const stopped = events.stop ? safeTriggerEvent(ent, events.stop as string, player) : true;

      // Luego iniciar el nuevo modo
      if (events.start && mode !== "false" && mode !== "off") {
        const triggered = safeTriggerEvent(ent, events.start as string, player);
        if (triggered) {
          setEntitySystemState(ent, systemId, mode);
          debug("menuApply:entity", `§a${systemId}§r → ${entityLabel}: modo=§6${mode}§r`, { level: "debug", color: "green" });
          recordCommandHistory(ent, systemId, systemConfig, configValue, player);
          return true; // Aplicado exitosamente
        } else {
          debug(
            "menuApply:entity",
            `§a${systemId}§r → ${entityLabel}: evento "${events.start}" §cno disponible§r`,
            { level: "warn", color: "yellow" }
          );
          return false; // No aplicado
        }
      } else {
        if (events.stop && stopped) {
          setEntitySystemState(ent, systemId, mode);
        }
        debug("menuApply:entity", `§a${systemId}§r → ${entityLabel}: §6desactivado§r`, { level: "debug", color: "gray" });
        recordCommandHistory(ent, systemId, systemConfig, configValue, player);
        return true; // Para el caso de "desactivado" sin evento start, se considera aplicado
      }
    }

    return false; // Caso por defecto: no se aplicó
  } catch (e) {
    debug("menuApply:entity", `§cError§r aplicando §a${systemId}§r a §r§f${ent?.nameTag || "<noName>"}§r: ${e}`, { level: "error", color: "red" });
    return false;
  }
}

/**
 * Obtiene la lista de soldados elegibles basándose en dimensiones y scope
 * @param dimensions - Lista de dimensiones a considerar
 * @param scope - Scope opcional para filtrar entidades
 * @returns Lista de entidades elegibles con su información de facción
 */
export function getEligibleSoldiers(dimensions: any[], scope: any = null): any[] {
  const seen = new Set();
  const eligible = [];

  const entities = getAllAddonEntitiesInDimensions(dimensions as any);
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
 * @param eligibleSoldiers
 * @param systemIds
 * @param options
 */
export function applySystemsToEntities(eligibleSoldiers: any[], systemIds: string[], options: any = {}): void {
  const { player = null, skipCompatibilityCheck = false, cached = {} } = options;

  // DEBUG CACHE: Verificar si la cache se está usando
  const cacheUsed = !!cached?.systemStates;
  debug(
    "menuApply",
    `[CACHE] Entrada: cached=${cacheUsed ? "§aACTIVA§r" : "§cFALLBACK§r"} (systemStates: ${cached?.systemStates ? "sí" : "no"})`,
    { level: "warn", color: "yellow" }
  );

  const systemStates = cached.systemStates || (_getMenuSystemStates ? _getMenuSystemStates() : {});

  let totalChecked = 0;
  let skippedNoChange = 0;
  let appliedCount = 0;

  for (const { entity, factionInfo } of eligibleSoldiers) {
    for (const systemId of systemIds) {
      totalChecked++;
      const systemConfig = CATALOG_SYSTEMS[systemId as SystemId];
      const state = systemStates[systemId];

      // Debug detallado para diagnóstico
      if (!systemConfig) {
        debug("menuApply", `DEBUG: §a${systemId}§r — §csin systemConfig§r`, { level: "warn", color: "yellow" });
        continue;
      }
      if (!state) {
        debug(
          "menuApply",
          `DEBUG: §a${systemId}§r — §csin state§r en systemStates (keys: ${JSON.stringify(Object.keys(systemStates))})`,
          { level: "warn", color: "yellow" }
        );
        continue;
      }

      const factionState = state[factionInfo.faction];
      // Obtener el valor de configuración según jerarquía/grupo
      const configValue = getEntityConfigValue(factionState, factionInfo);
      if (configValue === undefined) {
        // Debug CRÍTICO: ver qué está pasando con el estado
        debug(
          "menuApply",
          `DEBUG: §a${systemId}§r — §cconfigValue UNDEFINED§r para ${entity.nameTag ? `§r§f${entity.nameTag}§r` : `§b${entity.typeId}§r`}`,
          { level: "warn", color: "yellow" }
        );
        debug("menuApply", `DEBUG: state keys=${JSON.stringify(Object.keys(state || {}))}`, { level: "debug", color: "dark_gray" });
        debug("menuApply", `DEBUG: factionState=${JSON.stringify(factionState)}`, { level: "debug", color: "dark_gray" });
        debug("menuApply", `DEBUG: factionInfo=${JSON.stringify(factionInfo)}`, { level: "debug", color: "dark_gray" });
        continue;
      }

      // Guardia ANTES de llamar a applySystemToEntity - evita eventos innecesarios
      const currentValue = getEntitySystemState(entity, systemId);
      debug(
        "menuApply",
        `DEBUG: §a${systemId}§r — currentValue="§6${currentValue}§r" vs configValue="§6${configValue}§r"`,
        { level: "debug", color: "dark_gray" }
      );
      if (currentValue !== undefined && currentValue === configValue) {
        skippedNoChange++;
        continue;
      }

      const applied = applySystemToEntity(
        systemId,
        systemConfig,
        entity,
        null,
        skipCompatibilityCheck,
        factionInfo,
        player,
        {
          systemStates,
        }
      );
      if (applied) appliedCount++;
    }
  }

  debug(
    "menuApply",
    `applySystemsToEntities: ${totalChecked} verificados, ${skippedNoChange} §csin cambios§r, ${appliedCount} aplicados`,
    { level: "debug", color: "aqua" }
  );
}

/**
 * Aplica un sistema a todas las entidades usando eventos de la configuración
 */
export function applySystemWithEvents(
  systemId: string,
  systemConfig: any,
  dimension: any = null,
  player: Player | null = null
): void {
  try {
    const dims = dimension
      ? [dimension]
      : ["overworld", "nether", "the_end"].map((id) => world.getDimension(id)).filter(Boolean);

    const scope = loadScope();

    // Log para diagnosticar estados
    debug("menuApply", `=== Aplicando sistema §a${systemId}§r ===`, { level: "debug", color: "aqua" });

    const cached = {
      systemStates: _getMenuSystemStates ? _getMenuSystemStates() : {},
    };

    const eligible = getEligibleSoldiers(dims as any, scope);
    applySystemsToEntities(eligible, [systemId], { player, cached });

    const dimLabel = dimension ? ((dimension as any).id ?? "custom") : "all";
    debug("menuApply", `Sistema §a${systemId}§r aplicado a ${eligible.length} entidades en dim=${dimLabel}`, { level: "debug", color: "green" });
  } catch (e) {
    debug("menuApply", `§cError§r en applySystemWithEvents(§a${systemId}§r): ${e}`, { level: "error", color: "red" });
  }
}
