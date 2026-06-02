// scripts/gui/commandMenu/menu_config.js

/**
 * Configuración centralizada del menú de comandos
 * Este archivo define todas las categorías, sistemas y sus comportamientos
 *
 * v4.0 — Detección dinámica de unidades mediante nametags.
 * Especiales: entidades con nametag no vacío.
 * No especiales: detección por jerarquía mediante type_family.
 * Grupos (A-D + Sin grupo): asignados dinámicamente vía propiedades dinámicas.
 */

import type { Entity } from "@minecraft/server";

// ── Tipos de control ────────────────────────────────────────────────────────

export const ControlType = {
  TOGGLE: "toggle",
  DROPDOWN: "dropdown",
};

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

export const Factions = {
  FOUNDATION: "foundation",
  CHAOS: "chaos",
};

// ── Grupos para especiales (A-D + Sin grupo) ────────────────────────────────

export const SpecialGroups = {
  GROUP_A: "groupA",
  GROUP_B: "groupB",
  GROUP_C: "groupC",
  GROUP_D: "groupD",
  NO_GROUP: "noGroup",
};

export const SpecialGroupLabels = {
  [SpecialGroups.GROUP_A]: "§9Grupo A",
  [SpecialGroups.GROUP_B]: "§aGrupo B",
  [SpecialGroups.GROUP_C]: "§6Grupo C",
  [SpecialGroups.GROUP_D]: "§dGrupo D",
  [SpecialGroups.NO_GROUP]: "§8Sin grupo",
};

// ── Jerarquías para no especiales ──────────────────────────────────────────

export const UnitHierarchy = {
  BASIC: "basic",
  LEADER: "leader",
  COMMANDER: "commander",
};

export const UnitHierarchyLabels = {
  [UnitHierarchy.BASIC]: "§7Básicos",
  [UnitHierarchy.LEADER]: "§eLíderes",
  [UnitHierarchy.COMMANDER]: "§6Comandantes",
};

// ── Guía de etiquetado UI de familias MTF ──────────────────────────────────
/**
 * Solo controla el label visual y el orden de aparición de cada familia MTF
 * en el menú de grupos. No filtra qué unidades son o no son especiales.
 * Agregar nuevas familias aquí no requiere tocar ninguna otra parte del sistema.
 */
export const NAMETAG_FAMILY_MAP = {
  mtf_delta1: { label: "§9§lMTF Delta-1", order: 1 },
  mtf_alpha1: { label: "§f§lMTF Alpha-1", order: 2 },
  mtf_epsilon11: { label: "§1§lMTF Epsilon-11", order: 3 },
  mtf_eta10: { label: "§b§lMTF Eta-10", order: 4 },
  mtf_nu7: { label: "§8§lMTF Nu-7", order: 5 },
  mtf_beta7: { label: "§6§lMTF Beta-7", order: 6 },
  mtf_epsilon6: { label: "§e§lMTF Epsilon-6", order: 7 },
  chaos_delta: { label: "§2§lChaos Delta", order: 10 },
  chaos_member: { label: "§a§lChaos Member", order: 11 },
};

export function getFamilyTagLabel(familyId: string) {
  const family = NAMETAG_FAMILY_MAP[familyId as keyof typeof NAMETAG_FAMILY_MAP];
  return family?.label ?? familyId;
}

export function getFamilyTagOrder(familyId: string) {
  const family = NAMETAG_FAMILY_MAP[familyId as keyof typeof NAMETAG_FAMILY_MAP];
  return family?.order ?? 999;
}

// ── Re-exportar scanner ─────────────────────────────────────────────────────

export {
  scanActiveUnits,
  scanActiveEntities,
  invalidateScanCache,
  getScanCache,
  invalidateEntityQueryCache,
  getEntitiesCached,
} from "./model/menu_entity_scanner.js";

// ── Definición de sistemas ─────────────────────────────────────────────────

export const systems: MenuSystems = {
  movement: {
    id: "movement",
    displayName: "§1Movimiento / Patrulla",
    description: "§8(Sólo entidades existentes)",
    tooltip:
      "§7Define cómo se desplazan las unidades en terreno.\n\nModos:\n- Seguir jugador (§aCerca/§eMedia/§6Lejos§7)\n- §9Caminar libremente\n§7- §cDetenerse",
    category: "movement_patrol",
    dynamicProperty: "scpd_system_movement",
    controlType: ControlType.DROPDOWN,
    supportsSpecials: true,
    supportsHierarchy: true,
    supportsGroups: true,

    options: [
      {
        value: "follow_close",
        label: "§aSeguir jugador (Cerca)",
        events: { start: "humanoid:set_tamed_close" },
        autoTame: true,
      },
      {
        value: "follow_mid",
        label: "§eSeguir jugador (Media)",
        events: { start: "humanoid:set_tamed_mid" },
        autoTame: true,
      },
      {
        value: "follow_far",
        label: "§6Seguir jugador (Lejos)",
        events: { start: "humanoid:set_tamed_far" },
        autoTame: true,
      },
      {
        value: "free",
        label: "§9Caminar libremente",
        events: { start: "mtf:to_move_free" },
      },
      {
        value: "stop",
        label: "§cDetenerse",
        events: { start: "mtf:to_stop" },
      },
    ],

    factions: {
      [Factions.FOUNDATION]: { label: "§lFoundation" },
      [Factions.CHAOS]: { label: "§2§lChaos" },
    },

    defaults: {
      [Factions.FOUNDATION]: {
        [UnitHierarchy.BASIC]: "free",
        [UnitHierarchy.LEADER]: "free",
        [UnitHierarchy.COMMANDER]: "free",
        [SpecialGroups.GROUP_A]: "free",
        [SpecialGroups.GROUP_B]: "free",
        [SpecialGroups.GROUP_C]: "free",
        [SpecialGroups.GROUP_D]: "free",
        [SpecialGroups.NO_GROUP]: "free",
      },
      [Factions.CHAOS]: {
        [UnitHierarchy.BASIC]: "free",
        [UnitHierarchy.LEADER]: "free",
        [UnitHierarchy.COMMANDER]: "free",
        [SpecialGroups.GROUP_A]: "free",
        [SpecialGroups.GROUP_B]: "free",
        [SpecialGroups.GROUP_C]: "free",
        [SpecialGroups.GROUP_D]: "free",
        [SpecialGroups.NO_GROUP]: "free",
      },
    },
  },

  fire: {
    id: "fire",
    displayName: "§cIniciativa de Combate",
    description: "",
    tooltip:
      "§7Define el radio de conciencia y respuesta ante amenazas.\n\nModos:\n- §cMáxima\n§7- §9Avanzada\n§7- §aIntermedia\n§7- §bCercana\n§7- §eNeutral / Sigilo",
    category: "combat",
    dynamicProperty: "scpd_system_fire",
    controlType: ControlType.DROPDOWN,
    supportsSpecials: true,
    supportsHierarchy: true,
    supportsGroups: true,

    options: [
      { value: "maximum", label: "§cMáxima", events: { start: "humanoid:fire_maximum" } },
      { value: "advanced", label: "§9Avanzada", events: { start: "humanoid:fire_advanced" } },
      { value: "intermediate", label: "§aIntermedia", events: { start: "humanoid:fire_intermediate" } },
      { value: "close", label: "§bCercana", events: { start: "humanoid:fire_close" } },
      { value: "neutral", label: "§eNeutral / Sigilo", events: { start: "humanoid:fire_neutral" } },
    ],

    factions: {
      [Factions.FOUNDATION]: { label: "§lFoundation" },
      [Factions.CHAOS]: { label: "§2§lChaos" },
    },

    defaults: {
      [Factions.FOUNDATION]: {
        [UnitHierarchy.BASIC]: "intermediate",
        [UnitHierarchy.LEADER]: "intermediate",
        [UnitHierarchy.COMMANDER]: "intermediate",
        [SpecialGroups.GROUP_A]: "intermediate",
        [SpecialGroups.GROUP_B]: "intermediate",
        [SpecialGroups.GROUP_C]: "intermediate",
        [SpecialGroups.GROUP_D]: "intermediate",
        [SpecialGroups.NO_GROUP]: "intermediate",
      },
      [Factions.CHAOS]: {
        [UnitHierarchy.BASIC]: "intermediate",
        [UnitHierarchy.LEADER]: "intermediate",
        [UnitHierarchy.COMMANDER]: "intermediate",
        [SpecialGroups.GROUP_A]: "intermediate",
        [SpecialGroups.GROUP_B]: "intermediate",
        [SpecialGroups.GROUP_C]: "intermediate",
        [SpecialGroups.GROUP_D]: "intermediate",
        [SpecialGroups.NO_GROUP]: "intermediate",
      },
    },
  },

  spawn: {
    id: "spawn",
    displayName: "§1Spawn de soldados",
    description: "",
    tooltip:
      "§7Habilita la capacidad de generar refuerzos adicionales (Sólo líderes y algunos comandantes).\n\nEstados:\n- §aActivado\n§7- §cDesactivado",
    category: "advanced",
    dynamicProperty: "scpd_system_spawn",
    controlType: ControlType.TOGGLE,
    supportsSpecials: true,
    supportsHierarchy: true,
    supportsGroups: true,

    events: {
      enable: {
        true: "humanoid:start_spawn_soldiers",
        false: "humanoid:stop_spawn_soldiers",
      },
    },

    factions: {
      [Factions.FOUNDATION]: { label: "§lFoundation" },
      [Factions.CHAOS]: { label: "§2§lChaos" },
    },

    defaults: {
      [Factions.FOUNDATION]: {
        [UnitHierarchy.BASIC]: false,
        [UnitHierarchy.LEADER]: false,
        [UnitHierarchy.COMMANDER]: false,
        [SpecialGroups.GROUP_A]: false,
        [SpecialGroups.GROUP_B]: false,
        [SpecialGroups.GROUP_C]: false,
        [SpecialGroups.GROUP_D]: false,
        [SpecialGroups.NO_GROUP]: false,
      },
      [Factions.CHAOS]: {
        [UnitHierarchy.BASIC]: false,
        [UnitHierarchy.LEADER]: false,
        [UnitHierarchy.COMMANDER]: false,
        [SpecialGroups.GROUP_A]: false,
        [SpecialGroups.GROUP_B]: false,
        [SpecialGroups.GROUP_C]: false,
        [SpecialGroups.GROUP_D]: false,
        [SpecialGroups.NO_GROUP]: false,
      },
    },
  },

  health: {
    id: "health",
    displayName: "§cBarra de vida",
    description: "",
    tooltip:
      "§7Visualización de la salud de las unidades cercanas en la interfaz.\n\nEstados:\n- §aActivado\n§7- §cDesactivado",
    category: "advanced",
    dynamicProperty: "scpd_system_health",
    controlType: ControlType.TOGGLE,
    supportsSpecials: true,
    supportsHierarchy: true,
    supportsGroups: true,

    events: {
      enable: {
        true: "humanoid:show_boss_bar",
        false: "humanoid:dont_show_boss_bar",
      },
    },

    factions: {
      [Factions.FOUNDATION]: { label: "§lFoundation" },
      [Factions.CHAOS]: { label: "§2§lChaos" },
    },

    defaults: {
      [Factions.FOUNDATION]: {
        [UnitHierarchy.BASIC]: false,
        [UnitHierarchy.LEADER]: false,
        [UnitHierarchy.COMMANDER]: false,
        [SpecialGroups.GROUP_A]: false,
        [SpecialGroups.GROUP_B]: false,
        [SpecialGroups.GROUP_C]: false,
        [SpecialGroups.GROUP_D]: false,
        [SpecialGroups.NO_GROUP]: false,
      },
      [Factions.CHAOS]: {
        [UnitHierarchy.BASIC]: false,
        [UnitHierarchy.LEADER]: false,
        [UnitHierarchy.COMMANDER]: false,
        [SpecialGroups.GROUP_A]: false,
        [SpecialGroups.GROUP_B]: false,
        [SpecialGroups.GROUP_C]: false,
        [SpecialGroups.GROUP_D]: false,
        [SpecialGroups.NO_GROUP]: false,
      },
    },
  },

  teleport: {
    id: "teleport",
    displayName: "§2Teletransportación",
    description: "",
    tooltip:
      "§7Define la agresividad del teletransporte hacia el enemigo cuando hay distancia.\n\nModos:\n- §aNormal\n§7- §6Cercano\n§7- §cDesactivado",
    category: "advanced",
    dynamicProperty: "scpd_system_teleport",
    controlType: ControlType.DROPDOWN,
    supportsSpecials: true,
    supportsHierarchy: true,
    supportsGroups: true,

    options: [
      { value: "normal", label: "§aNormal", events: { start: "humanoid:start_teleport" } },
      { value: "near", label: "§6Cercano", events: { start: "humanoid:start_teleport_near" } },
      { value: "false", label: "§cDesactivado", events: { stop: "humanoid:stop_teleport" } },
    ],

    factions: {
      [Factions.FOUNDATION]: { label: "§lFoundation" },
      [Factions.CHAOS]: { label: "§2§lChaos" },
    },

    defaults: {
      [Factions.FOUNDATION]: {
        [UnitHierarchy.BASIC]: "false",
        [UnitHierarchy.LEADER]: "false",
        [UnitHierarchy.COMMANDER]: "false",
        [SpecialGroups.GROUP_A]: "false",
        [SpecialGroups.GROUP_B]: "false",
        [SpecialGroups.GROUP_C]: "false",
        [SpecialGroups.GROUP_D]: "false",
        [SpecialGroups.NO_GROUP]: "false",
      },
      [Factions.CHAOS]: {
        [UnitHierarchy.BASIC]: "false",
        [UnitHierarchy.LEADER]: "false",
        [UnitHierarchy.COMMANDER]: "false",
        [SpecialGroups.GROUP_A]: "false",
        [SpecialGroups.GROUP_B]: "false",
        [SpecialGroups.GROUP_C]: "false",
        [SpecialGroups.GROUP_D]: "false",
        [SpecialGroups.NO_GROUP]: "false",
      },
    },
  },

  invincible: {
    id: "invincible",
    displayName: "§cInvencibilidad",
    description: "",
    tooltip: "§7Hace invulnerable a la unidad. Usar con precaución.\n\nEstados:\n- §aActivado\n§7- §cDesactivado",
    category: "advanced",
    dynamicProperty: "scpd_system_invincible",
    controlType: ControlType.TOGGLE,
    supportsSpecials: true,
    supportsHierarchy: true,
    supportsGroups: true,

    events: {
      enable: {
        true: "humanoid:start_invincible",
        false: "humanoid:stop_invincible",
      },
    },

    factions: {
      [Factions.FOUNDATION]: { label: "§lFoundation" },
      [Factions.CHAOS]: { label: "§2§lChaos" },
    },

    defaults: {
      [Factions.FOUNDATION]: {
        [UnitHierarchy.BASIC]: false,
        [UnitHierarchy.LEADER]: false,
        [UnitHierarchy.COMMANDER]: false,
        [SpecialGroups.GROUP_A]: false,
        [SpecialGroups.GROUP_B]: false,
        [SpecialGroups.GROUP_C]: false,
        [SpecialGroups.GROUP_D]: false,
        [SpecialGroups.NO_GROUP]: false,
      },
      [Factions.CHAOS]: {
        [UnitHierarchy.BASIC]: false,
        [UnitHierarchy.LEADER]: false,
        [UnitHierarchy.COMMANDER]: false,
        [SpecialGroups.GROUP_A]: false,
        [SpecialGroups.GROUP_B]: false,
        [SpecialGroups.GROUP_C]: false,
        [SpecialGroups.GROUP_D]: false,
        [SpecialGroups.NO_GROUP]: false,
      },
    },
  },
};

// ── Categorías ───────────────────────────────────────────────────────────────

export const categories: Record<string, { id: string; displayName: string; description: string; systems: string[] }> = {
  movement_patrol: {
    id: "movement_patrol",
    displayName: "§1Movimiento / Patrulla",
    description: "§8(Sólo entidades existentes)",
    systems: ["movement"],
  },
  combat: {
    id: "combat",
    displayName: "§cIniciativa de Combate",
    description: "",
    systems: ["fire"],
  },
  advanced: {
    id: "advanced",
    displayName: "§6Configuración avanzada",
    description: "",
    systems: ["spawn", "health", "teleport", "invincible"],
  },
  all: {
    id: "all",
    displayName: "§lTodos los Sistemas",
    description: "",
    systems: ["movement", "fire", "spawn", "health", "teleport", "invincible"],
  },
};

// ── Configuración del menú principal ───────────────────────────────────────

export const menuConfig = {
  title: "SCPDystopia | Panel de Comandos",
  categoryOrder: ["movement_patrol", "combat", "advanced", "all"],
  useDividers: true,
  messages: {
    allSystems:
      "§8[MENU] §7{player} §rconfiguró §6todos los sistemas§r. Usa §bscpd:check_world_props§r para ver las opciones aplicadas§r.",
    specificSystems: "§8[MENU] §7{player} §rconfiguró: §6{systems}§r.",
  },
};

// ── Funciones utilitarias de sistema ────────────────────────────────────────

export function getSystemConfig(systemId: string) {
  return systems[systemId] || null;
}

export function getCategoryConfig(categoryId: string) {
  return categories[categoryId] || null;
}

export function getSystemsByCategory(categoryId: string) {
  const category = categories[categoryId];
  if (!category) return [];
  return category.systems.map((id: string) => systems[id]).filter(Boolean);
}

export function getOrderedCategories() {
  return menuConfig.categoryOrder.map((id: string) => categories[id]).filter(Boolean);
}

export function getSystemPropertyId(systemId: string) {
  const sys = systems[systemId];
  if (!sys || !sys.dynamicProperty) return null;
  return sys.dynamicProperty;
}

function shouldParseJsonString(raw: any): raw is string {
  return typeof raw === "string" && (raw.startsWith("{") || raw.startsWith("["));
}

export function setEntitySystemState(entity: Entity, systemId: string, value: any) {
  const propertyId = getSystemPropertyId(systemId);
  if (!propertyId || !entity) return;
  try {
    // Normalizar valor inline (función eliminada por no uso)
    let normalized = value;
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
    console.warn(`[SCPDystopia] Error al guardar propiedad dinámica en entidad (${propertyId}): ${err}`);
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
    console.warn(`[SCPDystopia] Error al leer propiedad dinámica de entidad (${propertyId}): ${err}`);
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

export function formatEntitySystemStateLabel(systemId: string, value: any) {
  const sys = systems[systemId];
  if (!sys) return String(value ?? "§7No configurado§r");

  if (sys.controlType === ControlType.TOGGLE) {
    return value ? "§aON§r" : "§cOFF§r";
  }

  if (isDropdownSystem(sys)) {
    const option = sys.options?.find((opt: any) => opt.value === value);
    if (option?.label) return option.label;
    return typeof value === "string" ? value : String(value ?? "§7No configurado§r");
  }

  return String(value ?? "§7No configurado§r");
}

export function getEntitySystemsStatus(entity: Entity) {
  const result = [];
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
  const sys = systems[systemId];
  if (!sys) return {};
  return sys.defaults;
}

export function getSystemEvents(systemId: string, value: string | boolean): any {
  const sys = systems[systemId];
  if (!sys) return {};

  if (isToggleSystem(sys)) {
    const key = typeof value === "boolean" ? String(value) : value;
    const ev = sys.events?.enable?.[key];
    return ev ? { event: ev } : {};
  } else if (isDropdownSystem(sys)) {
    const option = sys.options?.find((opt: any) => opt.value === value);
    if (!option) return {};
    const result: Record<string, string | boolean | undefined> = { ...(option.events || {}) };
    if (option.autoTame) result.autoTame = true;
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
  const allGroups = Object.values(SpecialGroups);
  return [SpecialGroups.NO_GROUP, ...allGroups.filter((g) => g !== SpecialGroups.NO_GROUP)];
}

export function getGroupsOrderForSystems() {
  return Object.values(SpecialGroups);
}
