// scripts/gui/teleportMenu/teleport_utils.ts
// ═══════════════════════════════════════════════════════════════════════════════════════
// §  TELEPORT UTILS — DESHABILITADO TEMPORALMENTE
// ═══════════════════════════════════════════════════════════════════════════════════════
// Este módulo fue deshabilitado en la refactoring v4.0 del menú de comandos.
// Dependía de `specialUnits` y `normalUnits` que fueron eliminados.
// ═══════════════════════════════════════════════════════════════════════════════════════

// Stubs de exportación para que los archivos que importan de este módulo no fallen
// durante la compilación. Eliminar cuando se migre el teleportMenu.

import { Entity, Dimension, Player } from "@minecraft/server";

export function getNormalEntitiesByHierarchy(
  _faction: string,
  _hierarchies: string[],
  _dimension: Dimension
): Entity[] {
  return [];
}

export function getSpecialEntitiesBySubgroup(_faction: string, _subgroup: string, _dimension: Dimension): Entity[] {
  return [];
}

export function getSpecialEntitiesByToggles(
  _faction: string,
  _selectedUnits: string[],
  _dimension: Dimension
): Entity[] {
  return [];
}

export function getAllFactionEntities(_faction: string, _dimension: Dimension): Entity[] {
  return [];
}

export function getCoordinateInputFromFormValues(_formValues: any[] | undefined): string | undefined {
  return undefined;
}

export function parseTeleportDestination(
  _rawInput: string | undefined,
  _player: Player
): { x: number; y: number; z: number } | null {
  return null;
}
