// scripts/gui/commandMenu/ddui/panels/advancedPanel.ts

import { Player, system } from "@minecraft/server";
import { CustomForm } from "@minecraft/server-ui";
import { debug } from "../../../../utils/debug.js";
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
          debug("commandMenuDDUI", `Configuración Avanzada cerrada: X del cliente (§b${player.name}§r)`, {
            level: "debug",
            color: "gray",
          });
          commandMenuSessionStore.cleanup(player.id);
        } else if (reason === "UserBusy") {
          debug("commandMenuDDUI", `Configuración Avanzada cerrada: §6UserBusy§r (§b${player.name}§r)`, {
            level: "warn",
            color: "gray",
          });
          commandMenuSessionStore.cleanup(player.id);
        } else if (reason === "ServerClosed") {
          if (closeReason === "navigation") {
            debug("commandMenuDDUI", `Configuración Avanzada cerrada: §6navegación§r (§b${player.name}§r)`, {
              level: "debug",
              color: "gray",
            });
            nextPanel?.();
          } else {
            debug(
              "commandMenuDDUI",
              `Configuración Avanzada cerrada: §cServerClosed sin razón§r (§b${player.name}§r)`,
              { level: "warn", color: "yellow" }
            );
            commandMenuSessionStore.cleanup(player.id);
          }
        }
        closeReason = undefined;
        nextPanel = undefined;
      })
      .catch((err) => {
        debug("commandMenuDDUI", `Error en form.show() avanzada: ${err}`, { level: "error", color: "red" });
        commandMenuSessionStore.cleanup(player.id);
      });
  } catch (e) {
    debug("commandMenuDDUI", `Error en showAdvancedPanel: ${e}`, { level: "error", color: "red" });
  }
}
