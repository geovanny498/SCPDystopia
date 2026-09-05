// scripts/gui/commandMenu/ddui/panels/scopePanel.ts

import { Player, system } from "@minecraft/server";
import { CustomForm, ObservableBoolean, ObservableString } from "@minecraft/server-ui";
import { debugWarn, debugMessage } from "../../../../utils/debug.js";
import { TargetFaction, FACTION_IDS } from "../../../../constants/domains.js";
import {
  PANEL_TITLES,
  PANEL_DESCRIPTIONS,
  BACK_BUTTON_LABEL,
  ERROR_MESSAGES,
  SCOPE_RESPECT_LABEL,
  SCOPE_GLOBAL_LABEL,
  SCOPE_CONTEXT,
  isMenuFeatureVisible,
} from "../../../shared/systemCatalog.js";
import { PlayerPermissionManager } from "../../../shared/playerPermissionManager.js";
import { loadScope, saveScope, getScopeSummary } from "../../../commandMenu/model/menu_scope.js";
import { commandMenuSessionStore } from "../sessionStore.js";
import { stripColorCodes } from "../helpers/formHelpers.js";
import { addHistoryEntry, getSystemShortName } from "../helpers/historyStore.js";

export function showScopePanel(player: Player, targetFaction?: TargetFaction): void {
  try {
    const isAdmin = PlayerPermissionManager.isAdmin(player);
    if (isAdmin) {
      // admin short-circuit, ok
    } else {
      const foundationRole = PlayerPermissionManager.getPlayerRole(player, "foundation");
      const chaosRole = PlayerPermissionManager.getPlayerRole(player, "chaos");
      const foundationVisible = isMenuFeatureVisible("scope", foundationRole, false, "foundation");
      const chaosVisible = isMenuFeatureVisible("scope", chaosRole, false, "chaos");
      if (!foundationVisible && !chaosVisible) {
        player.sendMessage("§c[SCPDystopia] No tienes permiso para acceder a la prioridad de aplicación.");
        return;
      }
    }

    const scope = loadScope();
    const session = commandMenuSessionStore.get(player.id);
    if (!session) {
      player.sendMessage(ERROR_MESSAGES.NO_SESSION);
      return;
    }
    const effectiveTarget = targetFaction ?? session.getTargetFaction() ?? "both";
    let closeReason: "navigation" | undefined = undefined;

    const form = new CustomForm(player, PANEL_TITLES.scope);

    form.spacer();
    form.label(PANEL_DESCRIPTIONS.scope);
    form.spacer();

    const descriptionText = new ObservableString(getScopeSummary(scope));
    form.label(descriptionText);
    form.spacer();

    const scopeObs = new ObservableBoolean(scope.respectEntityBlocks, { clientWritable: true });
    form.toggle(SCOPE_RESPECT_LABEL, scopeObs);

    scopeObs.subscribe((respectEntityBlocks) => {
      try {
        saveScope({ respectEntityBlocks });
        player.sendMessage(
          `§a[SCPDystopia] Scope actualizado: §f${respectEntityBlocks ? SCOPE_RESPECT_LABEL : SCOPE_GLOBAL_LABEL}`
        );

        descriptionText.setData(getScopeSummary({ respectEntityBlocks }));
        if (effectiveTarget === "both") {
          for (const fac of FACTION_IDS) {
            addHistoryEntry({
              playerName: player.name,
              faction: fac,
              systemShortName: getSystemShortName("scope"),
              key: SCOPE_CONTEXT,
              value: respectEntityBlocks ? SCOPE_RESPECT_LABEL : SCOPE_GLOBAL_LABEL,
            });
          }
        } else {
          addHistoryEntry({
            playerName: player.name,
            faction: effectiveTarget,
            systemShortName: getSystemShortName("scope"),
            key: SCOPE_CONTEXT,
            value: respectEntityBlocks ? SCOPE_RESPECT_LABEL : SCOPE_GLOBAL_LABEL,
          });
        }
      } catch (e) {
        debugWarn("commandMenuDDUI", `Error guardando scope: ${e}`, "red");
        player.sendMessage(ERROR_MESSAGES.SCOPE_SAVE);
      }
    });

    form.spacer();

    form.button(stripColorCodes(BACK_BUTTON_LABEL), () => {
      closeReason = "navigation";
      form.close();
    });

    form
      .show()
      .then((reason) => {
        if (reason === "ClientClosed") {
          debugMessage("commandMenuDDUI", `Scope cerrado: X del cliente (${player.name})`, "gray");
          commandMenuSessionStore.cleanup(player.id);
        } else if (reason === "UserBusy") {
          debugWarn("commandMenuDDUI", `Scope cerrado: UserBusy (${player.name})`, "yellow");
          commandMenuSessionStore.cleanup(player.id);
        } else if (reason === "ServerClosed") {
          if (closeReason === "navigation") {
            debugMessage("commandMenuDDUI", `Scope cerrado: navegación (${player.name})`, "gray");
            import("./advancedPanel.js").then(({ showAdvancedPanel }) => showAdvancedPanel(player, effectiveTarget));
          } else {
            debugWarn("commandMenuDDUI", `Scope cerrado: ServerClosed sin razón (${player.name})`, "yellow");
            commandMenuSessionStore.cleanup(player.id);
          }
        }
        closeReason = undefined;
      })
      .catch((err) => {
        debugWarn("commandMenuDDUI", `Error en form.show() scope: ${err}`, "red");
        commandMenuSessionStore.cleanup(player.id);
      });
  } catch (e) {
    debugWarn("commandMenuDDUI", `Error en showScopePanel: ${e}`, "red");
  }
}
