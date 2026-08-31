// scripts/gui/interactMenu/ddui/interact_ddui_shared.ts

import { ObservableNumber, ObservableString } from "@minecraft/server-ui";
import { Entity, Player, EntityVariantComponent, system } from "@minecraft/server";
import { debugWarn, debugMessage } from "../../../utils/debug.js";
import {
  getEntitySystemsStatus,
  isAutoTameEvent,
  findSystemStateByEvent,
  setEntitySystemState,
  getSystemConfig,
  formatEntitySystemStateLabel,
  SpecialGroupLabels,
  SpecialGroups,
  UnitHierarchyLabels,
  UnitHierarchy,
  Factions,
  getEntitySystemState,
  getSystemDefaults,
} from "../../commandMenu/menu_config.js";
import { getEntityFactionInfo, type EntityFactionInfo } from "../../commandMenu/model/menu_faction.js";
import { setUnitGroup, getUnitGroup } from "../../commandMenu/model/menu_groups.js";
import {
  isGlobalOverwriteAllowed,
  setGlobalOverwriteAllowed,
  makeSystemId,
  isAllowedByRule,
  type EntityConfig,
} from "../gui.js";
import { stripColorCodes } from "../../monitorMenu/monitor_config.js";
import { tryAutoTame } from "../../commandMenu/core/menu_apply.js";
import type { MenuEntry } from "../config.js";
import { SYSTEM_SHORT_NAMES } from "../config.js";

export class InteractDDUISession {
  readonly playerId: string;
  readonly player: Player;
  readonly entity: Entity;
  readonly cfg: EntityConfig;
  readonly soldierName: string;
  readonly displayName: string;
  readonly typeId: string;
  viewId: string;
  factionInfo: EntityFactionInfo | null;
  readonly observables: {
    healthText: ObservableString;
    systemStateDetailText: ObservableString;
    actionResultText: ObservableString;
    groupDetailText: ObservableString;
  };
  private readonly intervalIds: number[] = [];
  private cleaned = false;

  constructor(
    playerId: string,
    player: Player,
    entity: Entity,
    cfg: EntityConfig,
    soldierName: string,
    displayName: string,
    typeId: string
  ) {
    this.playerId = playerId;
    this.player = player;
    this.entity = entity;
    this.cfg = cfg;
    this.soldierName = soldierName;
    this.displayName = displayName;
    this.typeId = typeId;
    this.viewId = "main";
    this.factionInfo = getEntityFactionInfo(entity);
    this.observables = {
      healthText: new ObservableString("§cVida: §a-- / --"),
      systemStateDetailText: new ObservableString(""),
      actionResultText: new ObservableString("§7Último cambio: §fN/A"),
      groupDetailText: new ObservableString(""),
    };
  }

  registerInterval(intervalId: number): void {
    this.intervalIds.push(intervalId);
  }

  unregisterInterval(intervalId: number): void {
    const idx = this.intervalIds.indexOf(intervalId);
    if (idx >= 0) {
      this.intervalIds.splice(idx, 1);
      try {
        system.clearRun(intervalId);
      } catch {
        // intervalo ya limpiado o inválido
      }
      debugMessage("interactDDUI", `Intervalo desregistrado: ${intervalId}`, "gray");
    }
  }

  private static buildFeedbackText(context: string, value: string): string {
    return `§7Último cambio: ${context}\n§7-> §f${value}`;
  }

  recordFeedback(context: string, value: string): void {
    const text = InteractDDUISession.buildFeedbackText(context, value);
    this.observables.actionResultText.setData(text);
    setLastFeedbackText(this.entity.id, this.viewId, text);
    pushHistory(this.entity.id, {
      viewId: this.viewId,
      context,
      value,
      timestamp: Date.now(),
      localTime: formatLocalTimeShort(Date.now()),
    });
  }

  applyEntryAction(entry: MenuEntry, dynamicProperty?: string, categoryLabel?: string): void {
    const action = entry.action;
    const event = entry.event;
    const entity = this.entity;
    const player = this.player;
    const viewId = this.viewId;

    if (action === "assign_group" && entry.value) {
      try {
        setUnitGroup(entity, String(entry.value));
        const groupId = String(entry.value);
        const groupLabel = SpecialGroupLabels[groupId] || groupId;
        this.recordFeedback("Asignar grupo", groupLabel);
      } catch (e) {
        debugWarn("interactDDUI", `Error asignando grupo: ${e}`, "red");
        const text = `§cError asignando grupo`;
        this.observables.actionResultText.setData(text);
        setLastFeedbackText(entity.id, viewId, text);
      }
      return;
    }

    if (action === "set_global_overwrite" && typeof entry.value === "boolean") {
      try {
        setGlobalOverwriteAllowed(entity, entry.value);
        this.recordFeedback("Configuración", entry.value ? "Global" : "Local");
      } catch (e) {
        debugWarn("interactDDUI", `Error cambiando config global: ${e}`, "red");
        const text = `§cError config global`;
        this.observables.actionResultText.setData(text);
        setLastFeedbackText(entity.id, viewId, text);
      }
      return;
    }

    if (action === "toggle_entity_global_overwrite") {
      try {
        const current = isGlobalOverwriteAllowed(entity);
        setGlobalOverwriteAllowed(entity, !current);
        this.recordFeedback("Configuración", !current ? "Activada" : "Desactivada");
      } catch (e) {
        debugWarn("interactDDUI", `Error cambiando config global: ${e}`, "red");
        const text = `§cError config global`;
        this.observables.actionResultText.setData(text);
        setLastFeedbackText(entity.id, viewId, text);
      }
      return;
    }

    if (event) {
      let triggeredEvent = false;
      try {
        if (isAutoTameEvent(event)) {
          tryAutoTame(entity, player);
        }
        entity.triggerEvent(event);
        triggeredEvent = true;
      } catch (e) {
        debugWarn("interactDDUI", `Error aplicando evento ${event}: ${e}`, "red");
      }

      const mapped = findSystemStateByEvent(event);
      if (mapped && triggeredEvent) {
        setEntitySystemState(entity, mapped.systemId, mapped.value);
        const sysConfig = getSystemConfig(mapped.systemId);
        const sysDisplay = sysConfig?.displayName || mapped.systemId;
        const valueLabel = formatEntitySystemStateLabel(mapped.systemId, mapped.value);
        const context = SYSTEM_SHORT_NAMES[mapped.systemId] || categoryLabel || sysDisplay || mapped.systemId;
        debugMessage("interactDDUI", `Evento mapeado: sistema=${mapped.systemId} valor=${valueLabel}`, "green");
        this.recordFeedback(context, valueLabel);
      } else if (event && triggeredEvent && !mapped) {
        debugMessage("interactDDUI", `Evento específico disparado: evento=${event} label=${entry.label}`, "cyan");
        if (dynamicProperty) {
          try {
            entity.setDynamicProperty(dynamicProperty, event);
          } catch {}
        }
        const context = categoryLabel || "Variante";
        this.recordFeedback(context, entry.label);
      }
    }
  }

  buildObservableFromEntries(
    entries: MenuEntry[],
    dynamicProperty?: string,
    typeId?: string,
    categoryLabel?: string
  ): { obs: ObservableNumber; items: { label: string; value: number }[]; disabled: boolean } {
    let systemId: string | null = null;
    let currentRawValue: unknown = undefined;
    const entity = this.entity;

    if (entries.length > 0) {
      for (const entry of entries) {
        if (entry.event) {
          const mapped = findSystemStateByEvent(entry.event);
          if (mapped) {
            systemId = mapped.systemId;
            break;
          }
        }
      }
    }

    if (systemId) {
      currentRawValue = getEntitySystemState(entity, systemId);
    }

    if (currentRawValue === undefined && systemId) {
      const factionInfo = this.factionInfo;
      if (factionInfo) {
        const sysDefaults = getSystemDefaults(systemId) as Record<string, Record<string, unknown>> | undefined;
        const factionKey = factionInfo.faction;
        const subKey = factionInfo.isSpecial ? factionInfo.group : factionInfo.hierarchy;
        if (factionKey && subKey) {
          const fallback = sysDefaults?.[factionKey]?.[subKey];
          if (fallback !== undefined) currentRawValue = fallback;
        }
      }
    }

    if (currentRawValue === undefined && entries.some((entry) => entry.action === "assign_group")) {
      currentRawValue = getUnitGroup(entity);
    }

    if (
      currentRawValue === undefined &&
      dynamicProperty &&
      entries.some((entry) => entry.event && entry.event.startsWith("start_variant"))
    ) {
      currentRawValue = entity.getDynamicProperty(dynamicProperty);
    }

    let variantIndex = -1;
    if (entries.some((entry) => entry.event && entry.event.startsWith("start_variant"))) {
      const variantComp = entity.getComponent("minecraft:variant") as EntityVariantComponent | undefined;
      const variantValue = variantComp?.value;
      if (typeof variantValue === "number") {
        const variantEvent = `start_variant${variantValue}`;
        variantIndex = entries.findIndex((entry) => entry.event === variantEvent);
      }
    }

    let initialIndex = -1;
    if (variantIndex >= 0) {
      initialIndex = variantIndex;
    } else if (currentRawValue !== undefined && entries.length > 0) {
      const matchIndex = entries.findIndex((entry) => {
        if (entry.action === "assign_group" && entry.value !== undefined) {
          return entry.value === String(currentRawValue);
        }
        if (!entry.event) return false;
        const mapped = findSystemStateByEvent(entry.event);
        if (mapped) return mapped.value === currentRawValue;
        return entry.event === currentRawValue;
      });
      if (matchIndex >= 0) initialIndex = matchIndex;
    }

    const items = entries.map((entry, idx) => ({
      label: stripColorCodes(entry.label),
      value: idx,
      description: entry.description ? stripColorCodes(entry.description) : undefined,
    }));
    const fallbackIndex = entries.length > 0 ? 0 : -1;
    const obs = new ObservableNumber(initialIndex >= 0 ? initialIndex : fallbackIndex, { clientWritable: true });
    let lastAppliedIndex = initialIndex >= 0 ? initialIndex : fallbackIndex;
    obs.subscribe((newIndex) => {
      if (newIndex === lastAppliedIndex) return;
      if (newIndex < 0) return;
      const entry = entries[newIndex];
      if (entry) {
        this.applyEntryAction(entry, dynamicProperty, categoryLabel);
        lastAppliedIndex = newIndex;
      }
    });

    const allowed = typeId ? isAllowedByRule(systemId, typeId) : true;
    return { obs, items, disabled: !allowed };
  }

  cleanup(): void {
    if (this.cleaned) return;
    this.cleaned = true;
    for (const intervalId of this.intervalIds) {
      try {
        system.clearRun(intervalId);
      } catch {
        // intervalo ya limpiado o inválido
      }
    }
    debugMessage("interactDDUI", `Sesión limpiada: ${this.playerId}`, "gray");
  }
}

export interface InteractMenuSessionStore {
  get(playerId: string): InteractDDUISession | undefined;
  set(playerId: string, session: InteractDDUISession): void;
  delete(playerId: string): void;
  clear(): void;
  cleanup(playerId: string): void;
  cleanupByEntity(entityId: string): void;
}

const interactDDUISessions = new Map<string, InteractDDUISession>();

export const interactMenuSessionStore: InteractMenuSessionStore = {
  get(playerId: string) {
    return interactDDUISessions.get(playerId);
  },
  set(playerId: string, session: InteractDDUISession) {
    interactDDUISessions.set(playerId, session);
  },
  delete(playerId: string) {
    interactDDUISessions.delete(playerId);
  },
  clear() {
    for (const [, session] of interactDDUISessions) {
      session.cleanup();
    }
    interactDDUISessions.clear();
  },
  cleanup(playerId: string): void {
    const session = interactDDUISessions.get(playerId);
    if (!session) return;
    session.cleanup();
    interactDDUISessions.delete(playerId);
  },
  cleanupByEntity(entityId: string): void {
    for (const [playerId, session] of interactDDUISessions) {
      if (session.entity.id === entityId) {
        session.cleanup();
        interactDDUISessions.delete(playerId);
      }
    }
  },
};

export function createInteractMenuSession(
  playerId: string,
  player: Player,
  entity: Entity,
  cfg: EntityConfig,
  soldierName: string,
  displayName: string,
  typeId: string
): InteractDDUISession {
  const session = new InteractDDUISession(playerId, player, entity, cfg, soldierName, displayName, typeId);
  interactMenuSessionStore.set(playerId, session);
  debugMessage("interactDDUI", `Sesión creada: ${playerId}`, "green");
  return session;
}

export function getOrCreateInteractDDUISession(
  player: Player,
  entity: Entity,
  cfg: EntityConfig,
  soldierName: string,
  displayName: string,
  typeId: string
): InteractDDUISession {
  const playerId = player.id;
  let session = interactMenuSessionStore.get(playerId);
  if (!session) {
    session = createInteractMenuSession(playerId, player, entity, cfg, soldierName, displayName, typeId);
  }
  return session;
}

const lastFeedback = new Map<string, Record<string, string>>();

export function getLastFeedbackText(entityId: string, viewId: string): string {
  const entityMap = lastFeedback.get(entityId);
  if (entityMap) {
    const viewText = entityMap[viewId];
    if (viewText) return viewText;
  }
  return "§7Último cambio: §fN/A";
}

export function setLastFeedbackText(entityId: string, viewId: string, text: string): void {
  let entityMap = lastFeedback.get(entityId);
  if (!entityMap) {
    entityMap = {};
    lastFeedback.set(entityId, entityMap);
  }
  entityMap[viewId] = text;
}

export interface ChangeEntry {
  viewId: string;
  context: string;
  value: string;
  timestamp: number;
  localTime: string;
}

const history = new Map<string, ChangeEntry[]>();

export function pushHistory(entityId: string, entry: ChangeEntry): void {
  let entries = history.get(entityId);
  if (!entries) {
    entries = [];
    history.set(entityId, entries);
  }
  entries.unshift(entry);
  if (entries.length > 10) {
    entries.length = 10;
  }
}

export function getHistory(entityId: string): ChangeEntry[] {
  return history.get(entityId) || [];
}

export function cleanupEntityData(entityId: string): void {
  lastFeedback.delete(entityId);
  history.delete(entityId);
}

import { formatLocalTimeShort } from "../../shared/timeHelpers.js";

export function refreshStatus(
  entity: Entity,
  factionInfo: EntityFactionInfo | null
): { healthLabel: string; systemsLabel: string; systemStateDetail: string; configLabel: string } {
  const healthComp = entity.getComponent("health");
  const currentHealth = healthComp?.currentValue;
  const maxHealth = healthComp?.effectiveMax;

  const { totalSystems, savedSystems, statuses: systemStatuses } = getEntitySystemsStatus(entity);
  const dynamicProperties = entity.getDynamicPropertyIds?.() ?? [];

  const healthLine =
    typeof currentHealth === "number" && typeof maxHealth === "number"
      ? `§cVida: §a${Math.floor(currentHealth)} / ${Math.floor(maxHealth)}`
      : "§cVida: §a-- / --";

  const systemsLine = `§7Sistemas: §a${savedSystems} / ${totalSystems}`;

  const systemStateLines: string[] = [];

  systemStateLines.push(`§7Propiedades dinámicas: §r${dynamicProperties.length}`);

  if (systemStatuses.length) {
    systemStateLines.push("§7Configuración de la entidad:");
    for (const status of systemStatuses) {
      systemStateLines.push(`§7- §6${status.displayName}§r: ${status.label}`);
    }
  } else {
    systemStateLines.push("§7No hay sistemas configurados para esta unidad.");
  }

  const systemStateDetail = systemStateLines.join("\n");

  const configAllowed = isGlobalOverwriteAllowed(entity);
  const configLine = `§7Config: §a${configAllowed ? "Global" : "Local"}`;

  return {
    healthLabel: healthLine,
    systemsLabel: systemsLine,
    systemStateDetail,
    configLabel: configLine,
  };
}
