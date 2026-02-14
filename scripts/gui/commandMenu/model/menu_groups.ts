// scripts/gui/commandMenu/menu_groups.ts
import { world } from "@minecraft/server";
import { debugWarn } from "../../../utils/debug.js";
import { Factions, SpecialGroups, specialUnits } from "../menu_config.js";

/**
 * Sistema de Grupos de Especiales
 *
 * Maneja la asignación de unidades especiales a grupos (A-D + Sin grupo)
 * Los grupos se guardan en dynamic properties y persisten hasta que el jugador los cambie.
 */

const GROUPS_PROPERTY = "scpd_special_groups";

interface SpecialGroupAssignment {
  [unitName: string]: string; // unitName -> groupId (SpecialGroups value)
}

interface GroupsData {
  [Factions.FOUNDATION]: SpecialGroupAssignment;
  [Factions.CHAOS]: SpecialGroupAssignment;
}

let groupsCache: GroupsData | null = null;

/**
 * Genera la asignación de grupos por defecto (todos en Sin grupo)
 */
function generateDefaultGroups(): GroupsData {
  const groups: GroupsData = {
    [Factions.FOUNDATION]: {},
    [Factions.CHAOS]: {},
  };

  // Asignar todas las unidades especiales a "Sin grupo" por defecto
  for (const faction of [Factions.FOUNDATION, Factions.CHAOS]) {
    const factionData = specialUnits[faction as keyof typeof specialUnits];
    if (factionData?.all) {
      for (const unitName of factionData.all) {
        groups[faction as keyof GroupsData][unitName] = SpecialGroups.NO_GROUP;
      }
    }
  }

  return groups;
}

/**
 * Carga los grupos desde dynamic properties
 */
export function loadGroups(forceReload = false): GroupsData {
  try {
    if (groupsCache && !forceReload) {
      return groupsCache;
    }

    const raw = world.getDynamicProperty(GROUPS_PROPERTY) as string | undefined;

    if (!raw) {
      debugWarn("menuGroups", "No hay grupos guardados, generando defaults", "yellow");
      const defaultGroups = generateDefaultGroups();
      groupsCache = defaultGroups;
      return defaultGroups;
    }

    const parsed = JSON.parse(raw) as GroupsData;

    // Validar estructura
    if (!parsed[Factions.FOUNDATION] || !parsed[Factions.CHAOS]) {
      debugWarn("menuGroups", "Grupos inválidos, generando defaults", "yellow");
      const defaultGroups = generateDefaultGroups();
      groupsCache = defaultGroups;
      return defaultGroups;
    }

    // Asegurar que todas las unidades especiales tengan un grupo asignado
    for (const faction of [Factions.FOUNDATION, Factions.CHAOS]) {
      const factionData = specialUnits[faction as keyof typeof specialUnits];
      if (factionData?.all) {
        for (const unitName of factionData.all) {
          if (!parsed[faction as keyof GroupsData][unitName]) {
            parsed[faction as keyof GroupsData][unitName] = SpecialGroups.NO_GROUP;
          }
        }
      }
    }

    groupsCache = parsed;
    return parsed;
  } catch (e) {
    debugWarn("menuGroups", `Error cargando grupos: ${e}`, "red");
    const defaultGroups = generateDefaultGroups();
    groupsCache = defaultGroups;
    return defaultGroups;
  }
}

/**
 * Guarda los grupos en dynamic properties
 */
export function saveGroups(groups: GroupsData): void {
  try {
    const serialized = JSON.stringify(groups);
    world.setDynamicProperty(GROUPS_PROPERTY, serialized);
    groupsCache = groups;
    debugWarn("menuGroups", "Grupos guardados correctamente", "green");
  } catch (e) {
    debugWarn("menuGroups", `Error guardando grupos: ${e}`, "red");
  }
}

/**
 * Obtiene el grupo de una unidad especial
 */
export function getUnitGroup(unitName: string, faction: string): string {
  const groups = loadGroups();
  const factionGroups = groups[faction as keyof GroupsData];
  return factionGroups?.[unitName] || SpecialGroups.NO_GROUP;
}

/**
 * Asigna un grupo a una unidad especial
 */
export function setUnitGroup(unitName: string, faction: string, groupId: string): void {
  const groups = loadGroups();
  if (!groups[faction as keyof GroupsData]) {
    groups[faction as keyof GroupsData] = {};
  }
  groups[faction as keyof GroupsData][unitName] = groupId;
  saveGroups(groups);
}

/**
 * Obtiene todas las unidades de un grupo específico
 */
export function getUnitsInGroup(faction: string, groupId: string): string[] {
  const groups = loadGroups();
  const factionGroups = groups[faction as keyof GroupsData];
  if (!factionGroups) return [];

  return Object.entries(factionGroups)
    .filter(([_, group]) => group === groupId)
    .map(([unitName, _]) => unitName);
}

/**
 * Obtiene un resumen de los grupos por bando
 */
export function getGroupsSummary(faction: string): { [groupId: string]: number } {
  const groups = loadGroups();
  const factionGroups = groups[faction as keyof GroupsData];
  if (!factionGroups) return {};

  const summary: { [groupId: string]: number } = {};
  for (const groupId of Object.values(SpecialGroups)) {
    summary[groupId] = 0;
  }

  for (const groupId of Object.values(factionGroups)) {
    if (summary[groupId] !== undefined) {
      summary[groupId]++;
    }
  }

  return summary;
}

/**
 * Reinicia los grupos a valores por defecto
 */
export function resetGroups(): GroupsData {
  debugWarn("menuGroups", "Reiniciando grupos a valores por defecto", "yellow");
  const defaultGroups = generateDefaultGroups();
  saveGroups(defaultGroups);
  return defaultGroups;
}
