// scripts/gui/commandMenu/ddui/builders/systemBuilder.ts

import { Player, Dimension, Entity, system } from "@minecraft/server";
import { CustomForm, ObservableNumber, ObservableBoolean, ObservableString } from "@minecraft/server-ui";
import { debugWarn, debugMessage } from "../../../../utils/debug.js";
import {
  CATALOG_SYSTEMS,
  BACK_BUTTON_LABEL,
  SYSTEM_PANEL_FEEDBACK_INITIAL,
  FACTION_DISPLAY_NAMES,
  PANEL_TITLES,
  SPECIAL_GROUP_OPTIONS,
  HIERARCHY_OPTIONS,
} from "../../../shared/systemCatalog.js";
import { cleanupSession, pauseSession, commandMenuSessionStore } from "../sessionStore.js";
import { showAdvancedPanel } from "../panels/advancedPanel.js";
import { stripColorCodes } from "../helpers/formHelpers.js";
import { addHistoryEntry, getSystemShortName } from "../helpers/historyStore.js";
import { getSystemConfig, getSystemDefaults, getEntitySystemState, SpecialGroups } from "../../menu_config.js";
import { loadSystemStates, saveSystemAndUpdateMemory } from "../../core/menu_state.js";
import { applySystemsToEntities } from "../../../commandMenu/core/menu_apply.js";
import { scanActiveEntities } from "../../../commandMenu/model/menu_entity_scanner.js";

export interface SystemViewParams {
  systemId: string;
  player: Player;
  targetFaction?: string;
  returnTo?: "main" | "advanced";
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

function buildInitialState(systemId: string, factions: string[], key: string): Record<string, Record<string, unknown>> {
  const loadedStates = loadSystemStates([systemId]);
  const systemState = loadedStates[systemId] || getSystemDefaults(systemId);
  const result: Record<string, Record<string, unknown>> = {};
  for (const fac of factions) {
    const factionState = (systemState as Record<string, Record<string, unknown>>)[fac] || {};
    result[fac] = factionState;
  }
  return result;
}

function buildDropdownItems(options: { label: string; value: unknown }[]): { label: string; value: number }[] {
  return options.map((o, idx) => ({ label: stripColorCodes(o.label), value: idx }));
}

function buildCountsAndNametags(dimension: Dimension, factions: string[]): {
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
        ctrl.descriptionObs.setData(`(N/A)`);
      } else {
        const sorted = Array.from(nametagSet).sort();
        const MAX_DISPLAY = 3;
        const truncated = sorted.slice(0, MAX_DISPLAY).join(", ");
        const more = sorted.length > MAX_DISPLAY ? ` +${sorted.length - MAX_DISPLAY} más` : "";
        ctrl.descriptionObs.setData(`(${truncated}${more})`);
      }
    }
  }
}

function buildControls(
  controlOptions: { value: string; label: string }[],
  systemOptions: { label: string; value: unknown }[] | undefined,
  initialStates: Record<string, Record<string, unknown>>,
  factions: string[],
  form: CustomForm,
  controlType: "dropdown" | "toggle",
  isGroup: boolean
): ControlRecord[] {
  const controls: ControlRecord[] = [];
  const systemOptionsForIndex = systemOptions?.map((o) => ({ value: String(o.value), label: o.label })) ?? [];

  for (const opt of controlOptions) {
    let initialValue: number | boolean = controlType === "dropdown" ? 0 : false;
    for (const fac of factions) {
      const factionState = initialStates[fac as string] || {};
      const currentValue = factionState[opt.value];
      if (controlType === "dropdown") {
        const foundIndex = findOptionIndex(systemOptionsForIndex, currentValue);
        if (foundIndex >= 0) {
          initialValue = foundIndex;
          break;
        }
      } else {
        if (typeof currentValue === "boolean") {
          initialValue = currentValue;
          break;
        }
      }
    }

    const labelObs = new ObservableString(`${stripColorCodes(opt.label)}: (0)`);
    const descObs = isGroup ? new ObservableString(`(N/A)`) : undefined;

    if (controlType === "dropdown") {
      const obs = new ObservableNumber(initialValue as number, { clientWritable: true });
      form.dropdown(
        labelObs,
        obs,
        buildDropdownItems(systemOptions ?? []),
        isGroup ? { description: descObs } : undefined
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
      form.toggle(labelObs, obs, isGroup && descObs ? { description: descObs } : undefined);
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
  systemId: string,
  player: Player,
  targetFaction: string | undefined,
  label: string
): string {
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
    const displayName = stripColorCodes(CATALOG_SYSTEMS[systemId].displayName);
    const cleanLabel = stripColorCodes(label);
    const cleanValue = stripColorCodes(valueLabel);
    const feedback = `§a✓ §7${displayName} [${cleanLabel}]: §f${cleanValue} §8(${summary})`;

    const partialState: Record<string, Record<string, unknown>> = {};
    for (const fac of factions) {
      partialState[fac] = { [key]: value };
    }
    try {
      saveSystemAndUpdateMemory(systemId, partialState);
    } catch (e) {
      debugWarn("commandMenuDDUI", `Error guardando estado de sistema ${systemId}: ${e}`, "red");
    }

    const session = commandMenuSessionStore.get(player.id);
    if (session) {
      addHistoryEntry({
        playerName: player.name,
        faction: targetFaction ?? "foundation",
        systemShortName: getSystemShortName(systemId),
        key: cleanLabel,
        value: cleanValue,
      });
    }

    return feedback;
  } catch (e) {
    debugWarn("commandMenuDDUI", `Error aplicando control ${systemId} [${key}]: ${e}`, "red");
    return "";
  }
}

export function buildSystemView({ systemId, player, targetFaction, returnTo }: SystemViewParams): () => void {
  const systemConfig = CATALOG_SYSTEMS[systemId];
  const legacySystem = getSystemConfig(systemId);
  if (!systemConfig || !legacySystem) {
    return () => {
      player.sendMessage("§c[SCPDystopia] Sistema no encontrado.");
    };
  }

  return () => {
    try {
      const form = new CustomForm(player, `${PANEL_TITLES.system} - ${stripColorCodes(systemConfig.displayName)}`);
      const feedbackText = new ObservableString(SYSTEM_PANEL_FEEDBACK_INITIAL);

      form.spacer();
      form.label(
        `§7Facción: §f${targetFaction === "both" ? "Ambas facciones" : (FACTION_DISPLAY_NAMES[targetFaction as keyof typeof FACTION_DISPLAY_NAMES] ?? targetFaction)}`
      );
      form.spacer();
      form.label(feedbackText);
      form.spacer();

      const dimension = player.dimension;
      const factions: string[] = targetFaction === "both" ? ["foundation", "chaos"] : [targetFaction ?? "foundation"];
      const initialStates = buildInitialState(systemId, factions, systemId);

      if ((systemConfig.controlType === "dropdown" && systemConfig.options) || systemConfig.controlType === "toggle") {
        form.header("§7No especiales");
        form.spacer();

        const hierarchyControls = buildControls(
          HIERARCHY_OPTIONS,
          systemConfig.options!,
          initialStates,
          factions,
          form,
          systemConfig.controlType,
          false
        );

        form.spacer();
        form.header("§6Especiales");
        form.spacer();

        const groupControls = buildControls(
          SPECIAL_GROUP_OPTIONS,
          systemConfig.options!,
          initialStates,
          factions,
          form,
          systemConfig.controlType,
          true
        );

        const intervalId = system.runInterval(() => {
          try {
            const { counts, nametagsByKey } = buildCountsAndNametags(dimension, factions);
            updateControlLabels(hierarchyControls, groupControls, counts, nametagsByKey);
          } catch (e) {
            debugWarn("commandMenuDDUI", `Error en intervalo de contadores: ${e}`, "red");
          }
        }, 20);

        const session = commandMenuSessionStore.get(player.id);
        if (session) {
          session.registerInterval(intervalId);
        }

        for (const ctrl of hierarchyControls) {
          if (ctrl.kind === "dropdown") {
            ctrl.obs.subscribe((idx: number) => {
              if (idx === ctrl.lastAppliedIndex) return;
              if (idx < 0) return;
              const selectedOption = systemConfig.options![idx] ?? systemConfig.options![0];
              const feedback = applySystemToEntitiesForSystem(ctrl.key, selectedOption.value, selectedOption.label, factions, dimension, systemId, player, targetFaction, ctrl.label);
              feedbackText.setData(feedback);
              ctrl.lastAppliedIndex = idx;
            });
          } else {
            ctrl.obs.subscribe((enabled: boolean) => {
              if (enabled === ctrl.lastValue) return;
              const feedback = applySystemToEntitiesForSystem(ctrl.key, enabled, enabled ? "Activado" : "Desactivado", factions, dimension, systemId, player, targetFaction, ctrl.label);
              feedbackText.setData(feedback);
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
              const feedback = applySystemToEntitiesForSystem(ctrl.key, selectedOption.value, selectedOption.label, factions, dimension, systemId, player, targetFaction, ctrl.label);
              feedbackText.setData(feedback);
              ctrl.lastAppliedIndex = idx;
            });
          } else {
            ctrl.obs.subscribe((enabled: boolean) => {
              if (enabled === ctrl.lastValue) return;
              const feedback = applySystemToEntitiesForSystem(ctrl.key, enabled, enabled ? "Activado" : "Desactivado", factions, dimension, systemId, player, targetFaction, ctrl.label);
              feedbackText.setData(feedback);
              ctrl.lastValue = enabled;
            });
          }
        }

        const { counts, nametagsByKey } = buildCountsAndNametags(dimension, factions);
        updateControlLabels(hierarchyControls, groupControls, counts, nametagsByKey);

        form.button(stripColorCodes(BACK_BUTTON_LABEL), () => {
          try {
            system.clearRun(intervalId);
          } catch {
            // intervalo ya limpiado o inválido
          }
          form.close();
          if (returnTo === "advanced") {
            system.run(() => import("../panels/advancedPanel.js").then(({ showAdvancedPanel }) => showAdvancedPanel(player, targetFaction)));
          } else {
            system.run(() => import("../panels/mainPanel.js").then(({ showMainPanel }) => showMainPanel(player)));
          }
        });

        form
          .show()
          .then((reason) => {
            try {
              system.clearRun(intervalId);
            } catch {
              // intervalo ya limpiado o inválido
            }
            debugMessage("commandMenuDDUI", `Sistema ${systemId} cerrado: ${reason}`, "gray");
            if (reason === "ClientClosed") {
              pauseSession(player.id);
            }
          })
          .catch((err) => {
            try {
              system.clearRun(intervalId);
            } catch {
              // intervalo ya limpiado o inválido
            }
            debugWarn("commandMenuDDUI", `Error en form.show() sistema ${systemId}: ${err}`, "red");
            cleanupSession(player.id);
          });
      }
    } catch (e) {
      debugWarn("commandMenuDDUI", `Error en buildSystemView ${systemId}: ${e}`, "red");
    }
  };
}
