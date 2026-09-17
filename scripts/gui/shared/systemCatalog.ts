// scripts/gui/shared/systemCatalog.ts

import type { Entity } from "@minecraft/server";
import {
  Factions,
  UnitHierarchy,
  SpecialGroups,
  FactionId,
  SpecialGroupId,
  DefaultsKey,
  NAMETAG_FAMILY_MAP,
  UnitHierarchyId,
  TargetFaction,
} from "../../constants/domains.js";
import { RoleIds } from "./playerPermissionManager.js";
import type { RoleId } from "./playerPermissionManager.js";

// ── Tipos de dominio ────────────────────────────────────────────────────────

/**
 * Identificadores canónicos de sistema como objeto de constantes.
 * Permite propagación: si renombras aquí, todos los consumidores
 * que usan `SystemIds.SPAWN` se actualizan automáticamente.
 */
export const SystemIds = {
  MOVEMENT: "movement",
  FIRE: "fire",
  WEAPON: "weapon",
  ARMAMENT: "armament",
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
 * Afiliación de menú de un sistema: a qué interfaz pertenece.
 * - "command" → commandMenu DDUI (no aparece en interactMenu).
 * - "interact" → interactMenu DDUI (excluido de la superficie de comandos `scpd:`;
 *   no debe resetearse/reaplicarse desde comandos para evitar stripeo de armas).
 * - "both" → visible/configurable en ambos menús.
 */
export type MenuAffiliation = "command" | "interact" | "both";

/**
 * Identificadores canónicos de categoría de catálogo como objeto de constantes.
 * Permite propagación: si renombras aquí, todos los consumidores
 * que usan `CategoryIds.MOVEMENT` se actualizan automáticamente.
 *
 * Nota: Los IDs de categoría para sistemas individuales (movement, fire)
 * coinciden con los IDs de sistema para evitar duplicación semántica.
 * La categoría `advanced` agrupa múltiples sistemas.
 */
export const CategoryIds = {
  MOVEMENT: "movement",
  FIRE: "fire",
  ARMAMENT: "armament",
  ADVANCED: "advanced",
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

export interface CatalogSystem {
  id: SystemId;
  /** Afiliación de menú del sistema. Siempre definido; el default conceptual es `"both"`. */
  menu: MenuAffiliation;
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
  minRole?: RoleId;
  blockedByHierarchy?: Partial<Record<UnitHierarchyId, boolean>>;
  allowedFamilies?: string[];
  blockedFamilies?: string[];
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

export const WEAPON_OPTIONS: SystemOption[] = [
  {
    value: "none",
    label: "Ninguna",
    description: "",
    eventStart: "humanoid:remove_weapon",
  },
  {
    value: "hk416",
    label: "§9HK416",
    description: "Fusil de asalto moderno.",
    eventStart: "humanoid:give_hk416",
  },
  {
    value: "m4a1",
    label: "§1M4A1",
    description: "Fusil de asalto versátil.",
    eventStart: "humanoid:give_m4a1",
  },
  {
    value: "scar",
    label: "§6Scar-H",
    description: "Fusil de combate robusto.",
    eventStart: "humanoid:give_scar",
  },
  {
    value: "ak47",
    label: "§fAK-47",
    description: "Fusil de asalto estándar.",
    eventStart: "humanoid:give_ak47",
  },
  {
    value: "m16",
    label: "§bM16",
    description: "Fusil de combate clásico.",
    eventStart: "humanoid:give_m16",
  },
  {
    value: "p90",
    label: "§6P90",
    description: "Subfusil bullpup.",
    eventStart: "humanoid:give_p90",
  },
  {
    value: "mp7",
    label: "§bMP7",
    description: "Subfusil táctica.",
    eventStart: "humanoid:give_mp7",
  },
  {
    value: "mp5a3",
    label: "§7MP5A3",
    description: "Subfusil compacto.",
    eventStart: "humanoid:give_mp5a3",
  },
  {
    value: "dystopia_rifle",
    label: "§dDystopia Rifle",
    description: "Sniper experimental.",
    eventStart: "humanoid:give_dystopia_rifle",
  },
  {
    value: "suscharger",
    label: "§5Suscharger",
    description: "Arma especial.",
    eventStart: "humanoid:give_suscharger",
  },
];

export const ARMAMENT_OPTIONS: SystemOption[] = [
  {
    value: "low",
    label: "§7Bajo",
    description: "Armamento básico; prioriza subfusiles y armas de bajo daño.",
    eventStart: "humanoid:armament_low",
  },
  {
    value: "standard",
    label: "§eEstándar",
    description: "Armamento equilibrado por unidad (predeterminado).",
    eventStart: "humanoid:armament_standard",
  },
  {
    value: "high",
    label: "§6Alto",
    description: "Escalada táctica; mayor acceso a armas de asalto de alto rendimiento.",
    eventStart: "humanoid:armament_high",
  },
  {
    value: "extreme",
    label: "§cExtremo",
    description: "Combate intenso; mayor preferencia por armamento de élite.",
    eventStart: "humanoid:armament_extreme",
  },
];

// ── Catálogo de sistemas ────────────────────────────────────────────────────

export const CATALOG_SYSTEMS: Record<SystemId, CatalogSystem> = {
  movement: {
    id: SystemIds.MOVEMENT,
    displayName: "§1Movimiento / Patrulla",
    controlType: "dropdown",
    options: MOVEMENT_OPTIONS,
    description: "§8(Sólo entidades existentes)",
    category: CategoryIds.MOVEMENT,
    menu: "both",
    dynamicProperty: "scpd_system_movement",
    tooltip:
      "§7Define cómo se desplazan las unidades en terreno.\n\nModos:\n- Seguir jugador (§aCerca/§eMedia/§6Lejos§7)\n- §9Caminar libremente\n§7- §cDetenerse",
    supportsSpecials: true,
    supportsHierarchy: true,
    supportsGroups: true,
    minRole: RoleIds.MEMBER,
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
    id: SystemIds.FIRE,
    displayName: "§cIniciativa de Combate",
    controlType: "dropdown",
    options: FIRE_OPTIONS,
    description: "",
    category: CategoryIds.FIRE,
    menu: "both",
    dynamicProperty: "scpd_system_fire",
    tooltip:
      "§7Define el radio de conciencia y respuesta ante amenazas.\n\nModos:\n- §cMáxima\n§7- §9Avanzada\n§7- §aIntermedia\n§7- §bCercana\n§7- §eNeutral / Sigilo",
    supportsSpecials: true,
    supportsHierarchy: true,
    supportsGroups: true,
    minRole: RoleIds.MEMBER,
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
  weapon: {
    id: SystemIds.WEAPON,
    displayName: "§6Arma equipada",
    controlType: "dropdown",
    options: WEAPON_OPTIONS,
    description: "",
    category: CategoryIds.ADVANCED,
    menu: "interact",
    dynamicProperty: "scpd_system_weapon",
    tooltip:
      "§7Cambia el arma equipada de la unidad.\n\nArmas disponibles:\n- §7MP5A3\n§7- §fAK-47\n§7- §8Dystopia Rifle\n§7- §aHK416\n§7- §eM4A1\n§7- §bM16\n§7- §dMP7\n§7- §6P90\n§7- §cScar-H\n§7- §5Suscharger",
    supportsSpecials: true,
    supportsHierarchy: true,
    supportsGroups: true,
    minRole: RoleIds.MEMBER,
    defaults: {
      [Factions.FOUNDATION]: {
        [UnitHierarchy.BASIC]: "none",
        [UnitHierarchy.LEADER]: "none",
        [UnitHierarchy.COMMANDER]: "none",
        [SpecialGroups.GROUP_A]: "none",
        [SpecialGroups.GROUP_B]: "none",
        [SpecialGroups.GROUP_C]: "none",
        [SpecialGroups.GROUP_D]: "none",
        [SpecialGroups.NO_GROUP]: "none",
      },
      [Factions.CHAOS]: {
        [UnitHierarchy.BASIC]: "none",
        [UnitHierarchy.LEADER]: "none",
        [UnitHierarchy.COMMANDER]: "none",
        [SpecialGroups.GROUP_A]: "none",
        [SpecialGroups.GROUP_B]: "none",
        [SpecialGroups.GROUP_C]: "none",
        [SpecialGroups.GROUP_D]: "none",
        [SpecialGroups.NO_GROUP]: "none",
      },
    },
  },
  armament: {
    id: SystemIds.ARMAMENT,
    displayName: "§6Distribución de Armamento",
    controlType: "dropdown",
    options: ARMAMENT_OPTIONS,
    description: "",
    category: CategoryIds.ARMAMENT,
    menu: "command",
    dynamicProperty: "scpd_system_armament",
    tooltip:
      "§7Define el nivel de armamento base de la unidad según su loot table.\n\nNiveles:\n- §7Bajo\n§7- §eEstándar\n§7- §6Alto\n§7- §cExtremo",
    supportsSpecials: true,
    supportsHierarchy: true,
    supportsGroups: true,
    minRole: RoleIds.MEMBER,
    defaults: {
      [Factions.FOUNDATION]: {
        [UnitHierarchy.BASIC]: "standard",
        [UnitHierarchy.LEADER]: "standard",
        [UnitHierarchy.COMMANDER]: "standard",
        [SpecialGroups.GROUP_A]: "standard",
        [SpecialGroups.GROUP_B]: "standard",
        [SpecialGroups.GROUP_C]: "standard",
        [SpecialGroups.GROUP_D]: "standard",
        [SpecialGroups.NO_GROUP]: "standard",
      },
      [Factions.CHAOS]: {
        [UnitHierarchy.BASIC]: "standard",
        [UnitHierarchy.LEADER]: "standard",
        [UnitHierarchy.COMMANDER]: "standard",
        [SpecialGroups.GROUP_A]: "standard",
        [SpecialGroups.GROUP_B]: "standard",
        [SpecialGroups.GROUP_C]: "standard",
        [SpecialGroups.GROUP_D]: "standard",
        [SpecialGroups.NO_GROUP]: "standard",
      },
    },
  },
  teleport: {
    id: SystemIds.TELEPORT,
    displayName: "§2Teletransporte",
    controlType: "dropdown",
    options: TELEPORT_OPTIONS,
    description: "",
    category: CategoryIds.ADVANCED,
    menu: "both",
    dynamicProperty: "scpd_system_teleport",
    tooltip:
      "§7Define la agresividad del teletransporte hacia el enemigo cuando hay distancia.\n\nModos:\n- §aModerado\n§7- §6Cercano\n§7- §cDesactivado",
    supportsSpecials: true,
    supportsHierarchy: true,
    supportsGroups: true,
    minRole: RoleIds.MEMBER,
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
  spawn: {
    id: SystemIds.SPAWN,
    displayName: "§bTraer refuerzos",
    controlType: "toggle",
    eventTrue: "humanoid:start_spawn_soldiers",
    eventFalse: "humanoid:stop_spawn_soldiers",
    description: "",
    category: CategoryIds.ADVANCED,
    menu: "both",
    dynamicProperty: "scpd_system_spawn",
    tooltip:
      "§7Habilita la capacidad de generar refuerzos adicionales (Sólo líderes y algunos comandantes).\n\nEstados:\n- §aActivado\n§7- §cDesactivado",
    labelTrue: "§aActivar",
    labelFalse: "§cDesactivar",
    supportsSpecials: true,
    supportsHierarchy: true,
    supportsGroups: true,
    minRole: RoleIds.COMMANDER, // Solo comandantes y admins ven este sistema
    // Compatibilidad por jerarquía (commandMenu)
    blockedByHierarchy: {
      [UnitHierarchy.BASIC]: true, // Dropdown "Básicos" se muestra disabled
      // [UnitHierarchy.LEADER]: true, //no definido → habilitado
      // [UnitHierarchy.COMMANDER]: true, //no definido → habilitado
    },
    // Compatibilidad por familia (interactMenu)
    allowedFamilies: [
      "hierarchy_leader", // Líderes pueden usar spawn
      "hierarchy_commander", // Comandantes pueden usar spawn (con excepciones)
    ],
    blockedFamilies: [
      "mtf_delta1", // Comandantes Delta-1 NO pueden usar spawn
    ],
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
    id: SystemIds.HEALTH,
    displayName: "§cBarra de vida",
    controlType: "toggle",
    eventTrue: "humanoid:show_boss_bar",
    eventFalse: "humanoid:dont_show_boss_bar",
    description: "",
    category: CategoryIds.ADVANCED,
    menu: "both",
    dynamicProperty: "scpd_system_health",
    tooltip:
      "§7Visualización de la salud de las unidades cercanas en la interfaz.\n\nEstados:\n- §aActivado\n§7- §cDesactivado",
    labelTrue: "§aMostrar",
    labelFalse: "§cOcultar",
    supportsSpecials: true,
    supportsHierarchy: true,
    supportsGroups: true,
    minRole: RoleIds.MEMBER,
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
  invincible: {
    id: SystemIds.INVINCIBLE,
    displayName: "Invencibilidad",
    controlType: "toggle",
    eventTrue: "humanoid:start_invincible",
    eventFalse: "humanoid:stop_invincible",
    description: "",
    category: CategoryIds.ADVANCED,
    menu: "both",
    dynamicProperty: "scpd_system_invincible",
    tooltip: "§7Hace invulnerable a la unidad. Usar con precaución.\n\nEstados:\n- §aActivado\n§7- §cDesactivado",
    labelTrue: "§aActivar",
    labelFalse: "§cDesactivar",
    supportsSpecials: true,
    supportsHierarchy: true,
    supportsGroups: true,
    minRole: RoleIds.ADMIN,
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

// ── IDs de sistema expuestos a la superficie de comandos `scpd:` ──────────────
// Fuente única de verdad: filtra el catálogo por `menu`, excluyendo los sistemas
// exclusivos de interactMenu (ej. `weapon`). Los comandos de reset, aplicación y
// scope consumen este arreglo en vez de `Object.keys(menuSystems)` para que un
// reset/aplicación masiva no reaplique el default de `weapon` ("none") y stripee
// armas de las entidades.
export const COMMAND_SYSTEM_IDS: SystemId[] = Object.keys(CATALOG_SYSTEMS).filter(
  (id) => CATALOG_SYSTEMS[id as SystemId]?.menu !== "interact"
) as SystemId[];

// ── Nombres de display de sistemas ─────────────────────────────────────────
// Definidos ANTES de CATALOG_CATEGORIES para que CATALOG_CATEGORIES pueda
// derivar sus `displayName` de una sola fuente sin TDZ de `const`.

export const SYSTEM_DISPLAY_NAMES: Record<SystemId, string> = {
  movement: "§1Movimiento / Patrulla",
  fire: "§cIniciativa de Combate",
  weapon: "§6Arma equipada",
  armament: "§6Distribución de Armamento",
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
  movement: "§1Movimiento / Patrulla",
  fire: "§cIniciativa de Combate",
  weapon: "§6Arma equipada",
  advanced: "§6Configuración avanzada",
  advanced_menu: "§6Más sistemas",
};

// ── Categorías ──────────────────────────────────────────────────────────────

export const CATALOG_CATEGORIES: Record<CategoryId, CatalogCategory> = {
  movement: {
    id: SystemIds.MOVEMENT,
    displayName: SYSTEM_DISPLAY_NAMES.movement,
    description: "",
    systemIds: [SystemIds.MOVEMENT],
  },
  fire: {
    id: SystemIds.FIRE,
    displayName: SYSTEM_DISPLAY_NAMES.fire,
    description: "",
    systemIds: [SystemIds.FIRE],
  },
  armament: {
    id: SystemIds.ARMAMENT,
    displayName: SYSTEM_DISPLAY_NAMES.armament,
    description: "",
    systemIds: [SystemIds.ARMAMENT],
  },
  advanced: {
    id: CategoryIds.ADVANCED,
    displayName: CATEGORY_DISPLAY_NAMES.advanced,
    description: "",
    systemIds: [SystemIds.SPAWN, SystemIds.HEALTH, SystemIds.TELEPORT, SystemIds.INVINCIBLE],
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
  weapon: "§6Arma§r",
  armament: "§6Armamento§r",
  spawn: "§bRefuerzos§r",
  health: "§cBarra de vida§r",
  teleport: "§2Teletransporte§r",
  invincible: "Invencibilidad",
  group_assignment: "§9Grupos§r",
  scope: "§dScope§r",
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
  both: "§dAmbas facciones",
};

// ── Nombres de display de cascos (roles por facción) ───────────────────────

export const HELMET_DISPLAY_NAMES: Record<string, string> = {
  "minecraft:netherite_helmet": "§5Netherite",
  "minecraft:diamond_helmet": "§bDiamante",
  "minecraft:iron_helmet": "§7Hierro",
  "minecraft:golden_helmet": "§6Oro",
  "gabrielaplok:nv_goggles": "§2Gafas NV",
};

// ── Configuración del menú principal ────────────────────────────────────────

export const MENU_CONFIG = {
  title: "SCPDystopia | Panel de Comandos",
  categoryOrder: [CategoryIds.MOVEMENT, CategoryIds.FIRE, CategoryIds.ARMAMENT, CategoryIds.ADVANCED] as CategoryId[],
  useDividers: true,
  messages: {
    allSystems:
      "§8[MENU] §7{player} §rconfiguró §6todos los sistemas§r. Usa §bscpd:check_world_props§r para ver las opciones aplicadas§r.",
    specificSystems: "§8[MENU] §7{player} §rconfiguró: §6{systems}§r.",
  },
};

// ── Reglas de acceso a features de menú ──────────────────────────────────────

/**
 * Features de menú del commandMenu DDUI cuyo acceso depende del rol del
 * jugador. Cada feature tiene un `minRole` que sigue la jerarquía estándar
 * (member < commander < admin). Las features no listadas aquí son visibles
 * para todos los roles (no se filtran).
 *
 * Aplica a: commandMenu DDUI (mainPanel, advancedPanel, scopePanel,
 * systemBuilder, historyPanel). NO aplica a interactMenu DDUI (que filtra
 * por sistemas, no por features de menú).
 */
export type MenuFeature = "scope" | "history";

/**
 * Tabla canónica de reglas de acceso por feature de menú. Para añadir una
 * nueva feature restringida, agrégala aquí y consume `isMenuFeatureVisible`
 * en su panel y en el botón que lo invoca.
 */
export const MENU_ACCESS: Record<MenuFeature, { minRole: RoleId }> = {
  scope: { minRole: RoleIds.COMMANDER },
  history: { minRole: RoleIds.COMMANDER },
};

/**
 * Determina si un jugador con el role dado puede acceder a una feature de
 * menú del commandMenu DDUI. Centraliza la regla; reemplaza los 4 checks
 * in-line que hoy duplican el patrón `commander || admin` con literales.
 *
 * Comportamiento:
 * - Si `isAdmin` es true, siempre retorna true (short-circuit).
 * - Si se pasa una `targetFaction` específica, evalúa `isRoleAtLeast(role, minRole)`.
 * - Si se pasa `"both"` o no se pasa, evalúa `isRoleAtLeast(role, minRole)`.
 *   El caller es responsable de iterar ambas facciones y hacer OR cuando
 *   corresponda (modo any-faction).
 *
 * @param feature - Identificador de la feature de menú.
 * @param role - Rol del jugador en la facción de la sesión (`effectiveRole`).
 * @param isAdmin - Si el jugador es admin global (short-circuit).
 * @param targetFaction - Facción objetivo de la sesión. `"both"` u `undefined`
 *   activa el modo any-faction.
 * @returns true si la feature debe mostrarse/ser accesible.
 */
export function isMenuFeatureVisible(
  feature: MenuFeature,
  role: RoleId,
  isAdmin: boolean,
  targetFaction?: TargetFaction
): boolean {
  if (isAdmin) return true;
  const { minRole } = MENU_ACCESS[feature];
  return isRoleAtLeast(role, minRole);
}

// ── Títulos y descripciones de paneles ──────────────────────────────────────

export const PANEL_TITLES: Record<string, string> = {
  main: "§9Menú de comandos",
  advanced: "§lConfiguración Avanzada",
  groups: "§lGrupos",
  groupsByFaction: "§9Grupos por Facción",
  history: "§9Historial",
  scope: "§lPrioridad de Aplicación",
  system: "§lSistemas",
  roleMenu: "§l§6GESTIÓN DE ROLES",
};

export const PANEL_DESCRIPTIONS: Record<string, string> = {
  main: "Selecciona una opción para continuar.",
  advanced: "Accede a sistemas avanzados y scope.",
  groups: "Gestiona los grupos de unidades especiales.",
  groupsByFaction: "Selecciona una categoria para asignar grupos.",
  history: "§6Últimos cambios aplicados.",
  scope: "Prioridad de aplicación de cambios. Los cambios se registran en el historial.",
  system: "Configura los sistemas de tus unidades.",
};

// ── Botones de paneles ──────────────────────────────────────────────────────

export const MAIN_PANEL_BUTTONS = {
  systems: "§1Sistemas",
  advanced: CATALOG_CATEGORIES.advanced.displayName,
  groups: "§9Grupos de Especiales",
  history: "§dHistorial",
};

export const ADVANCED_PANEL_BUTTONS = {
  weapon: "§6Arma equipada",
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
  admin: "§cAdmin§r",
  commander: "§6Comandante§r",
  member: "§7Miembro§r",
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
  { value: "specials", label: "§9Especiales" },
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
  ENTITY_NOT_AVAILABLE: "§c[SCPDystopia] La unidad objetivo ya no se encuentra disponible.",
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
export function getSystemEvent(
  systemId: SystemId,
  value: OptionValue
): { event: string; autoTame?: boolean } | undefined {
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
export function getSystemDefaultForKey(
  systemId: SystemId,
  faction: FactionId,
  key: DefaultsKey
): OptionValue | undefined {
  return getSystemDefaults(systemId)?.[faction]?.[key];
}

/**
 * IDs de todos los grupos especiales. Derivado de `SpecialGroups`
 * para evitar literales hardcodeados y mantener un solo punto de verdad.
 * El orden de `Object.values` sigue la definición del objeto (A→D→NO_GROUP).
 */
const ALL_SPECIAL_GROUPS = Object.values(SpecialGroups) as SpecialGroupId[];

/**
 * Obtiene el orden de grupos para asignación (NO_GROUP primero, luego A-D).
 * Derivado de ALL_SPECIAL_GROUPS: NO_GROUP se eleva sin duplicación.
 */
export function getGroupsOrderForAssignment(): SpecialGroupId[] {
  return [SpecialGroups.NO_GROUP, ...ALL_SPECIAL_GROUPS.filter((g) => g !== SpecialGroups.NO_GROUP)];
}

/**
 * Obtiene el orden de grupos para sistemas (A-D → NO_GROUP).
 * Equivale a ALL_SPECIAL_GROUPS tal cual.
 */
export function getGroupsOrderForSystems(): SpecialGroupId[] {
  return ALL_SPECIAL_GROUPS;
}

/**
 * Orden jerárquico de roles para comparación.
 * member (0) < commander (1) < admin (2)
 */
export const ROLE_ORDER: Record<RoleId, number> = {
  member: 0,
  commander: 1,
  admin: 2,
};

/**
 * Compara dos roles en la jerarquía member(0) < commander(1) < admin(2).
 *
 * Helper base para cualquier filtro de visibilidad por rol. Promovido desde
 * `isSystemVisibleForRole` para que tanto sistemas (`CatalogSystem.minRole`)
 * como features de menú (`MENU_ACCESS`) lo reutilicen sin duplicar la lógica.
 *
 * @param role - Rol del jugador.
 * @param minRole - Rol mínimo requerido.
 * @returns true si `role >= minRole` en la jerarquía.
 */
export function isRoleAtLeast(role: RoleId, minRole: RoleId): boolean {
  return ROLE_ORDER[role] >= ROLE_ORDER[minRole];
}

/**
 * Indica si un jugador con un rol específico puede VER un sistema en el menú.
 *
 * Si el sistema no define `minRole`, todos los roles pueden verlo.
 * Si el sistema define `minRole`, solo roles iguales o superiores pueden verlo.
 *
 * Aplica a: commandMenu DDUI e interactMenu DDUI
 *
 * @param system - Configuración del sistema desde el catálogo
 * @param role - Rol del jugador ("member" | "commander" | "admin")
 * @returns true si el jugador puede ver el sistema, false si debe ocultarse
 */
export function isSystemVisibleForRole(system: CatalogSystem, role: RoleId): boolean {
  if (!system.minRole) return true;
  return isRoleAtLeast(role, system.minRole);
}

/**
 * Filtra un array de sistemas por los que un rol puede ver.
 *
 * @param systems - Array de sistemas del catálogo
 * @param role - Rol del jugador
 * @returns Array de sistemas visibles para ese rol
 */
export function filterSystemsByRole(systems: CatalogSystem[], role: RoleId): CatalogSystem[] {
  return systems.filter((s) => isSystemVisibleForRole(s, role));
}
