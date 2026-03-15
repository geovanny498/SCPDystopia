// scripts/gui/commandMenu/menu_config.js

/**
 * Configuración centralizada del menú de comandos
 * Este archivo define todas las categorías, sistemas y sus comportamientos
 */

// Definición de tipos de control
export const ControlType = {
  TOGGLE: "toggle",
  DROPDOWN: "dropdown",
};

// Definición de bandos
export const Factions = {
  FOUNDATION: "foundation",
  CHAOS: "chaos",
};

// Definición de grupos para especiales (A-D + Sin grupo)
export const SpecialGroups = {
  GROUP_A: "groupA",
  GROUP_B: "groupB",
  GROUP_C: "groupC",
  GROUP_D: "groupD",
  NO_GROUP: "noGroup",
};

// Labels para los grupos
export const SpecialGroupLabels = {
  [SpecialGroups.GROUP_A]: "§9Grupo A",
  [SpecialGroups.GROUP_B]: "§aGrupo B",
  [SpecialGroups.GROUP_C]: "§6Grupo C",
  [SpecialGroups.GROUP_D]: "§dGrupo D",
  [SpecialGroups.NO_GROUP]: "§8Sin grupo",
};

// Definición de jerarquías para no especiales
export const UnitHierarchy = {
  BASIC: "basic",
  LEADER: "leader",
  COMMANDER: "commander",
};

// Labels para jerarquías
export const UnitHierarchyLabels = {
  [UnitHierarchy.BASIC]: "§7Básicos",
  [UnitHierarchy.LEADER]: "§eL\u00edderes",
  [UnitHierarchy.COMMANDER]: "§6Comandantes",
};

// NOTA: Algunas unidades pueden aparecer en múltiples subgrupos.
// El sistema usa OR lógico: la unidad estará EN SCOPE si está en
// CUALQUIERA de los subgrupos seleccionados.

/**
 * Definición de unidades NO especiales por bando y jerarquía (por typeId)
 * Similar a cómo specialUnits define subgrupos, pero usando typeId en lugar de nametag
 */
export const normalUnits = {
  [Factions.FOUNDATION]: {
    [UnitHierarchy.BASIC]: [
      "lc:dt_epsilon11",
      "lc:dt_eta10",
      "lc:dt_nu7",
      "lc:dt_beta7",
      "lc:dt_epsilon6",
      "lc:dt_alpha1",
    ],
    [UnitHierarchy.LEADER]: [
      "lc:dt_alpha1l",
      "lc:dt_epsilon11c",
      "lc:dt_eta10c",
      "lc:dt_nu7c",
      "lc:dt_beta7c",
      "lc:dt_epsilon6c",
    ],
    [UnitHierarchy.COMMANDER]: ["lc:dt_chara", "lc:dt_thedeath", "lc:dt_alpha1c"],
  },
  [Factions.CHAOS]: {
    [UnitHierarchy.BASIC]: ["lc:dt_chaos_insurgency"],
    [UnitHierarchy.LEADER]: ["lc:dt_cd"],
    [UnitHierarchy.COMMANDER]: ["lc:dt_cd_commander", "lc:dt_cd_leader"],
  },
};

// Definición de unidades especiales por bando con subgrupos (por nametag)
export const specialUnits = {
  [Factions.FOUNDATION]: {
    // Lista plana para compatibilidad (se genera automáticamente)
    all: [],

    // Subgrupos
    subgroups: {
      mtf_delta1: {
        label: "§9§lMTF Delta-1",
        units: [
          "§c§lMTF Delta-1 Chara",
          "§4§lMTF Delta-1 Death",
          "§d§lMTF Delta-1 Mita",
          "§d§lMTF Delta-1 Commander",
          "§d§lMTF Delta-1 Frisk",
          "§d§lMTF Delta-1 Leader",
        ],
      },
      mtf_alpha1_commanders: {
        label: "§f§lMTF Alpha-1 (Comandantes)",
        units: ["§lMTF Alpha-1 Commander", "§lMTF Alpha-1 Commander 2", "§lMTF Alpha-1 Commander 3"],
      },
      mtf_commanders: {
        label: "§6§lComandantes MTF (Otros)",
        units: [
          "§1§lMTF Epsilon-11 Commander",
          "§b§lMTF Eta-10 Commander",
          "§8§lMTF Nu-7 Commander",
          "§6§lMTF Beta-7 Commander",
          "§e§lMTF Epsilon-6 Commander",
        ],
      },
      mtf_leaders: {
        label: "§e§lLíderes MTF",
        units: [
          "§lMTF Alpha-1 Leader",
          "§1§lMTF Epsilon-11 Leader",
          "§b§lMTF Eta-10 Leader",
          "§8§lMTF Nu-7 Leader",
          "§6§lMTF Beta-7 Leader",
          "§e§lMTF Epsilon-6 Leader",
        ],
      },
      mtf_members: {
        label: "Miembros MTF",
        units: [
          "MTF Alpha-1 Member",
          "§1MTF Epsilon-11 Member",
          "§bMTF Eta-10 Member",
          "§8MTF Nu-7 Member",
          "§6MTF Beta-7 Member",
          "§eMTF Epsilon-6 Member",
        ],
      },
    },
  },
  [Factions.CHAOS]: {
    // Lista plana para compatibilidad (se genera automáticamente)
    all: [],

    // Subgrupos
    subgroups: {
      chaos_delta: {
        label: "§2§lChaos Delta",
        units: [
          "§2§lChaos Delta Commander",
          "§a§lChaos Delta Leader 1",
          "§a§lChaos Delta Leader 2",
          "§a§lChaos Delta Leader 3",
          "§a§lChaos Delta Leader 4",
        ],
      },
    },
  },
};

// Generar listas planas automáticamente para compatibilidad
for (const faction in specialUnits) {
  const factionData = specialUnits[faction];
  factionData.all = [];
  for (const subgroupId in factionData.subgroups) {
    factionData.all.push(...factionData.subgroups[subgroupId].units);
  }
}

/**
 * Definición de sistemas
 * Cada sistema define su comportamiento completo incluyendo eventos
 * Puedes usar códigos § directamente en displayName
 *
 * NUEVO: supportsHierarchy indica si el sistema soporta jerarquías (Básicos/Líderes/Comandantes)
 * NUEVO: supportsGroups indica si el sistema soporta grupos de especiales (A-D + Sin grupo)
 */
export const systems = {
  movement: {
    id: "movement",
    displayName: "§1Movimiento / Patrulla",
    description: "§8(Sólo entidades existentes)", // descripción visible en el botón de la categoría
    tooltip:
      "§7Define cómo se desplazan las unidades en terreno.\n\nModos:\n- Seguir jugador (§aCerca/§eMedia/§6Lejos§7)\n- §9Caminar libremente\n§7- §cDetenerse",
    category: "movement_patrol",
    dynamicProperty: "scpd_system_movement",
    controlType: ControlType.DROPDOWN,
    supportsSpecials: true,
    supportsHierarchy: true,
    supportsGroups: true,

    // Opciones para dropdown con eventos asociados
    options: [
      {
        value: "follow_close",
        label: "§aSeguir jugador (Cerca)",
        events: {
          start: "humanoid:set_tamed_close",
        },
        // Intentará domesticar la entidad al jugador que ejecutó el menú
        autoTame: true,
      },
      {
        value: "follow_mid",
        label: "§eSeguir jugador (Media)",
        events: {
          start: "humanoid:set_tamed_mid",
        },
        autoTame: true,
      },
      {
        value: "follow_far",
        label: "§6Seguir jugador (Lejos)",
        events: {
          start: "humanoid:set_tamed_far",
        },
        autoTame: true,
      },
      {
        value: "free",
        label: "§9Caminar libremente",
        events: {
          start: "mtf:to_move_free",
        },
      },
      {
        value: "stop",
        label: "§cDetenerse",
        events: {
          start: "mtf:to_stop",
        },
      },
    ],

    factions: {
      [Factions.FOUNDATION]: {
        label: "§lFoundation",
      },
      [Factions.CHAOS]: {
        label: "§2§lChaos",
      },
    },

    // Defaults por jerarquía y grupos
    defaults: {
      [Factions.FOUNDATION]: {
        // Jerarquías (no especiales)
        [UnitHierarchy.BASIC]: "free",
        [UnitHierarchy.LEADER]: "free",
        [UnitHierarchy.COMMANDER]: "free",
        // Grupos de especiales
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
      "§7Define el radio de conciencia y respuesta ante amenazas.\n\nModos:\n- §cMáxima\n§7- §aIntermedia\n§7- §9Cercana\n§7- §6Pasiva",
    category: "combat",
    dynamicProperty: "scpd_system_fire",
    controlType: ControlType.DROPDOWN,
    supportsSpecials: true,
    supportsHierarchy: true,
    supportsGroups: true,

    options: [
      {
        value: "maximum",
        label: "§cMáxima",
        events: {
          start: "humanoid:fire_open_warfare",
        },
      },
      {
        value: "intermediate",
        label: "§aIntermedia",
        events: {
          start: "humanoid:fire_armed_presence",
        },
      },
      {
        value: "close",
        label: "§9Cercana",
        events: {
          start: "humanoid:fire_defensive",
        },
      },
      {
        value: "passive",
        label: "§6Pasiva",
        events: {
          start: "humanoid:fire_mode_hit",
        },
      },
    ],

    factions: {
      [Factions.FOUNDATION]: {
        label: "§lFoundation",
      },
      [Factions.CHAOS]: {
        label: "§2§lChaos",
      },
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
      [Factions.FOUNDATION]: {
        label: "§lFoundation",
      },
      [Factions.CHAOS]: {
        label: "§2§lChaos",
      },
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
      [Factions.FOUNDATION]: {
        label: "§lFoundation",
      },
      [Factions.CHAOS]: {
        label: "§2§lChaos",
      },
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
      {
        value: "normal",
        label: "§aNormal",
        events: {
          start: "humanoid:start_teleport",
        },
      },
      {
        value: "near",
        label: "§6Cercano",
        events: {
          start: "humanoid:start_teleport_near",
        },
      },
      {
        value: "false",
        label: "§cDesactivado",
        events: {
          stop: "humanoid:stop_teleport",
        },
      },
    ],

    factions: {
      [Factions.FOUNDATION]: {
        label: "§lFoundation",
      },
      [Factions.CHAOS]: {
        label: "§2§lChaos",
      },
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
};

/**
 * Definición de categorías para el menú principal
 * Cada categoría agrupa sistemas relacionados
 * Puedes usar códigos § directamente en displayName
 * Si description está vacío, no ocupará espacio en el botón
 */
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
    systems: ["spawn", "health", "teleport"],
  },
  all: {
    id: "all",
    displayName: "§lTodos los Sistemas",
    description: "",
    systems: ["movement", "fire", "spawn", "health", "teleport"],
  },
};

/**
 * Configuración del menú principal
 */
export const menuConfig = {
  title: "SCPDystopia | Panel de Comandos",

  // Orden de las categorías en el menú principal (similar a gui.js)
  categoryOrder: ["movement_patrol", "combat", "advanced", "all"],

  // Usar divisores entre sistemas en formularios
  useDividers: true,

  // Mensajes de confirmación
  messages: {
    // Mensaje cuando se configura la categoría "all"
    allSystems:
      "§8[MENU] §7{player} §rconfiguró §6todos los sistemas§r. Usa §bscpd:check_world_props§r para ver las opciones aplicadas§r.",

    // Mensaje cuando se configuran sistemas específicos
    // {player} = nombre del jugador
    // {systems} = lista de sistemas configurados
    specificSystems: "§8[MENU] §7{player} §rconfiguró: §6{systems}§r.",
  },
};

/**
 * Obtiene la configuración de un sistema por su ID
 * @param {string} systemId
 * @returns {Object|null}
 */
export function getSystemConfig(systemId) {
  return systems[systemId] || null;
}

/**
 * Obtiene la configuración de una categoría por su ID
 * @param {string} categoryId
 * @returns {Object|null}
 */
export function getCategoryConfig(categoryId) {
  return categories[categoryId] || null;
}

/**
 * Obtiene todos los sistemas de una categoría
 * @param {string} categoryId
 * @returns {Array<Object>}
 */
export function getSystemsByCategory(categoryId) {
  const category = categories[categoryId];
  if (!category) return [];
  return category.systems.map((id) => systems[id]).filter(Boolean);
}

/**
 * Obtiene todas las categorías en el orden configurado
 * @returns {Array<Object>}
 */
export function getOrderedCategories() {
  return menuConfig.categoryOrder.map((id) => categories[id]).filter(Boolean);
}

/**
 * Obtiene los valores por defecto de un sistema
 * @param {string} systemId
 * @returns {Object}
 */
export function getSystemDefaults(systemId) {
  const sys = systems[systemId];
  if (!sys) return {};
  return sys.defaults;
}

/**
 * Obtiene los eventos de un sistema según el tipo de control
 * @param {string} systemId
 * @param {string} value - El valor seleccionado (true/false para toggle, o el value de la opción para dropdown)
 * @returns {Object} - Objeto con eventos { start?, stop? } y, si aplica,
 *   `autoTame` booleano indicando que el jugador debe domar la entidad.
 */
export function getSystemEvents(systemId, value) {
  const sys = systems[systemId];
  if (!sys) return {};

  if (sys.controlType === ControlType.TOGGLE) {
    // Para toggle, value es true/false
    const ev = sys.events?.enable?.[value];
    return ev ? { event: ev } : {};
  } else if (sys.controlType === ControlType.DROPDOWN) {
    // Para dropdown, buscar la opción por value
    const option = sys.options?.find((opt) => opt.value === value);
    if (!option) return {};
    const result = { ...(option.events || {}) };
    if (option.autoTame) result.autoTame = true;
    return result;
  }

  return {};
}

/**
 * Determina si un nombre de evento corresponde a un modo que debe
 * intentar domesticar automáticamente la entidad.
 *
 * Revisa todas las opciones de todos los sistemas buscando la bandera
 * `autoTame` y comparando con `start`.
 *
 * @param {string} eventName
 * @returns {boolean}
 */
export function isAutoTameEvent(eventName) {
  if (!eventName) return false;
  for (const sys of Object.values(systems)) {
    if (sys.controlType === ControlType.DROPDOWN && Array.isArray(sys.options)) {
      for (const opt of sys.options) {
        if (opt.autoTame && opt.events && opt.events.start === eventName) {
          return true;
        }
      }
    }

    if (sys.controlType === ControlType.TOGGLE && sys.events && sys.events.enable) {
      for (const key in sys.events.enable) {
        if (sys.events.enable[key] === eventName && sys.autoTame) {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Obtiene la jerarquía de una entidad no especial por su typeId
 * @param {string} typeId
 * @param {string} faction
 * @returns {string|null} - UnitHierarchy value o null si no se encuentra
 */
export function getUnitHierarchy(typeId, faction) {
  const factionUnits = normalUnits[faction];
  if (!factionUnits) return null;

  for (const hierarchy of Object.values(UnitHierarchy)) {
    if (factionUnits[hierarchy]?.includes(typeId)) {
      return hierarchy;
    }
  }
  return null;
}

/**
 * Verifica si un typeId pertenece a unidades normales de un bando
 * @param {string} typeId
 * @param {string} faction
 * @returns {boolean}
 */
export function isNormalUnit(typeId, faction) {
  return getUnitHierarchy(typeId, faction) !== null;
}

/**
 * Obtiene todos los typeIds de unidades normales de un bando
 * @param {string} faction
 * @returns {Array<string>}
 */
export function getAllNormalTypeIds(faction) {
  const factionUnits = normalUnits[faction];
  if (!factionUnits) return [];

  const allTypeIds = [];
  for (const hierarchy of Object.values(UnitHierarchy)) {
    if (factionUnits[hierarchy]) {
      allTypeIds.push(...factionUnits[hierarchy]);
    }
  }
  return allTypeIds;
}

/**
 * Obtiene el orden de grupos para la vista de asignación ("Sin grupo" primero)
 * @returns {Array<string>} Array de IDs de grupos
 */
export function getGroupsOrderForAssignment() {
  const allGroups = Object.values(SpecialGroups);
  return [SpecialGroups.NO_GROUP, ...allGroups.filter((g) => g !== SpecialGroups.NO_GROUP)];
}

/**
 * Obtiene el orden de grupos para formularios de sistemas ("Sin grupo" al final)
 * @returns {Array<string>} Array de IDs de grupos
 */
export function getGroupsOrderForSystems() {
  // NO_GROUP ya está al final en la definición de SpecialGroups
  return Object.values(SpecialGroups);
}

/**
 * Obtiene la lista de jerarquías disponibles
 * @returns {Array<{id: string, label: string}>}
 */
export function getHierarchyList() {
  return Object.entries(UnitHierarchyLabels).map(([id, label]) => ({ id, label }));
}
