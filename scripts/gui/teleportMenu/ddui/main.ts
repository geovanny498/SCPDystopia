// scripts/gui/teleportMenu/ddui/main.ts

/**
 * Punto de entrada principal para el menú de teletransporte DDUI.
 * Valida permisos de administrador y coordina la apertura del primer panel.
 */

import { Player, system } from "@minecraft/server";
import { debug } from "../../../utils/debug.js";
import { PlayerPermissionManager } from "../../shared/playerPermissionManager.js";
import { teleportMenuSessionStore } from "./sessionStore.js";
import { showMainPanel } from "./panels/mainPanel.js";

/**
 * Abre la interfaz DDUI del menú de teletransporte para un jugador
 * @param player - Jugador que ejecuta el comando
 */
export function openTeleportMenuDDUI(player: Player): void {
  try {
    const isAdmin = PlayerPermissionManager.isAdmin(player);
    if (!isAdmin) {
      player.sendMessage("§c[SCPDystopia] Solo los administradores pueden usar el menú de teletransporte.");
      return;
    }

    debug("teleportMenuDDUI", `Abriendo menú DDUI para §b${player.name}§r`, {
      level: "debug",
      color: "blue",
    });

    system.run(() => {
      try {
        const session = teleportMenuSessionStore.getOrCreate(player);
        showMainPanel(session);
      } catch (err) {
        debug("teleportMenuDDUI", `Error en runtime al mostrar mainPanel: ${err}`, {
          level: "error",
          color: "red",
        });
        player.sendMessage("§c[SCPDystopia] Error al abrir el menú de teletransporte DDUI.");
      }
    });
  } catch (e) {
    debug("teleportMenuDDUI", `Error abriendo menú DDUI: ${e}`, {
      level: "error",
      color: "red",
    });
    player.sendMessage("§c[SCPDystopia] Error al iniciar el menú de teletransporte.");
  }
}
