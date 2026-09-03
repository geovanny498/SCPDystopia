// scripts/gui/commandMenu/menu_config.js

/**
 * Configuración centralizada del menú de comandos
 * Este archivo define todas las categorías, sistemas y sus comportamientos
 *
 * v4.0 — Detección dinámica de unidades mediante nametags.
 * Especiales: entidades con nametag no vacío.
 * No especiales: detección por jerarquía mediante type_family.
 * Grupos (A-D + Sin grupo): asignados dinámicamente vía propiedades dinámicas.
 *
 * @module gui/commandMenu/menu_config
 * @description
 * Shim de re-export que consume `systemCatalog.ts` y `constants/domains.ts`
 * como fuentes de verdad, preservando la API pública legacy para no romper
 * el commandMenu legacy ni los menús que aún la consumen.
 */

import type { Entity } from "@minecraft/server";
import { debugWarn } from "../../utils/debug.js";
import type { SystemOption, CatalogSystem, SystemId, CategoryId, OptionValue } from "../shared/systemCatalog.js";
import {
  CATALOG_SYSTEMS,
  CATALOG_CATEGORIES,
  MENU_CONFIG,
  SYSTEM_SHORT_NAMES,
  SYSTEM_DISPLAY_NAMES,
  GROUP_LABELS,
  HIERARCHY_LABELS,
  PANEL_TITLES,
  PANEL_DESCRIPTIONS,
  MAIN_PANEL_BUTTONS,
  ADVANCED_PANEL_BUTTONS,
  GROUP_PANEL_BUTTONS,
  GROUP_FACTION_BUTTONS,
  GROUP_ASSIGNMENT_BUTTONS,
  ROLE_LABELS,
  FACTION_DISPLAY_NAMES,
  BACK_BUTTON_LABEL,
  PANEL_TITLE_ASIGNAR_GRUPO,
  GROUP_ASSIGNMENT_DESCRIPTION_PREFIX,
  HISTORY_INITIAL_TEXT,
  TARGET_FACTION_OPTIONS,
  SYSTEM_VIEW_FILTER_OPTIONS,
  HIERARCHY_AND_GROUP_OPTIONS,
  HIERARCHY_OPTIONS,
  SPECIAL_GROUP_OPTIONS,
  ERROR_MESSAGES,
  getSystemOption,
  getSystemEvent,
  isAutoTameSystem,
  getSystemProperty,
  isToggleSystem as catalogIsToggleSystem,
  isDropdownSystem as catalogIsDropdownSystem,
  getSystemDefaults as catalogGetSystemDefaults,
  getSystemDefaultForKey,
  getGroupsOrderForAssignment as catalogGetGroupsOrderForAssignment,
  getGroupsOrderForSystems as catalogGetGroupsOrderForSystems,
} from "../shared/systemCatalog.js";
import {
  Factions,
  SpecialGroups,
  UnitHierarchy,
  NAMETAG_FAMILY_MAP,
  getFamilyTagLabel,
  getFamilyTagOrder,
} from "../../constants/domains.js";

// ── Tipos de control ────────────────────────────────────────────────────────

export const ControlType = {
  TOGGLE: "toggle",
  DROPDOWN: "dropdown",
} as const;

export type MenuControlType = (typeof ControlType)[keyof typeof ControlType];

export type MenuOption = {
  value: string;
  label: string;
  events?: {
    start?: string;
    [key: string]: string | undefined;
  };
  autoTame?: boolean;
};

export type MenuSystemBase = {
  id: string;
  displayName: string;
  description: string;
  tooltip: string;
  category: string;
  dynamicProperty: string;
  controlType: MenuControlType;
  supportsSpecials: boolean;
  supportsHierarchy: boolean;
  supportsGroups: boolean;
  factions: Record<string, unknown>;
  defaults: Record<string, unknown>;
};

export type DropdownMenuSystem = MenuSystemBase & {
  controlType: typeof ControlType.DROPDOWN;
  options: MenuOption[];
};

export type ToggleMenuSystem = MenuSystemBase & {
  controlType: typeof ControlType.TOGGLE;
  events?: { enable?: Record<string, string> };
  autoTame?: boolean;
};

export type MenuSystem = DropdownMenuSystem | ToggleMenuSystem;
export type MenuSystems = Record<string, MenuSystem>;

export function isToggleSystem(sys: MenuSystem): sys is ToggleMenuSystem {
  return sys.controlType === ControlType.TOGGLE;
}

export function isDropdownSystem(sys: MenuSystem): sys is DropdownMenuSystem {
  return sys.controlType === ControlType.DROPDOWN;
}

// ── Bandos ──────────────────────────────────────────────────────────────────

export { Factions };

// ── Grupos para especiales (A-D + Sin grupo) ────────────────────────────────

export { SpecialGroups };

/**
 * Labels de grupos especiales (alias de `GROUP_LABELS` del catálogo).
 */
export const SpecialGroupLabels = GROUP_LABELS;

// ── Jerarquías para no especiales ──────────────────────────────────────────

export { UnitHierarchy };

/**
 * Labels de jerarquía de unidades (alias de `HIERARCHY_LABELS` del catálogo).
 */
export const UnitHierarchyLabels = HIERARCHY_LABELS;

// ── Guía de etiquetado UI de familias MTF ──────────────────────────────────

export { NAMETAG_FAMILY_MAP, getFamilyTagLabel, getFamilyTagOrder };



// ── Re-exportar scanner ─────────────────────────────────────────────────────

export {
  scanActiveUnits,
  scanActiveEntities,
  invalidateScanCache,
  getScanCache,
  invalidateEntityQueryCache,
  getEntitiesCached,
} from "./model/menu_entity_scanner.js";

// ── Definición de sistemas (adaptada al formato legacy) ─────────────────────

function mapOptionToLegacy(opt: SystemOption): MenuOption {
  return {
    value: opt.value,
    label: opt.label,
    events: {
      ...(opt.eventStart ? { start: opt.eventStart } : {}),
      ...(opt.eventStop ? { stop: opt.eventStop } : {}),
    },
    autoTame: opt.autoTame,
  };
}

function mapSystemToLegacy(sys: CatalogSystem): MenuSystem {
  const factions: Record<string, unknown> = {};
  for (const [key, label] of Object.entries(FACTION_DISPLAY_NAMES)) {
    factions[key] = { label };
  }

  if (sys.controlType === "toggle") {
    return {
      id: sys.id,
      displayName: sys.displayName,
      description: sys.description,
      tooltip: sys.tooltip ?? "",
      category: sys.category,
      dynamicProperty: sys.dynamicProperty,
      controlType: ControlType.TOGGLE,
      supportsSpecials: sys.supportsSpecials,
      supportsHierarchy: sys.supportsHierarchy,
      supportsGroups: sys.supportsGroups,
      factions,
      defaults: sys.defaults as Record<string, unknown>,
      events: {
        enable: {
          true: sys.eventTrue ?? "",
          false: sys.eventFalse ?? "",
        },
      },
    };
  }

  return {
    id: sys.id,
    displayName: sys.displayName,
    description: sys.description,
    tooltip: sys.tooltip ?? "",
    category: sys.category,
    dynamicProperty: sys.dynamicProperty,
    controlType: ControlType.DROPDOWN,
    supportsSpecials: sys.supportsSpecials,
    supportsHierarchy: sys.supportsHierarchy,
    supportsGroups: sys.supportsGroups,
    factions,
    defaults: sys.defaults as Record<string, unknown>,
    options: sys.options?.map(mapOptionToLegacy) ?? [],
  };
}

export const systems: MenuSystems = {
  movement: mapSystemToLegacy(CATALOG_SYSTEMS.movement),
  fire: mapSystemToLegacy(CATALOG_SYSTEMS.fire),
  teleport: mapSystemToLegacy(CATALOG_SYSTEMS.teleport),
  spawn: mapSystemToLegacy(CATALOG_SYSTEMS.spawn),
  health: mapSystemToLegacy(CATALOG_SYSTEMS.health),
  invincible: mapSystemToLegacy(CATALOG_SYSTEMS.invincible),
};

// ── Categorías ──────────────────────────────────────────────────────────────

/**
 * Categorías mapeadas desde `CATALOG_CATEGORIES` para eliminar duplicación
 * de literales (`displayName`, `systems`) con el catálogo.
 */
export const categories = Object.fromEntries(
  Object.entries(CATALOG_CATEGORIES).map(([key, cat]) => [
    key,
    {
      id: cat.id,
      displayName: cat.displayName,
      description: cat.description ?? "",
      systems: cat.systemIds,
    },
  ])
);

// ── Configuración del menú principal ────────────────────────────────────────

export const menuConfig = MENU_CONFIG;

// ── Funciones utilitarias de sistema ────────────────────────────────────────

export function getSystemConfig(systemId: string) {
  const sys = CATALOG_SYSTEMS[systemId as SystemId];
  return sys ? mapSystemToLegacy(sys) : null;
}

export function getCategoryConfig(categoryId: string) {
  const cat = CATALOG_CATEGORIES[categoryId as CategoryId];
  if (!cat) return null;
  return {
    id: cat.id,
    displayName: cat.displayName,
    description: cat.description ?? "",
    systems: cat.systemIds,
  };
}

export function getSystemsByCategory(categoryId: string) {
  const category = CATALOG_CATEGORIES[categoryId as CategoryId];
  if (!category) return [];
  return category.systemIds.map((id) => systems[id]).filter(Boolean);
}

export function getOrderedCategories() {
  return MENU_CONFIG.categoryOrder.map((id) => categories[id]).filter(Boolean);
}

export function getSystemPropertyId(systemId: string) {
  return getSystemProperty(systemId as SystemId);
}

function shouldParseJsonString(raw: unknown): raw is string {
  return typeof raw === "string" && (raw.startsWith("{") || raw.startsWith("["));
}

export function setEntitySystemState(entity: Entity, systemId: string, value: unknown): void {
  const propertyId = getSystemPropertyId(systemId);
  if (!propertyId || !entity) return;
  try {
    let normalized: string | number | boolean | undefined = undefined;

    if (value !== undefined && value !== null) {
      if (typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
        normalized = value;
      } else {
        try {
          normalized = JSON.stringify(value);
        } catch {
          normalized = String(value);
        }
      }
    }

    if (normalized === undefined) return;
    entity.setDynamicProperty(propertyId, normalized);
  } catch (err) {
    debugWarn(
      "menu_config",
      `Error al guardar propiedad dinámica en entidad (${propertyId}): ${err}`,
      "red"
    );
  }
}

export function getEntitySystemState(entity: Entity, systemId: string) {
  const propertyId = getSystemPropertyId(systemId);
  if (!propertyId || !entity) return undefined;
  try {
    const raw = entity.getDynamicProperty(propertyId);
    if (shouldParseJsonString(raw)) {
      try {
        return JSON.parse(raw);
      } catch {
        return raw;
      }
    }
    return raw;
  } catch (err) {
    debugWarn(
      "menu_config",
      `Error al leer propiedad dinámica de entidad (${propertyId}): ${err}`,
      "red"
    );
    return undefined;
  }
}

export function findSystemStateByEvent(eventName: string) {
  if (!eventName) return null;
  for (const systemId in systems) {
    const sys = systems[systemId];
    if (!sys) continue;
    if (isToggleSystem(sys) && sys.events?.enable) {
      if (sys.events.enable.true === eventName) return { systemId, value: true };
      if (sys.events.enable.false === eventName) return { systemId, value: false };
    }
    if (isDropdownSystem(sys) && Array.isArray(sys.options)) {
      for (const opt of sys.options) {
        if (opt?.events?.start === eventName || opt?.events?.stop === eventName) {
          return { systemId, value: opt.value };
        }
      }
    }
  }
  return null;
}

export function formatEntitySystemStateLabel(systemId: string, value: unknown): string {
  const sys = systems[systemId];
  if (!sys) return String(value ?? "§7No configurado§r");

  if (sys.controlType === ControlType.TOGGLE) {
    return value ? "§aON§r" : "§cOFF§r";
  }

  if (isDropdownSystem(sys)) {
    const option = sys.options?.find((opt: MenuOption) => opt.value === value);
    if (option?.label) return option.label;
    return typeof value === "string" ? value : String(value ?? "§7No configurado§r");
  }

  return String(value ?? "§7No configurado§r");
}

export function getEntitySystemsStatus(entity: Entity) {
  const result: { systemId: string; displayName: string; value: unknown; label: string }[] = [];
  let totalSystems = 0;
  for (const systemId in systems) {
    totalSystems += 1;
    const sys = systems[systemId];
    const rawValue = getEntitySystemState(entity, systemId);
    if (rawValue === undefined) continue;
    result.push({
      systemId,
      displayName: sys.displayName,
      value: rawValue,
      label: formatEntitySystemStateLabel(systemId, rawValue),
    });
  }
  return { totalSystems, savedSystems: result.length, statuses: result };
}

export function getSystemDefaults(systemId: string) {
  return catalogGetSystemDefaults(systemId as SystemId);
}

export function getSystemEvents(
  systemId: string,
  value: string | boolean
): Record<string, string | boolean | undefined> {
  const sys = systems[systemId];
  if (!sys) return {};
  if (isToggleSystem(sys)) {
    const key = typeof value === "boolean" ? String(value) : value;
    const ev = sys.events?.enable?.[key];
    return ev ? { event: ev } : {};
  }
  if (isDropdownSystem(sys) && Array.isArray(sys.options)) {
    const opt = sys.options.find((o) => o.value === value);
    if (!opt || !opt.events) return {};
    const result: Record<string, string | boolean | undefined> = { ...opt.events };
    if (opt.autoTame) result.autoTame = true;
    return result;
  }
  return {};
}

export function isAutoTameEvent(eventName: string) {
  if (!eventName) return false;
  for (const sys of Object.values(systems)) {
    if (isDropdownSystem(sys) && Array.isArray(sys.options)) {
      for (const opt of sys.options) {
        if (opt.autoTame && opt.events && opt.events.start === eventName) return true;
      }
    }
    if (isToggleSystem(sys) && sys.events && sys.events.enable) {
      for (const key in sys.events.enable) {
        if (sys.events.enable[key] === eventName && sys.autoTame) return true;
      }
    }
  }
  return false;
}

// ── Jerarquía de unidades (solo constantes) ─────────────────────────────────

/**
 * La detección de jerarquía por type_family se hace en menu_entity_scanner.ts
 * (función detectHierarchyFromFamilies). Aquí solo se mantienen las constantes.
 */
export function getHierarchyList() {
  return Object.entries(UnitHierarchyLabels).map(([id, label]) => ({ id, label }));
}

// ── Orden de grupos ─────────────────────────────────────────────────────────

export function getGroupsOrderForAssignment() {
  return catalogGetGroupsOrderForAssignment();
}

export function getGroupsOrderForSystems() {
  return catalogGetGroupsOrderForSystems();
}
