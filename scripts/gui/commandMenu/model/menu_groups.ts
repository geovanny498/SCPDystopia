// scripts/gui/commandMenu/menu_groups.ts
import { world, Entity } from "@minecraft/server";
import { debugWarn } from "../../../utils/debug.js";
import { SpecialGroups } from "../menu_config.js";

/**
 * Sistema de Grupos de Especiales
 *
 * Maneja la asignación de unidades especiales a grupos (A-D + Sin grupo).
 * Los grupos se guardan como DP individual por entidad en `entity.setDynamicProperty("scpd:group", groupId)`.
 * v5.0 — sin dependencia de world DP ni listas estáticas.
 */

// Constante de DP de entidad
const ENTITY_GROUP_DP = "scpd:group";

/**
 * Obtiene el grupo asignado a una entidad.
 * Lee el DP individual de la entidad. Si no existe, devuelve NO_GROUP.
 */
export function getUnitGroup(entity: Entity): string {
  if (!entity) return SpecialGroups.NO_GROUP;
  const group = entity.getDynamicProperty(ENTITY_GROUP_DP);
  return typeof group === "string" ? group : SpecialGroups.NO_GROUP;
}

/**
 * Asigna un grupo a una entidad escribiendo su DP individual.
 * Llamar con entidades vivas (scaneadas dinámicamente), no por nametag.
 */
export function setUnitGroup(entity: Entity, groupId: string): void {
  if (!entity) return;
  entity.setDynamicProperty(ENTITY_GROUP_DP, groupId);
  debugWarn("menuGroups", `Grupo ${groupId} asignado a entidad ${entity.typeId}`, "green");
}
