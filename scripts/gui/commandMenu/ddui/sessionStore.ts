// scripts/gui/commandMenu/ddui/sessionStore.ts

import { system } from "@minecraft/server";
import { debugMessage, debugWarn } from "../../../utils/debug.js";
import { ObservableString } from "@minecraft/server-ui";

export interface SessionStore {
  get(playerId: string): CommandMenuSession | undefined;
  set(playerId: string, session: CommandMenuSession): void;
  delete(playerId: string): void;
  clear(): void;
}

export class CommandMenuSession {
  readonly playerId: string;
  readonly playerName: string;
  faction: string;
  role: string;
  private readonly intervalIds: number[] = [];
  formState: Record<string, unknown> = {};
  viewId: string = "main";
  history: Array<{ text: string; timestamp: number }> = [];
  currentFormFeedback?: ObservableString;

  constructor(playerId: string, playerName: string, faction: string, role: string) {
    this.playerId = playerId;
    this.playerName = playerName;
    this.faction = faction;
    this.role = role;
  }

  changeView(viewId: string): void {
    this.viewId = viewId;
  }

  registerInterval(intervalId: number): void {
    this.intervalIds.push(intervalId);
  }

  addHistory(text: string): void {
    this.history.push({ text, timestamp: Date.now() });
    if (this.history.length > 50) this.history.shift();
  }

  cleanup(): void {
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

export function createSession(playerId: string, playerName: string, faction: string, role: string): CommandMenuSession {
  const session = new CommandMenuSession(playerId, playerName, faction, role);
  commandMenuSessionStore.set(playerId, session);
  debugMessage("commandMenuDDUI", `Sesión creada: ${playerName} (${faction}/${role})`, "green");
  return session;
}

export function cleanupSession(playerId: string): void {
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
