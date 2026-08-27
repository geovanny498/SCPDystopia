// scripts/gui/interactMenu/interact_ddui_systems.ts

import { CustomForm, ObservableNumber, ObservableBoolean, ObservableString, DataDrivenScreenClosedReason } from "@minecraft/server-ui";
import { Player, system, Entity } from "@minecraft/server";
import { debugWarn, debugMessage } from "../../utils/debug.js";
import { getEntityFactionInfo } from "../commandMenu/model/menu_faction.js";
import { isGlobalOverwriteAllowed, setGlobalOverwriteAllowed, isAllowedByRule, type EntityConfig } from "./gui.js";
import { stripColorCodes } from "../monitorMenu/monitor_config.js";
import type { MenuCategory } from "./config.js";
import {
  getOrCreateInteractDDUISession,
  removeInteractDDUISession,
  buildObservableFromEntries,
  refreshStatus,
  getLastFeedbackText,
  applyEntryAction,
  setLastFeedbackText,
  buildFeedback,
  getHistory,
  recordFeedback,
} from "./interact_ddui_shared.js";
import { getEntitySystemState, findSystemStateByEvent, SpecialGroups, UnitHierarchy, UnitHierarchyLabels, Factions } from "../commandMenu/menu_config.js";
import { getUnitGroup, setUnitGroup } from "../commandMenu/model/menu_groups.js";
import { SpecialGroupLabels } from "../commandMenu/menu_config.js";

export function showInteractDDUISystems(
  player: Player,
  entity: Entity,
  cfg: EntityConfig,
  soldierName: string,
  displayName: string,
  typeId: string
): void {
  try {
    const session = getOrCreateInteractDDUISession(player, entity, cfg, soldierName, displayName, typeId);
    session.viewId = "systems";
    debugMessage("interactDDUI", `Mostrando Vista Sistemas Avanzados para ${player.name} en ${typeId}`, "cyan");

    const form = new CustomForm(player, `§6Sistemas Avanzados`);

    system.run(() => {
      try {
        const intervalState = { current: null as number | null };
        session.observables.actionResultText.setData(getLastFeedbackText(entity.id, "systems"));
        form.spacer();
        form.label(`§7Unidad: §f${soldierName}`);
        form.spacer();

        function refreshAndUpdateStatus(): void {
          try {
            const status = refreshStatus(entity, session.factionInfo);
            session.observables.healthText.setData(status.healthLabel);
          } catch (e) {
            debugWarn("interactDDUI", `Error actualizando status en sistemas avanzados: ${e}`, "red");
          }
        }

        refreshAndUpdateStatus();
        form.label(session.observables.healthText);
        form.spacer();
        form.label(session.observables.actionResultText);
        form.spacer();

        const advancedCategories = cfg.submenus?.advanced?.categories || [];
        const TOGGLE_SYSTEMS = new Set(["spawn", "health", "invincible"]);

        for (const adv of advancedCategories) {
          const entries = adv.entries || [];
          if (entries.length === 0 || !adv.id) continue;

          const isToggleSystem = TOGGLE_SYSTEMS.has(adv.id);

          if (isToggleSystem) {
            let enableEvent: string | undefined;
            let disableEvent: string | undefined;
            for (const entry of entries) {
              if (!entry.event) continue;
              const mapped = findSystemStateByEvent(entry.event);
              if (mapped?.value === true) enableEvent = entry.event;
              if (mapped?.value === false) disableEvent = entry.event;
            }

            const currentRaw = getEntitySystemState(entity, adv.id);
            const initialValue = typeof currentRaw === "boolean" ? currentRaw : false;
            const toggleObs = new ObservableBoolean(initialValue, { clientWritable: true });
            let lastValue = initialValue;
            toggleObs.subscribe((newValue) => {
              if (newValue === lastValue) return;
              const targetEvent = newValue ? enableEvent : disableEvent;
              const targetEntry = entries.find((e) => e.event === targetEvent);
              if (targetEntry) {
                applyEntryAction(session, targetEntry, undefined, adv.category);
              }
              lastValue = newValue;
            });
            const toggleDisabled = !isAllowedByRule(adv.id, typeId);
            form.toggle(stripColorCodes(adv.category), toggleObs, {
              description: adv.description ? stripColorCodes(adv.description) : undefined,
              disabled: toggleDisabled,
            });
          } else {
            const built = buildObservableFromEntries(
              entries,
              session,
              undefined,
              typeId,
              adv.category
            );
            form.dropdown(stripColorCodes(adv.category), built.obs, built.items, { disabled: built.disabled });
          }
        }

        form.spacer();
        form.button("<- Volver", () => {
          try {
            form.close();
            system.run(() => {
              import("./interact_ddui_form.js").then(({ showInteractDDUI }) => {
                showInteractDDUI(player, entity, cfg, soldierName, displayName, typeId);
              });
            });
          } catch (e) {
            debugWarn("interactDDUI", `Error volviendo a Vista Principal: ${e}`, "red");
          }
        });

        form
          .show()
          .then((reason: DataDrivenScreenClosedReason) => {
            debugMessage("interactDDUI", `Vista Sistemas Avanzados cerrada: ${reason}`, "gray");
            if (intervalState.current !== null) {
              system.clearRun(intervalState.current);
              intervalState.current = null;
            }
            if (reason === "ClientClosed") {
              removeInteractDDUISession(player, entity);
            }
          })
          .catch((showError) => {
            debugWarn("interactDDUI", `Error en form.show() sistemas avanzados: ${showError}`, "red");
            if (intervalState.current !== null) {
              system.clearRun(intervalState.current);
              intervalState.current = null;
            }
            removeInteractDDUISession(player, entity);
          });

        intervalState.current = system.runInterval(() => {
          refreshAndUpdateStatus();
        }, 20);
      } catch (setupError) {
        debugWarn("interactDDUI", `Error configurando Vista Sistemas Avanzados: ${setupError}`, "red");
        try {
          player.sendMessage("§c[DDUI] Error al abrir el menú de sistemas avanzados.");
        } catch {}
      }
    });
  } catch (e) {
    debugWarn("interactDDUI", `Error mostrando Vista Sistemas Avanzados: ${e}`, "red");
    try {
      player.sendMessage("§c[DDUI] Error al abrir el menú de sistemas avanzados.");
    } catch {}
  }
}

export function showInteractDDUIManagement(
  player: Player,
  entity: Entity,
  cfg: EntityConfig,
  soldierName: string,
  displayName: string,
  typeId: string
): void {
  try {
    const session = getOrCreateInteractDDUISession(player, entity, cfg, soldierName, displayName, typeId);
    session.viewId = "management";
    debugMessage("interactDDUI", `Mostrando Vista Gestión y Estado para ${player.name} en ${typeId}`, "cyan");

    const factionInfo = session.factionInfo;

    const form = new CustomForm(player, `§dGestión y Estado`);

    system.run(() => {
      try {
        const intervalState = { current: null as number | null };
        session.observables.actionResultText.setData(getLastFeedbackText(entity.id, "management"));
        form.spacer();
        form.label(`§7Unidad: §f${soldierName}`);
        form.spacer();

        function refreshAndUpdateStatus(): void {
          try {
            const status = refreshStatus(entity, factionInfo);
            session.observables.healthText.setData(status.healthLabel);
            session.observables.systemStateDetailText.setData(status.systemStateDetail);

            if (factionInfo) {
              const factionLabel =
                factionInfo.faction === Factions.FOUNDATION
                  ? "§lFoundation"
                  : factionInfo.faction === Factions.CHAOS
                    ? "§2§lChaos"
                    : factionInfo.faction;

              if (factionInfo.isSpecial) {
                const groupId = getUnitGroup(entity) ?? SpecialGroups.NO_GROUP;
                const groupLabel = SpecialGroupLabels[groupId] || String(groupId);
                session.observables.groupDetailText.setData(`§7Facción: §a${factionLabel}\n§7Grupo actual: §a${groupLabel}`);
              } else {
                const hierarchyLabel = UnitHierarchyLabels[factionInfo.hierarchy ?? UnitHierarchy.BASIC] || String(factionInfo.hierarchy ?? UnitHierarchy.BASIC);
                session.observables.groupDetailText.setData(`§7Facción: §a${factionLabel}\n§7Jerarquia: §a${hierarchyLabel}`);
              }
            } else {
              session.observables.groupDetailText.setData("");
            }
          } catch (e) {
            debugWarn("interactDDUI", `Error actualizando status en gestión/estado: ${e}`, "red");
          }
        }

        refreshAndUpdateStatus();
        form.label(session.observables.healthText);
        form.spacer();
        form.label(session.observables.actionResultText);
        form.spacer();
        form.label(session.observables.groupDetailText);
        form.spacer();
        form.label(session.observables.systemStateDetailText);
        form.spacer();
        const managementEntries = cfg.submenus?.unit_management?.categories || [];

        const groupAssignment = managementEntries.find((m: MenuCategory) => m.id === "group_assignment");
        if (groupAssignment && cfg.isSpecial) {
          const entries = groupAssignment.entries || [];
          if (entries.length > 0) {
            const currentGroupValue = getUnitGroup(entity);
            const initialIndex = entries.findIndex(
              (e) => e.action === "assign_group" && e.value === String(currentGroupValue)
            );
            const fallbackIndex = 0;
            const startIndex = initialIndex >= 0 ? initialIndex : fallbackIndex;
            const groupObs = new ObservableNumber(startIndex, { clientWritable: true });
            const groupItems = entries.map((entry, idx) => ({
              label: stripColorCodes(entry.label),
              value: idx,
              description: entry.description ? stripColorCodes(entry.description) : undefined,
            }));
            let lastGroupIndex = startIndex;
            groupObs.subscribe((newIndex) => {
              if (newIndex === lastGroupIndex) return;
              const entry = entries[newIndex];
              if (entry && entry.action === "assign_group" && entry.value !== undefined) {
                try {
                  setUnitGroup(entity, String(entry.value));
                  const label = SpecialGroupLabels[String(entry.value)] || String(entry.value);
                  recordFeedback(session, "Asignar grupo", label);
                  const updatedGroup = getUnitGroup(entity);
                  const updatedLabel = SpecialGroupLabels[updatedGroup] || updatedGroup;
                  const factionLabel = factionInfo!.faction === Factions.FOUNDATION
                    ? "§lFoundation"
                    : factionInfo!.faction === Factions.CHAOS
                      ? "§2§lChaos"
                      : factionInfo!.faction;
                  session.observables.groupDetailText.setData(`§7Facción: §a${factionLabel}\n§7Grupo actual: §a${updatedLabel}`);

                  const updatedIndex = entries.findIndex(
                    (e) => e.action === "assign_group" && e.value === String(updatedGroup)
                  );
                  if (updatedIndex >= 0 && updatedIndex !== newIndex) {
                    groupObs.setData(updatedIndex);
                    lastGroupIndex = updatedIndex;
                  } else {
                    lastGroupIndex = newIndex;
                  }
                } catch (e) {
                  debugWarn("interactDDUI", `Error asignando grupo: ${e}`, "red");
                  const text = `§cError asignando grupo`;
                  session.observables.actionResultText.setData(text);
                  setLastFeedbackText(entity.id, session.viewId, text);
                  lastGroupIndex = newIndex;
                }
              }
            });
            form.dropdown(stripColorCodes(groupAssignment.category), groupObs, groupItems);
          }
        }

        const entityProtection = managementEntries.find((m: MenuCategory) => m.id === "entity_protection");
        if (entityProtection && entityProtection.entries && entityProtection.entries.length > 0) {
          const entries = entityProtection.entries;
          const currentAllowed = isGlobalOverwriteAllowed(entity);
          const items = entries.map((entry, idx) => ({
            label: stripColorCodes(entry.label),
            value: idx,
            description: entry.description ? stripColorCodes(entry.description) : undefined,
          }));
          const initialIndex = currentAllowed ? 0 : 1;
          const obs = new ObservableNumber(initialIndex, { clientWritable: true });
          let lastIndex = initialIndex;
          obs.subscribe((newIndex) => {
            if (newIndex === lastIndex) return;
            const entry = entries[newIndex];
            if (entry && entry.action === "set_global_overwrite" && typeof entry.value === "boolean") {
              setGlobalOverwriteAllowed(entity, entry.value);
              recordFeedback(session, "Configuración", entry.value ? "Global" : "Local");
            }
            lastIndex = newIndex;
          });
          form.dropdown(stripColorCodes(entityProtection.category), obs, items);
        }

        form.spacer();
        form.button("<- Volver", () => {
          try {
            form.close();
            system.run(() => {
              import("./interact_ddui_form.js").then(({ showInteractDDUI }) => {
                showInteractDDUI(player, entity, cfg, soldierName, displayName, typeId);
              });
            });
          } catch (e) {
            debugWarn("interactDDUI", `Error volviendo a Vista Principal: ${e}`, "red");
          }
        });

        form
          .show()
          .then((reason: DataDrivenScreenClosedReason) => {
            debugMessage("interactDDUI", `Vista Gestión y Estado cerrada: ${reason}`, "gray");
            if (intervalState.current !== null) {
              system.clearRun(intervalState.current);
              intervalState.current = null;
            }
            if (reason === "ClientClosed") {
              removeInteractDDUISession(player, entity);
            }
          })
          .catch((showError) => {
            debugWarn("interactDDUI", `Error en form.show() gestión/estado: ${showError}`, "red");
            if (intervalState.current !== null) {
              system.clearRun(intervalState.current);
              intervalState.current = null;
            }
            removeInteractDDUISession(player, entity);
          });

        intervalState.current = system.runInterval(() => {
          refreshAndUpdateStatus();
        }, 20);
      } catch (setupError) {
        debugWarn("interactDDUI", `Error configurando Vista Gestión y Estado: ${setupError}`, "red");
        try {
          player.sendMessage("§c[DDUI] Error al abrir el menú de gestión y estado.");
        } catch {}
      }
    });
  } catch (e) {
    debugWarn("interactDDUI", `Error mostrando Vista Gestión y Estado: ${e}`, "red");
    try {
      player.sendMessage("§c[DDUI] Error al abrir el menú de gestión y estado.");
    } catch {}
  }
}

export function showInteractDDUHistory(
  player: Player,
  entity: Entity,
  cfg: EntityConfig,
  soldierName: string,
  displayName: string,
  typeId: string
): void {
  try {
    debugMessage("interactDDUI", `Mostrando Historial para ${player.name} en ${typeId}`, "cyan");

    const form = new CustomForm(player, `§dHistorial`);

    system.run(() => {
      try {
        const historyObs = new ObservableString("");
        const intervalState = { current: null as number | null };

        function updateHistoryText(): void {
          const entries = getHistory(entity.id);
          let historyText = `§6Historial de cambios (10 más recientes):§r\n`;
          if (entries.length === 0) {
            historyText += `§7Sin cambios registrados.`;
          } else {
            for (const entry of entries) {
              historyText += `§7[${entry.localTime}] §r${entry.context} §7-> §f${entry.value}\n`;
            }
          }
          historyObs.setData(historyText.trim());
        }

        updateHistoryText();

        form.spacer();
        form.label(`§7Unidad: §f${soldierName}`);
        form.spacer();
        form.label(historyObs);
        form.spacer();
        form.button("<- Volver", () => {
          try {
            form.close();
            system.run(() => {
              import("./interact_ddui_form.js").then(({ showInteractDDUI }) => {
                showInteractDDUI(player, entity, cfg, soldierName, displayName, typeId);
              });
            });
          } catch (e) {
            debugWarn("interactDDUI", `Error volviendo a Vista Principal: ${e}`, "red");
          }
        });

        form
          .show()
          .then((reason: DataDrivenScreenClosedReason) => {
            debugMessage("interactDDUI", `Historial cerrado: ${reason}`, "gray");
            if (intervalState.current !== null) {
              system.clearRun(intervalState.current);
              intervalState.current = null;
            }
            if (reason === "ClientClosed") {
              removeInteractDDUISession(player, entity);
            }
          })
          .catch((showError) => {
            debugWarn("interactDDUI", `Error en form.show() historial: ${showError}`, "red");
            if (intervalState.current !== null) {
              system.clearRun(intervalState.current);
              intervalState.current = null;
            }
            removeInteractDDUISession(player, entity);
          });

        intervalState.current = system.runInterval(() => {
          updateHistoryText();
        }, 20);
      } catch (setupError) {
        debugWarn("interactDDUI", `Error configurando Historial: ${setupError}`, "red");
        try {
          player.sendMessage("§c[DDUI] Error al abrir el historial.");
        } catch {}
      }
    });
  } catch (e) {
    debugWarn("interactDDUI", `Error mostrando Historial: ${e}`, "red");
    try {
      player.sendMessage("§c[DDUI] Error al abrir el historial.");
    } catch {}
  }
}
