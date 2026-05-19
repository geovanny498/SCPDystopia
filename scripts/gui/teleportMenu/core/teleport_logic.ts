// scripts/gui/teleportMenu/teleport_logic.ts

/**
 * Lógica de teletransporte de entidades
 * Maneja la operación de teletransporte y reporta resultados
 */

import { Entity, Player, Dimension, Vector3 } from "@minecraft/server";
import { debugWarn } from "../../../utils/debug.js";
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

  debugWarn("teleportLogic", `=== Iniciando teletransporte de ${entities.length} entidades ===`, "cyan");

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
      debugWarn(
        "teleportLogic:success",
        `${entity.nameTag || entity.typeId} teletransportado a [${destination.x}, ${destination.y}, ${destination.z}]`,
        "green"
      );
    } catch (e) {
      const entityLabel = entity?.nameTag || entity?.typeId || "unknown";
      const errorMsg = `Error en ${entityLabel}: ${e}`;
      errors.push(errorMsg);
      debugWarn("teleportLogic:error", errorMsg, "red");
    }
  }

  const result: TeleportResult = {
    count,
    hasErrors: errors.length > 0,
    errors: errors.length > 0 ? errors : undefined,
  };

  debugWarn(
    "teleportLogic",
    `=== Teletransporte completado: ${count}/${entities.length} exitosos ===`,
    count > 0 ? "green" : "yellow"
  );

  if (result.hasErrors) {
    debugWarn("teleportLogic", `Errores encontrados: ${errors.length}`, "red");
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
