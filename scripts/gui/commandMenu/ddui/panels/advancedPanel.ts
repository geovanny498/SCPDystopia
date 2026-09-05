// scripts/gui/commandMenu/ddui/panels/advancedPanel.ts

import { Player, system } from "@minecraft/server";
import { CustomForm } from "@minecraft/server-ui";
import { debugWarn, debugMessage } from "../../../../utils/debug.js";
import { Factions, TargetFaction } from "../../../../constants/domains.js";
import {
  PANEL_TITLES,
  PANEL_DESCRIPTIONS,
  ADVANCED_PANEL_BUTTONS,
  BACK_BUTTON_LABEL,
  CATALOG_CATEGORIES,
  CATALOG_SYSTEMS,
  isSystemVisibleForRole,
  isMenuFeatureVisible,
} from "../../../shared/systemCatalog.js";
import { PlayerPermissionManager, type FactionId, type RoleId } from "../../../shared/playerPermissionManager.js";
import { showScopePanel } from "./scopePanel.js";
import { commandMenuSessionStore } from "../sessionStore.js";
import { buildSystemView } from "../builders/systemBuilder.js";
import { stripColorCodes } from "../helpers/formHelpers.js";

export function showAdvancedPanel(player: Player, targetFaction: TargetFaction = Factions.FOUNDATION): void {
  try {
    let closeReason: "navigation" | undefined = undefined;
    let nextPanel: (() => void) | undefined = undefined;

    const form = new CustomForm(player, PANEL_TITLES.advanced);

    const isAdmin = PlayerPermissionManager.isAdmin(player);
    const effectiveRole: RoleId = isAdmin
      ? "admin"
      : PlayerPermissionManager.getPlayerRole(player, targetFaction as FactionId);

    form.spacer();
    form.label(PANEL_DESCRIPTIONS.advanced);
    form.spacer();

    const advancedCategory = CATALOG_CATEGORIES.advanced;
    if (advancedCategory) {
      for (const systemId of advancedCategory.systemIds) {
        const systemConfig = CATALOG_SYSTEMS[systemId];
        if (!systemConfig) continue;
        if (!isSystemVisibleForRole(systemConfig, effectiveRole)) continue;
        form.button(stripColorCodes(systemConfig.displayName), () => {
          closeReason = "navigation";
          nextPanel = () => buildSystemView({ systemId, player, targetFaction, returnTo: "advanced" })();
          form.close();
        });
      }
    }

    form.divider();

    if (isMenuFeatureVisible("scope", effectiveRole, isAdmin, targetFaction)) {
      form.button(stripColorCodes(ADVANCED_PANEL_BUTTONS.scope), () => {
        closeReason = "navigation";
        nextPanel = () => showScopePanel(player, targetFaction);
        form.close();
      });
    }

    form.button(stripColorCodes(BACK_BUTTON_LABEL), () => {
      closeReason = "navigation";
      nextPanel = () => import("./mainPanel.js").then(({ showMainPanel }) => showMainPanel(player, targetFaction));
      form.close();
    });

    form
      .show()
      .then((reason) => {
        if (reason === "ClientClosed") {
          debugMessage("commandMenuDDUI", `Configuración Avanzada cerrada: X del cliente (${player.name})`, "gray");
          commandMenuSessionStore.cleanup(player.id);
        } else if (reason === "UserBusy") {
          debugWarn("commandMenuDDUI", `Configuración Avanzada cerrada: UserBusy (${player.name})`, "yellow");
          commandMenuSessionStore.cleanup(player.id);
        } else if (reason === "ServerClosed") {
          if (closeReason === "navigation") {
            debugMessage("commandMenuDDUI", `Configuración Avanzada cerrada: navegación (${player.name})`, "gray");
            nextPanel?.();
          } else {
            debugWarn(
              "commandMenuDDUI",
              `Configuración Avanzada cerrada: ServerClosed sin razón (${player.name})`,
              "yellow"
            );
            commandMenuSessionStore.cleanup(player.id);
          }
        }
        closeReason = undefined;
        nextPanel = undefined;
      })
      .catch((err) => {
        debugWarn("commandMenuDDUI", `Error en form.show() avanzada: ${err}`, "red");
        commandMenuSessionStore.cleanup(player.id);
      });
  } catch (e) {
    debugWarn("commandMenuDDUI", `Error en showAdvancedPanel: ${e}`, "red");
  }
}
