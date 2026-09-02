// scripts/utils/lifecycle.ts

import { world } from "@minecraft/server";
import { debugWarn, debugMessage } from "./debug.js";
import { commandMenuSessionStore } from "../gui/commandMenu/ddui/sessionStore.js";
import { interactMenuSessionStore } from "../gui/interactMenu/ddui/interact_ddui_shared.js";
import { monitorMenuSessionStore } from "../gui/monitorMenu/monitor_session.js";

export function registerLifecycleCleanups(): void {
  world.afterEvents.playerLeave.subscribe((event) => {
    try {
      commandMenuSessionStore.cleanup(event.playerId);
    } catch (e) {
      debugWarn("lifecycle", `Error limpiando commandMenu session: ${e}`, "red");
    }
    try {
      commandMenuSessionStore.clearKey(event.playerId);
    } catch (e) {
      debugWarn("lifecycle", `Error limpiando commandMenu feedback: ${e}`, "red");
    }
    try {
      interactMenuSessionStore.cleanup(event.playerId);
    } catch (e) {
      debugWarn("lifecycle", `Error limpiando interactMenu session: ${e}`, "red");
    }
    try {
      monitorMenuSessionStore.cleanup(event.playerId);
    } catch (e) {
      debugWarn("lifecycle", `Error limpiando monitorMenu session: ${e}`, "red");
    }
  });

  debugMessage("lifecycle", "Registro de lifecycle cleanups completado.", "green");
}
