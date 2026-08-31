// scripts/gui/interactMenu/ddui/interact_ddui_form.ts

import { CustomForm, ObservableNumber, DataDrivenScreenClosedReason } from "@minecraft/server-ui";
import { Player, system, Entity } from "@minecraft/server";
import { debugWarn, debugMessage } from "../../../utils/debug.js";
import { getEntityFactionInfo } from "../../commandMenu/model/menu_faction.js";
import { isGlobalOverwriteAllowed, setGlobalOverwriteAllowed, type EntityConfig } from "../gui.js";
import { stripColorCodes } from "../../monitorMenu/monitor_config.js";
import type { MenuCategory } from "../config.js";
import {
  getOrCreateInteractDDUISession,
  interactMenuSessionStore,
  refreshStatus,
  getLastFeedbackText,
} from "./interact_ddui_shared.js";
import { getUnitGroup } from "../../commandMenu/model/menu_groups.js";
import { SpecialGroupLabels } from "../../commandMenu/menu_config.js";

export function showInteractDDUI(
  player: Player,
  entity: Entity,
  cfg: EntityConfig,
  soldierName: string,
  displayName: string,
  typeId: string
): void {
  try {
    const session = getOrCreateInteractDDUISession(player, entity, cfg, soldierName, displayName, typeId);
    session.viewId = "main";
    debugMessage("interactDDUI", `Mostrando interact DDUI para ${player.name} en ${typeId}`, "cyan");

    const factionInfo = session.factionInfo;

    const form = new CustomForm(player, `§dMenú de Interacción`);

    system.run(() => {
      try {
        session.observables.actionResultText.setData(getLastFeedbackText(entity.id, "main"));
        form.spacer();
        form.label(`§7Unidad: §f${soldierName}`);
        form.spacer();

        function refreshAndUpdateStatus(): void {
          try {
            const status = refreshStatus(entity, factionInfo);
            session.observables.healthText.setData(status.healthLabel);
          } catch (e) {
            debugWarn("interactDDUI", `Error actualizando status: ${e}`, "red");
          }
        }

        refreshAndUpdateStatus();
        form.label(session.observables.healthText);
        form.spacer();
        form.label(session.observables.actionResultText);
        form.spacer();

        for (const globalCat of cfg.global) {
          if (globalCat.submenu) continue;
          const entries = globalCat.entries || [];
          if (entries.length === 0) continue;
          const built = session.buildObservableFromEntries(entries, undefined, typeId, globalCat.category);
          form.dropdown(stripColorCodes(globalCat.category), built.obs, built.items, { disabled: built.disabled });
        }

        const variantCategories = cfg.specific.filter((c: { category: string }) => c.category.trim().length > 0);
        for (const variantCat of variantCategories) {
          const entries = variantCat.entries || [];
          if (entries.length === 0) continue;
          const variantObs = session.buildObservableFromEntries(
            entries,
            variantCat.dynamicProperty,
            typeId,
            variantCat.category
          );
          form.dropdown(stripColorCodes(variantCat.category), variantObs.obs, variantObs.items, {
            disabled: variantObs.disabled,
          });
        }

        form.spacer();
        let closeReason: "navigation" | undefined = undefined;
        let intervalId: number | null = null;

        const advancedMenuCat = cfg.global.find((c: MenuCategory) => c.id === "advanced_menu");
        if (advancedMenuCat) {
          form.button(stripColorCodes(advancedMenuCat.category), () => {
            try {
              closeReason = "navigation";
              form.close();
              system.run(() => {
                import("./interact_ddui_systems.js").then(({ showInteractDDUISystems }) => {
                  showInteractDDUISystems(player, entity, cfg, soldierName, displayName, typeId);
                });
              });
            } catch (e) {
              debugWarn("interactDDUI", `Error abriendo Vista Sistemas Avanzados: ${e}`, "red");
            }
          });
        }

        const unitManagementCat = cfg.global.find((c: MenuCategory) => c.id === "unit_management");
        if (unitManagementCat) {
          form.button(stripColorCodes(unitManagementCat.category), () => {
            try {
              closeReason = "navigation";
              form.close();
              system.run(() => {
                import("./interact_ddui_systems.js").then(({ showInteractDDUIManagement }) => {
                  showInteractDDUIManagement(player, entity, cfg, soldierName, displayName, typeId);
                });
              });
            } catch (e) {
              debugWarn("interactDDUI", `Error abriendo Vista Gestión y Estado: ${e}`, "red");
            }
          });
        }

        form.button("Historial", () => {
          try {
            closeReason = "navigation";
            form.close();
            system.run(() => {
              import("./interact_ddui_systems.js").then(({ showInteractDDUHistory }) => {
                showInteractDDUHistory(player, entity, cfg, soldierName, displayName, typeId);
              });
            });
          } catch (e) {
            debugWarn("interactDDUI", `Error abriendo Historial: ${e}`, "red");
          }
        });

        form
          .show()
          .then((reason: DataDrivenScreenClosedReason) => {
            if (reason === "ClientClosed") {
              debugMessage("interactDDUI", `DDUI cerrado: X del cliente (${player.name})`, "gray");
              interactMenuSessionStore.cleanup(player.id);
            } else if (reason === "UserBusy") {
              debugWarn("interactDDUI", `DDUI cerrado: UserBusy (${player.name})`, "yellow");
              interactMenuSessionStore.cleanup(player.id);
            } else if (reason === "ServerClosed") {
              if (closeReason === "navigation") {
                debugMessage("interactDDUI", `DDUI cerrado: navegación (${player.name})`, "gray");
                if (intervalId !== null) {
                  session.unregisterInterval(intervalId);
                }
              } else {
                debugWarn("interactDDUI", `DDUI cerrado: ServerClosed sin razón (${player.name})`, "yellow");
                interactMenuSessionStore.cleanup(player.id);
              }
            }
            closeReason = undefined;
          })
          .catch((showError) => {
            debugWarn("interactDDUI", `Error en form.show(): ${showError}`, "red");
            interactMenuSessionStore.cleanup(player.id);
          });

        intervalId = system.runInterval(() => {
          refreshAndUpdateStatus();
        }, 20);
        session.registerInterval(intervalId);
      } catch (setupError) {
        debugWarn("interactDDUI", `Error configurando DDUI en system.run: ${setupError}`, "red");
        try {
          player.sendMessage("§c[DDUI] Error al abrir el menú.");
        } catch {}
      }
    });
  } catch (e) {
    debugWarn("interactDDUI", `Error mostrando interact DDUI: ${e}`, "red");
    try {
      player.sendMessage("§c[DDUI] Error al abrir el menú de interacción.");
    } catch {}
  }
}
