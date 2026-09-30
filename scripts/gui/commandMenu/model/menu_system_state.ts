import type { FactionId } from "../../../constants/domains.js";
import type { OptionValue } from "../../shared/systemCatalog.js";

/**
 * Valores configurados para una sola facción dentro de un sistema.
 * Las claves permanecen abiertas para admitir jerarquías, grupos y nametags.
 */
export type SystemFactionState = Partial<Record<string, OptionValue>>;

/**
 * Estado de un sistema indexado por facción.
 * Puede ser parcial mientras DDUI edita únicamente un control o una facción.
 */
export type SystemState = Partial<Record<FactionId, SystemFactionState>>;

/**
 * Colección dispersa de estados indexada por ID textual de sistema.
 * Un sistema puede estar ausente antes de cargarse o en caches parciales.
 */
export type AllSystemStates = Partial<Record<string, SystemState>>;
