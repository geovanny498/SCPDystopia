// scripts/gui/shared/systemCatalog.ts

export interface SystemOption {
  value: string;
  label: string;
  description?: string;
  eventStart?: string;
  eventStop?: string;
  autoTame?: boolean;
}

export interface AdvancedToggleSystem {
  id: string;
  displayName: string;
  description: string;
  eventTrue: string;
  eventFalse: string;
}

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

export const ADVANCED_TOGGLE_SYSTEMS: AdvancedToggleSystem[] = [
  {
    id: "spawn",
    displayName: "§bTraer refuerzos",
    description: "Activa o detiene el spawn automático de refuerzos",
    eventTrue: "humanoid:start_spawn_soldiers",
    eventFalse: "humanoid:stop_spawn_soldiers",
  },
  {
    id: "health",
    displayName: "§cBarra de vida",
    description: "Muestra u oculta la barra de vida de la entidad",
    eventTrue: "humanoid:show_boss_bar",
    eventFalse: "humanoid:dont_show_boss_bar",
  },
  {
    id: "invincible",
    displayName: "Invencibilidad",
    description: "Hace que la entidad ignore todo el daño recibido",
    eventTrue: "humanoid:start_invincible",
    eventFalse: "humanoid:stop_invincible",
  },
];

export const SYSTEM_DISPLAY_NAMES: Record<string, string> = {
  movement: "§1Movimiento / Patrulla",
  fire: "§cIniciativa de Combate",
  spawn: "§bTraer refuerzos",
  health: "§cBarra de vida",
  teleport: "§2Teletransportación",
  invincible: "Invencibilidad",
};

export const CATEGORY_DISPLAY_NAMES: Record<string, string> = {
  movement_patrol: "§1Movimiento / Patrulla",
  combat: "§cIniciativa de Combate",
  advanced: "§6Configuración avanzada",
  advanced_menu: "§6Más sistemas",
};

export const GROUP_LABELS: Record<string, string> = {
  groupA: "§9Grupo A",
  groupB: "§aGrupo B",
  groupC: "§6Grupo C",
  groupD: "§dGrupo D",
  noGroup: "§8Sin grupo",
};

export const SpecialGroupLabels: Record<string, string> = {
  mtf_delta1: "§9§lMTF Delta-1",
  mtf_alpha1: "§f§lMTF Alpha-1",
  mtf_epsilon11: "§1§lMTF Epsilon-11",
  mtf_eta10: "§b§lMTF Eta-10",
  mtf_nu7: "§8§lMTF Nu-7",
  mtf_beta7: "§6§lMTF Beta-7",
  mtf_epsilon6: "§e§lMTF Epsilon-6",
  chaos_delta: "§2§lChaos Delta",
  chaos_member: "§a§lChaos Member",
};

export const GROUP_DESCRIPTIONS: Record<string, string> = {
  groupA: "Perfil 1. Menos unidades, más control",
  groupB: "Perfil 2. Unidades de apoyo",
  groupC: "Perfil 3. Cobertura amplia",
  groupD: "Perfil 4. Más unidades, fuego masivo",
  noGroup: "Perfil por defecto. Aplica a todas sin asignar",
};

export const HIERARCHY_LABELS: Record<string, string> = {
  basic: "§7Básicos",
  leader: "§eLíderes",
  commander: "§6Comandantes",
};

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

export const MAIN_PANEL_BUTTONS = {
  systems: "§1Sistemas",
  advanced: "§6Configuración Avanzada",
  groups: "§9Grupos de Especiales",
  history: "§dHistorial",
};

export const ADVANCED_PANEL_BUTTONS = {
  spawn: "§bTraer refuerzos",
  health: "§cBarra de vida",
  teleport: "§2Teletransportación",
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

export const FACTION_DISPLAY_NAMES: Record<string, string> = {
  foundation: "§lFoundation",
  chaos: "§2§lChaos",
};

export const BACK_BUTTON_LABEL = "<- Volver";

export const PANEL_TITLE_ASIGNAR_GRUPO = "§lAsignar Grupo - ";

export const GROUP_ASSIGNMENT_DESCRIPTION_PREFIX = "§7Asignando grupos para facción: §f";

export const HISTORY_INITIAL_TEXT = "§7Sin cambios registrados.";

export const SYSTEM_PANEL_FEEDBACK_INITIAL = "§7Último cambio: §fN/A";

export const TARGET_FACTION_OPTIONS = [
  { value: "foundation", label: "§lFoundation" },
  { value: "chaos", label: "§2§lChaos" },
  { value: "both", label: "§dAmbas facciones" },
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

export interface CatalogSystem {
  id: string;
  displayName: string;
  controlType: "dropdown" | "toggle";
  options?: SystemOption[];
  eventTrue?: string;
  eventFalse?: string;
}

export interface CatalogCategory {
  id: string;
  displayName: string;
  description?: string;
  systemIds: string[];
}

export const CATALOG_SYSTEMS: Record<string, CatalogSystem> = {
  movement: {
    id: "movement",
    displayName: "§1Movimiento / Patrulla",
    controlType: "dropdown",
    options: MOVEMENT_OPTIONS,
  },
  fire: {
    id: "fire",
    displayName: "§cIniciativa de Combate",
    controlType: "dropdown",
    options: FIRE_OPTIONS,
  },
  teleport: {
    id: "teleport",
    displayName: "§2Teletransportación",
    controlType: "dropdown",
    options: TELEPORT_OPTIONS,
  },
  spawn: {
    id: "spawn",
    displayName: "§bTraer refuerzos",
    controlType: "toggle",
    eventTrue: "humanoid:start_spawn_soldiers",
    eventFalse: "humanoid:stop_spawn_soldiers",
  },
  health: {
    id: "health",
    displayName: "§cBarra de vida",
    controlType: "toggle",
    eventTrue: "humanoid:show_boss_bar",
    eventFalse: "humanoid:dont_show_boss_bar",
  },
  invincible: {
    id: "invincible",
    displayName: "Invencibilidad",
    controlType: "toggle",
    eventTrue: "humanoid:start_invincible",
    eventFalse: "humanoid:stop_invincible",
  },
};

export const CATALOG_CATEGORIES: Record<string, CatalogCategory> = {
  movement_patrol: {
    id: "movement_patrol",
    displayName: "§1Movimiento / Patrulla",
    systemIds: ["movement"],
  },
  combat: {
    id: "combat",
    displayName: "§cIniciativa de Combate",
    systemIds: ["fire"],
  },
  advanced: {
    id: "advanced",
    displayName: "§6Configuración avanzada",
    systemIds: ["spawn", "health", "teleport", "invincible"],
  },
};
