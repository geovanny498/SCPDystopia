// scripts/gui/teleportMenu/teleport_utils.ts

/**
 * Utilidades para filtrar y obtener entidades
 * IMPORTANTE: Reutiliza las funciones del sistema de comandos existente
 */

import { Entity, Dimension } from "@minecraft/server";
import { getEntityFactionInfo, isValidSoldier } from "../../commandMenu/model/menu_faction.js";
import { normalUnits, specialUnits, Factions, UnitHierarchy } from "../../commandMenu/menu_config.js";
import { teamFamilies } from "../../../utils/teams.js";
import { debugWarn } from "../../../utils/debug.js";

// specialUnits viene de JS y no tiene tipos, usamos 'as any' donde sea necesario

/**
 * Obtiene entidades normales por jerarquía en una dimensión
 * Reutiliza la lógica de menu_apply.js adaptada para teletransporte
 * @param faction - Facción de las entidades
 * @param hierarchies - Array de jerarquías a incluir (basic, leader, commander)
 * @param dimension - Dimensión donde buscar
 * @returns Array de entidades filtradas
 */
export function getNormalEntitiesByHierarchy(faction: string, hierarchies: string[], dimension: Dimension): Entity[] {
  const entities: Entity[] = [];
  const seen = new Set<string>();

  // Determinar familias válidas según facción
  const validFamilies = faction === Factions.FOUNDATION ? teamFamilies.foundation : teamFamilies.chaos;

  debugWarn(
    "teleportUtils",
    `Buscando entidades normales de ${faction}, jerarquías: ${hierarchies.join(", ")}`,
    "cyan"
  );

  for (const family of validFamilies) {
    try {
      const ents = dimension.getEntities({ families: [family] });

      for (const ent of ents) {
        if (!ent || !ent.id) continue;
        if (seen.has(ent.id)) continue;

        // Validar que sea un soldado válido
        if (!isValidSoldier(ent, specialUnits as any)) continue;

        // Obtener información de facción
        const factionInfo = getEntityFactionInfo(ent, specialUnits as any);
        if (!factionInfo) continue;
        if (factionInfo.faction !== faction) continue;
        if (factionInfo.isSpecial) continue; // Solo queremos normales

        // Verificar que la jerarquía esté en el filtro
        if (!factionInfo.hierarchy || !hierarchies.includes(factionInfo.hierarchy)) continue;

        seen.add(ent.id);
        entities.push(ent);
        debugWarn("teleportUtils:normal", `Encontrada: ${ent.typeId} [${faction}-${factionInfo.hierarchy}]`, "green");
      }
    } catch (e) {
      debugWarn("teleportUtils:normal", `Error escaneando familia ${family}: ${e}`, "red");
    }
  }

  debugWarn("teleportUtils", `Encontradas ${entities.length} entidades normales`, "green");
  return entities;
}

/**
 * Obtiene entidades especiales por subgrupo
 * @param faction - Facción de las entidades
 * @param subgroup - ID del subgrupo (delta1, alpha1, other_mtf, chaos_delta)
 * @param dimension - Dimensión donde buscar
 * @returns Array de entidades filtradas
 */
export function getSpecialEntitiesBySubgroup(faction: string, subgroup: string, dimension: Dimension): Entity[] {
  const entities: Entity[] = [];
  const seen = new Set<string>();

  // Obtener datos del subgrupo desde menu_config
  const subgroupData = (specialUnits as any)[faction]?.subgroups?.[subgroup];
  if (!subgroupData) {
    debugWarn("teleportUtils:special", `Subgrupo ${subgroup} no encontrado para ${faction}`, "red");
    return entities;
  }

  const validFamilies = faction === Factions.FOUNDATION ? teamFamilies.foundation : teamFamilies.chaos;

  debugWarn("teleportUtils", `Buscando entidades especiales de ${faction}, subgrupo: ${subgroup}`, "cyan");

  for (const family of validFamilies) {
    try {
      const ents = dimension.getEntities({ families: [family] });

      for (const ent of ents) {
        if (!ent || !ent.id) continue;
        if (seen.has(ent.id)) continue;

        // Validar que sea un soldado válido
        if (!isValidSoldier(ent, specialUnits as any)) continue;

        // Obtener información de facción
        const factionInfo = getEntityFactionInfo(ent, specialUnits as any);
        if (!factionInfo) continue;
        if (factionInfo.faction !== faction) continue;
        if (!factionInfo.isSpecial) continue; // Solo queremos especiales

        // Verificar que el nametag esté en la lista del subgrupo
        const nameTag = ent.nameTag ?? "";
        if (!subgroupData.units.includes(nameTag)) continue;

        seen.add(ent.id);
        entities.push(ent);
        debugWarn("teleportUtils:special", `Encontrada: ${nameTag} [${faction}-${subgroup}]`, "green");
      }
    } catch (e) {
      debugWarn("teleportUtils:special", `Error escaneando familia ${family}: ${e}`, "red");
    }
  }

  debugWarn("teleportUtils", `Encontradas ${entities.length} entidades especiales`, "green");
  return entities;
}

/**
 * Obtiene entidades especiales por nametags seleccionados (para toggles individuales)
 * @param faction - Facción de las entidades
 * @param selectedUnits - Array de nametags seleccionados
 * @param dimension - Dimensión donde buscar
 * @returns Array de entidades filtradas
 */
export function getSpecialEntitiesByToggles(faction: string, selectedUnits: string[], dimension: Dimension): Entity[] {
  const entities: Entity[] = [];
  const seen = new Set<string>();

  const validFamilies = faction === Factions.FOUNDATION ? teamFamilies.foundation : teamFamilies.chaos;

  debugWarn(
    "teleportUtils",
    `Buscando entidades especiales de ${faction}, nametags: ${selectedUnits.join(", ")}`,
    "cyan"
  );

  for (const family of validFamilies) {
    try {
      const ents = dimension.getEntities({ families: [family] });

      for (const ent of ents) {
        if (!ent || !ent.id) continue;
        if (seen.has(ent.id)) continue;

        // Validar que sea un soldado válido
        if (!isValidSoldier(ent, specialUnits as any)) continue;

        // Obtener información de facción
        const factionInfo = getEntityFactionInfo(ent, specialUnits as any);
        if (!factionInfo) continue;
        if (factionInfo.faction !== faction) continue;
        if (!factionInfo.isSpecial) continue; // Solo queremos especiales

        // Verificar que el nametag esté en la lista de seleccionados
        const nameTag = ent.nameTag ?? "";
        if (!selectedUnits.includes(nameTag)) continue;

        seen.add(ent.id);
        entities.push(ent);
        debugWarn("teleportUtils:special", `Encontrada: ${nameTag} [${faction}]`, "green");
      }
    } catch (e) {
      debugWarn("teleportUtils:special", `Error escaneando familia ${family}: ${e}`, "red");
    }
  }

  debugWarn("teleportUtils", `Encontradas ${entities.length} entidades especiales seleccionadas`, "green");
  return entities;
}

/**
 * Obtiene TODAS las entidades de un bando (sin filtros)
 * @param faction - Facción de las entidades
 * @param dimension - Dimensión donde buscar
 * @returns Array de todas las entidades del bando
 */
export function getAllFactionEntities(faction: string, dimension: Dimension): Entity[] {
  const entities: Entity[] = [];
  const seen = new Set<string>();

  const validFamilies = faction === Factions.FOUNDATION ? teamFamilies.foundation : teamFamilies.chaos;

  debugWarn("teleportUtils", `Buscando TODAS las entidades de ${faction}`, "cyan");

  for (const family of validFamilies) {
    try {
      const ents = dimension.getEntities({ families: [family] });

      for (const ent of ents) {
        if (!ent || !ent.id) continue;
        if (seen.has(ent.id)) continue;

        // Validar que sea un soldado válido
        if (!isValidSoldier(ent, specialUnits as any)) continue;

        // Obtener información de facción
        const factionInfo = getEntityFactionInfo(ent, specialUnits as any);
        if (!factionInfo) continue;
        if (factionInfo.faction !== faction) continue;

        seen.add(ent.id);
        entities.push(ent);
      }
    } catch (e) {
      debugWarn("teleportUtils:all", `Error escaneando familia ${family}: ${e}`, "red");
    }
  }

  debugWarn("teleportUtils", `Encontradas ${entities.length} entidades totales`, "green");
  return entities;
}
