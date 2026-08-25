// scripts/commands/monitor_command.ts

/**
 * Comando /scpd:monitor_units
 * Abre el menú de monitoreo reactivo de unidades en tiempo real.
 * Reemplaza los comandos de chat /scpd:count_special_groups y /scpd:count_normal_units
 * con una vista dinámica actualizada cada segundo.
 */

import { system, CustomCommandStatus, CustomCommandSource, CommandPermissionLevel, Player } from "@minecraft/server";
import { showMonitorMenu, initializeMonitorObservables } from "../gui/monitorMenu/monitor_form.js";
import { debugMessage } from "../utils/debug.js";

system.beforeEvents.startup.subscribe(() => {
  try {
    initializeMonitorObservables();
  } catch (e) {
    console.warn("[Monitor] Error inicializando observables en startup:", e);
  }
});

system.beforeEvents.startup.subscribe((init) => {
  const cmd = {
    name: "scpd:monitor_units",
    description: "Abre el monitor reactivo de unidades en tiempo real (reemplaza comandos de conteo)",
    permissionLevel: CommandPermissionLevel.Any,
    cheatsRequired: false,
  };

  try {
    init.customCommandRegistry.registerCommand(cmd, (origin) => {
      try {
        debugMessage("monitorCommand", "Comando /scpd:monitor_units ejecutado", "cyan");

        if (origin.sourceType !== CustomCommandSource.Entity || !origin.sourceEntity) {
          debugMessage("monitorCommand", "Comando rechazado: no ejecutado por jugador", "yellow");
          return {
            status: CustomCommandStatus.Failure,
            message: "Este comando solo puede ser ejecutado por un jugador.",
          };
        }

        const player = origin.sourceEntity as Player;

        try {
          showMonitorMenu(player);
        } catch (e) {
          debugMessage("monitorCommand", `Error mostrando monitor: ${e}`, "red");
          console.warn("Error mostrando monitor de unidades:", e);
          return {
            status: CustomCommandStatus.Failure,
            message: "Error abriendo el monitor de unidades. Revisa la consola.",
          };
        }

        return {
          status: CustomCommandStatus.Success,
          message: "Abriendo monitor de unidades...",
        };
      } catch (e) {
        console.warn("scpd:monitor_units handler error:", e);
        return { status: CustomCommandStatus.Failure, message: "Error interno al ejecutar el comando." };
      }
    });
  } catch (e) {
    console.warn("Error registrando scpd:monitor_units:", e);
  }
});
