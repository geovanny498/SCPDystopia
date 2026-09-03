// scripts/gui/interactMenu/ddui/interact_ddui_shared.ts

import { ObservableNumber, ObservableString } from "@minecraft/server-ui";
import { Entity, Player, EntityVariantComponent, system } from "@minecraft/server";
import { formatLocalTimeShort } from "../../shared/timeHelpers.js";
import { debugWarn, debugMessage } from "../../../utils/debug.js";
import {
  getEntitySystemsStatus,
  isAutoTameEvent,
  findSystemStateByEvent,
  setEntitySystemState,
  formatEntitySystemStateLabel,
  getEntitySystemState,
  getSystemDefaults,
} from "../../commandMenu/menu_config.js";
import { SpecialGroups, UnitHierarchy, Factions } from "../../../constants/domains.js";
import { GROUP_LABELS, CATALOG_SYSTEMS, type SystemId } from "../../shared/systemCatalog.js";
import { getEntityFactionInfo, type EntityFactionInfo } from "../../commandMenu/model/menu_faction.js";
import { setUnitGroup, getUnitGroup } from "../../commandMenu/model/menu_groups.js";
import {
  isGlobalOverwriteAllowed,
  setGlobalOverwriteAllowed,
} from "../../shared/entityScope.js";
import {
  makeSystemId,
  isAllowedByRule,
  type EntityConfig,
} from "../gui.js";
import { stripColorCodes } from "../../monitorMenu/monitor_config.js";
import { tryAutoTame } from "../../commandMenu/core/menu_apply.js";
import { getGlobalOverwriteLabel } from "../../shared/entityScope.js";
import type { MenuEntry } from "../config.js";
import { SYSTEM_SHORT_NAMES } from "../config.js";
import {
  DDUIFeedbackEntry,
  DDUIFeedbackPresenter,
  DDUIFeedbackStore,
  INTERACT_PANEL_FEEDBACK_DEFAULT,
  formatFeedbackText,
} from "../../shared/dduiFeedback.js";

export class InteractDDUISession {
  /** Identificador del jugador dueño de la sesión. */
  readonly playerId: string;
  /** Referencia al `Player` de Bedrock. */
  readonly player: Player;
  /** Entidad que está siendo gestionada por la sesión. */
  readonly entity: Entity;
  /** Configuración de menú efectiva para la entidad. */
  readonly cfg: EntityConfig;
  /** Nombre interno del soldado. */
  readonly soldierName: string;
  /** Nombre a mostrar en el UI. */
  readonly displayName: string;
  /** `typeId` de la entidad. */
  readonly typeId: string;
  /** Vista actual del menú (`main`, `systems`, `management`, `history`). */
  viewId: string;
  /** Información de facción cacheada para la entidad. */
  factionInfo: EntityFactionInfo | null;
  /** Observables compartidos con los forms para refresco reactivo. */
  readonly observables: {
    /** Label de vida actual/máxima. */
    healthText: ObservableString;
    /** Detalle de sistemas configurados. */
    systemStateDetailText: ObservableString;
    /** Texto del último cambio aplicado. Se rehidrata desde el presenter al cambiar de vista. */
    actionResultText: ObservableString;
    /** Detalle de facción/grupo/jerarquía. */
    groupDetailText: ObservableString;
  };
  /** Presenter de feedback visual de la vista activa. */
  feedbackPresenter: DDUIFeedbackPresenter;
  /** Ids de intervalos registrados en la sesión, limpiados en `cleanup()`. */
  private readonly intervalIds: number[] = [];
  /** Flag para evitar limpieza múltiple. */
  private cleaned = false;

  /**
   * @param playerId Identificador del jugador.
   * @param player Referencia al `Player` de Bedrock.
   * @param entity Entidad objetivo del menú.
   * @param cfg Configuración de menú de la entidad.
   * @param soldierName Nombre del soldado (interno).
   * @param displayName Nombre a mostrar.
   * @param typeId `typeId` de la entidad.
   */
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
    const initialText = interactMenuSessionStore.getLastFeedbackText(entity.id, "main");
    this.feedbackPresenter = new DDUIFeedbackPresenter(
      entity.id,
      "main",
      interactMenuSessionStore,
      initialText
    );
    this.observables = {
      healthText: new ObservableString("§cVida: §a-- / --"),
      systemStateDetailText: new ObservableString(""),
      actionResultText: this.feedbackPresenter.getObservable(),
      groupDetailText: new ObservableString(""),
    };
  }

  /**
   * Cambia la vista activa de la sesión y rehidrata el presenter desde el
   * store con el `viewId` correspondiente. Llamado por cada vista del menú.
   * @param viewId Identificador de la nueva vista.
   */
  setView(viewId: string): void {
    this.viewId = viewId;
    const initial = interactMenuSessionStore.getLastFeedbackText(this.entity.id, viewId);
    this.feedbackPresenter = new DDUIFeedbackPresenter(
      this.entity.id,
      viewId,
      interactMenuSessionStore,
      initial
    );
    this.observables.actionResultText = this.feedbackPresenter.getObservable();
  }

  /**
   * Registra un `system.runInterval` para asegurar su cleanup con la sesión.
   * @param intervalId Id devuelto por `system.runInterval`.
   */
  registerInterval(intervalId: number): void {
    this.intervalIds.push(intervalId);
  }

  /**
   * Desregistra y limpia un intervalo previamente registrado.
   * @param intervalId Id a remover de la sesión.
   */
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

  /**
   * Registra feedback del último cambio en el presenter (que actualiza el
   * `ObservableString` y el store) y en el historial por entidad. El
   * historial es independiente del feedback visual y mantiene los últimos
   * 10 cambios para la vista de historial del interactMenu.
   * @param context Contexto del cambio (sistema o categoría).
   * @param value Valor aplicado.
   * @param status Estado semántico (`"ok"`, `"warn"`, `"error"`). Por defecto `"ok"`.
   */
  recordFeedback(context: string, value: string, status: "ok" | "warn" | "error" = "ok"): void {
    this.feedbackPresenter.present({ context, value, status });
    interactMenuSessionStore.pushHistory(this.entity.id, {
      viewId: this.viewId,
      context,
      value,
      timestamp: Date.now(),
      localTime: formatLocalTimeShort(Date.now()),
    });
  }

  /**
   * Aplica la acción asociada a una entrada de menú (evento, asignación de
   * grupo, cambio de config) sobre la entidad objetivo y registra feedback.
   * @param entry Entrada de menú seleccionada.
   * @param dynamicProperty Propiedad dinámica opcional a escribir.
   * @param categoryLabel Etiqueta de categoría para el feedback.
   */
  applyEntryAction(entry: MenuEntry, dynamicProperty?: string, categoryLabel?: string): void {
    const action = entry.action;
    const event = entry.event;
    const entity = this.entity;
    const player = this.player;

    if (action === "assign_group" && entry.value) {
      try {
        setUnitGroup(entity, String(entry.value));
        const groupId = String(entry.value);
        const groupLabel = GROUP_LABELS[groupId] || groupId;
        this.recordFeedback("Asignar grupo", groupLabel);
      } catch (e) {
        debugWarn("interactDDUI", `Error asignando grupo: ${e}`, "red");
        this.recordFeedback("Asignar grupo", "Error", "error");
      }
      return;
    }

    if (action === "set_global_overwrite" && typeof entry.value === "boolean") {
      try {
        setGlobalOverwriteAllowed(entity, entry.value);
        this.recordFeedback("Configuración", entry.value ? "Global" : "Local");
      } catch (e) {
        debugWarn("interactDDUI", `Error cambiando config global: ${e}`, "red");
        this.recordFeedback("Configuración", "Error", "error");
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
        this.recordFeedback("Configuración", "Error", "error");
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
        const sysConfig = CATALOG_SYSTEMS[mapped.systemId as SystemId];
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
      } else if (event && !triggeredEvent) {
        this.recordFeedback(categoryLabel || "Variante", entry.label, "error");
      }
    }
  }

  /**
   * Construye un observable para una lista de entradas de menú, resolviendo
   * el valor inicial a partir del estado de la entidad y disparando la
   * acción correspondiente al cambiar de selección.
   * @param entries Entradas que componen el dropdown.
   * @param dynamicProperty Propiedad dinámica opcional asociada a la entrada.
   * @param typeId `typeId` de la entidad (para reglas de habilitación).
   * @param categoryLabel Etiqueta de la categoría para feedback.
   * @returns Observable, items listos para `form.dropdown` y flag de deshabilitado.
   */
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

  /**
   * Limpia los intervalos registrados en la sesión y libera el presenter de
   * feedback de la vista activa. Idempotente. **No** toca el store:
   * `lastFeedback` y `history` por entidad sobreviven a cierres del menú y
   * se limpian con `cleanupByEntity` cuando la entidad muere/removida.
   */
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
    this.feedbackPresenter.reset();
    debugMessage("interactDDUI", `Sesión limpiada: ${this.playerId}`, "gray");
  }
}

/**
 * Interfaz que encapsula el acceso al Map de sesiones del interactMenu DDUI y
 * a los Maps auxiliares (feedback por entidad, historial). Toda operación
 * sobre el estado del menú o de las entidades debe pasar por aquí.
 */
export interface InteractMenuSessionStore extends DDUIFeedbackStore {
  /**
   * Recupera la sesión del jugador.
   * @param playerId Identificador del jugador.
   * @returns La sesión si existe, o `undefined`.
   */
  get(playerId: string): InteractDDUISession | undefined;
  /**
   * Registra una sesión en el store.
   * @param playerId Identificador del jugador.
   * @param session Sesión a registrar.
   */
  set(playerId: string, session: InteractDDUISession): void;
  /**
   * Elimina la entrada del jugador del store sin invocar cleanup.
   * @param playerId Identificador del jugador.
   */
  delete(playerId: string): void;
  /** Limpia todas las sesiones y los datos auxiliares de las entidades. */
  clear(): void;
  /**
   * Limpia los recursos de la sesión del jugador y la elimina del store.
   * @param playerId Identificador del jugador.
   */
  cleanup(playerId: string): void;
  /**
   * Limpia todas las sesiones asociadas a una entidad (cuando la entidad muere
   * o es removida) y los datos auxiliares de esa entidad.
   * @param entityId Identificador de la entidad.
   */
  cleanupByEntity(entityId: string): void;
  /**
   * Crea y registra una nueva sesión para el jugador.
   * @param playerId Identificador del jugador.
   * @param player Referencia al `Player` de Bedrock.
   * @param entity Entidad objetivo.
   * @param cfg Configuración de menú de la entidad.
   * @param soldierName Nombre del soldado.
   * @param displayName Nombre a mostrar.
   * @param typeId `typeId` de la entidad.
   * @returns La sesión recién creada.
   */
  create(playerId: string, player: Player, entity: Entity, cfg: EntityConfig, soldierName: string, displayName: string, typeId: string): InteractDDUISession;
  /**
   * Devuelve la sesión del jugador si existe; si no, la crea y la registra.
   * @param player Referencia al `Player` de Bedrock.
   * @param entity Entidad objetivo.
   * @param cfg Configuración de menú de la entidad.
   * @param soldierName Nombre del soldado.
   * @param displayName Nombre a mostrar.
   * @param typeId `typeId` de la entidad.
   * @returns La sesión existente o recién creada.
   */
  getOrCreate(player: Player, entity: Entity, cfg: EntityConfig, soldierName: string, displayName: string, typeId: string): InteractDDUISession;
  /**
   * Devuelve el último texto de feedback registrado para una vista de la entidad.
   * @param entityId Identificador de la entidad.
   * @param viewId Identificador de la vista (`main`, `systems`, etc.).
   * @returns Texto almacenado, o el texto por defecto si no hay nada.
   */
  getLastFeedbackText(entityId: string, viewId: string): string;
  /**
   * Registra el último texto de feedback para una vista de la entidad.
   * @param entityId Identificador de la entidad.
   * @param viewId Identificador de la vista.
   * @param text Texto a almacenar.
   */
  setLastFeedbackText(entityId: string, viewId: string, text: string): void;
  /**
   * Devuelve el historial reciente de cambios aplicados a la entidad.
   * @param entityId Identificador de la entidad.
   * @returns Lista de entradas (puede estar vacía).
   */
  getHistory(entityId: string): ChangeEntry[];
  /**
   * Inserta una entrada al inicio del historial de la entidad (limitado a 10).
   * @param entityId Identificador de la entidad.
   * @param entry Entrada a registrar.
   */
  pushHistory(entityId: string, entry: ChangeEntry): void;
  /**
   * Elimina los datos auxiliares (feedback e historial) asociados a una entidad.
   * Se invoca cuando la entidad muere o es removida.
   * @param entityId Identificador de la entidad.
   */
  cleanupEntityData(entityId: string): void;
}

/**
 * Entrada de historial para un cambio aplicado a una entidad desde el menú.
 */
export interface ChangeEntry {
  /** Vista del menú donde se aplicó el cambio. */
  viewId: string;
  /** Contexto del cambio (sistema o categoría). */
  context: string;
  /** Valor aplicado. */
  value: string;
  /** Timestamp en milisegundos. */
  timestamp: number;
  /** Hora local formateada corta. */
  localTime: string;
}

const interactDDUISessions = new Map<string, InteractDDUISession>();
const lastFeedback = new Map<string, Record<string, DDUIFeedbackEntry>>();
const history = new Map<string, ChangeEntry[]>();

/**
 * Store singleton de sesiones y datos auxiliares del interactMenu DDUI. Punto
 * único de acceso para sesiones por jugador, feedback por entidad y
 * historial por entidad. Implementa `DDUIFeedbackStore` para el feedback
 * visual por vista (vida = existencia de la entidad; se limpia con
 * `cleanupByEntity`).
 */
export const interactMenuSessionStore: InteractMenuSessionStore & DDUIFeedbackStore = {
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
    debugMessage("interactDDUI", `Sesión limpiada y eliminada: ${session.playerId}`, "gray");
  },
  cleanupByEntity(entityId: string): void {
    for (const [playerId, session] of interactDDUISessions) {
      if (session.entity.id === entityId) {
        session.cleanup();
        interactDDUISessions.delete(playerId);
      }
    }
  },
  create(playerId: string, player: Player, entity: Entity, cfg: EntityConfig, soldierName: string, displayName: string, typeId: string): InteractDDUISession {
    const session = new InteractDDUISession(playerId, player, entity, cfg, soldierName, displayName, typeId);
    interactDDUISessions.set(playerId, session);
    debugMessage("interactDDUI", `Sesión creada: ${playerId}`, "green");
    return session;
  },
  getOrCreate(player: Player, entity: Entity, cfg: EntityConfig, soldierName: string, displayName: string, typeId: string): InteractDDUISession {
    const playerId = player.id;
    let session = interactDDUISessions.get(playerId);
    if (!session) {
      session = this.create(playerId, player, entity, cfg, soldierName, displayName, typeId);
    }
    return session;
  },
  getLast(entityId: string, viewId: string): DDUIFeedbackEntry | null {
    const entityMap = lastFeedback.get(entityId);
    if (!entityMap) return null;
    return entityMap[viewId] ?? null;
  },
  setLast(entityId: string, viewId: string, entry: DDUIFeedbackEntry): void {
    let entityMap = lastFeedback.get(entityId);
    if (!entityMap) {
      entityMap = {};
      lastFeedback.set(entityId, entityMap);
    }
    entityMap[viewId] = entry;
  },
  clearKey(entityId: string): void {
    lastFeedback.delete(entityId);
  },
  clearAll(): void {
    lastFeedback.clear();
  },
  getLastFeedbackText(entityId: string, viewId: string): string {
    const entry = this.getLast(entityId, viewId);
    if (entry) return formatFeedbackText(entry);
    return INTERACT_PANEL_FEEDBACK_DEFAULT;
  },
  setLastFeedbackText(entityId: string, viewId: string, text: string): void {
    // Compatibilidad hacia atrás: se mantiene la firma legacy que recibe un
    // texto formateado. Internamente se descompone para almacenar la entry.
    this.setLast(entityId, viewId, {
      context: "Vista",
      value: text,
      status: "ok",
      timestamp: Date.now(),
      viewId,
    });
  },
  getHistory(entityId: string): ChangeEntry[] {
    return history.get(entityId) || [];
  },
  pushHistory(entityId: string, entry: ChangeEntry): void {
    let entries = history.get(entityId);
    if (!entries) {
      entries = [];
      history.set(entityId, entries);
    }
    entries.unshift(entry);
    if (entries.length > 10) {
      entries.length = 10;
    }
  },
  cleanupEntityData(entityId: string): void {
    lastFeedback.delete(entityId);
    history.delete(entityId);
  },
};

/**
 * Genera los labels de estado para una entidad a partir de su facción.
 * @param entity Entidad a inspeccionar.
 * @param factionInfo Información de facción cacheada (puede ser `null`).
 * @returns Labels listos para mostrar en el form (vida, sistemas, detalle, config).
 */
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
  const configLine = `§7Config: §a${getGlobalOverwriteLabel(entity)}`;

  return {
    healthLabel: healthLine,
    systemsLabel: systemsLine,
    systemStateDetail,
    configLabel: configLine,
  };
}
