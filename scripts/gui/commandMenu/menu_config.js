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
      delta1: {
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
      alpha1: {
        label: "§f§lMTF Alpha-1",
        units: ["§lMTF Alpha-1 Commander", "§lMTF Alpha-1 Commander 2", "§lMTF Alpha-1 Commander 3"],
      },
      other_mtf: {
        label: "§6§lOtros MTF",
        units: [
          "§1§lMTF Epsilon-11 Commander",
          "§b§lMTF Eta-10 Commander",
          "§8§lMTF Nu-7 Commander",
          "§6§lMTF Beta-7 Commander",
          "§e§lMTF Epsilon-6 Commander",
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
    description: "§8(Sólo entidades existentes)",
    tooltip: "Controla cómo se mueven las unidades: seguir al jugador (requiere domesticar), caminar libremente o detenerse",
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
      },
      {
        value: "follow_far",
        label: "§6Seguir jugador (Lejos)",
        events: {
          start: "humanoid:set_tamed_far",
        },
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
    displayName: "§cModo de Disparo",
    description: "",
    tooltip:
      "Define cuándo y cómo atacan las unidades: guerra abierta, presencia armada, defensivo, al recibir daño, etc.",
    category: "combat",
    dynamicProperty: "scpd_system_fire",
    controlType: ControlType.DROPDOWN,
    supportsSpecials: true,
    supportsHierarchy: true,
    supportsGroups: true,

    options: [
      {
        value: "open_warfare",
        label: "§cGuerra Abierta",
        events: {
          start: "humanoid:fire_open_warfare",
        },
      },
      {
        value: "armed_presence",
        label: "§aPresencia Armada",
        events: {
          start: "humanoid:fire_armed_presence",
        },
      },
      {
        value: "defensive",
        label: "§9Defensivo (alcance reducido)",
        events: {
          start: "humanoid:fire_defensive",
        },
      },
      {
        value: "on_hit",
        label: "§6Al Recibir Daño",
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
        [UnitHierarchy.BASIC]: "armed_presence",
        [UnitHierarchy.LEADER]: "armed_presence",
        [UnitHierarchy.COMMANDER]: "armed_presence",
        [SpecialGroups.GROUP_A]: "armed_presence",
        [SpecialGroups.GROUP_B]: "armed_presence",
        [SpecialGroups.GROUP_C]: "armed_presence",
        [SpecialGroups.GROUP_D]: "armed_presence",
        [SpecialGroups.NO_GROUP]: "armed_presence",
      },
      [Factions.CHAOS]: {
        [UnitHierarchy.BASIC]: "armed_presence",
        [UnitHierarchy.LEADER]: "armed_presence",
        [UnitHierarchy.COMMANDER]: "armed_presence",
        [SpecialGroups.GROUP_A]: "armed_presence",
        [SpecialGroups.GROUP_B]: "armed_presence",
        [SpecialGroups.GROUP_C]: "armed_presence",
        [SpecialGroups.GROUP_D]: "armed_presence",
        [SpecialGroups.NO_GROUP]: "armed_presence",
      },
    },
  },

  spawn: {
    id: "spawn",
    displayName: "§1Spawn de soldados",
    description: "",
    tooltip: "Activa o desactiva la generación automática de soldados adicionales",
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
    tooltip: "Muestra u oculta la barra de vida de las unidades en pantalla",
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
    tooltip: "Controla si las unidades pueden teletransportarse al enemigo cuando están lejos",
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
    displayName: "§cAtaque / Reglas de disparo",
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
 * @returns {Object} - Objeto con eventos { start?, stop? }
 */
export function getSystemEvents(systemId, value) {
  const sys = systems[systemId];
  if (!sys) return {};

  if (sys.controlType === ControlType.TOGGLE) {
    // Para toggle, value es true/false
    return sys.events?.enable?.[value] ? { event: sys.events.enable[value] } : {};
  } else if (sys.controlType === ControlType.DROPDOWN) {
    // Para dropdown, buscar la opción por value
    const option = sys.options?.find((opt) => opt.value === value);
    return option?.events || {};
  }

  return {};
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
 * Obtiene la lista de grupos de especiales disponibles
 * @returns {Array<{id: string, label: string}>}
 */
export function getSpecialGroupsList() {
  return Object.entries(SpecialGroupLabels).map(([id, label]) => ({ id, label }));
}

/**
 * Obtiene la lista de jerarquías disponibles
 * @returns {Array<{id: string, label: string}>}
 */
export function getHierarchyList() {
  return Object.entries(UnitHierarchyLabels).map(([id, label]) => ({ id, label }));
}
