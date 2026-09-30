// scripts/gui/commandMenu/menu_faction.ts
/**
 * Módulo centralizado para determinar el bando, facción, jerarquía y grupo de una entidad.
 *
 * v4.0 — Sin listas hardcodeadas de unidades.
 * Especialidad: nametag no vacío + familias de facción válidas.
 * No especialidad: nametag vacío + familias de facción válidas.
 * Jerarquía de no especiales: familias type_family (hierarchy_basic/leader/commander)
 *   agregadas a los paquetes de comportamiento de cada entidad.
 */

import { Entity, EntityComponentTypes } from "@minecraft/server";
import { Factions, UnitHierarchy, SpecialGroups } from "../menu_config.js";
import { getUnitGroup } from "./menu_groups.js";
import { getTeam, teamFamilies } from "../../../utils/teams.js";
import { debug } from "../../../utils/debug.js";
import type { CatalogSystem, OptionValue } from "../../shared/systemCatalog.js";
import type { FactionId, UnitHierarchyId } from "../../../constants/domains.js";
import type { SystemFactionState } from "./menu_system_state.js";

/** Contexto de facción, especialidad y agrupación resuelto para una entidad. */
export interface EntityFactionInfo {
  faction: FactionId;
  isSpecial: boolean;
  nametag: string;
  hierarchy: string | null;
  group: string | null;
}

// ── Familias de jerarquía reconocidas ────────────────────────────────────────

const HIERARCHY_FAMILIES: Record<string, string> = {
  hierarchy_commander: UnitHierarchy.COMMANDER,
  hierarchy_leader: UnitHierarchy.LEADER,
  hierarchy_basic: UnitHierarchy.BASIC,
};

// ── Detección de facción por familias ───────────────────────────────────────

function detectFactionByFamilies(ent: Entity): FactionId | null {
  const typeFamilies = ent.getComponent(EntityComponentTypes.TypeFamily);
  if (!typeFamilies) return null;

  const families = typeFamilies.getTypeFamilies();

  for (const fam of teamFamilies.foundation) {
    if (families.includes(fam)) return Factions.FOUNDATION;
  }
  for (const fam of teamFamilies.chaos) {
    if (families.includes(fam)) return Factions.CHAOS;
  }

  return null;
}

// ── Detección de jerarquía por type_family de la entidad ────────────────────
// Lee directamente del type_family de la entidad (sin depender de typeId ni nametag).
// Las familias hierarchy_basic / hierarchy_leader / hierarchy_commander se agregan
// a los paquetes de comportamiento de cada entidad según su carpeta
// (Normal/, Leaders/, Commanders/).

function detectHierarchyByEntity(ent: Entity): string | null {
  const typeFamilies = ent.getComponent(EntityComponentTypes.TypeFamily);
  if (!typeFamilies) return null;

  const families = typeFamilies.getTypeFamilies();
  for (const fam of families) {
    if (HIERARCHY_FAMILIES[fam]) return HIERARCHY_FAMILIES[fam];
  }

  return null;
}

/**
 * Determina toda la información de facción de una entidad.
 * Sin listas hardcodeadas de unidades.
 * @param ent - Entidad cuyo contexto de facción se resolverá.
 * @returns Información de facción o `null` cuando no pertenece a un bando válido.
 */
export function getEntityFactionInfo(ent: Entity): EntityFactionInfo | null {
  if (!ent) return null;

  const nametag = (ent.nameTag ?? "").trim();
  const typeId = ent.typeId;

  // 1. Determinar facción por familias
  const faction = detectFactionByFamilies(ent);
  if (!faction) {
    // Fallback: usar getTeam()
    const team = getTeam(ent);
    if (team !== "foundation" && team !== "chaos") return null;
    // Entidad sin familias de facción pero sí team → intentar jerarquía por type_family
    const hierarchy = detectHierarchyByEntity(ent) || detectHierarchyFallback(typeId);
    debug("menuFaction", `§b${typeId}§r: Fallback team=§a${team}§r, jerarquía=§6${hierarchy}§r`, {
      color: "yellow",
      level: "warn",
    });
    return { faction: team, isSpecial: false, nametag: "", hierarchy, group: null };
  }

  // 2. Determinar especialidad por nametag (sin patrones restrictivos)
  const isSpecial = nametag !== "";

  if (isSpecial) {
    // Especial: nametag no vacío + familias de facción
    const group = getUnitGroup(ent);
    debug("menuFaction", `§r§f${nametag}§r: Especial §a${faction}§r, grupo=§6${group}§r`, {
      color: "aqua",
      level: "debug",
    });
    return {
      faction,
      isSpecial: true,
      nametag,
      hierarchy: null,
      group: group || SpecialGroups.NO_GROUP,
    };
  }

  // No especial: nametag vacío + familias de facción → detectar jerarquía
  const hierarchy = detectHierarchyByEntity(ent) || detectHierarchyFallback(typeId);
  debug("menuFaction", `§b${typeId}§r: No especial §b${faction}§r, jerarquía=§6${hierarchy}§r`, {
    color: "green",
    level: "debug",
  });
  return {
    faction,
    isSpecial: false,
    nametag: "",
    hierarchy,
    group: null,
  };
}

/**
 * Fallback de jerarquía por typeId cuando type_family no incluye familias de jerarquía.
 * Usa sufijos: c → commander, l → leader, resto → basic.
 * Los namespaces (ej: "lc:") se eliminan antes de comprobar el sufijo.
 */
function detectHierarchyFallback(typeId: string): string {
  const base = (typeId ?? "").toLowerCase();
  const clean = base.indexOf(":") >= 0 ? base.substring(base.indexOf(":") + 1) : base;
  if (clean.endsWith("c")) return UnitHierarchy.COMMANDER;
  if (clean.endsWith("l")) return UnitHierarchy.LEADER;
  return UnitHierarchy.BASIC;
}

/**
 * Verifica si una entidad es un soldado válido.
 * v4.0 — sin listas de unidades hardcodeadas.
 */
export function isValidSoldier(ent: Entity): boolean {
  if (!ent) return false;
  if (ent.typeId === "minecraft:player") return false;

  // Especial: nametag no vacío y familias de facción válidas
  if ((ent.nameTag ?? "").trim() !== "" && detectFactionByFamilies(ent)) return true;

  // No especial: solo familias de facción válidas
  if (detectFactionByFamilies(ent)) return true;

  // Fallback: verificar si pertenece a un bando por equipo
  const team = getTeam(ent);
  return team === "foundation" || team === "chaos";
}

/**
 * Obtiene el valor de configuración que aplica a una entidad según su jerarquía/grupo.
 * El estado recibido corresponde exclusivamente al fragmento de una facción.
 *
 * @param systemState - Valores de una sola facción, si el sistema los tiene configurados.
 * @param factionInfo - Contexto de jerarquía, grupo y nametag de la entidad.
 * @returns Valor aplicable o `undefined` cuando no existe una configuración coincidente.
 */
export function getEntityConfigValue(
  systemState: SystemFactionState | undefined,
  factionInfo: EntityFactionInfo
): OptionValue | undefined {
  if (!systemState) return undefined;

  // systemState es el objeto de la facción: { basic/leader/commander/groupA-D/noGroup: valor }
  // Para especiales: buscar primero por nametag, luego por grupo (noGroup/groupA-D)
  if (factionInfo.isSpecial && factionInfo.nametag) {
    var byName = systemState[factionInfo.nametag];
    if (byName !== undefined) return byName;
    if (factionInfo.group) return systemState[factionInfo.group];
    return undefined;
  }

  // Para no-especiales: buscar por jerarquía
  if (!factionInfo.isSpecial && factionInfo.hierarchy) {
    return systemState[factionInfo.hierarchy];
  }

  // Fallback final
  return systemState[UnitHierarchy.BASIC] ?? systemState[SpecialGroups.NO_GROUP];
}

/**
 * Lee las familias type_family de una entidad.
 *
 * Exportado para que otros módulos (catálogo, builders) puedan
 * evaluar compatibilidad sin duplicar la lectura de EntityTypeFamilyComponent.
 *
 * @param ent - Entidad a consultar
 * @returns Array de familias, o array vacío si no tiene el componente
 */
export function getEntityFamilies(ent: Entity): string[] {
  const typeFamilies = ent.getComponent(EntityComponentTypes.TypeFamily);
  if (!typeFamilies) return [];
  return typeFamilies.getTypeFamilies();
}

/**
 * Indica si un sistema está bloqueado para una entidad según sus familias.
 *
 * Lógica (orden de evaluación):
 * 1. Si la entidad tiene alguna familia en `system.blockedFamilies` → true
 * 2. Si `system.allowedFamilies` está definido y la entidad NO tiene ninguna → true
 * 3. En otro caso → false
 *
 * Política compartida para consumidores que ya disponen de las familias.
 * Permite reutilizar un mismo array al evaluar varios sistemas.
 *
 * @param system - Configuración del sistema desde el catálogo
 * @param families - Familias de la entidad (de getEntityFamilies)
 * @returns true si el sistema está bloqueado, false si está permitido
 */
export function isSystemBlockedByFamilies(system: CatalogSystem, families: string[]): boolean {
  // Paso 1: Verificar familias bloqueadas (tienen prioridad)
  if (system.blockedFamilies && system.blockedFamilies.length > 0) {
    if (system.blockedFamilies.some((f) => families.includes(f))) {
      return true;
    }
  }

  // Paso 2: Verificar familias permitidas (whitelist)
  if (system.allowedFamilies && system.allowedFamilies.length > 0) {
    if (!system.allowedFamilies.some((f) => families.includes(f))) {
      return true;
    }
  }

  // Paso 3: Si no hay restricciones o pasa ambas, permitir
  return false;
}

/**
 * Indica si una entidad está bloqueada para un sistema según sus familias.
 * Delega la interpretación del catálogo en `isSystemBlockedByFamilies` para
 * mantener una única política de compatibilidad.
 *
 * @param system - Configuración canónica del sistema.
 * @param entity - Entidad cuya compatibilidad se evaluará.
 * @returns `true` cuando la entidad no es elegible para el sistema.
 */
export function isSystemBlockedForEntity(system: CatalogSystem, entity: Entity): boolean {
  return isSystemBlockedByFamilies(system, getEntityFamilies(entity));
}

/**
 * Indica si un sistema está bloqueado para una jerarquía específica.
 *
 * Aplica a: commandMenu DDUI únicamente
 *
 * @param system - Configuración del sistema desde el catálogo
 * @param hierarchy - Jerarquía de la unidad ("basic" | "leader" | "commander")
 * @returns true si la jerarquía está bloqueada, false si está permitida
 */
export function isSystemBlockedByHierarchy(system: CatalogSystem, hierarchy: UnitHierarchyId | null): boolean {
  if (!hierarchy || !system.blockedByHierarchy) return false;
  return system.blockedByHierarchy[hierarchy] === true;
}
