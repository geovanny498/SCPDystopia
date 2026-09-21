// scripts/gui/shared/entityGroups.ts
/**
 * Operaciones de grupos de unidades especiales.
 *
 * Fuente de verdad para: ENTITY_GROUP_DP, getUnitGroup, setUnitGroup, clearUnitGroup.
 * `menu_groups.ts` (legacy shim) reexporta para compatibilidad.
 *
 * Los grupos se guardan como DP individual por entidad en
 * `entity.setDynamicProperty(ENTITY_GROUP_DP, groupId)`.
 * v5.0 — sin dependencia de world DP ni listas estáticas.
 */

import { Entity, Player } from "@minecraft/server";
import { SpecialGroups } from "../../constants/domains.js";
import { GROUP_LABELS, SYSTEM_SHORT_NAMES } from "./systemCatalog.js";
import { entityHistoryStore } from "./entityHistory.js";
import { debug } from "../../utils/debug.js";

export const ENTITY_GROUP_DP = "scpd:group";

/**
 * Obtiene el grupo asignado a una entidad.
 * Lee el DP individual de la entidad. Si no existe, devuelve NO_GROUP.
 * @param entity - Entidad objetivo
 * @returns ID del grupo o SpecialGroups.NO_GROUP
 */
export function getUnitGroup(entity: Entity): string {
  if (!entity) return SpecialGroups.NO_GROUP;
  const group = entity.getDynamicProperty(ENTITY_GROUP_DP);
  return typeof group === "string" ? group : SpecialGroups.NO_GROUP;
}

/**
 * Asigna un grupo a una entidad escribiendo su DP individual.
 * No registra historial — cada caller conoce su `source` ("interact"/"command").
 * @param entity - Entidad objetivo
 * @param groupId - ID del grupo (groupA/groupB/groupC/groupD/noGroup)
 */
export function setUnitGroup(entity: Entity, groupId: string): void {
  if (!entity) return;
  entity.setDynamicProperty(ENTITY_GROUP_DP, groupId);
  const soldierName = entity.nameTag ? `${entity.nameTag}§r` : `§b${entity.typeId}§r`;
  debug("menuGroups", `Grupo §a${groupId}§r asignado a entidad §e${soldierName}§r`, { color: "gray", level: "debug" });
}

/**
 * Limpia el grupo de una entidad borrando su DP (undefined).
 * Solo llamado desde comandos CLI (reset_groups/reset_all) → source siempre "command".
 * Registra en el historial per-entidad si se pasa un player.
 * @param entity - Entidad objetivo
 * @param player - Player que ejecutó el reset; si es null no registra historial
 * @returns true si la entidad tenía un grupo y fue borrado
 */
export function clearUnitGroup(entity: Entity, player: Player | null = null): boolean {
  if (!entity) return false;
  if (entity.getDynamicProperty(ENTITY_GROUP_DP) === undefined) return false;

  entity.setDynamicProperty(ENTITY_GROUP_DP, undefined);
  const soldierName = entity.nameTag ? `§r§f${entity.nameTag}§r` : `§b${entity.typeId}§r`;

  if (player != null) {
    entityHistoryStore.pushHistory(entity.id, {
      source: "command",
      viewId: "group_assignment",
      context: SYSTEM_SHORT_NAMES.group_assignment,
      value: GROUP_LABELS[SpecialGroups.NO_GROUP],
      targetName: soldierName,
    });
  }

  debug("menuGroups", `Grupo limpiado de §e${soldierName}§r`, { color: "gray", level: "debug" });
  return true;
}
