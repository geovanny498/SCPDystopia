// scripts/gui/teleportMenu/ddui/panels/mainPanel.ts

/**
 * Hub principal de Teletransporte DDUI.
 * Permite elegir facción y abrir directamente una de las tres vistas de acción.
 * Permite seleccionar la facción (Fundación SCP o Insurgencia del Caos).
 * Panel Principal de Teletransporte DDUI.
 */

import { system } from "@minecraft/server";
import { CustomForm, ObservableNumber } from "@minecraft/server-ui";
import { FactionId } from "../../../../constants/domains.js";
import { TELEPORT_FACTION_OPTIONS, TeleportHubTexts, TeleportTitles } from "../../teleport_config.js";
import { debug } from "../../../../utils/debug.js";
import { stripColorCodes } from "../../../commandMenu/ddui/helpers/formHelpers.js";
import { TeleportDDUISession } from "../sessionStore.js";
import { showAllPanel } from "./allPanel.js";
import { showNormalPanel } from "./normalPanel.js";
import { showSpecialBucketsPanel } from "./specialBucketsPanel.js";

/**
 * Muestra el hub de navegación y mantiene la facción elegida en la sesión.
 * @param session Sesión activa del jugador.
 */
export function showMainPanel(session: TeleportDDUISession): void {
  const player = session.player;
  session.currentView = "main";
  session.closeReason = "user";

  let nextPanel: (() => void) | undefined;
  const form = new CustomForm(player, TeleportTitles.main);
  const initialIndex = TELEPORT_FACTION_OPTIONS.findIndex((option) => option.value === session.faction);
  const factionObs = new ObservableNumber(initialIndex >= 0 ? initialIndex : 0, { clientWritable: true });

  form.spacer();
  form.label(TeleportHubTexts.description);
  form.spacer();
  form.dropdown(
    stripColorCodes("§7Facción:"),
    factionObs,
    TELEPORT_FACTION_OPTIONS.map((option, index) => ({ label: stripColorCodes(option.label), value: index }))
  );
  factionObs.subscribe((index: number) => {
    const option = TELEPORT_FACTION_OPTIONS[index];
    if (!option) return;
    session.faction = option.value as FactionId;
    debug("teleportMenuDDUI", `Facción preparada: §a${session.faction}§r (§b${player.name}§r)`, {
      level: "debug",
      color: "aqua",
    });
  });
  form.spacer();

  // Las categorías sustituyen al antiguo paso intermedio de selección de tipo.
  form.button(stripColorCodes(TeleportHubTexts.normal), () => {
    // Botón Fundación SCP / categoría No especiales
    session.closeReason = "navigation";
    nextPanel = () => showNormalPanel(session);
    form.close();
  });

  form.button(stripColorCodes(TeleportHubTexts.special), () => {
    // Botón Insurgencia del Caos / categoría Especiales
    session.closeReason = "navigation";
    nextPanel = () => showSpecialBucketsPanel(session);
    form.close();
  });

  form.button(stripColorCodes(TeleportHubTexts.all), () => {
    session.closeReason = "navigation";
    nextPanel = () => showAllPanel(session);
    form.close();
  });

  session.setForm(form);
  form
    .show()
    .then((reason) => {
      session.setForm(undefined);
      if (reason === "ClientClosed") {
        debug("teleportMenuDDUI", `Hub cerrado por cliente (§b${player.name}§r)`, {
          level: "debug",
          color: "gray",
        });
      } else if (reason === "UserBusy") {
        debug("teleportMenuDDUI", `Hub cerrado: UserBusy (§b${player.name}§r)`, {
          level: "warn",
          color: "gray",
        });
        player.sendMessage("§e[TELEPORT] La interfaz no pudo abrirse porque estás ocupado.");
      } else if (reason === "ServerClosed" && session.closeReason === "navigation") {
        system.run(() => nextPanel?.());
      }
    })
    .catch((err) => {
      session.setForm(undefined);
      debug("teleportMenuDDUI", `Error en showMainPanel: ${err}`, { level: "error", color: "red" });
    });
}
