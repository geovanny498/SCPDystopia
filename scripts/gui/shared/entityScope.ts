// scripts/gui/shared/entityScope.ts

export const ENTITY_GLOBAL_OVERWRITE_PROPERTY = "scpd_menu_config_allow_global_overwrite";

export interface ScopeData {
  respectEntityBlocks: boolean;
}

export function isGlobalOverwriteAllowed(entity: { getDynamicProperty: (key: string) => unknown }): boolean {
  try {
    const raw = entity.getDynamicProperty(ENTITY_GLOBAL_OVERWRITE_PROPERTY);
    if (raw === true || raw === "true" || raw === 1 || raw === "1") return true;
    if (raw === false || raw === "false" || raw === 0 || raw === "0") return false;
    return true;
  } catch {
    return true;
  }
}

export function setGlobalOverwriteAllowed(entity: { setDynamicProperty: (key: string, value: unknown) => void }, value: boolean): void {
  try {
    entity.setDynamicProperty(ENTITY_GLOBAL_OVERWRITE_PROPERTY, value);
  } catch (e) {
    console.warn(`[SCPDystopia] Error guardando configuración global: ${e}`);
  }
}

export function getGlobalOverwriteLabel(entity: { getDynamicProperty: (key: string) => unknown }): string {
  return isGlobalOverwriteAllowed(entity) ? "§aGlobal" : "§cLocal";
}

export const SCOPE_TOGGLE_LABEL = "Respetar bloqueos locales";
