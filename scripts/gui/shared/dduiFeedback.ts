// scripts/gui/shared/dduiFeedback.ts

import { ObservableString } from "@minecraft/server-ui";
import { debugMessage } from "../../utils/debug.js";

/**
 * Estado semántico de una entrada de feedback DDUI. Determina el prefijo
 * visual (`§a✓` ok, `§e⚠` warn, `§c✗` error, sin prefijo idle) en
 * `formatFeedbackText`. Usar `"idle"` para placeholders iniciales donde aún
 * no hay resultado de acción.
 */
export type DDUIFeedbackStatus = "ok" | "warn" | "error" | "idle";

/**
 * Entrada de feedback visual de una vista DDUI. Se sobreescribe por
 * `(key, viewId)`: solo persiste la última entry hasta que se aplique un
 * nuevo cambio en la misma vista. No es un historial.
 */
export interface DDUIFeedbackEntry {
  /** Contexto del cambio (sistema, categoría, etc.). */
  context: string;
  /** Valor aplicado. */
  value: string;
  /** Estado semántico del feedback. */
  status: DDUIFeedbackStatus;
  /** Timestamp en milisegundos. */
  timestamp: number;
  /** Identificador de la vista (`"system:movement"`, `"main"`, etc.). */
  viewId: string;
}

/**
 * Formatea una entrada de feedback con prefijo de color y formato consistente
 * entre commandMenu e interactMenu.
 * @param entry Entrada a formatear.
 * @returns Cadena con códigos de color lista para mostrar en un label.
 */
export function formatFeedbackText(entry: DDUIFeedbackEntry): string {
  const prefix =
    entry.status === "ok" ? "§a✓" : entry.status === "warn" ? "§e⚠" : entry.status === "error" ? "§c✗" : "";
  const body = `§7${entry.context}: §f${entry.value}`;
  return prefix ? `${prefix} ${body}` : body;
}

/**
 * Contrato de almacenamiento del feedback visual por clave y vista. Se
 * sobreescribe el entry de cada `viewId`; no acumula historial.
 */
export interface DDUIFeedbackStore {
  /**
   * Recupera la última entry de feedback para una vista de la clave dada.
   * @param key Identificador de la clave (`playerId` o `entityId`).
   * @param viewId Identificador de la vista.
   * @returns La entry si existe, o `null`.
   */
  getLast(key: string, viewId: string): DDUIFeedbackEntry | null;
  /**
   * Registra la última entry de feedback para una vista de la clave dada,
   * sobreescribiendo cualquier entry previa.
   * @param key Identificador de la clave.
   * @param viewId Identificador de la vista.
   * @param entry Entry a almacenar.
   */
  setLast(key: string, viewId: string, entry: DDUIFeedbackEntry): void;
  /**
   * Elimina todas las entries asociadas a una clave.
   * @param key Identificador de la clave.
   */
  clearKey(key: string): void;
  /** Elimina todas las entries del store. */
  clearAll(): void;
}

/**
 * Presenter que mantiene un `ObservableString` reactivo sincronizado con un
 * `DDUIFeedbackStore`. Rehidrata desde el store al construirse si existe una
 * entry previa para su `(key, viewId)`. Pensado para vivir dentro de la
 * sesión del menú y destruirse con ella.
 */
export class DDUIFeedbackPresenter {
  /** Identificador de la clave del store (`playerId` o `entityId`). */
  private readonly key: string;
  /** Identificador de la vista que representa el presenter. */
  private readonly viewId: string;
  /** Store al que se replica cada `present`. Puede ser `null` para vistas efímeras. */
  private readonly store: DDUIFeedbackStore | null;
  /** Observable expuesto al form para renderizado reactivo. */
  private readonly observable: ObservableString;
  /** Flag para evitar resets múltiples. */
  private resetDone: boolean = false;

  /**
   * @param key Identificador de la clave del store.
   * @param viewId Identificador de la vista.
   * @param store Store al que replicar. Si es `null`, el presenter es efímero.
   * @param initialText Texto inicial si el store no tiene entry previa.
   */
  constructor(key: string, viewId: string, store: DDUIFeedbackStore | null, initialText: string) {
    this.key = key;
    this.viewId = viewId;
    this.store = store;

    const last = store?.getLast(key, viewId);
    const initial = last ? formatFeedbackText(last) : initialText;
    this.observable = new ObservableString(initial);
  }

  /**
   * Actualiza el observable con la entry proporcionada y la replica al store.
   * El `viewId` y `timestamp` se completan automáticamente con los del presenter.
   * @param entry Datos del feedback sin `viewId` ni `timestamp`.
   */
  present(entry: { context: string; value: string; status: DDUIFeedbackStatus }): void {
    const full: DDUIFeedbackEntry = {
      ...entry,
      timestamp: Date.now(),
      viewId: this.viewId,
    };
    this.observable.setData(formatFeedbackText(full));
    this.store?.setLast(this.key, this.viewId, full);
    debugMessage("dduiFeedback", `Feedback [${this.viewId}] ${full.context}: ${full.value}`, "gray");
  }

  /**
   * Devuelve el `ObservableString` que el form debe usar como `form.label`.
   * @returns El observable reactivo.
   */
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

/** Texto inicial por defecto para vistas del commandMenu. */
export const SYSTEM_PANEL_FEEDBACK_INITIAL: string = formatFeedbackText({
  context: "Sistema",
  value: "N/A",
  status: "idle",
  timestamp: 0,
  viewId: "system:*",
});

/** Texto inicial por defecto para vistas del interactMenu. */
export const INTERACT_PANEL_FEEDBACK_DEFAULT: string = formatFeedbackText({
  context: "Vista",
  value: "N/A",
  status: "idle",
  timestamp: 0,
  viewId: "*",
});

/** Texto inicial por defecto para el panel de roles. */
export const ROLE_PANEL_FEEDBACK_INITIAL: string = formatFeedbackText({
  context: "Vista",
  value: "N/A",
  status: "idle",
  timestamp: 0,
  viewId: "roleMenu:*",
});
