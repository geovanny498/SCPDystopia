// scripts/gui/shared/systemCatalog.ts

import type { Entity } from "@minecraft/server";
import { FactionId, SpecialGroupId, DefaultsKey, NAMETAG_FAMILY_MAP } from "../../constants/domains.js";

// ── Tipos de dominio ────────────────────────────────────────────────────────

/**
 * Identificadores canónicos de sistema como objeto de constantes.
 * Permite propagación: si renombras aquí, todos los consumidores
 * que usan `SystemIds.SPAWN` se actualizan automáticamente.
 */
export const SystemIds = {
  MOVEMENT: "movement",
  FIRE: "fire",
  SPAWN: "spawn",
  HEALTH: "health",
  TELEPORT: "teleport",
  INVINCIBLE: "invincible",
} as const;

/**
 * Union type de IDs de sistema válidos (derivado de SystemIds).
 */
export type SystemId = (typeof SystemIds)[keyof typeof SystemIds];

/**
 * Identificadores canónicos de categoría de catálogo como objeto de constantes.
 * Permite propagación: si renombras aquí, todos los consumidores
 * que usan `CategoryIds.MOVEMENT_PATROL` se actualizan automáticamente.
 */
export const CategoryIds = {
  MOVEMENT_PATROL: "movement_patrol",
  COMBAT: "combat",
  ADVANCED: "advanced",
  ALL: "all",
} as const;

/**
 * Union type de IDs de categoría válidos (derivado de CategoryIds).
 */
export type CategoryId = (typeof CategoryIds)[keyof typeof CategoryIds];

/**
 * Valor posible de una opción de sistema (string para dropdown, boolean para toggle).
 */
export type OptionValue = string | boolean;

// ── Interfaces de catálogo ──────────────────────────────────────────────────

export interface SystemOption {
  value: string;
  label: string;
  description?: string;
  eventStart?: string;
  eventStop?: string;
  autoTame?: boolean;
}

export interface AdvancedToggleSystem {
  id: SystemId;
  displayName: string;
  description: string;
  eventTrue: string;
  eventFalse: string;
  labelTrue?: string;
  labelFalse?: string;
}

export interface CatalogSystem {
  id: SystemId;
  displayName: string;
  controlType: "dropdown" | "toggle";
  options?: SystemOption[];
  eventTrue?: string;
  eventFalse?: string;
  description: string;
  category: CategoryId;
  dynamicProperty: string;
  tooltip?: string;
  supportsSpecials: boolean;
  supportsHierarchy: boolean;
  supportsGroups: boolean;
  defaults: Record<FactionId, Record<DefaultsKey, OptionValue>>;
  labelTrue?: string;
  labelFalse?: string;
}

export interface CatalogCategory {
  id: CategoryId;
  displayName: string;
  description?: string;
  systemIds: SystemId[];
}

// ── Opciones de sistemas dropdown ──────────────────────────────────────────

export const MOVEMENT_OPTIONS: SystemOption[] = [
  {
    value: "follow_close",
    label: "§aSeguir jugador (Cerca)",
    description: "Escolta cercana. Teletransporte de combate activo",
    eventStart: "humanoid:set_tamed_close",
    autoTame: true,
  },
  {
    value: "follow_mid",
    label: "§eSeguir jugador (Media)",
    description: "Grupo extendido. Unidades de apoyo",
    eventStart: "humanoid:set_tamed_mid",
    autoTame: true,
  },
  {
    value: "follow_far",
    label: "§6Seguir jugador (Lejos)",
    description: "Grupo operando separado. Mantiene posición relativa",
    eventStart: "humanoid:set_tamed_far",
    autoTame: true,
  },
  {
    value: "free",
    label: "§9Caminar libremente",
    description: "Autonomía total. Sin dueño ni teletransporte",
    eventStart: "mtf:to_move_free",
  },
  {
    value: "stop",
    label: "§cDetenerse",
    description: "Guardia estática. Mantiene ataque y rotación activos",
    eventStart: "mtf:to_stop",
  },
];

export const FIRE_OPTIONS: SystemOption[] = [
  {
    value: "maximum",
    label: "§cMáxima",
    description: "Detección máxima. Guerra y defensa. Hasta ~48m-64m según unidad",
    eventStart: "humanoid:fire_maximum",
  },
  {
    value: "advanced",
    label: "§9Avanzada",
    description: "Combate ofensivo. Ataque controlado. Hasta ~36m-48m según unidad",
    eventStart: "humanoid:fire_advanced",
  },
  {
    value: "intermediate",
    label: "§aIntermedia",
    description: "Exploración estándar. Cobertura general. Hasta ~26m-34m según unidad",
    eventStart: "humanoid:fire_intermediate",
  },
  {
    value: "close",
    label: "§bCercana",
    description: "CQB y escolta. Interiores cerrados. Hasta ~16m-22m según unidad",
    eventStart: "humanoid:fire_close",
  },
  {
    value: "neutral",
    label: "§eNeutral / Sigilo",
    description: "Sin detección visual. Pasa desapercibido. Solo responde al daño",
    eventStart: "humanoid:fire_neutral",
  },
];

export const TELEPORT_OPTIONS: SystemOption[] = [
  {
    value: "normal",
    label: "§aModerado",
    description: "Teletransporta hacia el enemigo si está a más de ~30m",
    eventStart: "humanoid:start_teleport",
  },
  {
    value: "near",
    label: "§6Cercano",
    description: "Teletransporta hacia el enemigo si está a más de ~15m",
    eventStart: "humanoid:start_teleport_near",
  },
  {
    value: "false",
    label: "§cDesactivado",
    description: "Avanza hacia el enemigo usando solo navegación a pie",
    eventStop: "humanoid:stop_teleport",
  },
];

// ── Sistemas avanzados (toggle) ─────────────────────────────────────────────

export const ADVANCED_TOGGLE_SYSTEMS: AdvancedToggleSystem[] = [
  {
    id: "spawn",
    displayName: "§bTraer refuerzos",
    description: "Activa o detiene el spawn automático de refuerzos",
    eventTrue: "humanoid:start_spawn_soldiers",
    eventFalse: "humanoid:stop_spawn_soldiers",
    labelTrue: "§aActivar",
    labelFalse: "§cDesactivar",
  },
  {
    id: "health",
    displayName: "§cBarra de vida",
    description: "Muestra u oculta la barra de vida de la entidad",
    eventTrue: "humanoid:show_boss_bar",
    eventFalse: "humanoid:dont_show_boss_bar",
    labelTrue: "§aMostrar",
    labelFalse: "§cOcultar",
  },
  {
    id: "invincible",
    displayName: "Invencibilidad",
    description: "Hace que la entidad ignore todo el daño recibido",
    eventTrue: "humanoid:start_invincible",
    eventFalse: "humanoid:stop_invincible",
    labelTrue: "§aActivar",
    labelFalse: "§cDesactivar",
  },
];

// ── Catálogo de sistemas ────────────────────────────────────────────────────

export const CATALOG_SYSTEMS: Record<SystemId, CatalogSystem> = {
  movement: {
    id: "movement",
    displayName: "§1Movimiento / Patrulla",
    controlType: "dropdown",
    options: MOVEMENT_OPTIONS,
    description: "§8(Sólo entidades existentes)",
    category: "movement_patrol",
    dynamicProperty: "scpd_system_movement",
    tooltip:
      "§7Define cómo se desplazan las unidades en terreno.\n\nModos:\n- Seguir jugador (§aCerca/§eMedia/§6Lejos§7)\n- §9Caminar libremente\n§7- §cDetenerse",
    supportsSpecials: true,
    supportsHierarchy: true,
    supportsGroups: true,
    defaults: {
      foundation: {
        basic: "free",
        leader: "free",
        commander: "free",
        groupA: "free",
        groupB: "free",
        groupC: "free",
        groupD: "free",
        noGroup: "free",
      },
      chaos: {
        basic: "free",
        leader: "free",
        commander: "free",
        groupA: "free",
        groupB: "free",
        groupC: "free",
        groupD: "free",
        noGroup: "free",
      },
    },
  },
  fire: {
    id: "fire",
    displayName: "§cIniciativa de Combate",
    controlType: "dropdown",
    options: FIRE_OPTIONS,
    description: "",
    category: "combat",
    dynamicProperty: "scpd_system_fire",
    tooltip:
      "§7Define el radio de conciencia y respuesta ante amenazas.\n\nModos:\n- §cMáxima\n§7- §9Avanzada\n§7- §aIntermedia\n§7- §bCercana\n§7- §eNeutral / Sigilo",
    supportsSpecials: true,
    supportsHierarchy: true,
    supportsGroups: true,
    defaults: {
      foundation: {
        basic: "intermediate",
        leader: "intermediate",
        commander: "intermediate",
        groupA: "intermediate",
        groupB: "intermediate",
        groupC: "intermediate",
        groupD: "intermediate",
        noGroup: "intermediate",
      },
      chaos: {
        basic: "intermediate",
        leader: "intermediate",
        commander: "intermediate",
        groupA: "intermediate",
        groupB: "intermediate",
        groupC: "intermediate",
        groupD: "intermediate",
        noGroup: "intermediate",
      },
    },
  },
  teleport: {
    id: "teleport",
    displayName: "§2Teletransporte",
    controlType: "dropdown",
    options: TELEPORT_OPTIONS,
    description: "",
    category: "advanced",
    dynamicProperty: "scpd_system_teleport",
    tooltip:
      "§7Define la agresividad del teletransporte hacia el enemigo cuando hay distancia.\n\nModos:\n- §aModerado\n§7- §6Cercano\n§7- §cDesactivado",
    supportsSpecials: true,
    supportsHierarchy: true,
    supportsGroups: true,
    defaults: {
      foundation: {
        basic: "false",
        leader: "false",
        commander: "false",
        groupA: "false",
        groupB: "false",
        groupC: "false",
        groupD: "false",
        noGroup: "false",
      },
      chaos: {
        basic: "false",
        leader: "false",
        commander: "false",
        groupA: "false",
        groupB: "false",
        groupC: "false",
        groupD: "false",
        noGroup: "false",
      },
    },
  },
  spawn: {
    id: "spawn",
    displayName: "§bTraer refuerzos",
    controlType: "toggle",
    eventTrue: "humanoid:start_spawn_soldiers",
    eventFalse: "humanoid:stop_spawn_soldiers",
    description: "",
    category: "advanced",
    dynamicProperty: "scpd_system_spawn",
    tooltip:
      "§7Habilita la capacidad de generar refuerzos adicionales (Sólo líderes y algunos comandantes).\n\nEstados:\n- §aActivado\n§7- §cDesactivado",
    labelTrue: "§aActivar",
    labelFalse: "§cDesactivar",
    supportsSpecials: true,
    supportsHierarchy: true,
    supportsGroups: true,
    defaults: {
      foundation: {
        basic: false,
        leader: false,
        commander: false,
        groupA: false,
        groupB: false,
        groupC: false,
        groupD: false,
        noGroup: false,
      },
      chaos: {
        basic: false,
        leader: false,
        commander: false,
        groupA: false,
        groupB: false,
        groupC: false,
        groupD: false,
        noGroup: false,
      },
    },
  },
  health: {
    id: "health",
    displayName: "§cBarra de vida",
    controlType: "toggle",
    eventTrue: "humanoid:show_boss_bar",
    eventFalse: "humanoid:dont_show_boss_bar",
    description: "",
    category: "advanced",
    dynamicProperty: "scpd_system_health",
    tooltip:
      "§7Visualización de la salud de las unidades cercanas en la interfaz.\n\nEstados:\n- §aActivado\n§7- §cDesactivado",
    labelTrue: "§aMostrar",
    labelFalse: "§cOcultar",
    supportsSpecials: true,
    supportsHierarchy: true,
    supportsGroups: true,
    defaults: {
      foundation: {
        basic: false,
        leader: false,
        commander: false,
        groupA: false,
        groupB: false,
        groupC: false,
        groupD: false,
        noGroup: false,
      },
      chaos: {
        basic: false,
        leader: false,
        commander: false,
        groupA: false,
        groupB: false,
        groupC: false,
        groupD: false,
        noGroup: false,
      },
    },
  },
  invincible: {
    id: "invincible",
    displayName: "Invencibilidad",
    controlType: "toggle",
    eventTrue: "humanoid:start_invincible",
    eventFalse: "humanoid:stop_invincible",
    description: "",
    category: "advanced",
    dynamicProperty: "scpd_system_invincible",
    tooltip:
      "§7Hace invulnerable a la unidad. Usar con precaución.\n\nEstados:\n- §aActivado\n§7- §cDesactivado",
    labelTrue: "§aActivar",
    labelFalse: "§cDesactivar",
    supportsSpecials: true,
    supportsHierarchy: true,
    supportsGroups: true,
    defaults: {
      foundation: {
        basic: false,
        leader: false,
        commander: false,
        groupA: false,
        groupB: false,
        groupC: false,
        groupD: false,
        noGroup: false,
      },
      chaos: {
        basic: false,
        leader: false,
        commander: false,
        groupA: false,
        groupB: false,
        groupC: false,
        groupD: false,
        noGroup: false,
      },
    },
  },
};

// ── Categorías ──────────────────────────────────────────────────────────────

export const CATALOG_CATEGORIES: Record<CategoryId, CatalogCategory> = {
  movement_patrol: {
    id: "movement_patrol",
    displayName: "§1Movimiento / Patrulla",
    description: "",
    systemIds: [SystemIds.MOVEMENT],
  },
  combat: {
    id: "combat",
    displayName: "§cIniciativa de Combate",
    description: "",
    systemIds: [SystemIds.FIRE],
  },
  advanced: {
    id: "advanced",
    displayName: "§6Configuración avanzada",
    description: "",
    systemIds: [SystemIds.SPAWN, SystemIds.HEALTH, SystemIds.TELEPORT, SystemIds.INVINCIBLE],
  },
  all: {
    id: "all",
    displayName: "§lTodos los Sistemas",
    description: "",
    systemIds: [SystemIds.MOVEMENT, SystemIds.FIRE, SystemIds.SPAWN, SystemIds.HEALTH, SystemIds.TELEPORT, SystemIds.INVINCIBLE],
  },
};

// ── Nombres cortos de sistemas ──────────────────────────────────────────────

/**
 * Nombres cortos para mostrar en resúmenes, historial y etiquetas compactas.
 *
 * Solo incluye los 6 sistemas reales del catálogo.
 * `group_assignment` y `entity_protection` permanecen en `interactMenu/config.ts`
 * porque son features específicas de ese menú.
 */
export const SYSTEM_SHORT_NAMES: Record<string, string> = {
  movement: "§1Movimiento§r",
  fire: "§cIniciativa§r",
  spawn: "§bRefuerzos§r",
  health: "§cBarra de vida§r",
  teleport: "§2Teletransporte§r",
  invincible: "Invencibilidad",
};

// ── Nombres de display de sistemas ─────────────────────────────────────────

export const SYSTEM_DISPLAY_NAMES: Record<SystemId, string> = {
  movement: "§1Movimiento / Patrulla",
  fire: "§cIniciativa de Combate",
  spawn: "§bTraer refuerzos",
  health: "§cBarra de vida",
  teleport: "§2Teletransporte",
  invincible: "Invencibilidad",
};

// ── Labels de categorías ────────────────────────────────────────────────────

/**
 * Labels de categoría para navegación UI.
 *
 * `advanced_menu` es un label de navegación interna de interactMenu
 * (no una categoría de catálogo). Se mantiene con JSDoc para diferenciarla
 * de `advanced` (categoría de sistemas del catálogo).
 */
export const CATEGORY_DISPLAY_NAMES: Record<string, string> = {
  movement_patrol: "§1Movimiento / Patrulla",
  combat: "§cIniciativa de Combate",
  advanced: "§6Configuración avanzada",
  advanced_menu: "§6Más sistemas",
};

// ── Labels de grupos especiales ─────────────────────────────────────────────

export const GROUP_LABELS: Record<string, string> = {
  groupA: "§9Grupo A",
  groupB: "§aGrupo B",
  groupC: "§6Grupo C",
  groupD: "§dGrupo D",
  noGroup: "§8Sin grupo",
};

/**
 * Labels de familias MTF/Chaos para el menú de grupos por facción.
 *
 * Derivado de NAMETAG_FAMILY_MAP (constants/domains.ts).
 * Se incluye aquí para consumo directo desde systemCatalog sin depender
 * de constants/domains.ts en builders de UI.
 */
/**
 * Vista de solo labels de NAMETAG_FAMILY_MAP. Derivada automáticamente:
 * si añades una familia a NAMETAG_FAMILY_MAP, aparece aquí sin tocar este archivo.
 */
export const NAMETAG_FAMILY_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(NAMETAG_FAMILY_MAP).map(([key, entry]) => [key, entry.label])
);

export const GROUP_DESCRIPTIONS: Record<SpecialGroupId, string> = {
  groupA: "Perfil 1. Menos unidades, más control",
  groupB: "Perfil 2. Unidades de apoyo",
  groupC: "Perfil 3. Cobertura amplia",
  groupD: "Perfil 4. Más unidades, fuego masivo",
  noGroup: "Perfil por defecto. Aplica a todas sin asignar",
};

// ── Labels de jerarquía ─────────────────────────────────────────────────────

export const HIERARCHY_LABELS: Record<string, string> = {
  basic: "§7Básicos",
  leader: "§eLíderes",
  commander: "§6Comandantes",
};

// ── Nombres de display de facciones ─────────────────────────────────────────

export const FACTION_DISPLAY_NAMES: Record<string, string> = {
  foundation: "§lFoundation",
  chaos: "§2§lChaos",
};

// ── Configuración del menú principal ────────────────────────────────────────

export const MENU_CONFIG = {
  title: "SCPDystopia | Panel de Comandos",
  categoryOrder: [CategoryIds.MOVEMENT_PATROL, CategoryIds.COMBAT, CategoryIds.ADVANCED, CategoryIds.ALL] as CategoryId[],
  useDividers: true,
  messages: {
    allSystems:
      "§8[MENU] §7{player} §rconfiguró §6todos los sistemas§r. Usa §bscpd:check_world_props§r para ver las opciones aplicadas§r.",
    specificSystems: "§8[MENU] §7{player} §rconfiguró: §6{systems}§r.",
  },
};

// ── Títulos y descripciones de paneles ──────────────────────────────────────

export const PANEL_TITLES: Record<string, string> = {
  main: "§9Menú de comandos",
  advanced: "§lConfiguración Avanzada",
  groups: "§lGrupos",
  groupsByFaction: "§lGrupos por Facción",
  history: "§lHistorial",
  scope: "§lPrioridad de Aplicación",
  system: "§lSistemas",
};

export const PANEL_DESCRIPTIONS: Record<string, string> = {
  main: "Selecciona una opción para continuar.",
  advanced: "Accede a sistemas avanzados y scope.",
  groups: "Gestiona los grupos de unidades especiales.",
  groupsByFaction: "Selecciona una categoria para asignar grupos.",
  history: "Últimos cambios aplicados.",
  scope: "Prioridad de aplicación de cambios. Los cambios se registran en el historial.",
  system: "Configura los sistemas de tus unidades.",
};

// ── Botones de paneles ──────────────────────────────────────────────────────

export const MAIN_PANEL_BUTTONS = {
  systems: "§1Sistemas",
  advanced: "§6Configuración Avanzada",
  groups: "§9Grupos de Especiales",
  history: "§dHistorial",
};

export const ADVANCED_PANEL_BUTTONS = {
  spawn: "§bTraer refuerzos",
  health: "§cBarra de vida",
  teleport: "§2Teletransporte",
  invincible: "Invencibilidad",
  scope: "§dPrioridad de Aplicación",
  back: "<- Volver",
};

export const GROUP_PANEL_BUTTONS = {
  assignByFaction: "§9Grupos por Facción",
  back: "<- Volver",
};

export const GROUP_FACTION_BUTTONS = {
  foundation: "§lFoundation",
  chaos: "§2§lChaos",
};

export const GROUP_ASSIGNMENT_BUTTONS = {
  groupA: "§9Grupo A",
  groupB: "§aGrupo B",
  groupC: "§6Grupo C",
  groupD: "§dGrupo D",
  noGroup: "§8Sin grupo",
  back: "<- Volver",
};

export const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  commander: "Comandante",
  member: "Miembro",
};

export const BACK_BUTTON_LABEL = "<- Volver";

export const PANEL_TITLE_ASIGNAR_GRUPO = "§lAsignar Grupo - ";

export const GROUP_ASSIGNMENT_DESCRIPTION_PREFIX = "§7Asignando grupos para facción: §f";

export const HISTORY_INITIAL_TEXT = "§7Sin cambios registrados.";

export const TARGET_FACTION_OPTIONS = [
  { value: "foundation", label: "§lFoundation" },
  { value: "chaos", label: "§2§lChaos" },
  { value: "both", label: "§dAmbas facciones" },
];

export const SYSTEM_VIEW_FILTER_OPTIONS = [
  { value: "all", label: "§fAmbos" },
  { value: "hierarchy", label: "§7No especiales" },
  { value: "specials", label: "§6Especiales" },
];

export const HIERARCHY_AND_GROUP_OPTIONS = [
  { value: "basic", label: "§7Básicos" },
  { value: "leader", label: "§eLíderes" },
  { value: "commander", label: "§6Comandantes" },
  { value: "groupA", label: "§9Grupo A" },
  { value: "groupB", label: "§aGrupo B" },
  { value: "groupC", label: "§6Grupo C" },
  { value: "groupD", label: "§dGrupo D" },
  { value: "noGroup", label: "§8Sin grupo" },
];

export const HIERARCHY_OPTIONS = HIERARCHY_AND_GROUP_OPTIONS.filter((opt) =>
  ["basic", "leader", "commander"].includes(opt.value)
);

export const SPECIAL_GROUP_OPTIONS = HIERARCHY_AND_GROUP_OPTIONS.filter((opt) =>
  ["groupA", "groupB", "groupC", "groupD", "noGroup"].includes(opt.value)
);

// ── Mensajes de error centralizados ─────────────────────────────────────────

export const ERROR_MESSAGES = {
  NEED_FACTION_HELMET: "§c[SCPDystopia] Necesitas llevar el casco de tu facción para acceder al menú.",
  OPEN_MENU: "§c[SCPDystopia] Error al abrir el menú.",
  NO_DIMENSION: "§c[SCPDystopia] Dimensión no disponible.",
  NO_SESSION: "§c[SCPDystopia] Sesión no encontrada para el menú de comandos.",
  NO_BUCKET: "§c[SCPDystopia] Bucket no encontrado.",
  ASSIGN_GROUP: "§c[SCPDystopia] Error asignando grupo.",
  SYSTEM_NOT_FOUND: "§c[SCPDystopia] Sistema no encontrado.",
  SCOPE_SAVE: "§c[SCPDystopia] Error guardando scope.",
  APPLY: "Error al aplicar",
  DDUI_OPEN: "§c[DDUI] Error al abrir el menú de interacción.",
  DDUI_OPEN_SYSTEMS: "§c[DDUI] Error al abrir el menú de sistemas avanzados.",
  DDUI_OPEN_MANAGEMENT: "§c[DDUI] Error al abrir el menú de gestión y estado.",
  DDUI_OPEN_HISTORY: "§c[DDUI] Error al abrir el historial.",
};

export const SCOPE_RESPECT_LABEL = "Respetar bloqueos";
export const SCOPE_GLOBAL_LABEL = "Aplicar global";
export const SCOPE_CONTEXT = "Prioridad de Aplicación";

export const TOGGLE_ON_LABEL = "Activado";
export const TOGGLE_OFF_LABEL = "Desactivado";

// ── Helpers puros ───────────────────────────────────────────────────────────

/**
 * Indica si un sistema es de tipo toggle.
 */
export function isToggleSystem(sys: CatalogSystem): sys is CatalogSystem & { controlType: "toggle" } {
  return sys.controlType === "toggle";
}

/**
 * Indica si un sistema es de tipo dropdown.
 */
export function isDropdownSystem(sys: CatalogSystem): sys is CatalogSystem & { controlType: "dropdown" } {
  return sys.controlType === "dropdown";
}

/**
 * Obtiene la opción de un sistema dropdown por su valor.
 */
export function getSystemOption(systemId: SystemId, value: string): SystemOption | undefined {
  const sys = CATALOG_SYSTEMS[systemId];
  if (!isDropdownSystem(sys) || !sys.options) return undefined;
  return sys.options.find((opt) => opt.value === value);
}

/**
 * Obtiene el evento asociado a un valor de sistema.
 */
export function getSystemEvent(systemId: SystemId, value: OptionValue): { event: string; autoTame?: boolean } | undefined {
  const sys = CATALOG_SYSTEMS[systemId];
  if (!sys) return undefined;

  if (isToggleSystem(sys)) {
    const boolVal = typeof value === "boolean" ? value : value === "true";
    const ev = boolVal ? sys.eventTrue : sys.eventFalse;
    if (!ev) return undefined;
    return { event: ev };
  }

  if (isDropdownSystem(sys) && sys.options) {
    const opt = sys.options.find((o) => o.value === value);
    if (!opt) return undefined;
    const result: { event: string; autoTame?: boolean } = { event: opt.eventStart ?? opt.eventStop ?? "" };
    if (opt.autoTame) result.autoTame = true;
    return result;
  }

  return undefined;
}

/**
 * Indica si un valor de sistema dispara un evento autoTame.
 */
export function isAutoTameSystem(systemId: SystemId, value: OptionValue): boolean {
  const ev = getSystemEvent(systemId, value);
  return ev?.autoTame === true;
}

/**
 * Obtiene el nombre de la DP dinámica de un sistema.
 */
export function getSystemProperty(systemId: SystemId): string | undefined {
  return CATALOG_SYSTEMS[systemId]?.dynamicProperty;
}

/**
 * Obtiene los defaults crudos de un sistema.
 */
export function getSystemDefaults(systemId: SystemId): Record<FactionId, Record<DefaultsKey, OptionValue>> {
  return CATALOG_SYSTEMS[systemId]?.defaults ?? {};
}

/**
 * Obtiene el default para una facción y clave específicas.
 */
export function getSystemDefaultForKey(systemId: SystemId, faction: FactionId, key: DefaultsKey): OptionValue | undefined {
  return getSystemDefaults(systemId)?.[faction]?.[key];
}

/**
 * Obtiene el orden de grupos para asignación (NO_GROUP primero).
 */
export function getGroupsOrderForAssignment(): SpecialGroupId[] {
  return ["noGroup", "groupA", "groupB", "groupC", "groupD"];
}

/**
 * Obtiene el orden de grupos para sistemas.
 */
export function getGroupsOrderForSystems(): SpecialGroupId[] {
  return ["groupA", "groupB", "groupC", "groupD", "noGroup"];
}
