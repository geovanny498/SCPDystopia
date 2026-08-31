// scripts/gui/commandMenu/ddui/panels/scopePanel.ts

import { Player, system } from "@minecraft/server";
import { CustomForm, ObservableBoolean, ObservableString } from "@minecraft/server-ui";
import { debugWarn, debugMessage } from "../../../../utils/debug.js";
import { PANEL_TITLES, PANEL_DESCRIPTIONS, BACK_BUTTON_LABEL } from "../../../shared/systemCatalog.js";
import { SCOPE_TOGGLE_LABEL } from "../../../shared/entityScope.js";
import { loadScope, saveScope, getScopeSummary } from "../../../commandMenu/model/menu_scope.js";
import { cleanupCommandMenuSession, pauseSession, commandMenuSessionStore } from "../sessionStore.js";
import { stripColorCodes } from "../helpers/formHelpers.js";
import { addHistoryEntry, getSystemShortName } from "../helpers/historyStore.js";

export function showScopePanel(player: Player): void {
  try {
    const scope = loadScope();
    const session = commandMenuSessionStore.get(player.id);
    let closeReason: "navigation" | undefined = undefined;

    const form = new CustomForm(player, PANEL_TITLES.scope);

    form.spacer();
    form.label(PANEL_DESCRIPTIONS.scope);
    form.spacer();

    const descriptionText = new ObservableString(getScopeSummary(scope));
    form.label(descriptionText);
    form.spacer();

    const feedbackText = new ObservableString("§7Último cambio: §fN/A");
    form.label(feedbackText);
    form.spacer();

    const scopeObs = new ObservableBoolean(scope.respectEntityBlocks, { clientWritable: true });
    form.toggle(SCOPE_TOGGLE_LABEL, scopeObs);

    scopeObs.subscribe((respectEntityBlocks) => {
      try {
        saveScope({ respectEntityBlocks });
        player.sendMessage(
          `§a[SCPDystopia] Scope actualizado: §f${respectEntityBlocks ? "Respetar bloqueos" : "Aplicar global"}`
        );

        descriptionText.setData(getScopeSummary({ respectEntityBlocks }));
        feedbackText.setData(
          `§a✓ Prioridad de Aplicación: §f${respectEntityBlocks ? "Respetar bloqueos" : "Aplicar global"}`
        );

        if (session) {
          addHistoryEntry({
            playerName: player.name,
            faction: (session.formState.targetFaction as string) ?? "both",
            systemShortName: getSystemShortName("scope"),
            key: "Prioridad de Aplicación",
            value: respectEntityBlocks ? "Respetar bloqueos" : "Aplicar global",
          });
        }
      } catch (e) {
        debugWarn("commandMenuDDUI", `Error guardando scope: ${e}`, "red");
        player.sendMessage("§c[SCPDystopia] Error guardando scope.");
      }
    });

    form.spacer();

    form.button(stripColorCodes(BACK_BUTTON_LABEL), () => {
      closeReason = "navigation";
      form.close();
      system.run(() => import("./advancedPanel.js").then(({ showAdvancedPanel }) => showAdvancedPanel(player)));
    });

    form
      .show()
      .then((reason) => {
        if (reason === "ClientClosed") {
          debugMessage("commandMenuDDUI", `Scope cerrado: X del cliente (${player.name})`, "gray");
          pauseSession(player.id);
        } else if (reason === "UserBusy") {
          debugWarn("commandMenuDDUI", `Scope cerrado: UserBusy (${player.name})`, "yellow");
          cleanupCommandMenuSession(player.id);
        } else if (reason === "ServerClosed") {
          if (closeReason === "navigation") {
            debugMessage("commandMenuDDUI", `Scope cerrado: navegación (${player.name})`, "gray");
          } else {
            debugWarn("commandMenuDDUI", `Scope cerrado: ServerClosed sin razón (${player.name})`, "yellow");
            cleanupCommandMenuSession(player.id);
          }
        }
        closeReason = undefined;
      })
      .catch((err) => {
        debugWarn("commandMenuDDUI", `Error en form.show() scope: ${err}`, "red");
        cleanupCommandMenuSession(player.id);
      });
  } catch (e) {
    debugWarn("commandMenuDDUI", `Error en showScopePanel: ${e}`, "red");
  }
}
