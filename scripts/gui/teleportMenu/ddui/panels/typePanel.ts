// scripts/gui/teleportMenu/ddui/panels/typePanel.ts

/**
 * Panel de Selección de Tipo de Unidades DDUI
 * Permite escoger entre:
 * - Soldados NO especiales (Básicos, Líderes, Comandantes)
 * - Soldados ESPECIALES (MTF especiales, unidades élite por buckets)
 * - TELETRANSPORTAR TODAS (vista agregada)
 */

import { system } from "@minecraft/server";
import { CustomForm } from "@minecraft/server-ui";
import { TypeSelectionTexts, CommonTexts, getFactionLabel } from "../../teleport_config.js";
import { debug } from "../../../../utils/debug.js";
import { stripColorCodes } from "../../../commandMenu/ddui/helpers/formHelpers.js";
import { TeleportDDUISession } from "../sessionStore.js";
import { showMainPanel } from "./mainPanel.js";
import { showNormalPanel } from "./normalPanel.js";
import { showSpecialBucketsPanel } from "./specialBucketsPanel.js";
import { showAllPanel } from "./allPanel.js";

/**
 * Muestra el panel de selección de tipo para la facción elegida
 * @param session - Sesión activa del jugador
 */
export function showTypePanel(session: TeleportDDUISession): void {
  const player = session.player;
  const faction = session.faction;
  session.currentView = "type";
  session.closeReason = "user";

  let nextPanel: (() => void) | undefined = undefined;

  const factionLabel = getFactionLabel(faction);
  const form = new CustomForm(player, `Teletransporte | ${factionLabel}`);

  form.spacer();
  form.label("§7Selecciona la categoría de unidades que deseas teletransportar:§r");
  form.spacer();

  // Botón 1: Soldados NO especiales
  form.button(stripColorCodes(TypeSelectionTexts.normal), () => {
    session.closeReason = "navigation";
    nextPanel = () => showNormalPanel(session);
    form.close();
  });

  // Botón 2: Soldados ESPECIALES
  form.button(stripColorCodes(TypeSelectionTexts.special), () => {
    session.closeReason = "navigation";
    nextPanel = () => showSpecialBucketsPanel(session);
    form.close();
  });

  // Botón 3: TELETRANSPORTAR TODAS
  form.button(stripColorCodes(TypeSelectionTexts.all), () => {
    session.closeReason = "navigation";
    nextPanel = () => showAllPanel(session);
    form.close();
  });

  // Botón 4: Volver al menú principal
  form.button(stripColorCodes(CommonTexts.backButton), () => {
    session.closeReason = "navigation";
    nextPanel = () => showMainPanel(session);
    form.close();
  });

  session.setForm(form);

  form
    .show()
    .then((reason) => {
      session.setForm(undefined);
      if (reason === "ClientClosed") {
        debug("teleportMenuDDUI", `Panel Tipo cerrado por cliente (§b${player.name}§r)`, {
          level: "debug",
          color: "gray",
        });
      } else if (reason === "UserBusy") {
        debug("teleportMenuDDUI", `Panel Tipo cerrado: UserBusy (§b${player.name}§r)`, {
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
      debug("teleportMenuDDUI", `Error en showTypePanel: ${err}`, { level: "error", color: "red" });
    });
}
