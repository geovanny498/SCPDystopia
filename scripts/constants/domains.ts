/**
 * @module constants/domains
 * @description
 * Identificadores de dominio del addon SCPDystopia.
 *
 * Este módulo es la fuente de verdad para constantes que se usan como claves en
 * dynamic properties (DPs), scanners, defaults de facción y helpers de etiquetado UI.
 *
 * Dirección de dependencias:
 *   - `systemCatalog.ts` (datos UI + catálogo) puede leer de este módulo.
 *   - `menu_config.ts` (shim legacy) re-exporta estos símbololes.
 *   - Los menús (commandMenu, interactMenu, teleportMenu, monitorMenu) consumen
 *     desde `constants/domains.ts` o desde `menu_config.ts` (shim) indistintamente.
 *
 * NO incluye textos de UI, labels de panel ni mensajes de error — eso vive en
 * `systemCatalog.ts`.
 */

// ── Bandos ──────────────────────────────────────────────────────────────────

/**
 * Identificadores canónicos de facción.
 * Se usan como claves en DPs de jugador, defaults de sistemas y filtros de menú.
 */
export const Factions = {
  FOUNDATION: "foundation",
  CHAOS: "chaos",
} as const;

/**
 * Union type de facciones válidas.
 */
export type FactionId = (typeof Factions)[keyof typeof Factions];

/**
 * Array de IDs de facciones. Derivado automáticamente de Factions.
 * Si añades una facción nueva a Factions, FACTION_IDS se actualiza solo.
 * El orden NO está garantizado por el estándar (en la práctica es orden
 * de inserción en ES2015+). No asumas orden.
 */
export const FACTION_IDS: FactionId[] = Object.values(Factions) as FactionId[];

// ── Grupos para especiales (A-D + Sin grupo) ────────────────────────────────

/**
 * Identificadores canónicos de grupo especial.
 * Se usan como claves en DPs de entidad, defaults de sistemas y asignación de grupos.
 */
export const SpecialGroups = {
  GROUP_A: "groupA",
  GROUP_B: "groupB",
  GROUP_C: "groupC",
  GROUP_D: "groupD",
  NO_GROUP: "noGroup",
} as const;

/**
 * Union type de grupos especiales válidos.
 */
export type SpecialGroupId = (typeof SpecialGroups)[keyof typeof SpecialGroups];

/**
 * Claves válidas para el map `defaults[facción][key]` de cada sistema.
 * Cada facción tiene 8 buckets: 3 jerarquías (basic/leader/commander) + 5 grupos (groupA-D/noGroup).
 */
export type DefaultsKey = UnitHierarchyId | SpecialGroupId;

// ── Jerarquías para no especiales ──────────────────────────────────────────

/**
 * Identificadores canónicos de jerarquía de unidad.
 * Se usan como claves en defaults de sistemas y detección por type_family.
 */
export const UnitHierarchy = {
  BASIC: "basic",
  LEADER: "leader",
  COMMANDER: "commander",
} as const;

/**
 * Union type de jerarquías válidas.
 */
export type UnitHierarchyId = (typeof UnitHierarchy)[keyof typeof UnitHierarchy];

// ── Guía de etiquetado UI de familias MTF ──────────────────────────────────

/**
 * Mapa de familias MTF/Chaos a su label visual y orden de aparición.
 *
 * Solo controla el label y el orden en el menú de grupos.
 * No filtra qué unidades son o no son especiales.
 *
 * Agregar nuevas familias aquí no requiere modificar otra parte del sistema.
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
} as const;

/**
 * Tipo de entrada individual del mapa de familias MTF.
 */
export interface NametagFamilyEntry {
  label: string;
  order: number;
}

/**
 * Obtiene el label visual de una familia MTF dado su identificador.
 *
 * @param familyId - Identificador de familia (ej: "mtf_delta1").
 * @returns Label formateado si existe; el propio id como fallback.
 */
export function getFamilyTagLabel(familyId: string): string {
  const entry = NAMETAG_FAMILY_MAP[familyId as keyof typeof NAMETAG_FAMILY_MAP];
  return entry?.label ?? familyId;
}

/**
 * Obtiene el orden de aparición de una familia MTF en el menú de grupos.
 *
 * @param familyId - Identificador de familia (ej: "mtf_delta1").
 * @returns Orden numérico si existe; 999 como fallback (aparece al final).
 */
export function getFamilyTagOrder(familyId: string): number {
  const entry = NAMETAG_FAMILY_MAP[familyId as keyof typeof NAMETAG_FAMILY_MAP];
  return entry?.order ?? 999;
}
