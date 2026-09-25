// scripts/gui/teleportMenu/ddui/sessionStore.ts

/**
 * Almacén de sesión para el sistema de teletransporte DDUI.
 * Encapsula la persistencia de elecciones de los jugadores en memoria durante la sesión activa.
 * Provee punto de cleanup determinista para 'playerLeave' y cierres de formulario.
 */

import { Player, system } from "@minecraft/server";
import { CustomForm } from "@minecraft/server-ui";
import { debug } from "../../../utils/debug.js";
import { FactionId, Factions } from "../../../constants/domains.js";
import { DDUIFeedbackEntry, DDUIFeedbackStore } from "../../shared/dduiFeedback.js";

/**
 * Razón de cierre de un formulario DDUI para distinguir navegación interna de cancelación voluntaria.
 */
export type TeleportCloseReason = "user" | "navigation";

/**
 * Datos de selección almacenados para una facción en el menú "TODAS".
 */
export interface AllMenuFactionSelection {
  hierarchies: [boolean, boolean, boolean]; // [basic, leader, commander]
  specialUnits: string[]; // nametags seleccionados
}

/**
 * Sesión activa de un jugador en el menú de teletransporte DDUI.
 */
export class TeleportDDUISession {
  /** Identificador único del jugador */
  readonly playerId: string;
  /** Nombre visible del jugador */
  readonly playerName: string;
  /** Referencia viva al jugador de Bedrock */
  player: Player;
  /** Facción activa seleccionada ("foundation" o "chaos") */
  faction: FactionId = Factions.FOUNDATION;
  /** Vista actual activa */
  currentView: string = "main";
  /** ID del bucket de especiales activo si está en submenú */
  activeBucketId?: string;

  /**
   * Estado de selección de unidades normales por facción.
   * Key: faction, Value: [basic, leader, commander]
   */
  private readonly normalSelection: Map<FactionId, [boolean, boolean, boolean]> = new Map();

  /**
   * Estado de selección de unidades especiales por facción (nametags seleccionados).
   * Key: faction, Value: Set de nametags seleccionados
   */
  private readonly specialSelection: Map<FactionId, Set<string>> = new Map();

  /**
   * Estado de selección del menú "TODAS" por facción.
   * Key: faction, Value: AllMenuFactionSelection
   */
  private readonly allMenuSelection: Map<FactionId, AllMenuFactionSelection> = new Map();

  /** Razón por la cual se cerró el formulario actual */
  closeReason: TeleportCloseReason = "user";

  /** Referencia al formulario CustomForm activo */
  activeForm?: CustomForm;

  /** Intervalos registrados en runtime para cleanup */
  private readonly intervalIds: number[] = [];

  /**
   * Crea una nueva sesión para el jugador
   * @param playerId - ID único del jugador
   * @param playerName - Nombre visible del jugador
   * @param player - Objeto Player
   */
  constructor(playerId: string, playerName: string, player: Player) {
    this.playerId = playerId;
    this.playerName = playerName;
    this.player = player;
  }

  /**
   * Registra un intervalo en la sesión
   * @param intervalId - ID retornado por system.runInterval
   */
  registerInterval(intervalId: number): void {
    this.intervalIds.push(intervalId);
  }

  /**
   * Desregistra y detiene un intervalo específico
   * @param intervalId - ID a remover
   */
  unregisterInterval(intervalId: number): void {
    const idx = this.intervalIds.indexOf(intervalId);
    if (idx >= 0) {
      this.intervalIds.splice(idx, 1);
      try {
        system.clearRun(intervalId);
      } catch {
        // Intervalo ya limpio
      }
    }
  }

  /**
   * Asigna el formulario activo
   * @param form - Instancia de CustomForm
   */
  setForm(form: CustomForm | undefined): void {
    this.activeForm = form;
  }

  /**
   * Obtiene la selección guardada de normales para una facción
   * @param faction - Facción
   * @returns Tupla booleana [basic, leader, commander]
   */
  getNormalSelection(faction: FactionId): [boolean, boolean, boolean] {
    const saved = this.normalSelection.get(faction);
    return saved ? [...saved] : [false, false, false];
  }

  /**
   * Guarda la selección de normales para una facción
   * @param faction - Facción
   * @param selection - Tupla booleana
   */
  saveNormalSelection(faction: FactionId, selection: [boolean, boolean, boolean]): void {
    this.normalSelection.set(faction, [...selection]);
  }

  /**
   * Verifica si un nametag especial está seleccionado para una facción
   * @param faction - Facción
   * @param nametag - Nametag de la unidad
   */
  isSpecialUnitSelected(faction: FactionId, nametag: string): boolean {
    const set = this.specialSelection.get(faction);
    if (!set) return false;
    return set.has(nametag);
  }

  /**
   * Guarda la selección de especiales de un bucket fusionando con las demás
   * @param faction - Facción
   * @param selectedInBucket - Nametags seleccionados en este bucket
   * @param allInBucket - Todos los nametags presentes en este bucket
   */
  saveSpecialSelection(faction: FactionId, selectedInBucket: string[], allInBucket: string[]): void {
    let set = this.specialSelection.get(faction);
    if (!set) {
      set = new Set<string>();
      this.specialSelection.set(faction, set);
    }

    // Remover los que estaban en este bucket pero no fueron seleccionados
    for (const nt of allInBucket) {
      set.delete(nt);
    }
    // Agregar los seleccionados
    for (const nt of selectedInBucket) {
      set.add(nt);
    }
  }

  /**
   * Obtiene la selección del menú "TODAS" para una facción
   * @param faction - Facción
   */
  getAllMenuSelection(faction: FactionId): AllMenuFactionSelection | undefined {
    const saved = this.allMenuSelection.get(faction);
    if (!saved) return undefined;
    return {
      hierarchies: [...saved.hierarchies],
      specialUnits: [...saved.specialUnits],
    };
  }

  /**
   * Guarda la selección del menú "TODAS" para una facción
   * @param faction - Facción
   * @param hierarchies - Tupla de jerarquías
   * @param specialUnits - Array de nametags seleccionados
   */
  saveAllMenuSelection(faction: FactionId, hierarchies: [boolean, boolean, boolean], specialUnits: string[]): void {
    this.allMenuSelection.set(faction, {
      hierarchies: [...hierarchies],
      specialUnits: [...specialUnits],
    });
  }

  /**
   * Limpia todos los intervalos y referencias activas de la sesión
   */
  cleanup(): void {
    for (const id of this.intervalIds) {
      try {
        system.clearRun(id);
      } catch {
        // Ignorar
      }
    }
    this.intervalIds.length = 0;
    this.activeForm = undefined;
    debug("teleportMenuDDUI", `Sesión limpiada para §b${this.playerName}§r`, {
      level: "debug",
      color: "gray",
    });
  }
}

/**
 * Interfaz de encapsulación para el almacén de sesiones
 */
export interface TeleportSessionStore {
  get(playerId: string): TeleportDDUISession | undefined;
  set(playerId: string, session: TeleportDDUISession): void;
  delete(playerId: string): void;
  clear(): void;
  cleanup(playerId: string): void;
  getOrCreate(player: Player): TeleportDDUISession;
}

const sessions = new Map<string, TeleportDDUISession>();
const lastFeedbackByPlayer = new Map<string, Record<string, DDUIFeedbackEntry>>();

/**
 * Instancia singleton del almacén de sesiones de teleportMenu DDUI
 */
export const teleportMenuSessionStore: TeleportSessionStore & DDUIFeedbackStore = {
  get(playerId: string): TeleportDDUISession | undefined {
    return sessions.get(playerId);
  },
  set(playerId: string, session: TeleportDDUISession): void {
    sessions.set(playerId, session);
  },
  delete(playerId: string): void {
    sessions.delete(playerId);
  },
  clear(): void {
    for (const session of sessions.values()) {
      session.cleanup();
    }
    sessions.clear();
    lastFeedbackByPlayer.clear();
  },
  cleanup(playerId: string): void {
    const session = sessions.get(playerId);
    if (session) {
      session.cleanup();
      sessions.delete(playerId);
    }
    lastFeedbackByPlayer.delete(playerId);
    debug("teleportMenuDDUI", `Feedback limpiado para §b${playerId}§r`, { level: "debug", color: "gray" });
  },
  getOrCreate(player: Player): TeleportDDUISession {
    let session = sessions.get(player.id);
    if (!session) {
      session = new TeleportDDUISession(player.id, player.name, player);
      sessions.set(player.id, session);
      debug("teleportMenuDDUI", `Nueva sesión creada para §b${player.name}§r`, {
        level: "debug",
        color: "green",
      });
    } else {
      session.player = player;
    }
    return session;
  },
  getLast(playerId: string, viewId: string): DDUIFeedbackEntry | null {
    const map = lastFeedbackByPlayer.get(playerId);
    return map?.[viewId] ?? null;
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
  },
  clearAll(): void {
    lastFeedbackByPlayer.clear();
  },
};
