// scripts/commands/teleport_command.ts

/**
 * Comando /scpd:teleport_units
 * Abre el menú de teletransporte de entidades (soporta modos DDUI y legacy)
 */

import {
  system,
  CustomCommandStatus,
  CustomCommandSource,
  CommandPermissionLevel,
  Player,
  CustomCommandParamType,
} from "@minecraft/server";
import { showTeleportMainMenu } from "../gui/teleportMenu/menus/teleport_menu.js";
import { openTeleportMenuDDUI } from "../gui/teleportMenu/ddui/main.js";
import { debug } from "../utils/debug.js";

system.beforeEvents.startup.subscribe((init) => {
  const cmd = {
    name: "scpd:teleport_units",
    description: "Abre el menú de teletransporte de entidades",
    permissionLevel: CommandPermissionLevel.Admin,
    cheatsRequired: false,
    optionalParameters: [{ name: "mode", type: CustomCommandParamType.String }],
  };

  try {
    init.customCommandRegistry.registerCommand(cmd, (origin, mode) => {
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
        const selectedMode = typeof mode === "string" ? mode.toLowerCase() : "";

        debug(
          "teleportCommand",
          `Abriendo menú para jugador: §b${player.name}§r en modo §a${selectedMode || "ddui (default)"}§r`,
          {
            level: "debug",
            color: "green",
          }
        );

        // Mostrar el menú según el modo seleccionado (legacy vs DDUI)
        try {
          if (selectedMode === "legacy") {
            showTeleportMainMenu(player);
          } else {
            system.run(() => {
              try {
                openTeleportMenuDDUI(player);
              } catch (err) {
                debug("teleportCommand", `Error mostrando menú DDUI: ${err}§r`, { level: "error", color: "red" });
                player.sendMessage("§c[SCPDystopia] Error abriendo el menú DDUI de teletransporte.");
              }
            });
          }
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
          message: selectedMode === "legacy" ? "Abriendo menú legacy..." : "Abriendo menú DDUI...",
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
