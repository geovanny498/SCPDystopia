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
import { debugWarn } from "../../../utils/debug.js";

export interface EntityFactionInfo {
  faction: string;
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

function detectFactionByFamilies(ent: Entity): string | null {
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
    debugWarn("menuFaction", `${typeId}: Fallback team=${team}, jerarquía=${hierarchy}`, "yellow");
    return { faction: team, isSpecial: false, nametag: "", hierarchy, group: null };
  }

  // 2. Determinar especialidad por nametag (sin patrones restrictivos)
  const isSpecial = nametag !== "";

  if (isSpecial) {
    // Especial: nametag no vacío + familias de facción
    const group = getUnitGroup(ent);
    debugWarn("menuFaction", `${nametag}: Especial ${faction}, grupo=${group}`, "cyan");
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
  debugWarn("menuFaction", `${typeId}: No especial ${faction}, jerarquía=${hierarchy}`, "green");
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
 * systemState tiene la forma: { faction: { grupo_o_jerarquia: valor, ... }, ... }
 */
export function getEntityConfigValue(systemState: Record<string, unknown>, factionInfo: EntityFactionInfo): unknown {
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
