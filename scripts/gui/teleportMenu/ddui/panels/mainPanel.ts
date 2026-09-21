// scripts/gui/teleportMenu/ddui/panels/mainPanel.ts

/**
 * Panel Principal de Teletransporte DDUI
 * Permite seleccionar la facción (Fundación SCP o Insurgencia del Caos)
 */

import { Player, system } from "@minecraft/server";
import { CustomForm } from "@minecraft/server-ui";
import { TeleportTitles, MainMenuButtons } from "../../teleport_config.js";
import { Factions } from "../../../../constants/domains.js";
import { debug } from "../../../../utils/debug.js";
import { stripColorCodes } from "../../../commandMenu/ddui/helpers/formHelpers.js";
import { teleportMenuSessionStore, TeleportDDUISession } from "../sessionStore.js";
import { showTypePanel } from "./typePanel.js";

/**
 * Muestra el panel principal de selección de facción en DDUI
 * @param session - Sesión activa del jugador
 */
export function showMainPanel(session: TeleportDDUISession): void {
  const player = session.player;
  session.currentView = "main";
  session.closeReason = "user";

  let nextPanel: (() => void) | undefined = undefined;

  const form = new CustomForm(player, TeleportTitles.main);

  form.spacer();
  form.label("§7Selecciona la facción de las unidades a teletransportar:§r");
  form.spacer();

  // Botón Fundación SCP
  form.button(stripColorCodes(MainMenuButtons.foundation), () => {
    session.closeReason = "navigation";
    session.faction = Factions.FOUNDATION;
    nextPanel = () => showTypePanel(session);
    form.close();
  });

  // Botón Insurgencia del Caos
  form.button(stripColorCodes(MainMenuButtons.chaos), () => {
    session.closeReason = "navigation";
    session.faction = Factions.CHAOS;
    nextPanel = () => showTypePanel(session);
    form.close();
  });

  session.setForm(form);

  form
    .show()
    .then((reason) => {
      session.setForm(undefined);
      if (reason === "ClientClosed") {
        debug("teleportMenuDDUI", `Panel Principal cerrado por cliente (§b${player.name}§r)`, {
          level: "debug",
          color: "gray",
        });
      } else if (reason === "UserBusy") {
        debug("teleportMenuDDUI", `Panel Principal cerrado: UserBusy (§b${player.name}§r)`, {
          level: "warn",
          color: "gray",
        });
        player.sendMessage("§e[TELEPORT] La interfaz no pudo abrirse porque estás ocupado.");
      } else if (reason === "ServerClosed") {
        if (session.closeReason === "navigation") {
          system.run(() => {
            nextPanel?.();
          });
        }
      }
    })
    .catch((err) => {
      session.setForm(undefined);
      debug("teleportMenuDDUI", `Error en showMainPanel: ${err}`, { level: "error", color: "red" });
    });
}
