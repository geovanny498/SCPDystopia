// scripts/gui/teleportMenu/teleport_logic.ts

/**
 * Lógica de teletransporte de entidades
 * Maneja la operación de teletransporte y reporta resultados
 */

import { Entity, Player } from "@minecraft/server";
import { debugWarn } from "../../../utils/debug.js";
import type { TeleportResult } from "./teleport_types.js";

/**
 * Teletransporta un array de entidades hacia un jugador
 * IMPORTANTE: La dimensión siempre es la del jugador, no la de la entidad
 * @param entities - Array de entidades a teletransportar
 * @param player - Jugador objetivo
 * @returns Resultado de la operación con conteo y errores
 */
export function teleportEntitiesToPlayer(entities: Entity[], player: Player): TeleportResult {
  let count = 0;
  const errors: string[] = [];

  debugWarn("teleportLogic", `=== Iniciando teletransporte de ${entities.length} entidades ===`, "cyan");

  for (const entity of entities) {
    try {
      if (!entity || !entity.isValid) {
        errors.push(`Entidad inválida o eliminada`);
        continue;
      }

      // Teletransportar a la ubicación y dimensión del jugador
      entity.teleport(player.location, {
        dimension: player.dimension,
      });

      count++;
      debugWarn(
        "teleportLogic:success",
        `${entity.nameTag || entity.typeId} teletransportado a ${player.name}`,
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
