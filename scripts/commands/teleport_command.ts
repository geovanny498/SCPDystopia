// scripts/commands/teleport_command.ts

/**
 * Comando /scpd:teleport_units
 * Abre el menú DDUI de teletransporte de entidades.
 */

import {
  system,
  CustomCommandStatus,
  CustomCommandSource,
  CommandPermissionLevel,
  Player,
} from "@minecraft/server";
import { openTeleportMenuDDUI } from "../gui/teleportMenu/ddui/main.js";
import { debug } from "../utils/debug.js";

system.beforeEvents.startup.subscribe((init) => {
  const cmd = {
    name: "scpd:teleport_units",
    description: "Abre el menú de teletransporte de entidades",
    permissionLevel: CommandPermissionLevel.Admin,
    cheatsRequired: false,
  };

  try {
    init.customCommandRegistry.registerCommand(cmd, (origin) => {
      try {
        debug("teleportCommand", "Comando /scpd:teleport_units ejecutado", { level: "debug", color: "blue" });

        // Solo permitir ejecución por entidad (jugador)
        if (origin.sourceType !== CustomCommandSource.Entity || !origin.sourceEntity) {
          debug("teleportCommand", "Comando rechazado: no ejecutado por jugador", { level: "warn", color: "yellow" });
          return {
            status: CustomCommandStatus.Failure,
            message: "Este comando solo puede ser ejecutado por un jugador.",
          };
        }

        const player = origin.sourceEntity as Player;
        debug("teleportCommand", `Abriendo menú DDUI para jugador: §b${player.name}§r`, {
          level: "debug",
          color: "green",
        });

        try {
          system.run(() => {
            try {
              openTeleportMenuDDUI(player);
            } catch (err) {
              debug("teleportCommand", `Error mostrando menú DDUI: ${err}§r`, { level: "error", color: "red" });
              player.sendMessage("§c[SCPDystopia] Error abriendo el menú DDUI de teletransporte.");
            }
          });
        } catch (e) {
          debug("teleportCommand", `Error mostrando menú: ${e}§r`, { level: "error", color: "red" });
          console.warn("Error mostrando menú de teletransporte:", e);
          return {
            status: CustomCommandStatus.Failure,
            message: "Error abriendo el menú de teletransporte. Revisa la consola.",
          };
        }

        return {
          status: CustomCommandStatus.Success,
          message: "Abriendo menú DDUI...",
        };
      } catch (e) {
        console.warn("scpd:teleport handler error:", e);
        return { status: CustomCommandStatus.Failure, message: "Error interno al ejecutar el comando." };
      }
    });
  } catch (e) {
    console.warn("Error registrando scpd:teleport_units:", e);
  }
});
