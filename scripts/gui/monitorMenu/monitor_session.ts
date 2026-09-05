// scripts/gui/monitorMenu/monitor_session.ts

import { Player, system } from "@minecraft/server";
import { ObservableString } from "@minecraft/server-ui";
import { MonitorConfig, MonitorConfigDefaults, MonitorConfigLabels } from "./monitor_config.js";
import { loadMonitorConfig, saveMonitorConfig, clearMonitorConfig } from "./monitor_state.js";
import { debugMessage, debugWarn } from "../../utils/debug.js";

/**
 * Interfaz que encapsula el acceso al Map de sesiones del monitor. Toda
 * operación sobre las sesiones debe pasar por aquí, nunca accediendo
 * directamente a la estructura interna.
 */
export interface MonitorMenuSessionStore {
  /**
   * Recupera la sesión del jugador.
   * @param playerId Identificador del jugador.
   * @returns La sesión si existe, o `undefined`.
   */
  get(playerId: string): MonitorMenuSession | undefined;
  /**
   * Registra una sesión en el store.
   * @param playerId Identificador del jugador.
   * @param session Sesión a registrar.
   */
  set(playerId: string, session: MonitorMenuSession): void;
  /**
   * Elimina la entrada del jugador del store sin invocar cleanup.
   * @param playerId Identificador del jugador.
   */
  delete(playerId: string): void;
  /** Limpia todas las sesiones, invocando `cleanup` en cada una. */
  clear(): void;
  /**
   * Limpia los recursos de la sesión del jugador y la elimina del store.
   * @param playerId Identificador del jugador.
   */
  cleanup(playerId: string): void;
}

/**
 * Sesión del menú de monitor asociada a un jugador. Mantiene la configuración
 * persistida y los textos observables que alimentan los labels del form.
 * Incluye un punto de cleanup explícito (`cleanup()`) que se invoca al cerrar
 * el menú o cuando el jugador sale del mundo.
 */
export class MonitorMenuSession {
  /** Identificador del jugador. */
  readonly playerId: string;
  /** Referencia al `Player` de Bedrock. */
  readonly player: Player;
  /** Ids de intervalos registrados, limpiados en `cleanup()`. */
  private readonly intervalIds: number[] = [];
  /** Flag para evitar limpieza múltiple. */
  private cleaned = false;
  /** Texto observable de la facción Foundation. */
  private foundationText: ObservableString;
  /** Texto observable de la facción Chaos. */
  private chaosText: ObservableString;
  /** Configuración persistida del monitor para este jugador. */
  private config: MonitorConfig;

  /**
   * @param player Referencia al `Player` de Bedrock.
   */
  constructor(player: Player) {
    this.playerId = player.id;
    this.player = player;
    this.foundationText = new ObservableString("§8Actualizando...");
    this.chaosText = new ObservableString("§8Actualizando...");
    this.config = loadMonitorConfig(player);
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
      debugMessage("monitorCommand", `Intervalo desregistrado: ${intervalId}`, "gray");
    }
  }

  /**
   * @returns Texto observable con el resumen de la facción Foundation.
   */
  getFoundationText(): ObservableString {
    return this.foundationText;
  }

  /**
   * @returns Texto observable con el resumen de la facción Chaos.
   */
  getChaosText(): ObservableString {
    return this.chaosText;
  }

  /**
   * @returns Copia de la configuración persistida del monitor.
   */
  getConfig(): MonitorConfig {
    return this.config;
  }

  /**
   * @returns `true` si la sesión tiene intervalos activos registrados.
   */
  hasActiveIntervals(): boolean {
    return this.intervalIds.length > 0;
  }

  /**
   * Persiste la configuración del monitor para el jugador.
   * @param config Nueva configuración.
   */
  saveConfig(config: MonitorConfig): void {
    this.config = config;
    saveMonitorConfig(this.player, config);
  }

  /**
   * Restablece la configuración a los valores por defecto y la persiste.
   * @returns La configuración por defecto recién aplicada.
   */
  resetToDefaults(): MonitorConfig {
    this.config = { ...MonitorConfigDefaults };
    clearMonitorConfig(this.player);
    saveMonitorConfig(this.player, this.config);
    return this.config;
  }

  /**
   * @returns Texto listo para mostrar con el resumen de la configuración.
   */
  getConfigText(): string {
    const cfg = this.config;
    const factionLabel = MonitorConfigLabels.faction[cfg.faction] ?? cfg.faction;
    const unitTypeLabel = MonitorConfigLabels.unitType[cfg.unitType] ?? cfg.unitType;
    const normalListModeLabel = MonitorConfigLabels.normalListMode[cfg.normalListMode] ?? cfg.normalListMode;
    const specialListModeLabel = MonitorConfigLabels.specialListMode[cfg.specialListMode] ?? cfg.specialListMode;
    const sortByLabel = MonitorConfigLabels.sortBy[cfg.sortBy] ?? cfg.sortBy;
    const lines: string[] = [
      `§bFacción: §r${factionLabel}`,
      `§eTipo: §r${unitTypeLabel}`,
      `§aLista (No especiales): §r${normalListModeLabel}`,
      `§dLista (Especiales): §r${specialListModeLabel}`,
      `§cOrden: §r${sortByLabel}`,
    ];
    return lines.join("\n");
  }

  /**
   * Limpia los intervalos registrados en la sesión. Idempotente: la segunda
   * invocación no produce efectos.
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
    debugMessage("monitorCommand", `Sesión limpiada: ${this.playerId}`, "gray");
  }
}

const monitorSessions = new Map<string, MonitorMenuSession>();

/**
 * Store singleton de sesiones del monitor. Punto único de acceso, registro y
 * limpieza de sesiones para mantener la encapsulación del estado.
 */
export const monitorMenuSessionStore: MonitorMenuSessionStore = {
  get(playerId: string) {
    return monitorSessions.get(playerId);
  },
  set(playerId: string, session: MonitorMenuSession) {
    monitorSessions.set(playerId, session);
  },
  delete(playerId: string) {
    monitorSessions.delete(playerId);
  },
  clear() {
    for (const [, session] of monitorSessions) {
      session.cleanup();
    }
    monitorSessions.clear();
  },
  cleanup(playerId: string): void {
    const session = monitorSessions.get(playerId);
    if (!session) return;
    session.cleanup();
    monitorSessions.delete(playerId);
    debugMessage("monitorCommand", `Sesión limpiada y eliminada: ${session.playerId}`, "gray");
  },
};
