// scripts/gui/interactMenu/ddui/interact_ddui_systems.ts

import {
  CustomForm,
  ObservableNumber,
  ObservableBoolean,
  ObservableString,
  DataDrivenScreenClosedReason,
} from "@minecraft/server-ui";
import { system } from "@minecraft/server";
import { debug } from "../../../utils/debug.js";
import { isSystemVisibleForRole, CATALOG_SYSTEMS, isToggleSystem, type SystemId } from "../../shared/systemCatalog.js";
import { PlayerPermissionManager, type FactionId, type RoleId } from "../../shared/playerPermissionManager.js";
import { getEntityFamilies, isSystemBlockedByFamilies } from "../../commandMenu/model/menu_faction.js";
import { isGlobalOverwriteAllowed, setGlobalOverwriteAllowed } from "../../shared/entityScope.js";
import { stripColorCodes } from "../../monitorMenu/monitor_config.js";
import type { MenuCategory } from "../config.js";
import {
  interactMenuSessionStore,
  refreshBasicStatus,
  handleInvalidEntity,
  type InteractDDUISession,
} from "./interact_ddui_shared.js";
import { entityHistoryStore } from "../../shared/entityHistory.js";
import { getEntitySystemState, findSystemStateByEvent } from "../../commandMenu/menu_config.js";
import { SpecialGroups, UnitHierarchy, Factions } from "../../../constants/domains.js";
import { getUnitGroup, setUnitGroup } from "../../shared/entityGroups.js";
import {
  HIERARCHY_LABELS as UnitHierarchyLabels,
  GROUP_LABELS as SpecialGroupLabels,
  ERROR_MESSAGES,
  BACK_BUTTON_LABEL,
  FACTION_DISPLAY_NAMES,
} from "../../shared/systemCatalog.js";

export function showInteractDDUISystems(session: InteractDDUISession): void {
  try {
    session.setView("systems");
    debug(
      "interactDDUI",
      `Mostrando Vista §a"${session.viewId}"§r para §b${session.player.name}§r en ${session.soldierName}`,
      {
        color: "blue",
        level: "debug",
      }
    );

    const form = new CustomForm(session.player, `§6Sistemas Avanzados`);
    session.setForm(form);

    system.run(() => {
      try {
        if (!interactMenuSessionStore.get(session.playerId)) {
          handleInvalidEntity(session.player, form);
          return;
        }
        if (!session.entity.isValid) {
          handleInvalidEntity(session.player);
          return;
        }
        form.spacer();
        form.label(`§7Unidad: §f${session.soldierName}`);
        form.spacer();

        refreshBasicStatus(session.entity, session.factionInfo, session, "sistemas avanzados");
        form.label(session.observables.healthText);
        form.spacer();
        form.label(session.observables.actionResultText);
        form.spacer();

        const advancedCategories = session.cfg.submenus?.advanced?.categories || [];

        const isAdmin = PlayerPermissionManager.isAdmin(session.player);
        const factionInfo = session.factionInfo;
        let role: RoleId;

        if (isAdmin) {
          role = "admin";
        } else {
          role = PlayerPermissionManager.getPlayerRole(
            session.player,
            (factionInfo?.faction ?? "foundation") as FactionId
          );
        }

        const entityFamilies = getEntityFamilies(session.entity);

        for (const adv of advancedCategories) {
          const entries = adv.entries || [];
          if (entries.length === 0 || !adv.id) continue;

          const sysConfig = CATALOG_SYSTEMS[adv.id as SystemId];
          if (!sysConfig) continue;

          if (!isSystemVisibleForRole(sysConfig, role)) {
            continue;
          }

          const isToggle = isToggleSystem(sysConfig);
          const disabledByFamily = isSystemBlockedByFamilies(sysConfig, entityFamilies);

          if (isToggle) {
            let enableEvent: string | undefined;
            let disableEvent: string | undefined;
            for (const entry of entries) {
              if (!entry.event) continue;
              const mapped = findSystemStateByEvent(entry.event);
              if (mapped?.value === true) enableEvent = entry.event;
              if (mapped?.value === false) disableEvent = entry.event;
            }

            const currentRaw = getEntitySystemState(session.entity, adv.id);
            const initialValue = typeof currentRaw === "boolean" ? currentRaw : false;
            const toggleObs = new ObservableBoolean(initialValue, { clientWritable: true });
            const trueEntry = entries.find((e) => e.event === enableEvent);
            const falseEntry = entries.find((e) => e.event === disableEvent);
            const descObs = new ObservableString(
              initialValue
                ? (trueEntry?.description ? stripColorCodes(trueEntry.description) : "")
                : (falseEntry?.description ? stripColorCodes(falseEntry.description) : "")
            );
            let lastValue = initialValue;
            toggleObs.subscribe((newValue) => {
              if (newValue === lastValue) return;
              const targetEvent = newValue ? enableEvent : disableEvent;
              const targetEntry = entries.find((e) => e.event === targetEvent);
              if (targetEntry) {
                session.applyEntryAction(targetEntry, undefined, adv.category);
              }
              const descEntry = newValue ? trueEntry : falseEntry;
              descObs.setData(
                descEntry?.description ? stripColorCodes(descEntry.description) : ""
              );
              lastValue = newValue;
            });
            const toggleDisabled = disabledByFamily;
            form.toggle(stripColorCodes(adv.category), toggleObs, {
              description: descObs,
              disabled: toggleDisabled,
            });
          } else {
            const built = session.buildObservableFromEntries(entries, undefined, session.typeId, adv.category);
            form.dropdown(stripColorCodes(adv.category), built.obs, built.items, { disabled: disabledByFamily });
          }
        }

        form.spacer();
        let closeReason: "navigation" | undefined = undefined;

        form.button(stripColorCodes(BACK_BUTTON_LABEL), () => {
          try {
            closeReason = "navigation";
            form.close();
          } catch (e) {
            debug("interactDDUI", `Error volviendo a Vista Principal: ${e}`, {
              level: "error",
              color: "red",
            });
          }
        });

        let intervalId: number;

        form
          .show()
          .then((reason: DataDrivenScreenClosedReason) => {
            if (reason === "ClientClosed") {
              debug("interactDDUI", `Vista "${session.viewId}" cerrada: X del cliente (§b${session.player.name}§r)`, {
                level: "debug",
                color: "gray",
              });
              interactMenuSessionStore.cleanup(session.player.id);
            } else if (reason === "UserBusy") {
              debug("interactDDUI", `Vista "${session.viewId}" cerrada: §cUserBusy§r (§b${session.player.name}§r)`, {
                level: "warn",
                color: "yellow",
              });
              interactMenuSessionStore.cleanup(session.player.id);
            } else if (reason === "ServerClosed") {
              if (closeReason === "navigation") {
                debug("interactDDUI", `Vista "${session.viewId}" cerrada: navegación (§b${session.player.name}§r)`, {
                  level: "debug",
                  color: "gray",
                });
                session.unregisterInterval(intervalId);
                if (!session.entity.isValid) {
                  handleInvalidEntity(session.player);
                  return;
                }
                if (!interactMenuSessionStore.get(session.playerId)) {
                  debug(
                    "interactDDUI",
                    `Sesión ya limpiada (entidad muerta), navegación cancelada (§b${session.player.name}§r)`,
                    {
                      level: "debug",
                      color: "gray",
                    }
                  );
                  return;
                }
                import("./interact_ddui_form.js").then(({ showInteractDDUI }) => {
                  showInteractDDUI(session);
                });
              } else {
                if (!interactMenuSessionStore.get(session.playerId)) {
                  debug(
                    "interactDDUI",
                    `Vista "${session.viewId}" cerrada: sesión limpiada (§b${session.player.name}§r)`,
                    {
                      level: "debug",
                      color: "gray",
                    }
                  );
                } else {
                  debug(
                    "interactDDUI",
                    `Vista "${session.viewId}" cerrada: ServerClosed sin razón (§b${session.player.name}§r)`,
                    {
                      level: "warn",
                      color: "yellow",
                    }
                  );
                  interactMenuSessionStore.cleanup(session.playerId);
                }
              }
            }
            closeReason = undefined;
          })
          .catch((showError) => {
            debug("interactDDUI", `Error en form.show() (${session.viewId}): ${showError}`, {
              level: "error",
              color: "red",
            });
            interactMenuSessionStore.cleanup(session.player.id);
          });

        intervalId = system.runInterval(() => {
          if (!session.entity.isValid) {
            handleInvalidEntity(session.player, form);
            return;
          }
          refreshBasicStatus(session.entity, session.factionInfo, session, "sistemas avanzados");
        }, 20);
        session.registerInterval(intervalId);
      } catch (setupError) {
        debug("interactDDUI", `Error configurando Vista "${session.viewId}": ${setupError}`, {
          level: "error",
          color: "red",
        });
        interactMenuSessionStore.cleanup(session.player.id);
        try {
          session.player.sendMessage(ERROR_MESSAGES.DDUI_OPEN_SYSTEMS);
        } catch {}
      }
    });
  } catch (e) {
    debug("interactDDUI", `Error mostrando Vista "${session.viewId}": ${e}`, {
      level: "error",
      color: "red",
    });
    try {
      session.player.sendMessage("§c[DDUI] Error al abrir el menú de sistemas avanzados.");
    } catch {}
  }
}

export function showInteractDDUIManagement(session: InteractDDUISession): void {
  try {
    session.setView("management");
    debug(
      "interactDDUI",
      `Mostrando Vista §a"${session.viewId}"§r para §b${session.player.name}§r en ${session.soldierName}`,
      {
        color: "blue",
        level: "debug",
      }
    );

    const factionInfo = session.factionInfo;

    const form = new CustomForm(session.player, `§dGestión y Estado`);
    session.setForm(form);

    system.run(() => {
      try {
        if (!interactMenuSessionStore.get(session.playerId)) {
          handleInvalidEntity(session.player, form);
          return;
        }
        if (!session.entity.isValid) {
          handleInvalidEntity(session.player);
          return;
        }
        form.spacer();
        form.label(`§7Unidad: §f${session.soldierName}`);
        form.spacer();

        function refreshAndUpdateStatus(): void {
          const status = refreshBasicStatus(session.entity, factionInfo, session, "gestión/estado");
          if (!status) return;

          session.observables.systemStateDetailText.setData(status.systemStateDetail);

          if (factionInfo) {
            const factionLabel =
              factionInfo.faction === Factions.FOUNDATION
                ? FACTION_DISPLAY_NAMES.foundation
                : factionInfo.faction === Factions.CHAOS
                  ? FACTION_DISPLAY_NAMES.chaos
                  : factionInfo.faction;

            if (factionInfo.isSpecial) {
              const groupId = getUnitGroup(session.entity) ?? SpecialGroups.NO_GROUP;
              const groupLabel = SpecialGroupLabels[groupId] || String(groupId);
              session.observables.groupDetailText.setData(
                `§7Facción: §a${factionLabel}\n§7Grupo actual: §a${groupLabel}`
              );
            } else {
              const hierarchyLabel =
                UnitHierarchyLabels[factionInfo.hierarchy ?? UnitHierarchy.BASIC] ||
                String(factionInfo.hierarchy ?? UnitHierarchy.BASIC);
              session.observables.groupDetailText.setData(
                `§7Facción: §a${factionLabel}\n§7Jerarquia: §a${hierarchyLabel}`
              );
            }
          } else {
            session.observables.groupDetailText.setData("");
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
        const managementEntries = session.cfg.submenus?.unit_management?.categories || [];

        const groupAssignment = managementEntries.find((m: MenuCategory) => m.id === "group_assignment");
        if (groupAssignment && session.cfg.isSpecial) {
          const entries = groupAssignment.entries || [];
          if (entries.length > 0) {
            const currentGroupValue = getUnitGroup(session.entity);
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
                  setUnitGroup(session.entity, String(entry.value));
                  const label = SpecialGroupLabels[String(entry.value)] || String(entry.value);
                  session.recordFeedback("Asignar grupo", label);
                  const updatedGroup = getUnitGroup(session.entity);
                  const updatedLabel = SpecialGroupLabels[updatedGroup] || updatedGroup;
                  const factionLabel =
                    factionInfo!.faction === Factions.FOUNDATION
                      ? FACTION_DISPLAY_NAMES.foundation
                      : factionInfo!.faction === Factions.CHAOS
                        ? FACTION_DISPLAY_NAMES.chaos
                        : factionInfo!.faction;
                  session.observables.groupDetailText.setData(
                    `§7Facción: §a${factionLabel}\n§7Grupo actual: §a${updatedLabel}`
                  );

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
                  debug("interactDDUI", `Error asignando grupo: ${e}`, {
                    level: "error",
                    color: "red",
                  });
                  session.recordFeedback("Asignar grupo", "Error", "error");
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
          const currentAllowed = isGlobalOverwriteAllowed(session.entity);
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
              setGlobalOverwriteAllowed(session.entity, entry.value);
              session.recordFeedback("Configuración", entry.value ? "Global" : "Local");
            }
            lastIndex = newIndex;
          });
          form.dropdown(stripColorCodes(entityProtection.category), obs, items);
        }

        form.spacer();
        let closeReason: "navigation" | undefined = undefined;

        form.button(stripColorCodes(BACK_BUTTON_LABEL), () => {
          try {
            closeReason = "navigation";
            form.close();
          } catch (e) {
            debug("interactDDUI", `Error volviendo a Vista Principal: ${e}`, {
              level: "error",
              color: "red",
            });
          }
        });

        let intervalId: number;

        form
          .show()
          .then((reason: DataDrivenScreenClosedReason) => {
            if (reason === "ClientClosed") {
              debug("interactDDUI", `Vista "${session.viewId}" cerrada: X del cliente (§b${session.player.name}§r)`, {
                level: "debug",
                color: "gray",
              });
              interactMenuSessionStore.cleanup(session.player.id);
            } else if (reason === "UserBusy") {
              debug("interactDDUI", `Vista "${session.viewId}" cerrada: §cUserBusy§r (§b${session.player.name}§r)`, {
                level: "warn",
                color: "yellow",
              });
              interactMenuSessionStore.cleanup(session.player.id);
            } else if (reason === "ServerClosed") {
              if (closeReason === "navigation") {
                debug("interactDDUI", `Vista "${session.viewId}" cerrada: navegación (§b${session.player.name}§r)`, {
                  level: "debug",
                  color: "gray",
                });
                session.unregisterInterval(intervalId);
                if (!session.entity.isValid) {
                  handleInvalidEntity(session.player);
                  return;
                }
                if (!interactMenuSessionStore.get(session.playerId)) {
                  debug(
                    "interactDDUI",
                    `Sesión ya limpiada (entidad muerta), navegación cancelada (§b${session.player.name}§r)`,
                    {
                      level: "debug",
                      color: "gray",
                    }
                  );
                  return;
                }
                import("./interact_ddui_form.js").then(({ showInteractDDUI }) => {
                  showInteractDDUI(session);
                });
              } else {
                if (!interactMenuSessionStore.get(session.playerId)) {
                  debug(
                    "interactDDUI",
                    `Vista "${session.viewId}" cerrada: sesión limpiada (§b${session.player.name}§r)`,
                    {
                      level: "debug",
                      color: "gray",
                    }
                  );
                } else {
                  debug(
                    "interactDDUI",
                    `Vista "${session.viewId}" cerrada: ServerClosed sin razón (§b${session.player.name}§r)`,
                    {
                      level: "warn",
                      color: "yellow",
                    }
                  );
                  interactMenuSessionStore.cleanup(session.playerId);
                }
              }
            }
            closeReason = undefined;
          })
          .catch((showError) => {
            debug("interactDDUI", `Error en form.show() (${session.viewId}): ${showError}`, {
              level: "error",
              color: "red",
            });
            interactMenuSessionStore.cleanup(session.player.id);
          });

        intervalId = system.runInterval(() => {
          if (!session.entity.isValid) {
            handleInvalidEntity(session.player, form);
            return;
          }
          refreshAndUpdateStatus();
        }, 20);
        session.registerInterval(intervalId);
      } catch (setupError) {
        debug("interactDDUI", `Error configurando Vista "${session.viewId}": ${setupError}`, {
          level: "error",
          color: "red",
        });
        interactMenuSessionStore.cleanup(session.player.id);
        try {
          session.player.sendMessage(ERROR_MESSAGES.DDUI_OPEN_MANAGEMENT);
        } catch {}
      }
    });
  } catch (e) {
    debug("interactDDUI", `Error mostrando Vista "${session.viewId}": ${e}`, {
      level: "error",
      color: "red",
    });
    try {
      session.player.sendMessage("§c[DDUI] Error al abrir el menú de gestión y estado.");
    } catch {}
  }
}

export function showInteractDDUHistory(session: InteractDDUISession): void {
  try {
    session.setView("history");
    debug(
      "interactDDUI",
      `Mostrando Vista §a"${session.viewId}"§r para §b${session.player.name}§r en ${session.soldierName}`,
      {
        color: "blue",
        level: "debug",
      }
    );

    const form = new CustomForm(session.player, `§dHistorial`);
    session.setForm(form);

    system.run(() => {
      try {
        if (!interactMenuSessionStore.get(session.playerId)) {
          handleInvalidEntity(session.player, form);
          return;
        }
        if (!session.entity.isValid) {
          handleInvalidEntity(session.player);
          return;
        }
        const historyObs = new ObservableString("");
        const FILTER_OPTIONS: { label: string; value: string }[] = [
          { label: "Todos", value: "all" },
          { label: "Interacción", value: "interact" },
          { label: "Comando", value: "command" },
        ];
        let currentFilter = "all";
        function updateHistoryText(): void {
          const allEntries = entityHistoryStore.getHistory(session.entity.id);
          const entries = currentFilter === "all" ? allEntries : allEntries.filter((e) => e.source === currentFilter);
          let historyText = `§6Historial de cambios (${entries.length} mostrados):§r\n`;
          if (entries.length === 0) {
            historyText += `§7Sin cambios registrados.`;
          } else {
            for (let i = 0; i < entries.length; i++) {
              const entry = entries[i];
              const srcPrefix = entry.source === "command" ? "§c[CMD] " : "§b[INT] ";
              historyText += `§8${i + 1}.§r ${srcPrefix}§7[${entry.localTime}] §r${entry.context} §7-> §f${entry.value}\n`;
            }
          }
          historyObs.setData(historyText.trim());
        }

        updateHistoryText();

        refreshBasicStatus(session.entity, session.factionInfo, session, "historial");

        form.spacer();
        form.label(`§7Unidad: §f${session.soldierName}`);
        form.spacer();
        form.label(session.observables.healthText);
        form.spacer();
        const filterObs = new ObservableNumber(0, { clientWritable: true });
        form.dropdown(
          "Origen:",
          filterObs,
          FILTER_OPTIONS.map((o, i) => ({ label: o.label, value: i }))
        );
        filterObs.subscribe((idx: number) => {
          currentFilter = FILTER_OPTIONS[idx]?.value ?? "all";
          updateHistoryText();
        });
        form.spacer();
        form.label(historyObs);
        form.spacer();
        let closeReason: "navigation" | undefined = undefined;

        form.button(stripColorCodes(BACK_BUTTON_LABEL), () => {
          try {
            closeReason = "navigation";
            form.close();
          } catch (e) {
            debug("interactDDUI", `Error volviendo a Vista Principal: ${e}`, {
              level: "error",
              color: "red",
            });
          }
        });

        let intervalId: number;

        form
          .show()
          .then((reason: DataDrivenScreenClosedReason) => {
            if (reason === "ClientClosed") {
              debug("interactDDUI", `Vista "${session.viewId}" cerrada: X del cliente (§b${session.player.name}§r)`, {
                level: "debug",
                color: "gray",
              });
              interactMenuSessionStore.cleanup(session.player.id);
            } else if (reason === "UserBusy") {
              debug("interactDDUI", `Vista "${session.viewId}" cerrada: §cUserBusy§r (§b${session.player.name}§r)`, {
                level: "warn",
                color: "yellow",
              });
              interactMenuSessionStore.cleanup(session.player.id);
            } else if (reason === "ServerClosed") {
              if (closeReason === "navigation") {
                debug("interactDDUI", `Vista "${session.viewId}" cerrada: navegación (§b${session.player.name}§r)`, {
                  level: "debug",
                  color: "gray",
                });
                session.unregisterInterval(intervalId);
                if (!session.entity.isValid) {
                  handleInvalidEntity(session.player);
                  return;
                }
                if (!interactMenuSessionStore.get(session.playerId)) {
                  debug(
                    "interactDDUI",
                    `Sesión ya limpiada (entidad muerta), navegación cancelada (§b${session.player.name}§r)`,
                    {
                      level: "debug",
                      color: "gray",
                    }
                  );
                  return;
                }
                import("./interact_ddui_form.js").then(({ showInteractDDUI }) => {
                  showInteractDDUI(session);
                });
              } else {
                if (!interactMenuSessionStore.get(session.playerId)) {
                  debug(
                    "interactDDUI",
                    `Vista "${session.viewId}" cerrada: sesión limpiada (§b${session.player.name}§r)`,
                    {
                      level: "debug",
                      color: "gray",
                    }
                  );
                } else {
                  debug(
                    "interactDDUI",
                    `Vista "${session.viewId}" cerrada: ServerClosed sin razón (§b${session.player.name}§r)`,
                    {
                      level: "warn",
                      color: "yellow",
                    }
                  );
                  interactMenuSessionStore.cleanup(session.playerId);
                }
              }
            }
            closeReason = undefined;
          })
          .catch((showError) => {
            debug("interactDDUI", `Error en form.show() (${session.viewId}): ${showError}`, {
              level: "error",
              color: "red",
            });
            interactMenuSessionStore.cleanup(session.player.id);
          });

        intervalId = system.runInterval(() => {
          if (!session.entity.isValid) {
            handleInvalidEntity(session.player, form);
            return;
          }
          refreshBasicStatus(session.entity, session.factionInfo, session, "historial");
          updateHistoryText();
        }, 20);
        session.registerInterval(intervalId);
      } catch (setupError) {
        debug("interactDDUI", `Error configurando Vista "${session.viewId}": ${setupError}`, {
          level: "error",
          color: "red",
        });
        interactMenuSessionStore.cleanup(session.player.id);
        try {
          session.player.sendMessage(ERROR_MESSAGES.DDUI_OPEN_HISTORY);
        } catch {}
      }
    });
  } catch (e) {
    debug("interactDDUI", `Error mostrando Vista "${session.viewId}": ${e}`, {
      level: "error",
      color: "red",
    });
    try {
      session.player.sendMessage("§c[DDUI] Error al abrir el historial.");
    } catch {}
  }
}
