import {
  system,
  CustomCommandStatus,
  CustomCommandSource,
  CommandPermissionLevel,
  Player,
  CustomCommandParamType,
} from "@minecraft/server";
import { debug } from "../utils/debug.js";
import { openCommandMenuDDUI } from "../gui/commandMenu/ddui/main.js";

system.beforeEvents.startup.subscribe((init) => {
  const cmd = {
    name: "scpd:config",
    description: "Abre el panel de configuración de SCPDystopia (interfaz)",
    permissionLevel: CommandPermissionLevel.Any,
    cheatsRequired: false,
    optionalParameters: [{ name: "mode", type: CustomCommandParamType.String }],
  };

  try {
    init.customCommandRegistry.registerCommand(cmd, (origin, mode) => {
      try {
        if (origin.sourceType !== CustomCommandSource.Entity || !origin.sourceEntity) {
          return {
            status: CustomCommandStatus.Failure,
            message: "Este comando solo puede ser ejecutado por un jugador.",
          };
        }

        const player = origin.sourceEntity as Player;
        const selectedMode = typeof mode === "string" ? mode.toLowerCase() : "";

        if (selectedMode === "legacy") {
          player.sendMessage("§c[SCPDystopia] El menú legacy ha sido desactivado. Usa /scpd:config.");
          return {
            status: CustomCommandStatus.Failure,
            message: "El menú legacy ha sido desactivado.",
          };
        }

        try {
          system.run(() => {
            try {
              openCommandMenuDDUI(player);
              debug("configCommand", `Menú DDUI abierto para §b${player.name}§r`, { level: "debug", color: "blue" });
            } catch (e) {
              debug("configCommand", `Error mostrando menú DDUI desde scpd:config: ${e}§r`, { level: "error", color: "red" });
              player.sendMessage("§c[SCPDystopia] Error abriendo el menú DDUI. Revisa la consola.");
            }
          });
        } catch (e) {
          debug("configCommand", `Error mostrando menú desde scpd:config: ${e}§r`, { level: "error", color: "red" });
          return {
            status: CustomCommandStatus.Failure,
            message: "Error abriendo el menú de configuración. Revisa la consola.",
          };
        }

        return {
          status: CustomCommandStatus.Success,
          message: "Abriendo menú DDUI...",
        };
      } catch (e) {
        debug("configCommand", `scpd:config handler error: ${e}§r`, { level: "error", color: "red" });
        return { status: CustomCommandStatus.Failure, message: "Error interno al ejecutar el comando." };
      }
    });
  } catch (e) {
      debug("configCommand", `Error registrando scpd:config: ${e}§r`, { level: "error", color: "red" });
  }
});
