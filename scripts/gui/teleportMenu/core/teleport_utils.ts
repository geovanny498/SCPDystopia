// scripts/gui/teleportMenu/core/teleport_utils.ts

/**
 * Utilidades para filtrar y obtener entidades
 * Refactorizado para usar funciones modulares sin listas hardcodeadas
 */

import { Entity, Dimension, Player } from "@minecraft/server";
import { getEntityFactionInfo, isValidSoldier } from "../../commandMenu/model/menu_faction.js";
import { Factions, UnitHierarchy } from "../../commandMenu/menu_config.js";
import type { FactionId, UnitHierarchyId } from "../../../constants/domains.js";
import { teamFamilies } from "../../../utils/teams.js";
import { debug } from "../../../utils/debug.js";

/**
 * Obtiene entidades normales por jerarquía en una dimensión
 * @param faction - Facción de las entidades
 * @param hierarchies - Array de jerarquías a incluir (basic, leader, commander)
 * @param dimension - Dimensión donde buscar
 * @returns Array de entidades filtradas
 */
export function getNormalEntitiesByHierarchy(
  faction: FactionId,
  hierarchies: UnitHierarchyId[],
  dimension: Dimension
): Entity[] {
  const entities: Entity[] = [];
  const seen = new Set<string>();

  // Determinar familias válidas según facción
  const validFamilies = faction === Factions.FOUNDATION ? teamFamilies.foundation : teamFamilies.chaos;

  debug("teleportUtils", `Buscando entidades normales de §a${faction}§r, jerarquías: ${hierarchies.join(", ")}`, {
    level: "debug",
    color: "aqua",
  });

  for (const family of validFamilies) {
    try {
      const ents = dimension.getEntities({ families: [family] });

      for (const ent of ents) {
        if (!ent || !ent.id) continue;
        if (seen.has(ent.id)) continue;

        // Validar que sea un soldado válido
        if (!isValidSoldier(ent)) continue;

        // Obtener información de facción
        const factionInfo = getEntityFactionInfo(ent);
        if (!factionInfo) continue;
        if (factionInfo.faction !== faction) continue;
        if (factionInfo.isSpecial) continue; // Solo queremos normales

        // Verificar que la jerarquía esté en el filtro
        if (!isUnitHierarchyId(factionInfo.hierarchy) || !hierarchies.includes(factionInfo.hierarchy)) continue;

        seen.add(ent.id);
        entities.push(ent);
        debug("teleportUtils:normal", `Encontrada: §b${ent.typeId}§r [§a${faction}§r-§a${factionInfo.hierarchy}§r]`, {
          level: "debug",
          color: "green",
        });
      }
    } catch (e) {
      debug("teleportUtils:normal", `§cError§r escaneando familia ${family}: ${e}`, { level: "error", color: "red" });
    }
  }

  debug("teleportUtils", `Encontradas ${entities.length} entidades normales`, { level: "debug", color: "green" });
  return entities;
}

/**
 * Obtiene entidades especiales por nametags seleccionados (para toggles individuales)
 * @param faction - Facción de las entidades
 * @param selectedNametags - Array de nametags seleccionados
 * @param dimension - Dimensión donde buscar
 * @returns Array de entidades filtradas
 */
export function getSpecialEntitiesByNametags(
  faction: FactionId,
  selectedNametags: string[],
  dimension: Dimension
): Entity[] {
  const entities: Entity[] = [];
  const seen = new Set<string>();

  const validFamilies = faction === Factions.FOUNDATION ? teamFamilies.foundation : teamFamilies.chaos;

  debug("teleportUtils", `Buscando entidades especiales de §a${faction}§r, nametags: ${selectedNametags.join(", ")}`, {
    level: "debug",
    color: "aqua",
  });

  for (const family of validFamilies) {
    try {
      const ents = dimension.getEntities({ families: [family] });

      for (const ent of ents) {
        if (!ent || !ent.id) continue;
        if (seen.has(ent.id)) continue;

        // Validar que sea un soldado válido
        if (!isValidSoldier(ent)) continue;

        // Obtener información de facción
        const factionInfo = getEntityFactionInfo(ent);
        if (!factionInfo) continue;
        if (factionInfo.faction !== faction) continue;
        if (!factionInfo.isSpecial) continue; // Solo queremos especiales

        // Verificar que el nametag esté en la lista de seleccionados
        const nameTag = ent.nameTag ?? "";
        if (!selectedNametags.includes(nameTag)) continue;

        seen.add(ent.id);
        entities.push(ent);
        debug(
          "teleportUtils:special",
          `Encontrada: ${nameTag ? `§r§f${nameTag}§r` : `§b${ent.typeId}§r`} [§a${faction}§r]`,
          { level: "debug", color: "green" }
        );
      }
    } catch (e) {
      debug("teleportUtils:special", `§cError§r escaneando familia ${family}: ${e}`, { level: "error", color: "red" });
    }
  }

  debug("teleportUtils", `Encontradas ${entities.length} entidades especiales seleccionadas`, {
    level: "debug",
    color: "green",
  });
  return entities;
}

/**
 * Obtiene TODAS las entidades de un bando (sin filtros)
 * @param faction - Facción de las entidades
 * @param dimension - Dimensión donde buscar
 * @returns Array de todas las entidades del bando
 */
export function getAllFactionEntities(faction: FactionId, dimension: Dimension): Entity[] {
  const entities: Entity[] = [];
  const seen = new Set<string>();

  const validFamilies = faction === Factions.FOUNDATION ? teamFamilies.foundation : teamFamilies.chaos;

  debug("teleportUtils", `Buscando TODAS las entidades de §a${faction}§r`, { level: "debug", color: "aqua" });

  for (const family of validFamilies) {
    try {
      const ents = dimension.getEntities({ families: [family] });

      for (const ent of ents) {
        if (!ent || !ent.id) continue;
        if (seen.has(ent.id)) continue;

        // Validar que sea un soldado válido
        if (!isValidSoldier(ent)) continue;

        // Obtener información de facción
        const factionInfo = getEntityFactionInfo(ent);
        if (!factionInfo) continue;
        if (factionInfo.faction !== faction) continue;

        seen.add(ent.id);
        entities.push(ent);
      }
    } catch (e) {
      debug("teleportUtils:all", `§cError§r escaneando familia ${family}: ${e}`, { level: "error", color: "red" });
    }
  }

  debug("teleportUtils", `Encontradas ${entities.length} entidades totales`, { level: "debug", color: "green" });
  return entities;
}

/**
 * Valida la jerarquía recibida desde la inspección de una entidad antes de
 * compararla con la selección tipada de la interfaz.
 * @param hierarchy Valor externo que puede no corresponder a una jerarquía válida.
 * @returns `true` cuando el valor es una jerarquía canónica de unidad.
 */
function isUnitHierarchyId(hierarchy: string | null): hierarchy is UnitHierarchyId {
  return hierarchy !== null && Object.values(UnitHierarchy).includes(hierarchy as UnitHierarchyId);
}

/**
 * Convierte un texto de coordenadas (x y z / x,y,z) a Vector3.
 * Si el texto está vacío, devuelve la ubicación actual del jugador.
 * Retorna null si el formato es inválido.
 */
export function parseTeleportDestination(
  rawInput: string | undefined,
  player: Player
): { x: number; y: number; z: number } | null {
  const source = rawInput?.trim() ?? "";
  if (source.length === 0) {
    const pos = player.location;
    return { x: pos.x, y: pos.y, z: pos.z };
  }

  const normalized = source.replace(/,/g, " ").replace(/\s+/g, " ").trim();
  const parts = normalized.split(" ");
  if (parts.length !== 3) return null;

  const parseAxis = (axisValue: string, base: number): number | null => {
    axisValue = axisValue.trim();
    if (axisValue === "~") {
      return base;
    }

    if (axisValue.startsWith("~")) {
      const offsetText = axisValue.slice(1);
      if (offsetText.length === 0) return base;
      const offset = Number(offsetText);
      if (Number.isNaN(offset)) return null;
      return base + offset;
    }

    const absolute = Number(axisValue);
    return Number.isNaN(absolute) ? null : absolute;
  };

  const x = parseAxis(parts[0], player.location.x);
  const y = parseAxis(parts[1], player.location.y);
  const z = parseAxis(parts[2], player.location.z);

  if (x === null || y === null || z === null) return null;

  return { x, y, z };
}
