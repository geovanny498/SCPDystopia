// scripts/gui/commandMenu/ddui/panels/scopePanel.ts

import { Player, system } from "@minecraft/server";
import { CustomForm, ObservableBoolean, ObservableString } from "@minecraft/server-ui";
import { debug } from "../../../../utils/debug.js";
import { TargetFaction, FACTION_IDS } from "../../../../constants/domains.js";
import {
  PANEL_TITLES,
  PANEL_DESCRIPTIONS,
  BACK_BUTTON_LABEL,
  ERROR_MESSAGES,
  SCOPE_RESPECT_LABEL,
  SCOPE_GLOBAL_LABEL,
  SCOPE_CONTEXT,
  SYSTEM_SHORT_NAMES,
  isMenuFeatureVisible,
} from "../../../shared/systemCatalog.js";
import { SCOPE_PANEL_FEEDBACK_INITIAL } from "../../../shared/dduiFeedback.js";
import { PlayerPermissionManager } from "../../../shared/playerPermissionManager.js";
import { loadScope, saveScope } from "../../../commandMenu/model/menu_scope.js";
import { commandMenuSessionStore } from "../sessionStore.js";
import { stripColorCodes } from "../helpers/formHelpers.js";
import { addHistoryEntry, getSystemShortName } from "../helpers/historyStore.js";

/**
 * Muestra el panel de configuración de Prioridad de Aplicación (Scope) por facción.
 * @param {Player} player - Jugador que abre el panel
 * @param {TargetFaction} [targetFaction] - Facción objetivo del panel o sesión
 */
export function showScopePanel(player: Player, targetFaction?: TargetFaction): void {
  try {
    const session = commandMenuSessionStore.get(player.id);
    if (!session) {
      player.sendMessage(ERROR_MESSAGES.NO_SESSION);
      return;
    }
    const effectiveTarget: TargetFaction = targetFaction ?? session.getTargetFaction() ?? "both";

    const isAdmin = PlayerPermissionManager.isAdmin(player);
    let canFoundation = isAdmin;
    let canChaos = isAdmin;

    if (!isAdmin) {
      const foundationRole = PlayerPermissionManager.getPlayerRole(player, "foundation");
      const chaosRole = PlayerPermissionManager.getPlayerRole(player, "chaos");
      canFoundation = isMenuFeatureVisible("scope", foundationRole, false, "foundation");
      canChaos = isMenuFeatureVisible("scope", chaosRole, false, "chaos");

      if (effectiveTarget === "foundation" && !canFoundation) {
        player.sendMessage(
          "§c[SCPDystopia] No tienes permiso para acceder a la prioridad de aplicación de Foundation."
        );
        return;
      }
      if (effectiveTarget === "chaos" && !canChaos) {
        player.sendMessage("§c[SCPDystopia] No tienes permiso para acceder a la prioridad de aplicación de Chaos.");
        return;
      }
      if (effectiveTarget === "both" && !canFoundation && !canChaos) {
        player.sendMessage("§c[SCPDystopia] No tienes permiso para acceder a la prioridad de aplicación.");
        return;
      }
    }

    const scope = loadScope();
    let closeReason: "navigation" | undefined = undefined;

    const form = new CustomForm(player, PANEL_TITLES.scope);

    form.spacer();
    form.label(PANEL_DESCRIPTIONS.scope);
    form.spacer();

    const feedbackPresenter = session.getOrCreateFeedbackPresenter(
      `commandMenu:${effectiveTarget}:scope`,
      SCOPE_PANEL_FEEDBACK_INITIAL
    );
    form.label(feedbackPresenter.getObservable());
    form.spacer();

    const showFoundationToggle = (effectiveTarget === "both" || effectiveTarget === "foundation") && canFoundation;
    const showChaosToggle = (effectiveTarget === "both" || effectiveTarget === "chaos") && canChaos;

    if (showFoundationToggle) {
      const foundationLabel = new ObservableString(
        `Foundation: ${scope.foundation.respectEntityBlocks ? SCOPE_RESPECT_LABEL : SCOPE_GLOBAL_LABEL}`
      );
      const foundationObs = new ObservableBoolean(scope.foundation.respectEntityBlocks, { clientWritable: true });
      form.toggle(foundationLabel, foundationObs);

      foundationObs.subscribe((respectEntityBlocks) => {
        try {
          scope.foundation.respectEntityBlocks = respectEntityBlocks;
          saveScope(scope);
          player.sendMessage(
            `§a[SCPDystopia] Scope Foundation actualizado: §f${respectEntityBlocks ? SCOPE_RESPECT_LABEL : SCOPE_GLOBAL_LABEL}`
          );

          foundationLabel.setData(
            `Foundation: ${respectEntityBlocks ? SCOPE_RESPECT_LABEL : SCOPE_GLOBAL_LABEL}`
          );
          feedbackPresenter.present({
            context: SYSTEM_SHORT_NAMES.scope,
            value: `Foundation: ${respectEntityBlocks ? SCOPE_RESPECT_LABEL : SCOPE_GLOBAL_LABEL}`,
            status: "ok",
          });
          addHistoryEntry({
            playerName: player.name,
            faction: "foundation",
            systemShortName: getSystemShortName("scope"),
            key: SCOPE_CONTEXT,
            value: respectEntityBlocks ? SCOPE_RESPECT_LABEL : SCOPE_GLOBAL_LABEL,
          });
        } catch (e) {
          debug("commandMenuDDUI", `Error guardando scope Foundation: ${e}`, { level: "error", color: "red" });
          feedbackPresenter.present({
            context: SYSTEM_SHORT_NAMES.scope,
            value: `Foundation: ${ERROR_MESSAGES.SCOPE_SAVE}`,
            status: "error",
          });
          player.sendMessage(ERROR_MESSAGES.SCOPE_SAVE);
        }
      });
    }

    if (showChaosToggle) {
      const chaosLabel = new ObservableString(
        `Chaos: ${scope.chaos.respectEntityBlocks ? SCOPE_RESPECT_LABEL : SCOPE_GLOBAL_LABEL}`
      );
      const chaosObs = new ObservableBoolean(scope.chaos.respectEntityBlocks, { clientWritable: true });
      form.toggle(chaosLabel, chaosObs);

      chaosObs.subscribe((respectEntityBlocks) => {
        try {
          scope.chaos.respectEntityBlocks = respectEntityBlocks;
          saveScope(scope);
          player.sendMessage(
            `§a[SCPDystopia] Scope Chaos actualizado: §f${respectEntityBlocks ? SCOPE_RESPECT_LABEL : SCOPE_GLOBAL_LABEL}`
          );

          chaosLabel.setData(`Chaos: ${respectEntityBlocks ? SCOPE_RESPECT_LABEL : SCOPE_GLOBAL_LABEL}`);
          feedbackPresenter.present({
            context: SYSTEM_SHORT_NAMES.scope,
            value: `Chaos: ${respectEntityBlocks ? SCOPE_RESPECT_LABEL : SCOPE_GLOBAL_LABEL}`,
            status: "ok",
          });
          addHistoryEntry({
            playerName: player.name,
            faction: "chaos",
            systemShortName: getSystemShortName("scope"),
            key: SCOPE_CONTEXT,
            value: respectEntityBlocks ? SCOPE_RESPECT_LABEL : SCOPE_GLOBAL_LABEL,
          });
        } catch (e) {
          debug("commandMenuDDUI", `Error guardando scope Chaos: ${e}`, { level: "error", color: "red" });
          feedbackPresenter.present({
            context: SYSTEM_SHORT_NAMES.scope,
            value: `Chaos: ${ERROR_MESSAGES.SCOPE_SAVE}`,
            status: "error",
          });
          player.sendMessage(ERROR_MESSAGES.SCOPE_SAVE);
        }
      });
    }

    form.spacer();

    form.button(stripColorCodes(BACK_BUTTON_LABEL), () => {
      closeReason = "navigation";
      form.close();
    });

    form
      .show()
      .then((reason) => {
        if (reason === "ClientClosed") {
          debug("commandMenuDDUI", `Scope cerrado: X del cliente (§b${player.name}§r)`, {
            level: "debug",
            color: "gray",
          });
          commandMenuSessionStore.cleanup(player.id);
        } else if (reason === "UserBusy") {
          debug("commandMenuDDUI", `Scope cerrado: §6UserBusy§r (§b${player.name}§r)`, {
            level: "warn",
            color: "gray",
          });
          commandMenuSessionStore.cleanup(player.id);
        } else if (reason === "ServerClosed") {
          if (closeReason === "navigation") {
            debug("commandMenuDDUI", `Scope cerrado: §6navegación§r (§b${player.name}§r)`, {
              level: "debug",
              color: "gray",
            });
            import("./advancedPanel.js").then(({ showAdvancedPanel }) => showAdvancedPanel(player, effectiveTarget));
          } else {
            debug("commandMenuDDUI", `Scope cerrado: §cServerClosed sin razón§r (§b${player.name}§r)`, {
              level: "warn",
              color: "gray",
            });
            commandMenuSessionStore.cleanup(player.id);
          }
        }
        closeReason = undefined;
      })
      .catch((err) => {
        debug("commandMenuDDUI", `Error en form.show() scope: ${err}`, { level: "error", color: "red" });
        commandMenuSessionStore.cleanup(player.id);
      });
  } catch (e) {
    debug("commandMenuDDUI", `Error en showScopePanel: ${e}`, { level: "error", color: "red" });
  }
}
