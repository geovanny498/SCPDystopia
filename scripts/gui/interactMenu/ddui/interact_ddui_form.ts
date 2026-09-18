// scripts/gui/interactMenu/ddui/interact_ddui_form.ts

import { CustomForm, DataDrivenScreenClosedReason } from "@minecraft/server-ui";
import { system } from "@minecraft/server";
import { debugWarn, debugMessage, debug } from "../../../utils/debug.js";
import { isGlobalOverwriteAllowed, setGlobalOverwriteAllowed } from "../../shared/entityScope.js";
import { stripColorCodes } from "../../monitorMenu/monitor_config.js";
import { ERROR_MESSAGES } from "../../shared/systemCatalog.js";
import type { MenuCategory } from "../config.js";
import {
  interactMenuSessionStore,
  refreshBasicStatus,
  handleInvalidEntity,
  type InteractDDUISession,
} from "./interact_ddui_shared.js";
import { getUnitGroup } from "../../commandMenu/model/menu_groups.js";
import { PlayerPermissionManager, type RoleId, type FactionId } from "../../shared/playerPermissionManager.js";
import { isSystemVisibleForRole, CATALOG_SYSTEMS, type SystemId } from "../../shared/systemCatalog.js";

/**
 * Muestra el formulario DDUI principal del interactMenu para una entidad.
 *
 * La sesión debe estar ya creada en el store (vía `getOrCreate` desde
 * `interactTrigger.ts`). Las sub-vistas pasan la misma `session` para navegar
 * de regreso sin recrear el store entry.
 *
 * @param session  Sesión activa del jugador+entidad. La sesión cachea
 *   `player`, `entity`, `cfg`, `soldierName`, `displayName`, `typeId` y
 *   `factionInfo`.
 */
export function showInteractDDUI(session: InteractDDUISession): void {
  try {
    session.setView("main");
    debug(
      "interactDDUI",
      `Mostrando Vista §a"${session.viewId}"§r para §b${session.player.name}§r en ${session.soldierName}`,
      {
        color: "blue",
        level: "debug",
      }
    );

    const sessionFactionInfo = session.factionInfo;

    const isAdmin = PlayerPermissionManager.isAdmin(session.player);
    const entityFaction = sessionFactionInfo?.faction ?? "foundation";

    const role: RoleId = isAdmin
      ? "admin"
      : PlayerPermissionManager.getPlayerRole(session.player, entityFaction as FactionId);

    const form = new CustomForm(session.player, `§dMenú de Interacción`);
    session.setForm(form);

    system.run(() => {
      try {
        if (!interactMenuSessionStore.get(session.playerId)) {
          handleInvalidEntity(session.player, form);
          return;
        }
        if (!session.entity.isValid) {
          handleInvalidEntity(session.player, form);
          return;
        }
        form.spacer();
        form.label(`§7Unidad: §f${session.soldierName}`);
        form.spacer();
        refreshBasicStatus(session.entity, sessionFactionInfo, session, session.viewId);
        form.label(session.observables.healthText);
        form.spacer();
        form.label(session.observables.actionResultText);
        form.spacer();

        for (const globalCat of session.cfg.global) {
          if (globalCat.submenu) continue;

          if (globalCat.id) {
            const sysConfig = CATALOG_SYSTEMS[globalCat.id as SystemId];
            if (sysConfig && !isSystemVisibleForRole(sysConfig, role)) {
              continue;
            }
          }

          const entries = globalCat.entries || [];
          if (entries.length === 0) continue;
          const built = session.buildObservableFromEntries(entries, undefined, session.typeId, globalCat.category);
          form.dropdown(stripColorCodes(globalCat.category), built.obs, built.items, { disabled: built.disabled });
        }

        const variantCategories = session.cfg.specific.filter(
          (c: { category: string }) => c.category.trim().length > 0
        );
        for (const variantCat of variantCategories) {
          const entries = variantCat.entries || [];
          if (entries.length === 0) continue;
          const variantObs = session.buildObservableFromEntries(
            entries,
            variantCat.dynamicProperty,
            session.typeId,
            variantCat.category
          );
          form.dropdown(stripColorCodes(variantCat.category), variantObs.obs, variantObs.items, {
            disabled: variantObs.disabled,
          });
        }

        form.spacer();
        let closeReason: "navigation" | undefined = undefined;
        let nextPanel: (() => void) | undefined = undefined;
        let intervalId: number | null = null;

        const advancedMenuCat = session.cfg.global.find((c: MenuCategory) => c.id === "advanced_menu");
        if (advancedMenuCat) {
          form.button(stripColorCodes(advancedMenuCat.category), () => {
            try {
              closeReason = "navigation";
              nextPanel = () =>
                import("./interact_ddui_systems.js").then(({ showInteractDDUISystems }) => {
                  showInteractDDUISystems(session);
                });
              form.close();
            } catch (e) {
              debugWarn("interactDDUI", `Error abriendo Vista Sistemas Avanzados: ${e}`, "red");
            }
          });
        }

        const unitManagementCat = session.cfg.global.find((c: MenuCategory) => c.id === "unit_management");
        if (unitManagementCat) {
          form.button(stripColorCodes(unitManagementCat.category), () => {
            try {
              closeReason = "navigation";
              nextPanel = () =>
                import("./interact_ddui_systems.js").then(({ showInteractDDUIManagement }) => {
                  showInteractDDUIManagement(session);
                });
              form.close();
            } catch (e) {
              debugWarn("interactDDUI", `Error abriendo Vista Gestión y Estado: ${e}`, "red");
            }
          });
        }

        form.button("Historial", () => {
          try {
            closeReason = "navigation";
            nextPanel = () =>
              import("./interact_ddui_systems.js").then(({ showInteractDDUHistory }) => {
                showInteractDDUHistory(session);
              });
            form.close();
          } catch (e) {
            debugWarn("interactDDUI", `Error abriendo Historial: ${e}`, "red");
          }
        });

        form
          .show()
          .then((reason: DataDrivenScreenClosedReason) => {
            if (reason === "ClientClosed") {
              debugMessage(
                "interactDDUI",
                `Vista "${session.viewId}" cerrada: X del cliente (${session.player.name})`,
                "gray"
              );
              interactMenuSessionStore.cleanup(session.playerId);
            } else if (reason === "UserBusy") {
              debugWarn(
                "interactDDUI",
                `Vista "${session.viewId}" cerrada: UserBusy (${session.player.name})`,
                "yellow"
              );
              interactMenuSessionStore.cleanup(session.playerId);
            } else if (reason === "ServerClosed") {
              if (closeReason === "navigation") {
                debugMessage(
                  "interactDDUI",
                  `Vista "${session.viewId}" cerrada: navegación (${session.player.name})`,
                  "gray"
                );
                if (intervalId !== null) {
                  session.unregisterInterval(intervalId);
                }
                if (!session.entity.isValid) {
                  handleInvalidEntity(session.player);
                  return;
                }
                if (!interactMenuSessionStore.get(session.playerId)) {
                  debugMessage(
                    "interactDDUI",
                    `Sesión ya limpiada (entidad muerta), navegación cancelada (${session.player.name})`,
                    "gray"
                  );
                  handleInvalidEntity(session.player, form);
                  return;
                }
                nextPanel?.();
              } else {
                if (!interactMenuSessionStore.get(session.playerId)) {
                  debugMessage(
                    "interactDDUI",
                    `Vista "${session.viewId}" cerrada: sesión limpiada (${session.player.name})`,
                    "gray"
                  );
                } else {
                  debugWarn(
                    "interactDDUI",
                    `Vista "${session.viewId}" cerrada: ServerClosed sin razón (${session.player.name})`,
                    "yellow"
                  );
                  interactMenuSessionStore.cleanup(session.playerId);
                }
              }
            }
            closeReason = undefined;
            nextPanel = undefined;
          })
          .catch((showError) => {
            debugWarn("interactDDUI", `Error en form.show() (${session.viewId}): ${showError}`, "red");
            interactMenuSessionStore.cleanup(session.playerId);
          });

        intervalId = system.runInterval(() => {
          if (!session.entity.isValid) {
            handleInvalidEntity(session.player, form);
            return;
          }
          refreshBasicStatus(session.entity, sessionFactionInfo, session, session.viewId);
        }, 20);
        session.registerInterval(intervalId);
      } catch (setupError) {
        debugWarn("interactDDUI", `Error configurando Vista "${session.viewId}": ${setupError}`, "red");
        interactMenuSessionStore.cleanup(session.playerId);
        try {
          session.player.sendMessage(ERROR_MESSAGES.DDUI_OPEN);
        } catch {}
      }
    });
  } catch (e) {
    debugWarn("interactDDUI", `Error mostrando Vista "${session.viewId}": ${e}`, "red");
    try {
      session.player.sendMessage("§c[DDUI] Error al abrir el menú de interacción.");
    } catch {}
  }
}
