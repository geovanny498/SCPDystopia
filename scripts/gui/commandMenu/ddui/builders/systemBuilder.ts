// scripts/gui/commandMenu/ddui/builders/systemBuilder.ts

import { Player, Dimension, system } from "@minecraft/server";
import {
  CustomForm,
  ObservableNumber,
  ObservableBoolean,
  ObservableString,
  type DropdownOptions,
  type ToggleOptions,
} from "@minecraft/server-ui";
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
  getSystemDefaultForKey,
  type CatalogSystem,
  type OptionValue,
  type SystemOption,
} from "../../../shared/systemCatalog.js";
import {
  SYSTEM_PANEL_FEEDBACK_INITIAL,
  type DDUIFeedbackEntry,
  type DDUIFeedbackPresenter,
} from "../../../shared/dduiFeedback.js";
import { PlayerPermissionManager, FactionId } from "../../../shared/playerPermissionManager.js";
import { commandMenuSessionStore, type CommandMenuSession } from "../sessionStore.js";
import { stripColorCodes } from "../helpers/formHelpers.js";
import { addHistoryEntry, getSystemShortName } from "../helpers/historyStore.js";
import {
  SpecialGroups,
  Factions,
  FACTION_IDS,
  UnitHierarchyId,
  TargetFaction,
  type DefaultsKey,
} from "../../../../constants/domains.js";
import { getEntitySystemState, getSystemDefaults } from "../../menu_config.js";
import { loadSystemStates, saveSystemAndUpdateMemory } from "../../core/menu_state.js";
import {
  applySystemsToEntities,
  type EligibleSoldier,
} from "../../../commandMenu/core/menu_apply.js";
import { scanActiveEntities } from "../../../commandMenu/model/menu_entity_scanner.js";
import { loadScope, isEntityInScope } from "../../../commandMenu/model/menu_scope.js";
import { isSystemBlockedForEntity } from "../../../commandMenu/model/menu_faction.js";
import type { SystemFactionState, SystemState } from "../../../commandMenu/model/menu_system_state.js";

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

interface CountsAndNametags {
  counts: Record<string, number>;
  nametagsByKey: Record<string, Set<string>>;
  differencesByKey: Record<string, Partial<Record<FactionId, number>>>;
}

function findOptionIndex(options: readonly SystemOption[], value: unknown): number {
  if (value === undefined || value === null) return -1;
  const strValue = String(value);
  const found = options.findIndex((opt) => opt.value === strValue);
  return found;
}

function buildInitialState(
  systemId: SystemId,
  factions: readonly FactionId[]
): SystemState {
  const loadedStates = loadSystemStates([systemId]);
  const defaults = getSystemDefaults(systemId);
  const result: SystemState = {};
  for (const fac of factions) {
    const loadedFaction: SystemFactionState = loadedStates[systemId]?.[fac] || {};
    const defaultFaction: SystemFactionState = defaults[fac] || {};
    const merged: SystemFactionState = { ...defaultFaction };
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
  options: SystemOption[]
): { label: string; value: number; description?: string }[] {
  return options.map((o, idx) => ({
    label: stripColorCodes(o.label),
    value: idx,
    description: o.description ? stripColorCodes(o.description) : undefined,
  }));
}

function buildDropdownItemsPlain(options: SystemOption[]): { label: string; value: number }[] {
  return options.map((o, idx) => ({ label: stripColorCodes(o.label), value: idx }));
}

/**
 * Construye los conteos por jerarquía/grupo y el conjunto de nametags de entidades especiales,
 * filtrando únicamente entidades elegibles según scope y compatibilidad de catálogo.
 * @param {Dimension} dimension - Dimensión a evaluar
 * @param {readonly FactionId[]} factions - Lista de facciones a escanear
 * @param {CatalogSystem} systemConfig - Sistema cuya elegibilidad y estado efectivo se diagnostican
 * @param {Record<string, unknown>} visibleValues - Valores reales visibles por jerarquía/grupo
 * @returns {CountsAndNametags} Conteos, nametags y diferencias elegibles por facción
 */
function buildCountsAndNametags(
  dimension: Dimension,
  factions: readonly FactionId[],
  systemConfig: CatalogSystem,
  visibleValues: Record<string, unknown>
): CountsAndNametags {
  const counts: Record<string, number> = {};
  const nametagsByKey: Record<string, Set<string>> = {};
  const differencesByKey: Record<string, Partial<Record<FactionId, number>>> = {};
  const scope = loadScope();

  for (const fac of factions) {
    const result = scanActiveEntities(dimension, fac);
    for (const se of result.entities) {
      if (!isEntityInScope(se.entity, se.faction, scope, se.nametag)) {
        continue;
      }
      if (isSystemBlockedForEntity(systemConfig, se.entity)) continue;

      const entityKey = se.isSpecial ? se.group : se.hierarchy;
      if (!entityKey) continue;
      counts[entityKey] = (counts[entityKey] || 0) + 1;

      if (Object.prototype.hasOwnProperty.call(visibleValues, entityKey)) {
        const registeredValue = getEntitySystemState(se.entity, systemConfig.id);
        const effectiveValue =
          registeredValue ??
          getSystemDefaultForKey(systemConfig.id, se.faction as FactionId, entityKey as DefaultsKey);
        if (effectiveValue !== visibleValues[entityKey]) {
          const differencesByFaction = differencesByKey[entityKey] ?? {};
          differencesByFaction[se.faction as FactionId] = (differencesByFaction[se.faction as FactionId] ?? 0) + 1;
          differencesByKey[entityKey] = differencesByFaction;
        }
      }

      if (se.isSpecial && se.nametag) {
        if (!nametagsByKey[entityKey]) nametagsByKey[entityKey] = new Set();
        nametagsByKey[entityKey].add(stripColorCodes(se.nametag));
      }
    }
  }

  return { counts, nametagsByKey, differencesByKey };
}

function buildVisibleValues(
  controls: ControlRecord[],
  systemOptions: SystemOption[] | undefined
): Record<string, unknown> {
  const visibleValues: Record<string, unknown> = {};

  for (const ctrl of controls) {
    if (ctrl.kind === "dropdown") {
      const selectedOption = systemOptions?.[ctrl.lastAppliedIndex] ?? systemOptions?.[0];
      if (selectedOption !== undefined) {
        visibleValues[ctrl.key] = selectedOption.value;
      }
    } else {
      visibleValues[ctrl.key] = ctrl.lastValue;
    }
  }

  return visibleValues;
}

function updateControlLabels(
  hierarchyControls: ControlRecord[],
  groupControls: ControlRecord[],
  counts: Record<string, number>,
  nametagsByKey: Record<string, Set<string>>,
  differencesByKey: Record<string, Partial<Record<FactionId, number>>>,
  factions: readonly FactionId[]
): void {
  const buildLabelText = (ctrl: ControlRecord): string => {
    const count = counts[ctrl.key] || 0;
    const differences = differencesByKey[ctrl.key] ?? {};
    const baseText = `${stripColorCodes(ctrl.label)}: (${count})`;

    if (factions.length > 1) {
      const foundationDifferent = differences[Factions.FOUNDATION] ?? 0;
      const chaosDifferent = differences[Factions.CHAOS] ?? 0;
      return foundationDifferent === 0 && chaosDifferent === 0
        ? baseText
        : `${baseText} · F:${foundationDifferent} C:${chaosDifferent} dif.`;
    }

    const different = differences[factions[0]] ?? 0;
    return different === 0 ? baseText : `${baseText} · ${different} dif.`;
  };

  for (const ctrl of hierarchyControls) {
    ctrl.labelObs.setData(buildLabelText(ctrl));
  }

  for (const ctrl of groupControls) {
    const count = counts[ctrl.key] || 0;
    ctrl.labelObs.setData(buildLabelText(ctrl));

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
  initialStates: SystemState,
  factions: readonly FactionId[],
  form: CustomForm,
  isGroup: boolean,
  systemConfig: CatalogSystem,
  visibleObs?: ObservableBoolean,
  firstVisibleIndex: number = -1
): ControlRecord[] {
  const controls: ControlRecord[] = [];
  const { controlType, options: systemOptions } = systemConfig;
  const referenceFaction = factions.length > 1 ? Factions.FOUNDATION : factions[0];

  for (let i = 0; i < controlOptions.length; i++) {
    const opt = controlOptions[i];
    let initialValue: number | boolean = controlType === "dropdown" ? 0 : false;
    const referenceValue = initialStates[referenceFaction]?.[opt.value];

    if (controlType === "dropdown") {
      const foundIndex = findOptionIndex(systemOptions ?? [], referenceValue);
      if (foundIndex >= 0) {
        initialValue = foundIndex;
      }
    } else if (typeof referenceValue === "boolean") {
      initialValue = referenceValue;
    }

    const baseLabel = stripColorCodes(opt.label);
    const labelObs = new ObservableString(`${baseLabel}: (0)`);
    const descObs = isGroup ? new ObservableString(`N/A`) : undefined;

    let disabled = false;
    if (!isGroup) {
      const hierarchyKey = opt.value as UnitHierarchyId;
      disabled = systemConfig.blockedByHierarchy?.[hierarchyKey] === true;
    }

    if (controlType === "dropdown") {
      const obs = new ObservableNumber(initialValue as number, { clientWritable: true });
      const dropdownOptions: DropdownOptions = {};
      if (disabled) dropdownOptions.disabled = true;
      if (isGroup && descObs) dropdownOptions.description = descObs;
      if (visibleObs) dropdownOptions.visible = visibleObs;
      form.dropdown(
        labelObs,
        obs,
        i === firstVisibleIndex
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
      const toggleOptions: ToggleOptions = {};
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
  value: OptionValue,
  valueLabel: string,
  factions: readonly FactionId[],
  dimension: Dimension,
  systemConfig: CatalogSystem,
  player: Player,
  targetFaction: TargetFaction | undefined,
  label: string
): DDUIFeedbackEntry | null {
  try {
    const systemId = systemConfig.id;
    const allEligible: EligibleSoldier[] = [];
    const scope = loadScope();

    for (const fac of factions) {
      const scanResult = scanActiveEntities(dimension, fac);

      for (const se of scanResult.entities) {
        if (se.faction !== fac) continue;
        if (se.isSpecial) {
          if (se.group !== key) continue;
        } else {
          if (se.hierarchy !== key) continue;
        }

        if (!isEntityInScope(se.entity, se.faction, scope, se.nametag)) {
          continue;
        }
        if (isSystemBlockedForEntity(systemConfig, se.entity)) continue;

        allEligible.push({
          entity: se.entity,
          factionInfo: {
            faction: fac,
            isSpecial: se.isSpecial,
            nametag: se.nametag,
            hierarchy: se.hierarchy,
            group: se.group || (se.isSpecial ? SpecialGroups.NO_GROUP : null),
          },
        });
      }
    }

    const systemOverrideState: SystemState = {};
    for (const fac of factions) {
      systemOverrideState[fac] = { [key]: value };
    }

    const { successes } = applySystemsToEntities(allEligible, [systemId], {
      player,
      skipCompatibilityCheck: true,
      cached: {
        systemStates: {
          [systemId]: systemOverrideState,
        },
      },
    });

    const appliedEntries: string[] = [];
    for (const fac of factions) {
      const appliedCount = successes.filter(
        (success) => success.systemId === systemId && success.faction === fac
      ).length;
      if (appliedCount > 0) {
        appliedEntries.push(
          `${FACTION_DISPLAY_NAMES[fac as keyof typeof FACTION_DISPLAY_NAMES] ?? fac}: ${appliedCount}`
        );
      }
    }

    const summary = appliedEntries.length > 0 ? appliedEntries.join(" | ") : "0 unidades";
    const systemShortName = getSystemShortName(systemId);

    const partialState: SystemState = {};
    for (const fac of factions) {
      partialState[fac] = { [key]: value };
    }
    try {
      saveSystemAndUpdateMemory(systemId, partialState);
    } catch (e) {
      debug("commandMenuDDUI", `Error guardando estado de sistema §b${systemId}§r: ${e}`, {
        level: "error",
        color: "red",
      });
    }

    if (targetFaction === "both") {
      for (const fac of FACTION_IDS) {
        addHistoryEntry({
          playerName: player.name,
          faction: fac,
          systemShortName,
          key: label,
          value: valueLabel,
        });
      }
    } else {
      addHistoryEntry({
        playerName: player.name,
        faction: targetFaction ?? Factions.FOUNDATION,
        systemShortName,
        key: label,
        value: valueLabel,
      });
    }

    return {
      context: systemShortName,
      value: `${label}: ${valueLabel} (${summary})`,
      status: "ok",
      timestamp: Date.now(),
      viewId: `commandMenu:${targetFaction ?? Factions.FOUNDATION}:system:${systemId}`,
    };
  } catch (e) {
    debug("commandMenuDDUI", `§cError§r aplicando control §b${systemConfig.id}§r [§b${key}§r]: ${e}`, {
      level: "error",
      color: "red",
    });
    return null;
  }
}

function resolveSystemViewFilter(
  player: Player,
  targetFaction: TargetFaction | undefined,
  isAdmin: boolean,
  viewFilter: SystemViewParams["viewFilter"],
  session: CommandMenuSession | undefined
): { canFilter: boolean; resolvedViewFilter: "all" | "hierarchy" | "specials" } {
  let canFilter = isAdmin;
  if (!canFilter) {
    if (targetFaction === "both") {
      const foundationRole = PlayerPermissionManager.getPlayerRole(player, Factions.FOUNDATION);
      const chaosRole = PlayerPermissionManager.getPlayerRole(player, Factions.CHAOS);
      canFilter =
        isMenuFeatureVisible("scope", foundationRole, false, "foundation") ||
        isMenuFeatureVisible("scope", chaosRole, false, "chaos");
    } else if (targetFaction) {
      const scopeRole = PlayerPermissionManager.getPlayerRole(player, targetFaction as FactionId);
      canFilter = isMenuFeatureVisible("scope", scopeRole, false, targetFaction);
    }
  }

  if (!canFilter) {
    return { canFilter, resolvedViewFilter: "specials" };
  }

  let persistedFilter: "all" | "hierarchy" | "specials" | undefined;
  try {
    const dp = player.getDynamicProperty("scpd_system_view_filter");
    if (dp === "all" || dp === "hierarchy" || dp === "specials") {
      persistedFilter = dp;
    }
  } catch {
    // DP no disponible
  }

  return {
    canFilter,
    resolvedViewFilter:
      viewFilter ??
      persistedFilter ??
      (session?.formState.systemViewFilter as "all" | "hierarchy" | "specials" | undefined) ??
      "all",
  };
}

function subscribeToSystemControls(
  hierarchyControls: ControlRecord[],
  groupControls: ControlRecord[],
  feedbackPresenter: DDUIFeedbackPresenter | null,
  systemConfig: CatalogSystem,
  factions: readonly FactionId[],
  dimension: Dimension,
  player: Player,
  targetFaction: TargetFaction | undefined
): void {
  const systemOptions = systemConfig.options;

  for (const ctrl of [...hierarchyControls, ...groupControls]) {
    if (ctrl.kind === "dropdown") {
      ctrl.obs.subscribe((idx: number) => {
        if (idx === ctrl.lastAppliedIndex) return;
        if (idx < 0) return;
        const selectedOption = systemOptions![idx] ?? systemOptions![0];
        const appliedIndex = systemOptions![idx] === undefined ? 0 : idx;
        const entry = applySystemToEntitiesForSystem(
          ctrl.key,
          selectedOption.value,
          selectedOption.label,
          factions,
          dimension,
          systemConfig,
          player,
          targetFaction,
          ctrl.label
        );
        ctrl.lastAppliedIndex = appliedIndex;
        if (feedbackPresenter && entry) {
          feedbackPresenter.present({ context: entry.context, value: entry.value, status: entry.status });
        } else if (feedbackPresenter) {
          feedbackPresenter.present({
            context: systemConfig.displayName,
            value: ERROR_MESSAGES.APPLY,
            status: "error",
          });
        }
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
          systemConfig,
          player,
          targetFaction,
          ctrl.label
        );
        ctrl.lastValue = enabled;
        if (feedbackPresenter && entry) {
          feedbackPresenter.present({ context: entry.context, value: entry.value, status: entry.status });
        } else if (feedbackPresenter) {
          feedbackPresenter.present({
            context: systemConfig.displayName,
            value: ERROR_MESSAGES.APPLY,
            status: "error",
          });
        }
      });
    }
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
      player.sendMessage(ERROR_MESSAGES.SYSTEM_NOT_FOUND);
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
      const factions: readonly FactionId[] =
        targetFaction === "both" ? FACTION_IDS : [(targetFaction ?? Factions.FOUNDATION) as FactionId];
      const initialStates = buildInitialState(systemId, factions);
      const session = commandMenuSessionStore.get(player.id);

      const feedbackPresenter = session
        ? session.getOrCreateFeedbackPresenter(
            `commandMenu:${targetFaction ?? Factions.FOUNDATION}:system:${systemId}`,
            SYSTEM_PANEL_FEEDBACK_INITIAL
          )
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
        const { canFilter, resolvedViewFilter } = resolveSystemViewFilter(
          player,
          targetFaction,
          isAdmin,
          viewFilter,
          session
        );

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
          initialStates,
          factions,
          form,
          false,
          systemConfig,
          hierarchyVisibleObs,
          isDropdown ? 0 : -1
        );

        form.spacer({ visible: groupVisibleObs });
        form.header(SYSTEM_VIEW_FILTER_OPTIONS.find((o) => o.value === "specials")!.label, {
          visible: groupVisibleObs,
        });
        form.spacer({ visible: groupVisibleObs });

        const groupControls = buildControls(
          SPECIAL_GROUP_OPTIONS,
          initialStates,
          factions,
          form,
          true,
          systemConfig,
          groupVisibleObs,
          isDropdown ? 0 : -1
        );

        const refreshControlLabels = (): void => {
          const visibleValues = buildVisibleValues([...hierarchyControls, ...groupControls], systemConfig.options);
          const { counts, nametagsByKey, differencesByKey } = buildCountsAndNametags(
            dimension,
            factions,
            systemConfig,
            visibleValues
          );
          updateControlLabels(
            hierarchyControls,
            groupControls,
            counts,
            nametagsByKey,
            differencesByKey,
            factions
          );
        };

        const intervalId = system.runInterval(() => {
          try {
            refreshControlLabels();
          } catch (e) {
            debug("commandMenuDDUI", `Error en intervalo de contadores: ${e}`, { level: "warn", color: "yellow" });
          }
        }, 20);

        if (session) {
          session.registerInterval(intervalId);
        }

        subscribeToSystemControls(
          hierarchyControls,
          groupControls,
          feedbackPresenter,
          systemConfig,
          factions,
          dimension,
          player,
          targetFaction
        );

        refreshControlLabels();
        form.spacer();
        form.button(stripColorCodes(BACK_BUTTON_LABEL), () => {
          closeReason = "navigation";
          form.close();
        });

        form
          .show()
          .then((reason) => {
            if (reason === "ClientClosed") {
              debug("commandMenuDDUI", `Sistema §b${systemId}§r cerrado: X del cliente (§b${player.name}§r)`, {
                level: "debug",
                color: "gray",
              });
              commandMenuSessionStore.cleanup(player.id);
            } else if (reason === "UserBusy") {
              debug("commandMenuDDUI", `Sistema §b${systemId}§r cerrado: §6UserBusy§r (§b${player.name}§r)`, {
                level: "warn",
                color: "gray",
              });
              commandMenuSessionStore.cleanup(player.id);
            } else if (reason === "ServerClosed") {
              if (closeReason === "navigation") {
                debug("commandMenuDDUI", `Sistema §b${systemId}§r cerrado: §6navegación§r (§b${player.name}§r)`, {
                  level: "debug",
                  color: "gray",
                });
                if (session) {
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
            debug("commandMenuDDUI", `Error en form.show() sistema §b${systemId}§r: ${err}`, {
              level: "error",
              color: "red",
            });
            commandMenuSessionStore.cleanup(player.id);
          });
      }
    } catch (e) {
      debug("commandMenuDDUI", `§cError§r en buildSystemView §b${systemId}§r: ${e}`, { level: "error", color: "red" });
    }
  };
}
