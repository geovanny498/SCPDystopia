import {
  system,
  CustomCommandStatus,
  CustomCommandSource,
  CommandPermissionLevel,
  Player,
  CustomCommandParamType,
} from "@minecraft/server";
import { debugWarn, debugMessage } from "../utils/debug.js";
import { buildAndShowMenu } from "../gui/commandMenu/builder/menu.js";
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

        try {
          if (selectedMode === "legacy") {
            buildAndShowMenu(player);
            debugMessage("configCommand", `Menú legacy abierto para ${player.name}`, "cyan");
          } else {
            system.run(() => {
              try {
                openCommandMenuDDUI(player);
                debugMessage("configCommand", `Menú DDUI abierto para ${player.name}`, "cyan");
              } catch (e) {
                debugWarn("configCommand", `Error mostrando menú DDUI desde scpd:config: ${e}`, "red");
                player.sendMessage("§c[SCPDystopia] Error abriendo el menú DDUI. Revisa la consola.");
              }
            });
          }
        } catch (e) {
          debugWarn("configCommand", `Error mostrando menú desde scpd:config: ${e}`, "red");
          return {
            status: CustomCommandStatus.Failure,
            message: "Error abriendo el menú de configuración. Revisa la consola.",
          };
        }

        return {
          status: CustomCommandStatus.Success,
            message: selectedMode === "legacy" ? "Abriendo menú legacy..." : "Abriendo menú DDUI...",
        };
      } catch (e) {
        debugWarn("configCommand", `scpd:config handler error: ${e}`, "red");
        return { status: CustomCommandStatus.Failure, message: "Error interno al ejecutar el comando." };
      }
    });
  } catch (e) {
    debugWarn("configCommand", `Error registrando scpd:config: ${e}`, "red");
  }
});
