// scripts/gui/commandMenu/ddui/builders/systemBuilder.ts

import { Player, system, world } from "@minecraft/server";
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
import { stripColorCodes } from "../helpers/formHelpers.js";
import { addHistoryEntry, getSystemShortName } from "../helpers/historyStore.js";
import { getSystemConfig, getSystemDefaults, getEntitySystemState } from "../../menu_config.js";
import { loadSystemStates } from "../../core/menu_state.js";
import { applySystemToEntity, getEligibleSoldiers } from "../../../commandMenu/core/menu_apply.js";
import { loadScope } from "../../../commandMenu/model/menu_scope.js";
import { saveSystemAndUpdateMemory } from "../../core/menu_state.js";

export interface SystemViewParams {
  systemId: string;
  player: Player;
  targetFaction?: string;
}

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

export function buildSystemView({ systemId, player, targetFaction }: SystemViewParams): () => void {
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

      const scope = loadScope();
      const dimensions = ["overworld", "nether", "the_end"].map((id) => world.getDimension(id)).filter(Boolean);
      const factions: string[] = targetFaction === "both" ? ["foundation", "chaos"] : [targetFaction ?? "foundation"];

      const initialStates = buildInitialState(systemId, factions, systemId);

      if (systemConfig.controlType === "dropdown" && systemConfig.options) {
        form.header("§7No especiales");
        form.spacer();

        const hierarchyControls: { key: string; label: string; obs: ObservableNumber; lastAppliedIndex: number }[] = [];
        for (const opt of HIERARCHY_OPTIONS) {
          let initialIndex = 0;
          for (const fac of factions) {
            const factionState = initialStates[fac as string] || {};
            const currentValue = factionState[opt.value];
            const foundIndex = findOptionIndex(systemConfig.options, currentValue);
            if (foundIndex >= 0) {
              initialIndex = foundIndex;
              break;
            }
          }

          const obs = new ObservableNumber(initialIndex, { clientWritable: true });
          form.dropdown(
            `${stripColorCodes(opt.label)}:`,
            obs,
            systemConfig.options.map((o, idx) => ({ label: stripColorCodes(o.label), value: idx }))
          );
          hierarchyControls.push({ key: opt.value, label: opt.label, obs, lastAppliedIndex: initialIndex });
        }

        form.spacer();
        form.header("§6Especiales");
        form.spacer();

        const groupControls: { key: string; label: string; obs: ObservableNumber; lastAppliedIndex: number }[] = [];
        for (const opt of SPECIAL_GROUP_OPTIONS) {
          let initialIndex = 0;
          for (const fac of factions) {
            const factionState = initialStates[fac as string] || {};
            const currentValue = factionState[opt.value];
            const foundIndex = findOptionIndex(systemConfig.options, currentValue);
            if (foundIndex >= 0) {
              initialIndex = foundIndex;
              break;
            }
          }

          const obs = new ObservableNumber(initialIndex, { clientWritable: true });
          form.dropdown(
            `${stripColorCodes(opt.label)}:`,
            obs,
            systemConfig.options.map((o, idx) => ({ label: stripColorCodes(o.label), value: idx }))
          );
          groupControls.push({ key: opt.value, label: opt.label, obs, lastAppliedIndex: initialIndex });
        }

        function applyDropdown(key: string, optionIndex: number, label: string, targetFaction?: string): void {
          try {
            const selectedOption = systemConfig.options![optionIndex] ?? systemConfig.options![0];
            const appliedEntries: string[] = [];

            for (const fac of factions) {
              let totalAffected = 0;
              const eligible = getEligibleSoldiers(dimensions as any, scope).filter((s: any) => {
                const fi = s.factionInfo;
                if (fi.faction !== fac) return false;
                if (fi.isSpecial) {
                  return fi.group === key;
                }
                return fi.hierarchy === key;
              });

              for (const { entity } of eligible) {
                const stateOverride: Record<string, any> = {
                  [fac as string]: {
                    [key]: selectedOption.value,
                  },
                };

                const applied = applySystemToEntity(
                  systemId,
                  legacySystem,
                  entity,
                  stateOverride,
                  true,
                  null,
                  player,
                  {}
                );

                if (applied) {
                  totalAffected++;
                }
              }

              if (totalAffected > 0) {
                appliedEntries.push(
                  `${FACTION_DISPLAY_NAMES[fac as keyof typeof FACTION_DISPLAY_NAMES] ?? fac}: ${totalAffected}`
                );
              }
            }

            const summary = appliedEntries.length > 0 ? appliedEntries.join(" | ") : "0 unidades";
            feedbackText.setData(
              `§a✓ §7${stripColorCodes(systemConfig.displayName)} [${label}]: §f${selectedOption?.label ?? ""} §8(${summary})`
            );

            const partialState: Record<string, Record<string, unknown>> = {};
            for (const fac of factions) {
              partialState[fac] = { [key]: selectedOption.value };
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
                key: label,
                value: selectedOption?.label ?? "",
              });
            }
          } catch (e) {
            debugWarn("commandMenuDDUI", `Error aplicando dropdown ${systemId} [${key}]: ${e}`, "red");
          }
        }

        for (const ctrl of hierarchyControls) {
          ctrl.obs.subscribe((idx) => {
            if (idx === ctrl.lastAppliedIndex) return;
            if (idx < 0) return;
            applyDropdown(ctrl.key, idx, ctrl.label, targetFaction);
            ctrl.lastAppliedIndex = idx;
          });
        }
        for (const ctrl of groupControls) {
          ctrl.obs.subscribe((idx) => {
            if (idx === ctrl.lastAppliedIndex) return;
            if (idx < 0) return;
            applyDropdown(ctrl.key, idx, ctrl.label, targetFaction);
            ctrl.lastAppliedIndex = idx;
          });
        }
      } else if (systemConfig.controlType === "toggle") {
        form.header("§7No especiales");
        form.spacer();

        const hierarchyToggles: { key: string; label: string; obs: ObservableBoolean; lastValue: boolean }[] = [];
        for (const opt of HIERARCHY_OPTIONS) {
          let initialValue = false;
          for (const fac of factions) {
            const factionState = initialStates[fac as string] || {};
            const currentValue = factionState[opt.value];
            if (typeof currentValue === "boolean") {
              initialValue = currentValue;
              break;
            }
          }

          const obs = new ObservableBoolean(initialValue, { clientWritable: true });
          form.toggle(stripColorCodes(opt.label), obs);
          hierarchyToggles.push({ key: opt.value, label: opt.label, obs, lastValue: initialValue });
        }

        form.spacer();
        form.header("§6Especiales");
        form.spacer();

        const groupToggles: { key: string; label: string; obs: ObservableBoolean; lastValue: boolean }[] = [];
        for (const opt of SPECIAL_GROUP_OPTIONS) {
          let initialValue = false;
          for (const fac of factions) {
            const factionState = initialStates[fac as string] || {};
            const currentValue = factionState[opt.value];
            if (typeof currentValue === "boolean") {
              initialValue = currentValue;
              break;
            }
          }

          const obs = new ObservableBoolean(initialValue, { clientWritable: true });
          form.toggle(stripColorCodes(opt.label), obs);
          groupToggles.push({ key: opt.value, label: opt.label, obs, lastValue: initialValue });
        }

        function applyToggle(key: string, enabled: boolean, label: string, targetFaction?: string): void {
          try {
            const appliedEntries: string[] = [];

            for (const fac of factions) {
              let totalAffected = 0;
              const eligible = getEligibleSoldiers(dimensions as any, scope).filter((s: any) => {
                const fi = s.factionInfo;
                if (fi.faction !== fac) return false;
                if (fi.isSpecial) {
                  return fi.group === key;
                }
                return fi.hierarchy === key;
              });

              for (const { entity } of eligible) {
                const stateOverride: Record<string, any> = {
                  [fac as string]: {
                    [key]: enabled,
                  },
                };

                const applied = applySystemToEntity(
                  systemId,
                  legacySystem,
                  entity,
                  stateOverride,
                  true,
                  null,
                  player,
                  {}
                );

                if (applied) {
                  totalAffected++;
                }
              }

              if (totalAffected > 0) {
                appliedEntries.push(
                  `${FACTION_DISPLAY_NAMES[fac as keyof typeof FACTION_DISPLAY_NAMES] ?? fac}: ${totalAffected}`
                );
              }
            }

            const summary = appliedEntries.length > 0 ? appliedEntries.join(" | ") : "0 unidades";
            feedbackText.setData(
              `§a✓ §7${stripColorCodes(systemConfig.displayName)} [${label}]: §f${enabled ? "Activado" : "Desactivado"} §8(${summary})`
            );

            const partialState: Record<string, Record<string, unknown>> = {};
            for (const fac of factions) {
              partialState[fac] = { [key]: enabled };
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
                key: label,
                value: enabled ? "Activado" : "Desactivado",
              });
            }
          } catch (e) {
            debugWarn("commandMenuDDUI", `Error aplicando toggle ${systemId} [${key}]: ${e}`, "red");
          }
        }

        for (const ctrl of hierarchyToggles) {
          ctrl.obs.subscribe((enabled) => {
            if (enabled === ctrl.lastValue) return;
            applyToggle(ctrl.key, enabled, ctrl.label, targetFaction);
            ctrl.lastValue = enabled;
          });
        }
        for (const ctrl of groupToggles) {
          ctrl.obs.subscribe((enabled) => {
            if (enabled === ctrl.lastValue) return;
            applyToggle(ctrl.key, enabled, ctrl.label, targetFaction);
            ctrl.lastValue = enabled;
          });
        }
      }

      form.spacer();
      form.button(stripColorCodes(BACK_BUTTON_LABEL), () => {
        form.close();
        system.run(() => import("../panels/mainPanel.js").then(({ showMainPanel }) => showMainPanel(player)));
      });

      form
        .show()
        .then((reason) => {
          debugMessage("commandMenuDDUI", `Sistema ${systemId} cerrado: ${reason}`, "gray");
          if (reason === "ClientClosed") {
            pauseSession(player.id);
          }
        })
        .catch((err) => {
          debugWarn("commandMenuDDUI", `Error en form.show() sistema ${systemId}: ${err}`, "red");
          cleanupSession(player.id);
        });
    } catch (e) {
      debugWarn("commandMenuDDUI", `Error en buildSystemView ${systemId}: ${e}`, "red");
    }
  };
}
