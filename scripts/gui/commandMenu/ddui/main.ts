// scripts/gui/commandMenu/ddui/main.ts

import { Player, system, world } from "@minecraft/server";
import { debugWarn, debugMessage } from "../../../utils/debug.js";
import { ERROR_MESSAGES } from "../../shared/systemCatalog.js";
import { PlayerPermissionManager } from "../../shared/playerPermissionManager.js";
import { EquipmentDetector } from "../../shared/equipmentDetector.js";
import { showMainPanel } from "./panels/mainPanel.js";
import { commandMenuSessionStore } from "./sessionStore.js";

export function openCommandMenuDDUI(player: Player): void {
  try {
    const isAdmin = PlayerPermissionManager.isAdmin(player);
    const helmetFaction = EquipmentDetector.getActiveFaction(player);

    if (!helmetFaction && !isAdmin) {
      player.sendMessage(ERROR_MESSAGES.NEED_FACTION_HELMET);
      return;
    }

    debugMessage("commandMenuDDUI", `Abriendo menú DDUI para ${player.name}`, "cyan");
    showMainPanel(player);
  } catch (e) {
    debugWarn("commandMenuDDUI", `Error abriendo menú DDUI: ${e}`, "red");
    player.sendMessage(ERROR_MESSAGES.OPEN_MENU);
  }
}
