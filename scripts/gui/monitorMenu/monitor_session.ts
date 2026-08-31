// scripts/gui/monitorMenu/monitor_session.ts

import { Player, system } from "@minecraft/server";
import { ObservableString } from "@minecraft/server-ui";
import { MonitorConfig, MonitorConfigDefaults } from "./monitor_config.js";
import { loadMonitorConfig, saveMonitorConfig, clearMonitorConfig } from "./monitor_state.js";
import { debugMessage, debugWarn } from "../../utils/debug.js";

export interface MonitorMenuSessionStore {
  get(playerId: string): MonitorMenuSession | undefined;
  set(playerId: string, session: MonitorMenuSession): void;
  delete(playerId: string): void;
  clear(): void;
  cleanup(playerId: string): void;
}

export class MonitorMenuSession {
  readonly playerId: string;
  readonly player: Player;
  private readonly intervalIds: number[] = [];
  private cleaned = false;
  private foundationText: ObservableString;
  private chaosText: ObservableString;
  private config: MonitorConfig;

  constructor(player: Player) {
    this.playerId = player.id;
    this.player = player;
    this.foundationText = new ObservableString("§8Actualizando...");
    this.chaosText = new ObservableString("§8Actualizando...");
    this.config = loadMonitorConfig(player);
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
      debugMessage("monitorCommand", `Intervalo desregistrado: ${intervalId}`, "gray");
    }
  }

  getFoundationText(): ObservableString {
    return this.foundationText;
  }

  getChaosText(): ObservableString {
    return this.chaosText;
  }

  getConfig(): MonitorConfig {
    return this.config;
  }

  hasActiveIntervals(): boolean {
    return this.intervalIds.length > 0;
  }

  saveConfig(config: MonitorConfig): void {
    this.config = config;
    saveMonitorConfig(this.player, config);
  }

  resetToDefaults(): MonitorConfig {
    this.config = { ...MonitorConfigDefaults };
    clearMonitorConfig(this.player);
    saveMonitorConfig(this.player, this.config);
    return this.config;
  }

  getConfigText(): string {
    const lines: string[] = [
      `§bFacción: §r${this.config.faction}`,
      `§eTipo: §r${this.config.unitType}`,
      `§aLista (No especiales): §r${this.config.normalListMode}`,
      `§dLista (Especiales): §r${this.config.specialListMode}`,
      `§cOrden: §r${this.config.sortBy}`,
    ];
    return lines.join("\n");
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
    debugMessage("monitorCommand", `Sesión limpiada: ${this.playerId}`, "gray");
  }
}

const monitorSessions = new Map<string, MonitorMenuSession>();

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
  },
};
