// scripts/gui/commandMenu/menu_faction.ts
import { Entity } from "@minecraft/server";
import { getTeam } from "../../../utils/teams.js";
import { Factions, UnitHierarchy, SpecialGroups, specialUnits, getUnitHierarchy } from "../menu_config.js";
import { getUnitGroup } from "./menu_groups.js";
import { debugWarn } from "../../../utils/debug.js";

/**
 * Módulo centralizado para determinar el bando, facción, jerarquía y grupo de una entidad
 *
 * Este módulo evita duplicación de código en menu_events.js y menu_apply.js
 */

export interface EntityFactionInfo {
  faction: string;
  isSpecial: boolean;
  hierarchy: string | null; // Para no especiales: basic, leader, commander
  group: string | null; // Para especiales: groupA, groupB, groupC, groupD, noGroup
}

interface SpecialUnitsData {
  all: string[];
  subgroups: Record<string, { label: string; units: string[] }>;
}

interface SpecialUnitsConfig {
  foundation: SpecialUnitsData;
  chaos: SpecialUnitsData;
}

/**
 * Determina toda la información de facción de una entidad
 */
export function getEntityFactionInfo(ent: Entity, specials?: SpecialUnitsConfig): EntityFactionInfo | null {
  if (!ent) return null;

  const name = ent.nameTag ?? "";
  const typeId = ent.typeId;
  const effectiveSpecials = (specials || specialUnits) as SpecialUnitsConfig;

  // Verificar si es especial (por nametag)
  const isSpecialFoundation = effectiveSpecials?.foundation?.all?.includes(name);
  const isSpecialChaos = effectiveSpecials?.chaos?.all?.includes(name);

  if (isSpecialFoundation) {
    const group = getUnitGroup(name, Factions.FOUNDATION);
    debugWarn("menuFaction", `${name}: Especial Foundation, grupo=${group}`, "cyan");
    return {
      faction: Factions.FOUNDATION,
      isSpecial: true,
      hierarchy: null,
      group: group || SpecialGroups.NO_GROUP,
    };
  }

  if (isSpecialChaos) {
    const group = getUnitGroup(name, Factions.CHAOS);
    debugWarn("menuFaction", `${name}: Especial Chaos, grupo=${group}`, "cyan");
    return {
      faction: Factions.CHAOS,
      isSpecial: true,
      hierarchy: null,
      group: group || SpecialGroups.NO_GROUP,
    };
  }

  // No es especial, verificar si es normal por typeId
  const foundationHierarchy = getUnitHierarchy(typeId, Factions.FOUNDATION);
  if (foundationHierarchy) {
    debugWarn("menuFaction", `${typeId}: Normal Foundation, jerarquía=${foundationHierarchy}`, "green");
    return {
      faction: Factions.FOUNDATION,
      isSpecial: false,
      hierarchy: foundationHierarchy,
      group: null,
    };
  }

  const chaosHierarchy = getUnitHierarchy(typeId, Factions.CHAOS);
  if (chaosHierarchy) {
    debugWarn("menuFaction", `${typeId}: Normal Chaos, jerarquía=${chaosHierarchy}`, "green");
    return {
      faction: Factions.CHAOS,
      isSpecial: false,
      hierarchy: chaosHierarchy,
      group: null,
    };
  }

  // Fallback: usar getTeam para determinar facción
  const team = getTeam(ent);
  if (team === "foundation" || team === "chaos") {
    debugWarn("menuFaction", `${typeId}: Fallback a team=${team}, jerarquía=basic`, "yellow");
    return {
      faction: team,
      isSpecial: false,
      hierarchy: UnitHierarchy.BASIC, // Default a básico si no se encuentra en la lista
      group: null,
    };
  }

  return null;
}

/**
 * Verifica si una entidad es un soldado válido
 */
export function isValidSoldier(ent: Entity, specials?: SpecialUnitsConfig): boolean {
  if (!ent) return false;
  if (ent.typeId === "minecraft:player") return false;

  const name = ent.nameTag ?? "";
  const typeId = ent.typeId;
  const effectiveSpecials = (specials || specialUnits) as SpecialUnitsConfig;

  // Verificar si es especial usando la lista plana .all
  if (effectiveSpecials?.foundation?.all?.includes(name)) return true;
  if (effectiveSpecials?.chaos?.all?.includes(name)) return true;

  // Verificar si es normal por typeId
  if (getUnitHierarchy(typeId, Factions.FOUNDATION)) return true;
  if (getUnitHierarchy(typeId, Factions.CHAOS)) return true;

  // Fallback: verificar si pertenece a un bando
  const team = getTeam(ent);
  return team === "foundation" || team === "chaos";
}

/**
 * Obtiene el valor de configuración que aplica a una entidad según su jerarquía/grupo
 * @param systemState - Estado del sistema para la facción
 * @param factionInfo - Información de facción de la entidad
 * @returns El valor de configuración que aplica
 */
export function getEntityConfigValue(systemState: Record<string, unknown>, factionInfo: EntityFactionInfo): unknown {
  if (!systemState) return undefined;

  if (factionInfo.isSpecial && factionInfo.group) {
    // Especial: usar el valor del grupo
    return systemState[factionInfo.group];
  } else if (!factionInfo.isSpecial && factionInfo.hierarchy) {
    // No especial: usar el valor de la jerarquía
    return systemState[factionInfo.hierarchy];
  }

  // Fallback: intentar con basic o noGroup
  return systemState[UnitHierarchy.BASIC] ?? systemState[SpecialGroups.NO_GROUP];
}
