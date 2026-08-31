// scripts/gui/commandMenu/ddui/panels/historyPanel.ts

import { Player, system } from "@minecraft/server";
import { CustomForm } from "@minecraft/server-ui";
import { debugWarn, debugMessage } from "../../../../utils/debug.js";
import {
  PANEL_TITLES,
  PANEL_DESCRIPTIONS,
  HISTORY_INITIAL_TEXT,
  BACK_BUTTON_LABEL,
  FACTION_DISPLAY_NAMES,
} from "../../../shared/systemCatalog.js";
import { cleanupCommandMenuSession, pauseSession, commandMenuSessionStore } from "../sessionStore.js";
import { stripColorCodes } from "../helpers/formHelpers.js";
import { getHistoryEntries } from "../helpers/historyStore.js";

export function showHistoryPanel(player: Player, targetFaction?: string): void {
  try {
    const session = commandMenuSessionStore.get(player.id);
    const effectiveFaction = targetFaction ?? (session?.formState.targetFaction as string | undefined) ?? "both";
    const entries = getHistoryEntries(effectiveFaction);
    const reversed = entries.slice(-20).reverse();

    let closeReason: "navigation" | undefined = undefined;

    const form = new CustomForm(player, PANEL_TITLES.history);

    form.spacer();
    form.label(PANEL_DESCRIPTIONS.history);
    form.spacer();

    const factionLabel =
      effectiveFaction === "both"
        ? "§7Filtro: §fAmbas facciones"
        : `§7Filtro: §f${FACTION_DISPLAY_NAMES[effectiveFaction as keyof typeof FACTION_DISPLAY_NAMES] ?? effectiveFaction}`;
    form.label(factionLabel);
    form.spacer();

    if (reversed.length === 0) {
      form.label(HISTORY_INITIAL_TEXT);
    } else {
      const lines = reversed
        .map((e) => {
          const facName = FACTION_DISPLAY_NAMES[e.faction as keyof typeof FACTION_DISPLAY_NAMES] ?? e.faction;
          return `§8[${e.timestamp}] §7${facName} | ${e.playerName}: ${e.systemShortName} ${e.key} → ${e.value}`;
        })
        .join("\n");
      form.label(lines);
    }

    form.spacer();

    form.button(stripColorCodes(BACK_BUTTON_LABEL), () => {
      closeReason = "navigation";
      form.close();
      system.run(() => import("./mainPanel.js").then(({ showMainPanel }) => showMainPanel(player)));
    });

    form
      .show()
      .then((reason) => {
        if (reason === "ClientClosed") {
          debugMessage("commandMenuDDUI", `Historial cerrado: X del cliente (${player.name})`, "gray");
          pauseSession(player.id);
        } else if (reason === "UserBusy") {
          debugWarn("commandMenuDDUI", `Historial cerrado: UserBusy (${player.name})`, "yellow");
          cleanupCommandMenuSession(player.id);
        } else if (reason === "ServerClosed") {
          if (closeReason === "navigation") {
            debugMessage("commandMenuDDUI", `Historial cerrado: navegación (${player.name})`, "gray");
          } else {
            debugWarn("commandMenuDDUI", `Historial cerrado: ServerClosed sin razón (${player.name})`, "yellow");
            cleanupCommandMenuSession(player.id);
          }
        }
        closeReason = undefined;
      })
      .catch((err) => {
        debugWarn("commandMenuDDUI", `Error en form.show() historial: ${err}`, "red");
        cleanupCommandMenuSession(player.id);
      });
  } catch (e) {
    debugWarn("commandMenuDDUI", `Error en showHistoryPanel: ${e}`, "red");
  }
}
