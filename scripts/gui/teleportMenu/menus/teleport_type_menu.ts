// scripts/gui/teleportMenu/teleport_type_menu.ts

/**
 * Menú de selección de tipo de soldados
 * Permite elegir entre: NO especiales, ESPECIALES, o TODAS
 */

import { Player, system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { TeleportTitles, TypeSelectionTexts, getFactionLabel } from "../teleport_config.js";
import { showNormalSoldiersMenu } from "./teleport_normal_menu.js";
import { showSpecialSoldiersMenu } from "./teleport_special_menu.js";
import { showTeleportAllMenu } from "./teleport_all_menu.js";
import { debugMessage } from "../../../utils/debug.js";

/**
 * Muestra el menú de selección de tipo de soldados
 * @param player - Jugador que ejecuta el comando
 * @param faction - Facción seleccionada
 */
export function showTypeSelectionMenu(player: Player, faction: string): void {
  debugMessage("teleportMenu", `Mostrando menú de tipo para facción ${faction}`, "cyan");

  // Usar system.run para evitar errores de ejecución restringida
  system.run(() => {
    const form = new ActionFormData();
    const factionLabel = getFactionLabel(faction);
    form.title(`${factionLabel} | Teletransporte`);
    form.body("§7Selecciona el tipo de soldados:");

    // Botones
    form.button(TypeSelectionTexts.normal + "\n§8" + TypeSelectionTexts.normalDesc);
    form.button(TypeSelectionTexts.special + "\n§8" + TypeSelectionTexts.specialDesc);
    form.button(TypeSelectionTexts.all + "\n§8" + TypeSelectionTexts.allDesc);
    form.button("§8« Volver al Menú Principal");

    form
      .show(player)
      .then((response) => {
        if (response.canceled || response.selection === 3) {
          debugMessage("teleportMenu", `${player.name} vuelve al menú principal`, "yellow");
          // Import dinámico para evitar dependencia circular
          import("./teleport_menu.js")
            .then((module) => {
              module.showTeleportMainMenu(player);
            })
            .catch((err) => console.error(err));
          return;
        }

        // Redirigir al menú correspondiente
        switch (response.selection) {
          case 0:
            // Soldados NO especiales
            showNormalSoldiersMenu(player, faction);
            break;
          case 1:
            // Soldados ESPECIALES
            showSpecialSoldiersMenu(player, faction);
            break;
          case 2:
            // TODAS las entidades
            showTeleportAllMenu(player, faction);
            break;
        }
      })
      .catch((e) => {
        console.warn(`Error mostrando menú de selección de tipo: ${e}`);
      });
  });
}
