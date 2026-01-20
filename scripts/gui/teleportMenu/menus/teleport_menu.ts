// scripts/gui/teleportMenu/teleport_menu.ts

/**
 * Menú principal del sistema de teletransporte
 * Punto de entrada - permite seleccionar la facción
 */

import { Player, system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { TeleportTitles, MainMenuButtons } from "../teleport_config.js";
import { Factions } from "../../commandMenu/menu_config.js";
import { showTypeSelectionMenu } from "./teleport_type_menu.js";
import { debugMessage } from "../../../utils/debug.js";

/**
 * Muestra el menú principal de teletransporte
 * Este es el punto de entrada al sistema
 * @param player - Jugador que ejecuta el comando
 */
export function showTeleportMainMenu(player: Player): void {
  debugMessage("teleportMenu", `Mostrando menú principal a ${player.name}`, "cyan");

  // Usar system.run para evitar errores de ejecución restringida
  system.run(() => {
    const form = new ActionFormData();
    form.title(TeleportTitles.main);
    form.body("§7Selecciona un bando:");

    // Botones de facción
    form.button(MainMenuButtons.foundation + "\n§8" + MainMenuButtons.foundationDesc);
    form.button(MainMenuButtons.chaos + "\n§8" + MainMenuButtons.chaosDesc);

    form
      .show(player)
      .then((response) => {
        if (response.canceled) {
          debugMessage("teleportMenu", `${player.name} canceló el menú principal`, "yellow");
          return;
        }

        // Determinar facción según selección
        const faction = response.selection === 0 ? Factions.FOUNDATION : Factions.CHAOS;

        // Mostrar menú de selección de tipo
        showTypeSelectionMenu(player, faction);
      })
      .catch((e) => {
        console.warn(`Error mostrando menú principal de teletransporte: ${e}`);
      });
  });
}
