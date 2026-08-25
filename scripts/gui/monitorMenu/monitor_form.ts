// scripts/gui/monitorMenu/monitor_form.ts

import { CustomForm, ObservableString, ObservableNumber, DataDrivenScreenClosedReason } from "@minecraft/server-ui";
import { Player, system, world } from "@minecraft/server";
import { scanActiveEntities } from "../commandMenu/model/menu_entity_scanner.js";
import { Factions } from "../commandMenu/menu_config.js";
import {
  MonitorConfig,
  MonitorConfigDefaults,
  MonitorConfigLabels,
  MonitorFaction,
  MonitorListMode,
  MonitorSortBy,
  MonitorUnitType,
  MonitorLabels,
  MonitorTitles,
  MonitorButtons,
  formatFactionSummary,
  buildFactionSummary,
  stripColorCodes,
} from "./monitor_config.js";
import { debugWarn, debugMessage } from "../../utils/debug.js";

let monitorText: ObservableString;

let monitorConfig: MonitorConfig = { ...MonitorConfigDefaults };

const MONITOR_CONFIG_PROPERTY = "scpd_monitor_config";

export function initializeMonitorObservables(): void {
  monitorText = new ObservableString(MonitorLabels.refreshing);
  debugMessage("monitorCommand", "Observables del monitor inicializados en startup", "green");
}

export function loadMonitorConfig(): void {
  try {
    const saved = world.getDynamicProperty(MONITOR_CONFIG_PROPERTY);
    if (!saved) {
      debugMessage("monitorCommand", "No hay config del monitor guardada, usando defaults", "yellow");
      monitorConfig = { ...MonitorConfigDefaults };
      return;
    }

    debugMessage("monitorCommand", "Config del monitor cargada desde propiedades dinámicas", "cyan");
    const parsed = JSON.parse(String(saved));

    if (!parsed || typeof parsed !== "object") {
      debugWarn("monitorCommand", "Config del monitor inválida, usando defaults", "yellow");
      monitorConfig = { ...MonitorConfigDefaults };
      return;
    }

    const validFactions: MonitorFaction[] = ["foundation", "chaos", "ambas"];
    const validUnitTypes: MonitorUnitType[] = ["especiales", "normales", "ambos"];
    const validListModes: MonitorListMode[] = ["breve", "completa"];
    const validSortBys: MonitorSortBy[] = ["alpha_asc", "alpha_desc"];

    monitorConfig = {
      faction: validFactions.includes(parsed.faction) ? parsed.faction : MonitorConfigDefaults.faction,
      unitType: validUnitTypes.includes(parsed.unitType) ? parsed.unitType : MonitorConfigDefaults.unitType,
      listMode: validListModes.includes(parsed.listMode) ? parsed.listMode : MonitorConfigDefaults.listMode,
      sortBy: validSortBys.includes(parsed.sortBy) ? parsed.sortBy : MonitorConfigDefaults.sortBy,
    };

    debugMessage("monitorCommand", `Config cargada: ${JSON.stringify(monitorConfig)}`, "green");
  } catch (e) {
    debugWarn("monitorCommand", `Error cargando config del monitor: ${e}`, "red");
    monitorConfig = { ...MonitorConfigDefaults };
  }
}

function saveMonitorConfig(): void {
  try {
    world.setDynamicProperty(MONITOR_CONFIG_PROPERTY, JSON.stringify(monitorConfig));
    debugMessage("monitorCommand", `Config del monitor guardada: ${JSON.stringify(monitorConfig)}`, "green");
  } catch (e) {
    debugWarn("monitorCommand", `Error guardando config del monitor: ${e}`, "red");
  }
}

export function showMonitorMenu(player: Player): void {
  try {
    debugMessage("monitorCommand", `Mostrando monitor para ${player.name}`, "cyan");

    if (!monitorText) {
      throw new Error("Observables no inicializados. Llama a initializeMonitorObservables() en startup.");
    }

    loadMonitorConfig();

    const form = new CustomForm(player, MonitorTitles.main);

    system.run(() => {
      try {
        form.label(monitorText);
        form.spacer();
        form.button(MonitorButtons.config, () => {
          try {
            form.close();
            showConfigMenu(player);
          } catch (e) {
            debugWarn("monitorCommand", `Error abriendo config desde monitor: ${e}`, "red");
          }
        });
        form.closeButton();

        let intervalId: number | null = null;

        const refresh = () => {
          try {
            const foundationScan = buildFactionSummary(
              scanActiveEntities(player.dimension, Factions.FOUNDATION),
              monitorConfig.unitType === "normales" || monitorConfig.unitType === "ambos"
            );
            const chaosScan = buildFactionSummary(
              scanActiveEntities(player.dimension, Factions.CHAOS),
              monitorConfig.unitType === "normales" || monitorConfig.unitType === "ambos"
            );

            monitorText.setData(
              formatFactionSummary(foundationScan, chaosScan, monitorConfig.faction, monitorConfig.unitType, monitorConfig.listMode, monitorConfig.sortBy)
            );
          } catch (e) {
            debugWarn("monitorCommand", `Error en refresco: ${e}`, "red");
          }

          if (intervalId !== null) {
            intervalId = system.runTimeout(() => {
              refresh();
            }, 20);
          }
        };

        form.show().then((reason: DataDrivenScreenClosedReason) => {
          debugMessage("monitorCommand", `Monitor cerrado: ${reason}`, "gray");
          if (intervalId !== null) {
            system.clearRun(intervalId);
            intervalId = null;
          }
        }).catch((showError) => {
          debugWarn("monitorCommand", `Error en form.show(): ${showError}`, "red");
          if (intervalId !== null) {
            system.clearRun(intervalId);
            intervalId = null;
          }
        });

        refresh();
        intervalId = system.runTimeout(() => {
          refresh();
        }, 20);
      } catch (setupError) {
        debugWarn("monitorCommand", `Error configurando DDUI en system.run: ${setupError}`, "red");
      }
    });
  } catch (e) {
    debugWarn("monitorCommand", `Error mostrando menú de monitoreo: ${e}`, "red");
    try {
      player.sendMessage("§c[Monitor] Error al abrir el menú de monitoreo.");
    } catch {}
  }
}

function getConfigText(): string {
  const lines: string[] = [
    `${MonitorTitles.config}`,
    `§bFacción:§r ${MonitorConfigLabels.faction[monitorConfig.faction]}`,
    `§eTipo:§r ${MonitorConfigLabels.unitType[monitorConfig.unitType]}`,
    `§aLista:§r ${MonitorConfigLabels.listMode[monitorConfig.listMode]}`,
    `§cOrden:§r ${MonitorConfigLabels.sortBy[monitorConfig.sortBy]}`,
  ];
  return lines.join("\n");
}

export function showConfigMenu(player: Player): void {
  try {
    const form = new CustomForm(player, MonitorTitles.config);

    system.run(() => {
      try {
        const factionObs = new ObservableNumber(monitorConfig.faction === "foundation" ? 0 : monitorConfig.faction === "chaos" ? 1 : 2, { clientWritable: true });
        const unitTypeObs = new ObservableNumber(monitorConfig.unitType === "especiales" ? 0 : monitorConfig.unitType === "normales" ? 1 : 2, { clientWritable: true });
        const listModeObs = new ObservableNumber(monitorConfig.listMode === "completa" ? 0 : 1, { clientWritable: true });
        const sortByObs = new ObservableNumber(monitorConfig.sortBy === "alpha_asc" ? 0 : 1, { clientWritable: true });

        form.label(getConfigText());
        form.spacer();

        form.dropdown("Facción:", factionObs, [
          { label: "Foundation", value: 0 },
          { label: "Chaos", value: 1 },
          { label: "Ambas", value: 2 },
        ]);

        form.dropdown("Tipo de unidad:", unitTypeObs, [
          { label: "Especiales", value: 0 },
          { label: "No especiales", value: 1 },
          { label: "Todos", value: 2 },
        ]);

        form.dropdown("Modo lista:", listModeObs, [
          { label: "Completa", value: 0 },
          { label: "Breve", value: 1 },
        ]);

        form.dropdown("Orden:", sortByObs, [
          { label: "Ascendente", value: 0 },
          { label: "Descendente", value: 1 },
        ]);

        form.spacer();
        form.button(MonitorButtons.save, () => {
          try {
            monitorConfig.faction = factionObs.getData() === 0 ? "foundation" : factionObs.getData() === 1 ? "chaos" : "ambas";
            monitorConfig.unitType = unitTypeObs.getData() === 0 ? "especiales" : unitTypeObs.getData() === 1 ? "normales" : "ambos";
            monitorConfig.listMode = listModeObs.getData() === 0 ? "completa" : "breve";
            monitorConfig.sortBy = sortByObs.getData() === 0 ? "alpha_asc" : "alpha_desc";
            saveMonitorConfig();
            form.close();
          } catch (e) {
            debugWarn("monitorCommand", `Error guardando config: ${e}`, "red");
            form.close();
          }
        });
        form.button(MonitorButtons.cancel, () => {
          form.close();
        });

        form.show().then((reason: DataDrivenScreenClosedReason) => {
          debugMessage("monitorCommand", `Config cerrada: ${reason}`, "gray");
          showMonitorMenu(player);
        }).catch((showError) => {
          debugWarn("monitorCommand", `Error en form.show() de config: ${showError}`, "red");
          showMonitorMenu(player);
        });
      } catch (setupError) {
        debugWarn("monitorCommand", `Error configurando DDUI de config en system.run: ${setupError}`, "red");
        showMonitorMenu(player);
      }
    });
  } catch (e) {
    debugWarn("monitorCommand", `Error mostrando configuración del monitor: ${e}`, "red");
    showMonitorMenu(player);
  }
}
