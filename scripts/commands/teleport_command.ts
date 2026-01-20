// scripts/commands/teleport_command.ts

/**
 * Comando /scpd:teleport
 * Abre el menú de teletransporte de entidades (sistema independiente)
 */

import { system, CustomCommandStatus, CustomCommandSource, CommandPermissionLevel, Player } from "@minecraft/server";
import { showTeleportMainMenu } from "../gui/teleportMenu/menus/teleport_menu.js";
import { debugMessage } from "../utils/debug.js";

system.beforeEvents.startup.subscribe((init) => {
  const cmd = {
    name: "scpd:teleport_units",
    description: "Abre el menú de teletransporte de entidades",
    permissionLevel: CommandPermissionLevel.Any,
    cheatsRequired: false,
  };

  try {
    init.customCommandRegistry.registerCommand(cmd, (origin) => {
      try {
        debugMessage("teleportCommand", "Comando /scpd:teleport ejecutado", "cyan");

        // Solo permitir ejecución por entidad (jugador)
        if (origin.sourceType !== CustomCommandSource.Entity || !origin.sourceEntity) {
          debugMessage("teleportCommand", "Comando rechazado: no ejecutado por jugador", "yellow");
          return {
            status: CustomCommandStatus.Failure,
            message: "Este comando solo puede ser ejecutado por un jugador.",
          };
        }

        const player = origin.sourceEntity as Player;
        debugMessage("teleportCommand", `Abriendo menú para jugador: ${player.name}`, "green");

        // Mostrar el menú al jugador que ejecutó el comando
        try {
          showTeleportMainMenu(origin.sourceEntity as Player);
        } catch (e) {
          debugMessage("teleportCommand", `Error mostrando menú: ${e}`, "red");
          console.warn("Error mostrando menú de teletransporte:", e);
          return {
            status: CustomCommandStatus.Failure,
            message: "Error abriendo el menú de teletransporte. Revisa la consola.",
          };
        }

        return {
          status: CustomCommandStatus.Success,
          message: "Abriendo menú de teletransporte...",
        };
      } catch (e) {
        console.warn("scpd:teleport handler error:", e);
        return { status: CustomCommandStatus.Failure, message: "Error interno al ejecutar el comando." };
      }
    });
  } catch (e) {
    console.warn("Error registrando scpd:teleport:", e);
  }
});
