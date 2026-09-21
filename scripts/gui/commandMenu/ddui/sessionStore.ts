// scripts/gui/commandMenu/ddui/sessionStore.ts

import { Player, system, EquipmentSlot } from "@minecraft/server";
import { debug } from "../../../utils/debug.js";
import { EquipmentDetector, FactionId } from "../../shared/equipmentDetector.js";
import { TargetFaction } from "../../../constants/domains.js";
import { DDUIFeedbackEntry, DDUIFeedbackPresenter, DDUIFeedbackStore } from "../../shared/dduiFeedback.js";

/**
 * Interfaz que encapsula el acceso al Map de sesiones del commandMenu DDUI.
 * Toda operación sobre las sesiones de jugadores debe pasar por aquí, nunca
 * accediendo directamente a la estructura interna.
 */
export interface SessionStore {
  /**
   * Recupera la sesión asociada a un jugador.
   * @param playerId Identificador del jugador.
   * @returns La sesión si existe, o `undefined` si no hay sesión activa.
   */
  get(playerId: string): CommandMenuSession | undefined;
  /**
   * Registra una sesión en el store.
   * @param playerId Identificador del jugador.
   * @param session Sesión a registrar.
   */
  set(playerId: string, session: CommandMenuSession): void;
  /**
   * Elimina la entrada del jugador del store sin invocar cleanup.
   * @param playerId Identificador del jugador.
   */
  delete(playerId: string): void;
  /** Limpia todas las sesiones, invocando `cleanup` en cada una y vaciando el store. */
  clear(): void;
  /**
   * Punto de cleanup centralizado por jugador: limpia los recursos de la sesión
   * (intervalos, observadores) y la elimina del store.
   * @param playerId Identificador del jugador.
   */
  cleanup(playerId: string): void;
  /**
   * Crea una nueva sesión, la registra en el store y la devuelve.
   * @param playerId Identificador del jugador.
   * @param playerName Nombre visible del jugador (usado en logs y etiquetas).
   * @param player Referencia al objeto `Player` de Bedrock.
   * @param faction Facción activa del jugador.
   * @param role Rol del jugador dentro de la facción.
   * @returns La sesión recién creada.
   */
  create(playerId: string, playerName: string, player: Player, faction: string, role: string): CommandMenuSession;
}

/**
 * Sesión de menú de comandos asociada a un jugador. Mantiene el estado mutable
 * que persiste entre vistas (filtros, facción objetivo, intervalos activos)
 * durante la vida del menú. Incluye un punto de cleanup explícito
 * (`cleanup()`) que se invoca cuando se cierra el menú o el jugador sale.
 */
export class CommandMenuSession {
  /** Identificador del jugador. */
  readonly playerId: string;
  /** Nombre del jugador, capturado al crear la sesión. */
  readonly playerName: string;
  /** Referencia al `Player` de Bedrock. */
  player: Player;
  /** Facción activa del jugador al momento de crear la sesión (FactionId, nunca "both"). */
  faction: FactionId;
  /** Rol del jugador dentro de la facción. */
  role: string;
  /** Intervalos registrados en la sesión, se limpian en `cleanup()`. */
  private readonly intervalIds: number[] = [];
  /** Estado mutable compartido entre vistas (filtros, facción objetivo, etc.). */
  formState: Record<string, unknown> = {};
  /** Vista actual del menú (se actualiza al navegar entre paneles). */
  viewId: string = "main";
  /** Historial local de la sesión, limitado a 50 entradas. */
  history: Array<{ text: string; timestamp: number }> = [];
  /** Presenters de feedback por vista. Se destruyen en `cleanup()`. */
  private readonly feedbackPresenters: Map<string, DDUIFeedbackPresenter> = new Map();
  /** Id del intervalo de vigilancia del casco, si está activo. */
  helmetWatchIntervalId?: number;
  /** Último `typeId` observado en el casco del jugador. */
  lastKnownHelmetTypeId?: string | null;

  /**
   * @param playerId Identificador del jugador.
   * @param playerName Nombre visible del jugador.
   * @param player Referencia al `Player` de Bedrock.
   * @param faction Facción activa.
   * @param role Rol del jugador.
   */
  constructor(playerId: string, playerName: string, player: Player, faction: string, role: string) {
    this.playerId = playerId;
    this.playerName = playerName;
    this.player = player;
    this.faction = faction as FactionId;
    this.role = role;
  }

  /**
   * Cambia la vista activa de la sesión (no navega, solo actualiza el id).
   * @param viewId Identificador de la nueva vista.
   */
  changeView(viewId: string): void {
    this.viewId = viewId;
  }

  /**
   * Registra un `system.runInterval` en la sesión para asegurar su cleanup.
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
      debug("commandMenuDDUI", `Intervalo desregistrado: §b${intervalId}§r`, { level: "debug", color: "gray" });
    }
  }

  /**
   * Inicia un watcher que invoca `onChange` cuando cambia el casco equipado.
   * Cualquier watcher previo se detiene antes de iniciar el nuevo.
   * @param onChange Callback con la facción activa detectada al cambiar.
   */
  startHelmetWatch(onChange: (currentFaction: FactionId | null) => void): void {
    this.stopHelmetWatch();

    const check = () => {
      const currentFaction = EquipmentDetector.getActiveFaction(this.player);
      const currentTypeId = this.player.getComponent("equippable")?.getEquipment(EquipmentSlot.Head)?.typeId ?? null;

      if (currentTypeId !== this.lastKnownHelmetTypeId) {
        this.lastKnownHelmetTypeId = currentTypeId;
        onChange(currentFaction);
      }
    };

    check();
    const intervalId = system.runInterval(check, 20);
    this.helmetWatchIntervalId = intervalId;
    this.registerInterval(intervalId);
  }

  /** Detiene y limpia el watcher de casco, si está activo. */
  stopHelmetWatch(): void {
    if (this.helmetWatchIntervalId !== undefined) {
      try {
        system.clearRun(this.helmetWatchIntervalId);
      } catch {
        // intervalo ya limpiado o inválido
      }
      this.helmetWatchIntervalId = undefined;
    }
  }

  /** Alias explícito de `cleanup()` orientado a uso como destructor lógico. */
  destroy(): void {
    this.stopHelmetWatch();
    this.cleanup();
  }

  /**
   * Agrega una entrada al historial interno (limitado a 50 elementos).
   * @param text Texto a almacenar.
   */
  addHistory(text: string): void {
    this.history.push({ text, timestamp: Date.now() });
    if (this.history.length > 50) this.history.shift();
  }

  /**
   * Devuelve el presenter de feedback para la vista indicada, creándolo si no
   * existe. El presenter se rehidrata desde `commandMenuSessionStore` si hay
   * una entry previa. Se destruye en `cleanup()`.
   * @param viewId Identificador de la vista (`"system:movement"`, `"scope"`, etc.).
   * @param initialText Texto inicial si no hay entry previa en el store.
   * @returns El presenter existente o recién creado.
   */
  getOrCreateFeedbackPresenter(viewId: string, initialText: string): DDUIFeedbackPresenter {
    const existing = this.feedbackPresenters.get(viewId);
    if (existing) return existing;
    const presenter = new DDUIFeedbackPresenter(this.playerId, viewId, commandMenuSessionStore, initialText);
    this.feedbackPresenters.set(viewId, presenter);
    return presenter;
  }

  /** Limpia intervalos, watcher de casco, presenters de feedback y referencias de la sesión. */
  cleanup(): void {
    this.stopHelmetWatch();
    for (const intervalId of this.intervalIds) {
      try {
        system.clearRun(intervalId);
      } catch {
        // intervalo ya limpiado o inválido
      }
    }
    for (const presenter of this.feedbackPresenters.values()) {
      presenter.reset();
    }
    this.feedbackPresenters.clear();
    debug("commandMenuDDUI", `Sesión limpiada: §b${this.playerName}§r`, { level: "debug", color: "gray" });
  }

  /**
   * Facción objetivo del admin (incluye "both").
   * Alias tipado sobre `formState.targetFaction`.
   * @returns Facción objetivo, o `undefined` si no está seteada.
   */
  getTargetFaction(): TargetFaction | undefined {
    return this.formState.targetFaction as TargetFaction | undefined;
  }

  /**
   * Setea la facción objetivo del admin.
   * @param faction Facción objetivo a guardar.
   */
  setTargetFaction(faction: TargetFaction): void {
    this.formState.targetFaction = faction;
  }
}

const sessions = new Map<string, CommandMenuSession>();
const lastFeedbackByPlayer = new Map<string, Record<string, DDUIFeedbackEntry>>();

/**
 * Store singleton de sesiones del commandMenu DDUI. Punto único de acceso,
 * creación y limpieza para mantener la encapsulación del estado. Implementa
 * `DDUIFeedbackStore` para el feedback visual por vista (vida = conexión del
 * jugador; se limpia con `playerLeave`).
 */
export const commandMenuSessionStore: SessionStore & DDUIFeedbackStore = {
  get(playerId: string) {
    return sessions.get(playerId);
  },
  set(playerId: string, session: CommandMenuSession) {
    sessions.set(playerId, session);
  },
  delete(playerId: string) {
    sessions.delete(playerId);
  },
  clear() {
    for (const [playerId, session] of sessions) {
      session.cleanup();
    }
    sessions.clear();
  },
  cleanup(playerId: string): void {
    const session = sessions.get(playerId);
    if (!session) return;
    session.cleanup();
    sessions.delete(playerId);
    debug("commandMenuDDUI", `Sesión limpiada y eliminada: §b${session.playerName}§r`, {
      level: "debug",
      color: "gray",
    });
  },
  create(playerId: string, playerName: string, player: Player, faction: string, role: string): CommandMenuSession {
    const session = new CommandMenuSession(playerId, playerName, player, faction, role);
    sessions.set(playerId, session);
    debug("commandMenuDDUI", `Sesión creada: §b${playerName}§r (§a${faction}§r/§6${role}§r)`, {
      level: "debug",
      color: "light_purple",
    });
    return session;
  },
  getLast(playerId: string, viewId: string): DDUIFeedbackEntry | null {
    const map = lastFeedbackByPlayer.get(playerId);
    if (!map) return null;
    return map[viewId] ?? null;
  },
  setLast(playerId: string, viewId: string, entry: DDUIFeedbackEntry): void {
    let map = lastFeedbackByPlayer.get(playerId);
    if (!map) {
      map = {};
      lastFeedbackByPlayer.set(playerId, map);
    }
    map[viewId] = entry;
  },
  clearKey(playerId: string): void {
    lastFeedbackByPlayer.delete(playerId);
    debug("commandMenuDDUI", `Feedback del jugador limpiado: §b${playerId}§r`, { level: "debug", color: "gray" });
  },
  clearAll(): void {
    lastFeedbackByPlayer.clear();
  },
};
