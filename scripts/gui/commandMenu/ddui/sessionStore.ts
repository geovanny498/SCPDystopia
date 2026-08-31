// scripts/gui/commandMenu/ddui/sessionStore.ts

import { Player, system, EquipmentSlot } from "@minecraft/server";
import { debugMessage, debugWarn } from "../../../utils/debug.js";
import { ObservableString } from "@minecraft/server-ui";
import { EquipmentDetector, FactionId } from "../../shared/equipmentDetector.js";

export interface SessionStore {
  get(playerId: string): CommandMenuSession | undefined;
  set(playerId: string, session: CommandMenuSession): void;
  delete(playerId: string): void;
  clear(): void;
}

export class CommandMenuSession {
  readonly playerId: string;
  readonly playerName: string;
  player: Player;
  faction: string;
  role: string;
  private readonly intervalIds: number[] = [];
  formState: Record<string, unknown> = {};
  viewId: string = "main";
  history: Array<{ text: string; timestamp: number }> = [];
  currentFormFeedback?: ObservableString;
  helmetWatchIntervalId?: number;
  lastKnownHelmetTypeId?: string | null;

  constructor(playerId: string, playerName: string, player: Player, faction: string, role: string) {
    this.playerId = playerId;
    this.playerName = playerName;
    this.player = player;
    this.faction = faction;
    this.role = role;
  }

  changeView(viewId: string): void {
    this.viewId = viewId;
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
      debugMessage("commandMenuDDUI", `Intervalo desregistrado: ${intervalId}`, "gray");
    }
  }

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

  destroy(): void {
    this.stopHelmetWatch();
    this.cleanup();
  }

  addHistory(text: string): void {
    this.history.push({ text, timestamp: Date.now() });
    if (this.history.length > 50) this.history.shift();
  }

  cleanup(): void {
    this.stopHelmetWatch();
    for (const intervalId of this.intervalIds) {
      try {
        system.clearRun(intervalId);
      } catch {
        // intervalo ya limpiado o inválido
      }
    }
    this.currentFormFeedback = undefined;
    debugMessage("commandMenuDDUI", `Sesión limpiada: ${this.playerName}`, "gray");
  }
}

const sessions = new Map<string, CommandMenuSession>();

export const commandMenuSessionStore: SessionStore = {
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
};

export function createSession(
  playerId: string,
  playerName: string,
  player: Player,
  faction: string,
  role: string
): CommandMenuSession {
  const session = new CommandMenuSession(playerId, playerName, player, faction, role);
  commandMenuSessionStore.set(playerId, session);
  debugMessage("commandMenuDDUI", `Sesión creada: ${playerName} (${faction}/${role})`, "green");
  return session;
}

export function cleanupCommandMenuSession(playerId: string): void {
  const session = commandMenuSessionStore.get(playerId);
  if (!session) return;
  session.cleanup();
  commandMenuSessionStore.delete(playerId);
}

export function pauseSession(playerId: string): void {
  const session = commandMenuSessionStore.get(playerId);
  if (!session) return;
  session.cleanup();
}
