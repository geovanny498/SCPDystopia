// scripts/gui/commandMenu/menu_config.js

/**
 * Configuración centralizada del menú de comandos
 * Este archivo define todas las categorías, sistemas y sus comportamientos
 *
 * v4.0 — Las listas especialUnits, normalUnits y normalUnitFamilies fueron eliminadas
 * del plan y sustituidas por detección dinámica (menu_entity_scanner.ts / menu_faction.ts).
 * Se mantienen exports de compatibilidad vacíos para módulos externos que aún no hayan
 * sido migrados (ej: teleportMenu). Suprimir estos exports una vez finalizada la migración.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// §  EXPORTS DE COMPATIBILIDAD  (vacíos, sin datos)
// ═══════════════════════════════════════════════════════════════════════════════

/** @deprecated Usar scanActiveUnits() en su lugar. Eliminar cuando teleportMenu se migre. */
export const specialUnits = Object.create(null);

/** @deprecated La detección de jerarquía se hace por typeId en menu_faction.ts. Eliminar cuando teleportMenu se migre. */
export const normalUnits = Object.create(null);

/** @deprecated Usar NAMETAG_FAMILY_MAP en su lugar. Eliminar cuando teleportMenu se migre. */
export const normalUnitFamilies = Object.create(null);

// ── Tipos de control ────────────────────────────────────────────────────────

export const ControlType = {
  TOGGLE: "toggle",
  DROPDOWN: "dropdown",
};

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
};

export function getFamilyTagLabel(familyId) {
  return NAMETAG_FAMILY_MAP[familyId]?.label ?? familyId;
}

export function getFamilyTagOrder(familyId) {
  return NAMETAG_FAMILY_MAP[familyId]?.order ?? 999;
}

// ── Re-exportar scanner ─────────────────────────────────────────────────────

export { scanActiveUnits, invalidateScanCache, getScanCache, invalidateEntityQueryCache, getEntitiesCached } from "./model/menu_entity_scanner.js";

// ── Definición de sistemas ─────────────────────────────────────────────────

export const systems = {
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
      { value: "maximum", label: "§cMáxima", events: { start: "humanoid:fire_open_warfare" } },
      { value: "advanced", label: "§9Avanzada", events: { start: "humanoid:fire_advanced" } },
      { value: "intermediate", label: "§aIntermedia", events: { start: "humanoid:fire_armed_presence" } },
      { value: "close", label: "§bCercana", events: { start: "humanoid:fire_defensive" } },
      { value: "neutral", label: "§eNeutral / Sigilo", events: { start: "humanoid:fire_mode_hit" } },
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

export const categories = {
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

// ═══════════════════════════════════════════════════════════════════════════════
// §  FUNCIONES DE COMPATIBILIDAD  (para módulos externos no migrados aún)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @deprecated Usar NAMETAG_FAMILY_MAP en su lugar. Eliminar cuando teleportMenu se migre.
 */
export function getNormalUnitFamilyOrder(_faction) {
  return Object.keys(NAMETAG_FAMILY_MAP);
}

/**
 * @deprecated Usar getFamilyTagLabel() en su lugar. Eliminar cuando teleportMenu se migre.
 */
export function getNormalUnitFamilyLabel(_faction, familyId) {
  return getFamilyTagLabel(familyId);
}

/**
 * @deprecated Usar scanActiveUnits para detectar familias por entidad. Eliminar cuando teleportMenu se migre.
 */
export function getNormalUnitFamilyLabelFromEntity(_ent, _faction) {
  return "§7Desconocido§r";
}

/**
 * @deprecated Usar detectHierarchyByTypeId() de menu_faction.ts en su lugar.
 * Eliminar cuando teleportMenu se migre.
 */
export function getUnitHierarchy(typeId, _faction) {
  const lower = (typeId ?? "").toLowerCase();
  if (lower.endsWith("c")) return UnitHierarchy.COMMANDER;
  if (lower.endsWith("l")) return UnitHierarchy.LEADER;
  return UnitHierarchy.BASIC;
}

/**
 * @deprecated Usar isValidSoldier() de menu_faction.ts en su lugar.
 * Eliminar cuando teleportMenu se migre.
 */
export function isNormalUnit(typeId, _faction) {
  return getUnitHierarchy(typeId, _faction) !== null;
}

/**
 * @deprecated Eliminar cuando teleportMenu se migre.
 */
export function getAllNormalTypeIds(_faction) {
  return [];
}

// ── Funciones utilitarias de sistema ────────────────────────────────────────

export function getSystemConfig(systemId) {
  return systems[systemId] || null;
}

export function getCategoryConfig(categoryId) {
  return categories[categoryId] || null;
}

export function getSystemsByCategory(categoryId) {
  const category = categories[categoryId];
  if (!category) return [];
  return category.systems.map((id) => systems[id]).filter(Boolean);
}

export function getOrderedCategories() {
  return menuConfig.categoryOrder.map((id) => categories[id]).filter(Boolean);
}

export function getSystemPropertyId(systemId) {
  const sys = systems[systemId];
  if (!sys || !sys.dynamicProperty) return null;
  return sys.dynamicProperty;
}

function shouldParseJsonString(raw) {
  return typeof raw === "string" && (raw.startsWith("{") || raw.startsWith("["));
}

function normalizeSystemStateValue(value) {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "boolean" || typeof value === "number" || typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function setEntitySystemState(entity, systemId, value) {
  const propertyId = getSystemPropertyId(systemId);
  if (!propertyId || !entity) return;
  try {
    const normalized = normalizeSystemStateValue(value);
    if (normalized === undefined) return;
    entity.setDynamicProperty(propertyId, normalized);
  } catch (err) {
    console.warn(`[SCPDystopia] Error al guardar propiedad dinámica en entidad (${propertyId}): ${err}`);
  }
}

export function getEntitySystemState(entity, systemId) {
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

export function findSystemStateByEvent(eventName) {
  if (!eventName) return null;
  for (const systemId in systems) {
    const sys = systems[systemId];
    if (!sys) continue;
    if (sys.controlType === ControlType.TOGGLE && sys.events?.enable) {
      if (sys.events.enable.true === eventName) return { systemId, value: true };
      if (sys.events.enable.false === eventName) return { systemId, value: false };
    }
    if (sys.controlType === ControlType.DROPDOWN && Array.isArray(sys.options)) {
      for (const opt of sys.options) {
        if (opt?.events?.start === eventName || opt?.events?.stop === eventName) {
          return { systemId, value: opt.value };
        }
      }
    }
  }
  return null;
}

export function formatEntitySystemStateLabel(systemId, value) {
  const sys = systems[systemId];
  if (!sys) return String(value ?? "§7No configurado§r");

  if (sys.controlType === ControlType.TOGGLE) {
    return value ? "§aON§r" : "§cOFF§r";
  }

  if (sys.controlType === ControlType.DROPDOWN) {
    const option = sys.options?.find((opt) => opt.value === value);
    if (option?.label) return option.label;
    return typeof value === "string" ? value : String(value ?? "§7No configurado§r");
  }

  return String(value ?? "§7No configurado§r");
}

export function getEntitySystemsStatus(entity) {
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

export function getSystemDefaults(systemId) {
  const sys = systems[systemId];
  if (!sys) return {};
  return sys.defaults;
}

export function getSystemEvents(systemId, value) {
  const sys = systems[systemId];
  if (!sys) return {};

  if (sys.controlType === ControlType.TOGGLE) {
    const ev = sys.events?.enable?.[value];
    return ev ? { event: ev } : {};
  } else if (sys.controlType === ControlType.DROPDOWN) {
    const option = sys.options?.find((opt) => opt.value === value);
    if (!option) return {};
    const result = { ...(option.events || {}) };
    if (option.autoTame) result.autoTame = true;
    return result;
  }

  return {};
}

export function isAutoTameEvent(eventName) {
  if (!eventName) return false;
  for (const sys of Object.values(systems)) {
    if (sys.controlType === ControlType.DROPDOWN && Array.isArray(sys.options)) {
      for (const opt of sys.options) {
        if (opt.autoTame && opt.events && opt.events.start === eventName) return true;
      }
    }
    if (sys.controlType === ControlType.TOGGLE && sys.events && sys.events.enable) {
      for (const key in sys.events.enable) {
        if (sys.events.enable[key] === eventName && sys.autoTame) return true;
      }
    }
  }
  return false;
}

// ── Jerarquía de unidades (solo constantes, sin listas) ─────────────────────

/**
 * La detección de jerarquía por typeId se hace en menu_faction.ts
 * (función detectHierarchyByTypeId). Aquí solo se mantienen las constantes.
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
