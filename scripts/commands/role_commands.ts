// scripts/commands/role_commands.ts

import { system, CustomCommandStatus, CustomCommandSource, CommandPermissionLevel, Player } from "@minecraft/server";
import { debug } from "../utils/debug.js";
import { showRolePanel } from "../gui/roleMenu/panels/rolePanel.js";

system.beforeEvents.startup.subscribe((init) => {
  const cmd = {
    name: "scpd:rolemenu",
    description: "Abre el panel de gestión de roles (solo admin)",
    permissionLevel: CommandPermissionLevel.Admin,
    cheatsRequired: false,
  };

  try {
    init.customCommandRegistry.registerCommand(cmd, (origin) => {
      try {
        if (origin.sourceType !== CustomCommandSource.Entity || !origin.sourceEntity) {
          return {
            status: CustomCommandStatus.Failure,
            message: "Este comando solo puede ser ejecutado por un jugador.",
          };
        }

        const admin = origin.sourceEntity as Player;

        system.run(() => {
          try {
            showRolePanel(admin);
            debug("roleMenu", `Panel de roles abierto para §b${admin.name}§r`, { level: "debug", color: "blue" });
          } catch (e) {
            debug("roleMenu", `Error mostrando panel de roles: ${e}§r`, { level: "error", color: "red" });
            admin.sendMessage("§c[SCPDystopia] Error abriendo el panel de roles.");
          }
        });

        return {
          status: CustomCommandStatus.Success,
          message: "Abriendo panel de gestión de roles...",
        };
      } catch (e) {
        debug("roleMenu", `Error en handler de scpd:roles: ${e}§r`, { level: "error", color: "red" });
        return { status: CustomCommandStatus.Failure, message: "Error interno al ejecutar el comando." };
      }
    });
  } catch (e) {
      debug("roleMenu", `Error registrando scpd:roles: ${e}§r`, { level: "error", color: "red" });
  }
});
