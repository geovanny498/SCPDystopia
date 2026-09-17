// scripts/gui/shared/entityHistory.ts

/**
 * Store de historial por entidad, compartido entre interactMenu y commandMenu DDUI.
 *
 * Almacena las últimas 20 entradas de cambios aplicados a una entidad,
 * discriminadas por `source` para permitir filtrado en la UI
 * (`"interact"` para cambios de interactMenu DDUI, `"command"` para commandMenu DDUI).
 *
 * Es un Map en memoria: no persiste entre reinicios del mundo. Se limpia en
 * `entityDie` con `clearEntity`. No tiene cleanup por `playerLeave` porque
 * el historial es per-entidad, no per-jugador.
 */

import { debugMessage } from "../../utils/debug.js";
import { formatLocalTimeShort } from "./timeHelpers.js";

/** Origen del cambio registrado en el historial. */
export type HistorySource = "interact" | "command";

/**
 * Entrada de historial para un cambio aplicado a una entidad.
 */
export interface EntityHistoryEntry {
  /** Origen del cambio: `"interact"` (interactMenu DDUI) o `"command"` (commandMenu DDUI). */
  source: HistorySource;
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

/**
 * Interfaz que encapsula el acceso al Map de historial por entidad.
 * Toda operación sobre el estado del historial debe pasar por aquí.
 */
export interface EntityHistoryStore {
  /**
   * Devuelve el historial reciente de cambios aplicados a la entidad.
   * @param entityId Identificador de la entidad.
   * @returns Lista de entradas (puede estar vacía).
   */
  getHistory(entityId: string): EntityHistoryEntry[];
  /**
   * Inserta una entrada al inicio del historial de la entidad (limitado a `MAX_ENTRIES`).
   * @param entityId Identificador de la entidad.
   * @param entry Entrada a registrar (sin `timestamp` ni `localTime`).
   */
  pushHistory(entityId: string, entry: Omit<EntityHistoryEntry, "timestamp" | "localTime">): void;
  /**
   * Elimina todo el historial asociado a una entidad.
   * @param entityId Identificador de la entidad.
   */
  clearEntity(entityId: string): void;
  /** Elimina todas las entries del store (para testing/limpieza global). */
  clearAll(): void;
}

const history = new Map<string, EntityHistoryEntry[]>();
/** Límite de entries por entidad. Match con el límite global de commandMenu (`historyStore.ts:9`). */
const MAX_ENTRIES = 20;

/**
 * Store singleton de historial por entidad. Punto único de acceso para
 * registrado y lectura de cambios aplicados a entidades, desde ambos menús.
 *
 * El historial es in-memory: se pierde al restart del mundo. Se limpia
 * explícitamente en `entityDie` via `clearEntity`.
 */
export const entityHistoryStore: EntityHistoryStore = {
  getHistory(entityId) {
    return history.get(entityId) ?? [];
  },
  pushHistory(entityId, entry) {
    let entries = history.get(entityId);
    if (!entries) {
      entries = [];
      history.set(entityId, entries);
    }
    entries.unshift({ ...entry, timestamp: Date.now(), localTime: formatLocalTimeShort(Date.now()) });
    if (entries.length > MAX_ENTRIES) {
      entries.length = MAX_ENTRIES;
    }
    debugMessage("entityHistory", `Entry [${entry.source}] ${entityId}: ${entry.context} → ${entry.value}`, "gray");
  },
  clearEntity(entityId) {
    history.delete(entityId);
  },
  clearAll() {
    history.clear();
  },
};
