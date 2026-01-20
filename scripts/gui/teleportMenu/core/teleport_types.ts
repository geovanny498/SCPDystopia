// scripts/gui/teleportMenu/teleport_types.ts

/**
 * Definiciones de tipos TypeScript para el sistema de teletransporte
 */

import { Entity } from "@minecraft/server";

/**
 * Información de una facción
 */
export type FactionType = "foundation" | "chaos";

/**
 * Lista de entidades filtradas
 * Simplemente un array de Entity ya que reutilizamos las funciones de menu_faction
 */
export type FilteredEntities = Entity[];

/**
 * Resultado de una operación de teletransporte
 */
export interface TeleportResult {
  /** Número de entidades teletransportadas exitosamente */
  count: number;
  /** Si hubo errores durante la operación */
  hasErrors: boolean;
  /** Mensajes de error (opcional) */
  errors?: string[];
}
