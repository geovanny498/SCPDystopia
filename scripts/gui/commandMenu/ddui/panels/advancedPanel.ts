// scripts/gui/commandMenu/ddui/panels/advancedPanel.ts

import { Player, system } from "@minecraft/server";
import { CustomForm } from "@minecraft/server-ui";
import { debugWarn, debugMessage } from "../../../../utils/debug.js";
import {
  PANEL_TITLES,
  PANEL_DESCRIPTIONS,
  ADVANCED_PANEL_BUTTONS,
  BACK_BUTTON_LABEL,
  CATALOG_CATEGORIES,
  CATALOG_SYSTEMS,
} from "../../../shared/systemCatalog.js";
import { showScopePanel } from "./scopePanel.js";
import { cleanupSession, pauseSession } from "../sessionStore.js";
import { buildSystemView } from "../builders/systemBuilder.js";
import { stripColorCodes } from "../helpers/formHelpers.js";

export function showAdvancedPanel(player: Player, targetFaction: string = "foundation"): void {
  try {
    const form = new CustomForm(player, PANEL_TITLES.advanced);

    form.spacer();
    form.label(PANEL_DESCRIPTIONS.advanced);
    form.spacer();

    const advancedCategory = CATALOG_CATEGORIES.advanced;
    if (advancedCategory) {
      for (const systemId of advancedCategory.systemIds) {
        const systemConfig = CATALOG_SYSTEMS[systemId];
        if (!systemConfig) continue;
        form.button(stripColorCodes(systemConfig.displayName), () => {
          form.close();
          system.run(() => buildSystemView({ systemId, player, targetFaction, returnTo: "advanced" })());
        });
      }
    }

    form.divider();

    form.button(stripColorCodes(ADVANCED_PANEL_BUTTONS.scope), () => {
      form.close();
      system.run(() => showScopePanel(player));
    });

    form.button(stripColorCodes(BACK_BUTTON_LABEL), () => {
      form.close();
      system.run(() => import("./mainPanel.js").then(({ showMainPanel }) => showMainPanel(player)));
    });

    form.show().then((reason) => {
      debugMessage("commandMenuDDUI", `Configuración Avanzada cerrada: ${reason}`, "gray");
      if (reason === "ClientClosed") {
        pauseSession(player.id);
      }
    }).catch((err) => {
      debugWarn("commandMenuDDUI", `Error en form.show() avanzada: ${err}`, "red");
      cleanupSession(player.id);
    });
  } catch (e) {
    debugWarn("commandMenuDDUI", `Error en showAdvancedPanel: ${e}`, "red");
  }
}
