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
import { GROUP_LABELS, CATALOG_SYSTEMS, ERROR_MESSAGES, type SystemId } from "../../shared/systemCatalog.js";
import { getEntityFactionInfo, type EntityFactionInfo } from "../../commandMenu/model/menu_faction.js";
import { setUnitGroup, getUnitGroup } from "../../commandMenu/model/menu_groups.js";
import { isGlobalOverwriteAllowed, setGlobalOverwriteAllowed } from "../../shared/entityScope.js";
import { makeSystemId, isAllowedByRule, type EntityConfig } from "../gui.js";
import { stripColorCodes } from "../../monitorMenu/monitor_config.js";
import { tryAutoTame } from "../../commandMenu/core/menu_apply.js";
import { getGlobalOverwriteLabel } from "../../shared/entityScope.js";
import type { MenuEntry } from "../config.js";
import { SYSTEM_SHORT_NAMES } from "../config.js";
import { DDUIFeedbackEntry, INTERACT_PANEL_FEEDBACK_DEFAULT, formatFeedbackText } from "../../shared/dduiFeedback.js";

/**
 * Presenter local del interactMenu DDUI para feedback visual por jugador +
 * entidad + vista. A diferencia de `DDUIFeedbackPresenter` (compartido,
 * scope de 1 clave), este presenter opera sobre el `InteractMenuSessionStore`
 * con scope de 3 parámetros: `playerId`, `entityId`, `viewId`.
 *
 * Se usa exclusivamente dentro de `InteractDDUISession` y no se exporta
 * porque es un detalle de implementación del interactMenu.
 */
class InteractDDUIFeedbackPresenter {
  /** Identificador del jugador dueño del feedback. */
  private readonly playerId: string;
  /** Identificador de la entidad objetivo. */
  private readonly entityId: string;
  /** Identificador de la vista que representa el presenter. */
  private readonly viewId: string;
  /** Store al que se replica cada `present`. */
  private readonly store: InteractMenuSessionStore;
  /** Observable expuesto al form para renderizado reactivo. */
  private readonly observable: ObservableString;
  /** Flag para evitar resets múltiples. */
  private resetDone: boolean = false;

  /**
   * @param playerId Identificador del jugador.
   * @param entityId Identificador de la entidad.
   * @param viewId Identificador de la vista.
   * @param store Store del interactMenu (no es `DDUIFeedbackStore`).
   * @param initialText Texto inicial si el store no tiene entry previa.
   */
  constructor(
    playerId: string,
    entityId: string,
    viewId: string,
    store: InteractMenuSessionStore,
    initialText: string
  ) {
    this.playerId = playerId;
    this.entityId = entityId;
    this.viewId = viewId;
    this.store = store;

    const last = store.getLastFeedback(playerId, entityId, viewId);
    const initial = last ? formatFeedbackText(last) : initialText;
    this.observable = new ObservableString(initial);
  }

  /**
   * Actualiza el observable con la entry proporcionada y la replica al store.
   * El `viewId` y `timestamp` se completan automáticamente con los del presenter.
   * @param entry Datos del feedback sin `viewId` ni `timestamp`.
   */
  present(entry: { context: string; value: string; status: "ok" | "warn" | "error" | "idle" }): void {
    const full: DDUIFeedbackEntry = {
      ...entry,
      timestamp: Date.now(),
      viewId: this.viewId,
    };
    this.observable.setData(formatFeedbackText(full));
    this.store.setLastFeedback(this.playerId, this.entityId, this.viewId, full);
    debugMessage("dduiFeedback", `Feedback [${this.viewId}] ${full.context}: ${full.value}`, "gray");
  }

  /** Devuelve el `ObservableString` que el form debe usar como `form.label`. */
  getObservable(): ObservableString {
    return this.observable;
  }

  /** Libera el observable dejándolo en cadena vacía. Idempotente. */
  reset(): void {
    if (this.resetDone) return;
    this.resetDone = true;
    try {
      this.observable.setData("");
    } catch {
      // observable ya liberado o inválido
    }
  }
}

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
  feedbackPresenter: InteractDDUIFeedbackPresenter;
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
    const initialEntry = interactMenuSessionStore.getLastFeedback(playerId, entity.id, "main");
    const initialText = initialEntry ? formatFeedbackText(initialEntry) : INTERACT_PANEL_FEEDBACK_DEFAULT;
    this.feedbackPresenter = new InteractDDUIFeedbackPresenter(
      playerId,
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
    const initialEntry = interactMenuSessionStore.getLastFeedback(this.playerId, this.entity.id, viewId);
    const initialText = initialEntry ? formatFeedbackText(initialEntry) : INTERACT_PANEL_FEEDBACK_DEFAULT;
    this.feedbackPresenter = new InteractDDUIFeedbackPresenter(
      this.playerId,
      this.entity.id,
      viewId,
      interactMenuSessionStore,
      initialText
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
   * `lastFeedback` y `history` sobreviven a cierres del menú y
   * se limpian con `clearPlayerFeedback` (desconexión) y `clearEntityFeedbackForAll`
   * (muerte de la entidad).
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
 * a los Maps auxiliares (feedback por jugador+entidad, historial por entidad).
 * Toda operación sobre el estado del menú o de las entidades debe pasar por
 * aquí.
 */
export interface InteractMenuSessionStore {
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
   * Limpia todas las sesiones asociadas a una entidad (cuando la entidad muere)
   * y cierra los menús abiertos sobre ella. No toca el feedback ni el historial.
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
  create(
    playerId: string,
    player: Player,
    entity: Entity,
    cfg: EntityConfig,
    soldierName: string,
    displayName: string,
    typeId: string
  ): InteractDDUISession;
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
  getOrCreate(
    player: Player,
    entity: Entity,
    cfg: EntityConfig,
    soldierName: string,
    displayName: string,
    typeId: string
  ): InteractDDUISession;
  /**
   * Devuelve la última entry de feedback para una vista de la entidad y el
   * jugador dados.
   * @param playerId Identificador del jugador.
   * @param entityId Identificador de la entidad.
   * @param viewId Identificador de la vista (`main`, `systems`, etc.).
   * @returns La entry si existe, o `null`.
   */
  getLastFeedback(playerId: string, entityId: string, viewId: string): DDUIFeedbackEntry | null;
  /**
   * Registra la última entry de feedback para una vista de la entidad y el
   * jugador dados, sobreescribiendo cualquier entry previa.
   * @param playerId Identificador del jugador.
   * @param entityId Identificador de la entidad.
   * @param viewId Identificador de la vista.
   * @param entry Entry a almacenar.
   */
  setLastFeedback(playerId: string, entityId: string, viewId: string, entry: DDUIFeedbackEntry): void;
  /**
   * Elimina todo el feedback asociado a un jugador. Se invoca en
   * `playerLeave` para limpiar el scope per-jugador.
   * @param playerId Identificador del jugador.
   */
  clearPlayerFeedback(playerId: string): void;
  /**
   * Elimina el feedback de una entidad para todos los jugadores. Se invoca
   * en `entityDie` para limpiar el scope por entidad.
   * @param entityId Identificador de la entidad.
   */
  clearEntityFeedbackForAll(entityId: string): void;
  /**
   * Elimina todas las entries de feedback del store. No se invoca en el
   * flujo actual; se mantiene por simetría.
   */
  clearAll(): void;
  /**
   * Devuelve el último texto de feedback registrado para una vista de la
   * entidad y el jugador dados.
   * @param playerId Identificador del jugador.
   * @param entityId Identificador de la entidad.
   * @param viewId Identificador de la vista (`main`, `systems`, etc.).
   * @returns Texto almacenado, o el texto por defecto si no hay nada.
   */
  getLastFeedbackText(playerId: string, entityId: string, viewId: string): string;
  /**
   * Registra el último texto de feedback para una vista de la entidad y el
   * jugador dados.
   * @param playerId Identificador del jugador.
   * @param entityId Identificador de la entidad.
   * @param viewId Identificador de la vista.
   * @param text Texto a almacenar.
   */
  setLastFeedbackText(playerId: string, entityId: string, viewId: string, text: string): void;
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
   * Marca a un jugador como "en proceso de apertura" (flag de corta duración).
   * Se usa para prevenir la condición de carrera entre `playerInteractWithEntity`
   * e `itemUse`, que pueden dispararse sincrónicamente antes de que `system.run`
   * cree la sesión.
   * @param playerId Identificador del jugador.
   */
  setOpening(playerId: string): void;
  /**
   * Comprueba si un jugador está marcado como "en proceso de apertura".
   * @param playerId Identificador del jugador.
   * @returns `true` si la apertura está en curso.
   */
  isOpening(playerId: string): boolean;
  /**
   * Limpia el flag de "en proceso de apertura" para un jugador.
   * @param playerId Identificador del jugador.
   */
  clearOpening(playerId: string): void;
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
const lastFeedback = new Map<string, Map<string, Record<string, DDUIFeedbackEntry>>>();
const history = new Map<string, ChangeEntry[]>();
/** Flag per-jugador de "apertura en curso" para prevenir race conditions síncronas. */
const openingPlayers = new Set<string>();

/**
 * Store singleton de sesiones y datos auxiliares del interactMenu DDUI. Punto
 * único de acceso para sesiones por jugador, feedback por jugador+entidad+vista
 * (gestionado por `InteractDDUIFeedbackPresenter`) e historial por entidad.
 *
 * El feedback se limpia con `clearPlayerFeedback` en `playerLeave` y con
 * `clearEntityFeedbackForAll` en `entityDie`. No se usa `DDUIFeedbackStore`
 * ni `DDUIFeedbackPresenter` porque el scope del interactMenu es per-jugador
 * + entidad, lo cual no encaja en la firma de 1 clave de la interfaz
 * compartida.
 */
export const interactMenuSessionStore: InteractMenuSessionStore = {
  get(playerId: string) {
    return interactDDUISessions.get(playerId);
  },
  set(playerId: string, session: InteractDDUISession) {
    interactDDUISessions.set(playerId, session);
  },
  delete(playerId: string) {
    interactDDUISessions.delete(playerId);
    openingPlayers.delete(playerId);
  },
  clear() {
    for (const [, session] of interactDDUISessions) {
      session.cleanup();
    }
    interactDDUISessions.clear();
    openingPlayers.clear();
  },
  cleanup(playerId: string): void {
    const session = interactDDUISessions.get(playerId);
    if (!session) return;
    session.cleanup();
    interactDDUISessions.delete(playerId);
    openingPlayers.delete(playerId);
    debugMessage("interactDDUI", `Sesión limpiada y eliminada: ${session.playerId}`, "gray");
  },
  cleanupByEntity(entityId: string): void {
    for (const [playerId, session] of interactDDUISessions) {
      if (session.entity.id === entityId) {
        session.cleanup();
        interactDDUISessions.delete(playerId);
        openingPlayers.delete(playerId);
      }
    }
  },
  create(
    playerId: string,
    player: Player,
    entity: Entity,
    cfg: EntityConfig,
    soldierName: string,
    displayName: string,
    typeId: string
  ): InteractDDUISession {
    const session = new InteractDDUISession(playerId, player, entity, cfg, soldierName, displayName, typeId);
    interactDDUISessions.set(playerId, session);
    debugMessage("interactDDUI", `Sesión creada: ${playerId}`, "green");
    return session;
  },
  getOrCreate(
    player: Player,
    entity: Entity,
    cfg: EntityConfig,
    soldierName: string,
    displayName: string,
    typeId: string
  ): InteractDDUISession {
    const playerId = player.id;
    let session = interactDDUISessions.get(playerId);
    if (!session) {
      session = this.create(playerId, player, entity, cfg, soldierName, displayName, typeId);
    }
    return session;
  },
  setOpening(playerId: string): void {
    openingPlayers.add(playerId);
  },
  isOpening(playerId: string): boolean {
    return openingPlayers.has(playerId);
  },
  clearOpening(playerId: string): void {
    openingPlayers.delete(playerId);
  },
  getLastFeedback(playerId: string, entityId: string, viewId: string): DDUIFeedbackEntry | null {
    const entityMap = lastFeedback.get(playerId);
    if (!entityMap) return null;
    return entityMap.get(entityId)?.[viewId] ?? null;
  },
  setLastFeedback(playerId: string, entityId: string, viewId: string, entry: DDUIFeedbackEntry): void {
    let playerMap = lastFeedback.get(playerId);
    if (!playerMap) {
      playerMap = new Map();
      lastFeedback.set(playerId, playerMap);
    }
    let entityMap = playerMap.get(entityId);
    if (!entityMap) {
      entityMap = {};
      playerMap.set(entityId, entityMap);
    }
    entityMap[viewId] = entry;
  },
  clearPlayerFeedback(playerId: string): void {
    lastFeedback.delete(playerId);
  },
  clearEntityFeedbackForAll(entityId: string): void {
    for (const [pid, entityMap] of lastFeedback) {
      entityMap.delete(entityId);
      if (entityMap.size === 0) {
        lastFeedback.delete(pid);
      }
    }
  },
  clearAll(): void {
    lastFeedback.clear();
  },
  getLastFeedbackText(playerId: string, entityId: string, viewId: string): string {
    const entry = this.getLastFeedback(playerId, entityId, viewId);
    if (entry) return formatFeedbackText(entry);
    return INTERACT_PANEL_FEEDBACK_DEFAULT;
  },
  setLastFeedbackText(playerId: string, entityId: string, viewId: string, text: string): void {
    // Compatibilidad hacia atrás: se mantiene la firma legacy que recibe un
    // texto formateado. Internamente se descompone para almacenar la entry.
    this.setLastFeedback(playerId, entityId, viewId, {
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
      const shortName = SYSTEM_SHORT_NAMES[status.systemId] || status.displayName;

      systemStateLines.push(`§7- §6${shortName}§r: ${status.label}`);
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

/**
 * Maneja el caso de entidad inválida (muerta o eliminada): opcionalmente cierra
 * el formulario abierto, limpia la sesión del jugador del store y notifica al
 * jugador. Centraliza el patrón de cleanup+notify para evitar sesiones fantasmas.
 *
 * @param player  Jugador cuya sesión se limpia y al que se notifica.
 * @param form  Formulario `CustomForm` abierto (opcional). Se cierra si se provee.
 */
export function handleInvalidEntity(player: Player, form?: { close(): void }): void {
  if (form) {
    try {
      form.close();
    } catch {
      // form ya cerrado o no visible
    }
  }
  interactMenuSessionStore.cleanup(player.id);
  try {
    player.sendMessage(ERROR_MESSAGES.ENTITY_NOT_AVAILABLE);
  } catch {
    // jugador desconectado
  }
  debugMessage("interactDDUI", `Entidad inválida: sesión limpiada para ${player.id}`, "gray");
}
