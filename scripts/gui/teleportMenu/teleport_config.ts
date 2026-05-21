// scripts/gui/teleportMenu/teleport_config.ts
// ═══════════════════════════════════════════════════════════════════════════════════════
// §  TELEPORT MENU — DESHABILITADO TEMPORALMENTE
// ═══════════════════════════════════════════════════════════════════════════════════════
// Este módulo fue deshabilitado en la refactoring v4.0 del menú de comandos.
// Dependía de `specialUnits` y `normalUnits` que fueron eliminados.
// Usa scanActiveUnits() cuando lo migres.
// ═══════════════════════════════════════════════════════════════════════════════════════

// Stubs de exportación para que los archivos que importan de este módulo no fallen
// durante la compilación. Eliminar estos stubs cuando se migre el teleportMenu.

export const TeleportTitles = Object.create(null);
export const MainMenuButtons = Object.create(null);
export const TypeSelectionTexts = Object.create(null);
export const NormalSoldiersTexts = Object.create(null);
export const SpecialSoldiersTexts = Object.create(null);
export const CommonTexts = Object.create(null);
export const TeleportAllTexts = Object.create(null);
export const ResultMessages = Object.create(null);

export function getSubgroupLabel(_faction: string, _subgroup: string): string {
  return "desconocido";
}

export function getFactionLabel(faction: string): string {
  return faction === "foundation" ? "§lFundación SCP" : "§2§lInsurgencia del Caos";
}
