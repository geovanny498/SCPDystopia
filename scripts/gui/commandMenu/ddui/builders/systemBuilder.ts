// scripts/gui/commandMenu/ddui/builders/systemBuilder.ts

import { Player, Dimension, Entity, system } from "@minecraft/server";
import { CustomForm, ObservableNumber, ObservableBoolean, ObservableString } from "@minecraft/server-ui";
import { debug } from "../../../../utils/debug.js";
import {
  CATALOG_SYSTEMS,
  BACK_BUTTON_LABEL,
  FACTION_DISPLAY_NAMES,
  PANEL_TITLES,
  SPECIAL_GROUP_OPTIONS,
  HIERARCHY_OPTIONS,
  SYSTEM_VIEW_FILTER_OPTIONS,
  TOGGLE_ON_LABEL,
  TOGGLE_OFF_LABEL,
  ERROR_MESSAGES,
  SystemId,
  isSystemVisibleForRole,
  isMenuFeatureVisible,
  type CatalogSystem,
} from "../../../shared/systemCatalog.js";
import {
  SYSTEM_PANEL_FEEDBACK_INITIAL,
  type DDUIFeedbackEntry,
  DDUIFeedbackStatus,
} from "../../../shared/dduiFeedback.js";
import { PlayerPermissionManager, FactionId } from "../../../shared/playerPermissionManager.js";
import { commandMenuSessionStore } from "../sessionStore.js";
import { stripColorCodes } from "../helpers/formHelpers.js";
import { addHistoryEntry, getSystemShortName } from "../helpers/historyStore.js";
import { SpecialGroups, Factions, FACTION_IDS, UnitHierarchyId, TargetFaction } from "../../../../constants/domains.js";
import { getSystemDefaults } from "../../menu_config.js";
import { loadSystemStates, saveSystemAndUpdateMemory } from "../../core/menu_state.js";
import { applySystemsToEntities } from "../../../commandMenu/core/menu_apply.js";
import { scanActiveEntities } from "../../../commandMenu/model/menu_entity_scanner.js";

export interface SystemViewParams {
  systemId: SystemId;
  player: Player;
  targetFaction?: TargetFaction;
  returnTo?: "main" | "advanced";
  viewFilter?: "all" | "hierarchy" | "specials";
}

interface BaseControl {
  key: string;
  label: string;
  labelObs: ObservableString;
  descriptionObs?: ObservableString;
}

interface DropdownControlRecord extends BaseControl {
  kind: "dropdown";
  obs: ObservableNumber;
  lastAppliedIndex: number;
}

interface ToggleControlRecord extends BaseControl {
  kind: "toggle";
  obs: ObservableBoolean;
  lastValue: boolean;
}

type ControlRecord = DropdownControlRecord | ToggleControlRecord;

function findOptionIndex(options: { value: string; label: string }[], value: unknown): number {
  if (value === undefined || value === null) return -1;
  const strValue = typeof value === "boolean" ? String(value) : String(value);
  const found = options.findIndex((opt) => opt.value === strValue);
  return found;
}

function buildInitialState(
  systemId: SystemId,
  factions: string[],
  key: string
): Record<string, Record<string, unknown>> {
  const loadedStates = loadSystemStates([systemId]);
  const defaults = getSystemDefaults(systemId);
  const result: Record<string, Record<string, unknown>> = {};
  for (const fac of factions) {
    const loadedFaction = (loadedStates[systemId]?.[fac] as Record<string, unknown>) || {};
    const defaultFaction = (defaults[fac as FactionId] as Record<string, unknown>) || {};
    const merged: Record<string, unknown> = { ...defaultFaction };
    for (const k of Object.keys(loadedFaction)) {
      if (loadedFaction[k] !== undefined) {
        merged[k] = loadedFaction[k];
      }
    }
    result[fac] = merged;
  }
  return result;
}

function buildDropdownItems(
  options: { label: string; value: unknown; description?: string }[]
): { label: string; value: number; description?: string }[] {
  return options.map((o, idx) => ({
    label: stripColorCodes(o.label),
    value: idx,
    description: o.description ? stripColorCodes(o.description) : undefined,
  }));
}

function buildDropdownItemsPlain(options: { label: string; value: unknown }[]): { label: string; value: number }[] {
  return options.map((o, idx) => ({ label: stripColorCodes(o.label), value: idx }));
}

function buildCountsAndNametags(
  dimension: Dimension,
  factions: string[]
): {
  counts: Record<string, number>;
  nametagsByKey: Record<string, Set<string>>;
} {
  const counts: Record<string, number> = {};
  const nametagsByKey: Record<string, Set<string>> = {};

  for (const fac of factions) {
    const result = scanActiveEntities(dimension, fac);
    for (const se of result.entities) {
      const entityKey = se.isSpecial ? se.group : se.hierarchy;
      if (!entityKey) continue;
      counts[entityKey] = (counts[entityKey] || 0) + 1;
      if (se.isSpecial && se.nametag) {
        if (!nametagsByKey[entityKey]) nametagsByKey[entityKey] = new Set();
        nametagsByKey[entityKey].add(stripColorCodes(se.nametag));
      }
    }
  }

  return { counts, nametagsByKey };
}

function updateControlLabels(
  hierarchyControls: ControlRecord[],
  groupControls: ControlRecord[],
  counts: Record<string, number>,
  nametagsByKey: Record<string, Set<string>>
): void {
  for (const ctrl of hierarchyControls) {
    const count = counts[ctrl.key] || 0;
    ctrl.labelObs.setData(`${stripColorCodes(ctrl.label)}: (${count})`);
  }

  for (const ctrl of groupControls) {
    const count = counts[ctrl.key] || 0;
    ctrl.labelObs.setData(`${stripColorCodes(ctrl.label)}: (${count})`);

    const nametagSet = nametagsByKey[ctrl.key];
    if (ctrl.descriptionObs) {
      if (count === 0 || !nametagSet || nametagSet.size === 0) {
        ctrl.descriptionObs.setData(`N/A`);
      } else {
        const sorted = Array.from(nametagSet).sort();
        const MAX_DISPLAY = 3;
        const truncated = sorted.slice(0, MAX_DISPLAY).join(", ");
        const more = sorted.length > MAX_DISPLAY ? ` +${sorted.length - MAX_DISPLAY} más` : "";
        ctrl.descriptionObs.setData(`${truncated}${more}`);
      }
    }
  }
}

function buildControls(
  controlOptions: { value: string; label: string }[],
  systemOptions: { label: string; value: unknown; description?: string }[] | undefined,
  initialStates: Record<string, Record<string, unknown>>,
  factions: string[],
  form: CustomForm,
  controlType: "dropdown" | "toggle",
  isGroup: boolean,
  systemConfig: CatalogSystem,
  visibleObs?: ObservableBoolean,
  firstVisibleIndex: number = -1
): ControlRecord[] {
  const controls: ControlRecord[] = [];
  const systemOptionsForIndex = systemOptions?.map((o) => ({ value: String(o.value), label: o.label })) ?? [];

  for (let i = 0; i < controlOptions.length; i++) {
    const opt = controlOptions[i];
    let initialValue: number | boolean = controlType === "dropdown" ? 0 : false;
    let foundationValue: number | boolean | undefined;
    let otherValue: number | boolean | undefined;

    for (const fac of factions) {
      const factionState = initialStates[fac as string] || {};
      const currentValue = factionState[opt.value];
      if (controlType === "dropdown") {
        const foundIndex = findOptionIndex(systemOptionsForIndex, currentValue);
        if (foundIndex >= 0) {
          if (fac === Factions.FOUNDATION) foundationValue = foundIndex;
          else if (otherValue === undefined) otherValue = foundIndex;
          if (foundIndex !== initialValue && (foundIndex !== 0 || factions.indexOf(fac as any) === 0)) {
            initialValue = foundIndex;
          }
        }
      } else {
        if (typeof currentValue === "boolean") {
          if (fac === Factions.FOUNDATION) foundationValue = currentValue;
          else if (otherValue === undefined) otherValue = currentValue;
          initialValue = currentValue;
        }
      }
    }

    const hasDivergence =
      factions.length > 1 &&
      foundationValue !== undefined &&
      otherValue !== undefined &&
      foundationValue !== otherValue;

    if (hasDivergence && controlType === "dropdown") {
      initialValue = foundationValue as number;
    }

    const baseLabel = stripColorCodes(opt.label);
    let labelText = `${baseLabel}: (0)`;
    if (hasDivergence) {
      labelText = `${baseLabel}: §e⚠ Valor distinto en Chaos`;
    }

    const labelObs = new ObservableString(labelText);
    const descObs = isGroup ? new ObservableString(`N/A`) : undefined;

    let disabled = false;
    if (!isGroup) {
      const hierarchyKey = opt.value as UnitHierarchyId;
      disabled = systemConfig.blockedByHierarchy?.[hierarchyKey] === true;
    }

    if (controlType === "dropdown") {
      const obs = new ObservableNumber(initialValue as number, { clientWritable: true });
      const dropdownOptions: Record<string, unknown> = {};
      if (disabled) dropdownOptions.disabled = true;
      if (isGroup) dropdownOptions.description = descObs;
      if (visibleObs) dropdownOptions.visible = visibleObs;
      form.dropdown(
        labelObs,
        obs,
        controlType === "dropdown" && i === firstVisibleIndex
          ? buildDropdownItems(systemOptions ?? [])
          : buildDropdownItemsPlain(systemOptions ?? []),
        Object.keys(dropdownOptions).length > 0 ? dropdownOptions : undefined
      );
      controls.push({
        key: opt.value,
        label: opt.label,
        labelObs,
        descriptionObs: descObs,
        kind: "dropdown",
        obs,
        lastAppliedIndex: initialValue as number,
      });
    } else {
      const obs = new ObservableBoolean(initialValue as boolean, { clientWritable: true });
      const toggleOptions: Record<string, unknown> = {};
      if (disabled) toggleOptions.disabled = true;
      if (isGroup && descObs) toggleOptions.description = descObs;
      if (visibleObs) toggleOptions.visible = visibleObs;
      form.toggle(labelObs, obs, Object.keys(toggleOptions).length > 0 ? toggleOptions : undefined);
      controls.push({
        key: opt.value,
        label: opt.label,
        labelObs,
        descriptionObs: descObs,
        kind: "toggle",
        obs,
        lastValue: initialValue as boolean,
      });
    }
  }

  return controls;
}

function applySystemToEntitiesForSystem(
  key: string,
  value: unknown,
  valueLabel: string,
  factions: string[],
  dimension: Dimension,
  systemId: SystemId,
  player: Player,
  targetFaction: string | undefined,
  label: string
): DDUIFeedbackEntry | null {
  try {
    const appliedEntries: string[] = [];
    const allEligible: { entity: Entity; factionInfo: any }[] = [];

    for (const fac of factions) {
      const scanResult = scanActiveEntities(dimension, fac);
      let totalAffected = 0;

      for (const se of scanResult.entities) {
        if (se.faction !== fac) continue;
        if (se.isSpecial) {
          if (se.group !== key) continue;
        } else {
          if (se.hierarchy !== key) continue;
        }

        allEligible.push({
          entity: se.entity,
          factionInfo: {
            faction: se.faction,
            isSpecial: se.isSpecial,
            nametag: se.nametag,
            hierarchy: se.hierarchy,
            group: se.group || (se.isSpecial ? SpecialGroups.NO_GROUP : null),
          },
        });
        totalAffected++;
      }

      if (totalAffected > 0) {
        appliedEntries.push(
          `${FACTION_DISPLAY_NAMES[fac as keyof typeof FACTION_DISPLAY_NAMES] ?? fac}: ${totalAffected}`
        );
      }
    }

    const systemOverrideState: Record<string, Record<string, unknown>> = {};
    for (const fac of factions) {
      systemOverrideState[fac] = { [key]: value };
    }

    applySystemsToEntities(allEligible, [systemId], {
      player,
      skipCompatibilityCheck: true,
      cached: {
        systemStates: {
          [systemId]: systemOverrideState,
        },
      },
    });

    const summary = appliedEntries.length > 0 ? appliedEntries.join(" | ") : "0 unidades";
    const displayName = getSystemShortName(systemId);

    const partialState: Record<string, Record<string, unknown>> = {};
    for (const fac of factions) {
      partialState[fac] = { [key]: value };
    }
    try {
      saveSystemAndUpdateMemory(systemId, partialState);
    } catch (e) {
      debug("commandMenuDDUI", `Error guardando estado de sistema §b${systemId}§r: ${e}`, { level: "error", color: "red" });
    }

    if (targetFaction === "both") {
      for (const fac of FACTION_IDS) {
        addHistoryEntry({
          playerName: player.name,
          faction: fac,
          systemShortName: getSystemShortName(systemId),
          key: label,
          value: valueLabel,
        });
      }
    } else {
      addHistoryEntry({
        playerName: player.name,
        faction: targetFaction ?? Factions.FOUNDATION,
        systemShortName: getSystemShortName(systemId),
        key: label,
        value: valueLabel,
      });
    }

    return {
      context: displayName,
      value: `${label}: ${valueLabel} (${summary})`,
      status: "ok" as DDUIFeedbackStatus,
      timestamp: Date.now(),
      viewId: `system:${systemId}`,
    };
  } catch (e) {
    debug("commandMenuDDUI", `§cError§r aplicando control §b${systemId}§r [§b${key}§r]: ${e}`, { level: "error", color: "red" });
    return null;
  }
}

export function buildSystemView({
  systemId,
  player,
  targetFaction,
  returnTo,
  viewFilter,
}: SystemViewParams): () => void {
  const systemConfig = CATALOG_SYSTEMS[systemId];
  if (!systemConfig) {
    return () => {
      player.sendMessage("§c[SCPDystopia] Sistema no encontrado.");
    };
  }

  const isAdmin = PlayerPermissionManager.isAdmin(player);
  const role = isAdmin
    ? "admin"
    : PlayerPermissionManager.getPlayerRole(player, (targetFaction ?? Factions.FOUNDATION) as FactionId);

  if (!isSystemVisibleForRole(systemConfig, role)) {
    return () => {
      player.sendMessage("§c[SCPDystopia] No tienes permiso para acceder a este sistema.");
    };
  }

  return () => {
    try {
      let closeReason: "navigation" | undefined = undefined;

      const form = new CustomForm(player, `${PANEL_TITLES.system} - ${systemConfig.displayName}`);

      const dimension = player.dimension;
      const factions: FactionId[] =
        targetFaction === "both" ? FACTION_IDS : [(targetFaction ?? Factions.FOUNDATION) as FactionId];
      const initialStates = buildInitialState(systemId, factions, systemId);
      const session = commandMenuSessionStore.get(player.id);

      const feedbackPresenter = session
        ? session.getOrCreateFeedbackPresenter(`system:${systemId}`, SYSTEM_PANEL_FEEDBACK_INITIAL)
        : null;

      form.spacer();
      form.label(
        `§7Facción: ${FACTION_DISPLAY_NAMES[(targetFaction ?? Factions.FOUNDATION) as keyof typeof FACTION_DISPLAY_NAMES] ?? targetFaction}`
      );
      form.spacer();
      if (feedbackPresenter) {
        form.label(feedbackPresenter.getObservable());
      }

      if ((systemConfig.controlType === "dropdown" && systemConfig.options) || systemConfig.controlType === "toggle") {
        const isAdmin = PlayerPermissionManager.isAdmin(player);
        let canFilter = isAdmin;
        if (!canFilter) {
          if (targetFaction === "both") {
            const foundationRole = PlayerPermissionManager.getPlayerRole(player, Factions.FOUNDATION);
            const chaosRole = PlayerPermissionManager.getPlayerRole(player, Factions.CHAOS);
            canFilter =
              isMenuFeatureVisible("scope", foundationRole, false, "foundation") ||
              isMenuFeatureVisible("scope", chaosRole, false, "chaos");
          } else if (targetFaction) {
            const role = PlayerPermissionManager.getPlayerRole(player, targetFaction as FactionId);
            canFilter = isMenuFeatureVisible("scope", role, false, targetFaction);
          }
        }

        let resolvedViewFilter: "all" | "hierarchy" | "specials";
        if (canFilter) {
          let persistedFilter: "all" | "hierarchy" | "specials" | undefined;
          try {
            const dp = player.getDynamicProperty("scpd_system_view_filter");
            if (dp === "all" || dp === "hierarchy" || dp === "specials") {
              persistedFilter = dp;
            }
          } catch {
            // DP no disponible
          }
          resolvedViewFilter =
            viewFilter ??
            persistedFilter ??
            (session?.formState.systemViewFilter as "all" | "hierarchy" | "specials" | undefined) ??
            "all";
        } else {
          resolvedViewFilter = "specials";
        }

        const hierarchyVisibleObs = new ObservableBoolean(
          resolvedViewFilter === "all" || resolvedViewFilter === "hierarchy"
        );
        const groupVisibleObs = new ObservableBoolean(
          resolvedViewFilter === "all" || resolvedViewFilter === "specials"
        );

        if (canFilter) {
          const filterIndex = SYSTEM_VIEW_FILTER_OPTIONS.findIndex((opt) => opt.value === resolvedViewFilter);
          const filterObs = new ObservableNumber(filterIndex >= 0 ? filterIndex : 0, { clientWritable: true });
          form.spacer();
          form.dropdown(
            new ObservableString("Mostrar:"),
            filterObs,
            SYSTEM_VIEW_FILTER_OPTIONS.map((opt, idx) => ({
              label: stripColorCodes(opt.label),
              value: idx,
            }))
          );
          filterObs.subscribe((idx: number) => {
            const newFilter = SYSTEM_VIEW_FILTER_OPTIONS[idx]?.value ?? "all";
            if (session) {
              session.formState.systemViewFilter = newFilter;
            }
            try {
              player.setDynamicProperty("scpd_system_view_filter", newFilter);
            } catch {
              // DP no disponible
            }
            hierarchyVisibleObs.setData(newFilter === "all" || newFilter === "hierarchy");
            groupVisibleObs.setData(newFilter === "all" || newFilter === "specials");
          });
        }

        form.spacer({ visible: hierarchyVisibleObs });
        form.header(SYSTEM_VIEW_FILTER_OPTIONS.find((o) => o.value === "hierarchy")!.label, {
          visible: hierarchyVisibleObs,
        });
        form.spacer({ visible: hierarchyVisibleObs });

        const isDropdown = systemConfig.controlType === "dropdown";

        const hierarchyControls = buildControls(
          HIERARCHY_OPTIONS,
          systemConfig.options!,
          initialStates,
          factions,
          form,
          systemConfig.controlType,
          false,
          systemConfig,
          hierarchyVisibleObs,
          isDropdown ? 0 : -1
        );
        // form.spacer({ visible: hierarchyVisibleObs });

        form.spacer({ visible: groupVisibleObs });
        form.header(SYSTEM_VIEW_FILTER_OPTIONS.find((o) => o.value === "specials")!.label, {
          visible: groupVisibleObs,
        });
        form.spacer({ visible: groupVisibleObs });

        const groupControls = buildControls(
          SPECIAL_GROUP_OPTIONS,
          systemConfig.options!,
          initialStates,
          factions,
          form,
          systemConfig.controlType,
          true,
          systemConfig,
          groupVisibleObs,
          isDropdown ? 0 : -1
        );

        let intervalId: number | null = null;

        intervalId = system.runInterval(() => {
          try {
            const { counts, nametagsByKey } = buildCountsAndNametags(dimension, factions);
            updateControlLabels(hierarchyControls, groupControls, counts, nametagsByKey);
          } catch (e) {
            debug("commandMenuDDUI", `Error en intervalo de contadores: ${e}`, { level: "warn", color: "yellow" });
          }
        }, 20);

        if (session) {
          session.registerInterval(intervalId);
        }

        for (const ctrl of hierarchyControls) {
          if (ctrl.kind === "dropdown") {
            ctrl.obs.subscribe((idx: number) => {
              if (idx === ctrl.lastAppliedIndex) return;
              if (idx < 0) return;
              const selectedOption = systemConfig.options![idx] ?? systemConfig.options![0];
              const entry = applySystemToEntitiesForSystem(
                ctrl.key,
                selectedOption.value,
                selectedOption.label,
                factions,
                dimension,
                systemId,
                player,
                targetFaction,
                ctrl.label
              );
              if (feedbackPresenter && entry) {
                feedbackPresenter.present({ context: entry.context, value: entry.value, status: entry.status });
              } else if (feedbackPresenter) {
                feedbackPresenter.present({
                  context: systemConfig.displayName,
                  value: "Error al aplicar",
                  status: "error",
                });
              }
              ctrl.lastAppliedIndex = idx;
            });
          } else {
            ctrl.obs.subscribe((enabled: boolean) => {
              if (enabled === ctrl.lastValue) return;
              const entry = applySystemToEntitiesForSystem(
                ctrl.key,
                enabled,
                enabled ? TOGGLE_ON_LABEL : TOGGLE_OFF_LABEL,
                factions,
                dimension,
                systemId,
                player,
                targetFaction,
                ctrl.label
              );
              if (feedbackPresenter && entry) {
                feedbackPresenter.present({ context: entry.context, value: entry.value, status: entry.status });
              } else if (feedbackPresenter) {
                feedbackPresenter.present({
                  context: systemConfig.displayName,
                  value: ERROR_MESSAGES.APPLY,
                  status: "error",
                });
              }
              ctrl.lastValue = enabled;
            });
          }
        }

        for (const ctrl of groupControls) {
          if (ctrl.kind === "dropdown") {
            ctrl.obs.subscribe((idx: number) => {
              if (idx === ctrl.lastAppliedIndex) return;
              if (idx < 0) return;
              const selectedOption = systemConfig.options![idx] ?? systemConfig.options![0];
              const entry = applySystemToEntitiesForSystem(
                ctrl.key,
                selectedOption.value,
                selectedOption.label,
                factions,
                dimension,
                systemId,
                player,
                targetFaction,
                ctrl.label
              );
              if (feedbackPresenter && entry) {
                feedbackPresenter.present({ context: entry.context, value: entry.value, status: entry.status });
              } else if (feedbackPresenter) {
                feedbackPresenter.present({
                  context: systemConfig.displayName,
                  value: ERROR_MESSAGES.APPLY,
                  status: "error",
                });
              }
              ctrl.lastAppliedIndex = idx;
            });
          } else {
            ctrl.obs.subscribe((enabled: boolean) => {
              if (enabled === ctrl.lastValue) return;
              const entry = applySystemToEntitiesForSystem(
                ctrl.key,
                enabled,
                enabled ? TOGGLE_ON_LABEL : TOGGLE_OFF_LABEL,
                factions,
                dimension,
                systemId,
                player,
                targetFaction,
                ctrl.label
              );
              if (feedbackPresenter && entry) {
                feedbackPresenter.present({ context: entry.context, value: entry.value, status: entry.status });
              } else if (feedbackPresenter) {
                feedbackPresenter.present({
                  context: systemConfig.displayName,
                  value: ERROR_MESSAGES.APPLY,
                  status: "error",
                });
              }
              ctrl.lastValue = enabled;
            });
          }
        }

        const { counts, nametagsByKey } = buildCountsAndNametags(dimension, factions);
        updateControlLabels(hierarchyControls, groupControls, counts, nametagsByKey);
        form.spacer();
        form.button(stripColorCodes(BACK_BUTTON_LABEL), () => {
          closeReason = "navigation";
          form.close();
        });

        form
          .show()
          .then((reason) => {
            if (reason === "ClientClosed") {
              debug("commandMenuDDUI", `Sistema §b${systemId}§r cerrado: X del cliente (§b${player.name}§r)`, { level: "debug", color: "gray" });
              commandMenuSessionStore.cleanup(player.id);
            } else if (reason === "UserBusy") {
              debug("commandMenuDDUI", `Sistema §b${systemId}§r cerrado: §6UserBusy§r (§b${player.name}§r)`, { level: "warn", color: "gray" });
              commandMenuSessionStore.cleanup(player.id);
            } else if (reason === "ServerClosed") {
              if (closeReason === "navigation") {
                debug("commandMenuDDUI", `Sistema §b${systemId}§r cerrado: §6navegación§r (§b${player.name}§r)`, { level: "debug", color: "gray" });
                if (session && intervalId !== null) {
                  session.unregisterInterval(intervalId);
                }
                if (returnTo === "advanced") {
                  import("../panels/advancedPanel.js").then(({ showAdvancedPanel }) =>
                    showAdvancedPanel(player, targetFaction as TargetFaction)
                  );
                } else {
                  import("../panels/mainPanel.js").then(({ showMainPanel }) =>
                    showMainPanel(player, targetFaction as TargetFaction)
                  );
                }
              } else {
                debug(
                  "commandMenuDDUI",
                  `Sistema §b${systemId}§r cerrado: §cServerClosed sin razón§r (§b${player.name}§r)`,
                  { level: "warn", color: "gray" }
                );
                commandMenuSessionStore.cleanup(player.id);
              }
            }
            closeReason = undefined;
          })
          .catch((err) => {
            debug("commandMenuDDUI", `Error en form.show() sistema §b${systemId}§r: ${err}`, { level: "error", color: "red" });
            commandMenuSessionStore.cleanup(player.id);
          });
      }
    } catch (e) {
      debug("commandMenuDDUI", `§cError§r en buildSystemView §b${systemId}§r: ${e}`, { level: "error", color: "red" });
    }
  };
}
