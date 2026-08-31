// scripts/gui/commandMenu/ddui/main.ts

import { Player, system, world } from "@minecraft/server";
import { debugWarn, debugMessage } from "../../../utils/debug.js";
import { getRoleInfo } from "./helpers/roleHelpers.js";
import { showMainPanel } from "./panels/mainPanel.js";
import { cleanupCommandMenuSession } from "./sessionStore.js";

export function openCommandMenuDDUI(player: Player): void {
  try {
    const roleInfo = getRoleInfo(player);
    if (!roleInfo) {
      player.sendMessage("§c[SCPDystopia] Necesitas llevar el casco de tu facción para acceder al menú.");
      return;
    }

    debugMessage("commandMenuDDUI", `Abriendo menú DDUI para ${player.name}`, "cyan");
    showMainPanel(player);
  } catch (e) {
    debugWarn("commandMenuDDUI", `Error abriendo menú DDUI: ${e}`, "red");
    player.sendMessage("§c[SCPDystopia] Error al abrir el menú.");
  }
}
