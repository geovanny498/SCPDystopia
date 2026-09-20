// scripts/gui/shared/entityScope.ts

import type { Entity } from "@minecraft/server";
import { debug } from "../../utils/debug.js";

export const ENTITY_GLOBAL_OVERWRITE_PROPERTY = "scpd_menu_config_allow_global_overwrite";

export interface ScopeData {
  respectEntityBlocks: boolean;
}

export function isGlobalOverwriteAllowed(entity: Entity): boolean {
  try {
    const raw = entity.getDynamicProperty(ENTITY_GLOBAL_OVERWRITE_PROPERTY);
    if (raw === true || raw === "true" || raw === 1 || raw === "1") return true;
    if (raw === false || raw === "false" || raw === 0 || raw === "0") return false;
    return true;
  } catch (e) {
      debug("scope", `Error leyendo propiedad de overwrite global: ${e}`, { level: "warn", color: "yellow" });
    return true;
  }
}

export function setGlobalOverwriteAllowed(entity: Entity, value: boolean): void {
  try {
    entity.setDynamicProperty(ENTITY_GLOBAL_OVERWRITE_PROPERTY, value);
  } catch (e) {
      debug("scope", `Error guardando configuración global: ${e}`, { level: "error", color: "red" });
  }
}

export function getGlobalOverwriteLabel(entity: Entity): string {
  return isGlobalOverwriteAllowed(entity) ? "§aGlobal" : "§cLocal";
}

export const SCOPE_TOGGLE_LABEL = "Respetar bloqueos locales";
