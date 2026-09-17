// scripts/gui/commandMenu/ddui/panels/historyPanel.ts

import { Player, system } from "@minecraft/server";
import { CustomForm } from "@minecraft/server-ui";
import { debugWarn, debugMessage } from "../../../../utils/debug.js";
import { TargetFaction, Factions } from "../../../../constants/domains.js";
import {
  PANEL_TITLES,
  PANEL_DESCRIPTIONS,
  HISTORY_INITIAL_TEXT,
  BACK_BUTTON_LABEL,
  FACTION_DISPLAY_NAMES,
  isMenuFeatureVisible,
} from "../../../shared/systemCatalog.js";
import { PlayerPermissionManager, type FactionId, type RoleId } from "../../../shared/playerPermissionManager.js";
import { commandMenuSessionStore } from "../sessionStore.js";
import { stripColorCodes } from "../helpers/formHelpers.js";
import { getHistoryEntries } from "../helpers/historyStore.js";

export function showHistoryPanel(player: Player, targetFaction?: TargetFaction): void {
  try {
    const isAdmin = PlayerPermissionManager.isAdmin(player);
    const role = PlayerPermissionManager.getPlayerRole(
      player,
      (targetFaction && targetFaction !== "both" ? targetFaction : Factions.FOUNDATION) as FactionId
    );
    if (!isMenuFeatureVisible("history", role, isAdmin, targetFaction)) {
      player.sendMessage("§c[SCPDystopia] No tienes permiso para ver el historial de comandos.");
      return;
    }

    const session = commandMenuSessionStore.get(player.id);
    const effectiveFaction = targetFaction ?? session?.getTargetFaction() ?? "both";
    const entries = getHistoryEntries(effectiveFaction);
    const reversed = entries.slice(-20).reverse();

    let closeReason: "navigation" | undefined = undefined;

    const form = new CustomForm(player, PANEL_TITLES.history);

    form.spacer();
    form.label(PANEL_DESCRIPTIONS.history);
    form.spacer();

    const factionLabel =
      effectiveFaction === "both"
        ? `§7Filtro: ${FACTION_DISPLAY_NAMES.both} §8(${entries.length} entradas)§r`
        : `§7Filtro: §f${FACTION_DISPLAY_NAMES[effectiveFaction as keyof typeof FACTION_DISPLAY_NAMES] ?? effectiveFaction} §8(${entries.length} entradas)§r`;
    form.label(factionLabel);
    form.spacer();

    if (reversed.length === 0) {
      form.label(HISTORY_INITIAL_TEXT);
    } else {
      const lines = reversed
        .map((e, i) => {
          const facName = FACTION_DISPLAY_NAMES[e.faction as keyof typeof FACTION_DISPLAY_NAMES] ?? e.faction;
          return `§8${i + 1}.§r §7[${e.timestamp}] §r${facName} \n§7${e.playerName}: ${e.systemShortName} \n${e.key} -> ${e.value}`;
        })
        .join("\n");
      form.label(lines);
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
          debugMessage("commandMenuDDUI", `Historial cerrado: X del cliente (${player.name})`, "gray");
          commandMenuSessionStore.cleanup(player.id);
        } else if (reason === "UserBusy") {
          debugWarn("commandMenuDDUI", `Historial cerrado: UserBusy (${player.name})`, "yellow");
          commandMenuSessionStore.cleanup(player.id);
        } else if (reason === "ServerClosed") {
          if (closeReason === "navigation") {
            debugMessage("commandMenuDDUI", `Historial cerrado: navegación (${player.name})`, "gray");
            import("./mainPanel.js").then(({ showMainPanel }) => showMainPanel(player, effectiveFaction));
          } else {
            debugWarn("commandMenuDDUI", `Historial cerrado: ServerClosed sin razón (${player.name})`, "yellow");
            commandMenuSessionStore.cleanup(player.id);
          }
        }
        closeReason = undefined;
      })
      .catch((err) => {
        debugWarn("commandMenuDDUI", `Error en form.show() historial: ${err}`, "red");
        commandMenuSessionStore.cleanup(player.id);
      });
  } catch (e) {
    debugWarn("commandMenuDDUI", `Error en showHistoryPanel: ${e}`, "red");
  }
}
