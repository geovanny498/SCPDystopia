/**
 * Utilidades para consultas de entidades del addon
 * @module utils/entityQuery
 */

import { Dimension, Entity } from "@minecraft/server";
import { teamFamilies } from "./teams.js";

/**
 * Obtiene todas las entidades del addon (Foundation + Chaos) en una dimensión.
 * Usa lógica AND de families: cada entidad debe tener AMBAS familias de su facción.
 *
 * Optimización: 2 llamadas a getEntities en lugar de 4 (una por familia individual).
 *
 * @param dimension - Dimensión donde buscar entidades
 * @returns Array con todas las entidades del addon (Foundation + Chaos)
 *
 * @example
 * ```ts
 * const allUnits = getAllAddonEntities(player.dimension);
 * for (const unit of allUnits) {
 *   // procesar unidad...
 * }
 * ```
 */
export function getAllAddonEntities(dimension: Dimension): Entity[] {
  const chaosEnts = dimension.getEntities({ families: teamFamilies.chaos });
  const foundationEnts = dimension.getEntities({ families: teamFamilies.foundation });

  return [...chaosEnts, ...foundationEnts];
}

/**
 * Obtiene todas las entidades del addon en múltiples dimensiones.
 *
 * @param dimensions - Array de dimensiones donde buscar
 * @returns Array con todas las entidades encontradas en todas las dimensiones
 *
 * @example
 * ```ts
 * import { world } from "@minecraft/server";
 *
 * const dims = ["overworld", "nether", "the_end"]
 *   .map(id => world.getDimension(id))
 *   .filter(Boolean);
 *
 * const allUnits = getAllAddonEntitiesInDimensions(dims);
 * ```
 */
export function getAllAddonEntitiesInDimensions(dimensions: Dimension[]): Entity[] {
  const allEntities: Entity[] = [];

  for (const dim of dimensions) {
    allEntities.push(...getAllAddonEntities(dim));
  }

  return allEntities;
}

/**
 * Obtiene entidades de una facción específica en una dimensión.
 *
 * @param dimension - Dimensión donde buscar
 * @param faction - "foundation" o "chaos"
 * @returns Array con entidades de la facción especificada
 *
 * @example
 * ```ts
 * const foundationUnits = getEntitiesByFaction(player.dimension, "foundation");
 * ```
 */
export function getEntitiesByFaction(dimension: Dimension, faction: "foundation" | "chaos"): Entity[] {
  return dimension.getEntities({ families: teamFamilies[faction] });
}
