// scripts/utils/lifecycle.ts

import { world } from "@minecraft/server";
import { debug } from "./debug.js";
import { commandMenuSessionStore } from "../gui/commandMenu/ddui/sessionStore.js";
import { interactMenuSessionStore } from "../gui/interactMenu/ddui/interact_ddui_shared.js";
import { monitorMenuSessionStore } from "../gui/monitorMenu/monitor_session.js";

export function registerLifecycleCleanups(): void {
  world.afterEvents.playerLeave.subscribe((event) => {
    try {
      commandMenuSessionStore.cleanup(event.playerId);
    } catch (e) {
      debug("lifecycle", `Error limpiando commandMenu session: ${e}`, { level: "error", color: "red" });
    }
    try {
      commandMenuSessionStore.clearKey(event.playerId);
    } catch (e) {
      debug("lifecycle", `Error limpiando commandMenu feedback: ${e}`, { level: "error", color: "red" });
    }
    try {
      interactMenuSessionStore.cleanup(event.playerId);
    } catch (e) {
      debug("lifecycle", `Error limpiando interactMenu session: ${e}`, { level: "error", color: "red" });
    }
    try {
      interactMenuSessionStore.clearPlayerFeedback(event.playerId);
    } catch (e) {
      debug("lifecycle", `Error limpiando interactMenu feedback: ${e}`, { level: "error", color: "red" });
    }
    try {
      monitorMenuSessionStore.cleanup(event.playerId);
    } catch (e) {
      debug("lifecycle", `Error limpiando monitorMenu session: ${e}`, { level: "error", color: "red" });
    }
    debug("lifecycle", `§b${event.playerName}§r se desconectó`, { level: "debug", color: "green" });
  });

  debug("lifecycle", "Registro de lifecycle cleanups completado.", { level: "debug", color: "light_purple" });
}
