// scripts/gui/teleportMenu/teleport_logic.ts

/**
 * Lógica de teletransporte de entidades
 * Maneja la operación de teletransporte y reporta resultados
 */

import { Entity, Player, Dimension, Vector3 } from "@minecraft/server";
import { debug } from "../../../utils/debug.js";
import type { TeleportResult } from "./teleport_types.js";

/**
 * Teletransporta a un destino en una dimensión específica.
 * @param entities - Array de entidades a teletransportar
 * @param destination - Coordenadas destino (Vector3)
 * @param dimension - Dimensión destino
 */
export function teleportEntitiesToLocation(
  entities: Entity[],
  destination: Vector3,
  dimension: Dimension
): TeleportResult {
  let count = 0;
  const errors: string[] = [];

  debug("teleportLogic", `=== Iniciando teletransporte de ${entities.length} entidades ===`, { color: "aqua", level: "debug" });

  for (const entity of entities) {
    try {
      if (!entity || !entity.isValid) {
        errors.push(`Entidad inválida o eliminada`);
        continue;
      }

      entity.teleport(destination, {
        dimension,
      });

      count++;
      const soldierName = entity.nameTag ? `${entity.nameTag}§r` : `§b${entity.typeId}§r`;
      debug(
        "teleportLogic:success",
        `${soldierName} teletransportado a [${destination.x}, ${destination.y}, ${destination.z}]`,
        { color: "green", level: "debug" }
      );
    } catch (e) {
      const entityLabel = entity?.nameTag ? `${entity?.nameTag}§r` : entity?.typeId ? `§b${entity?.typeId}§r` : "unknown";
      const errorMsg = `Error en ${entityLabel}: ${e}`;
      errors.push(errorMsg);
      debug("teleportLogic:error", errorMsg, { color: "red", level: "error" });
    }
  }

  const result: TeleportResult = {
    count,
    hasErrors: errors.length > 0,
    errors: errors.length > 0 ? errors : undefined,
  };

  debug(
    "teleportLogic",
    `=== Teletransporte completado: ${count}/${entities.length} exitosos ===`,
    { color: count > 0 ? "green" : "yellow", level: "debug" }
  );

  if (result.hasErrors) {
    debug("teleportLogic", `Errores encontrados: ${errors.length}`, { color: "red", level: "warn" });
  }

  return result;
}

/**
 * Conveniencia para teletransportar al jugador o a coordenadas dadas.
 * Si `targetLocation` no se provee, usa la ubicación del jugador.
 */
export function teleportEntitiesToPlayer(entities: Entity[], player: Player, targetLocation?: Vector3): TeleportResult {
  const destination = targetLocation ?? player.location;
  return teleportEntitiesToLocation(entities, destination, player.dimension);
}
