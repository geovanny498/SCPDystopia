// scripts/gui/monitorMenu/monitor_form.ts

/**
 * Arquitectura (alineada con commandMenu):
 * 1. Capa de scanner: menu_entity_scanner.ts (compartida)
 * 2. Capa de procesamiento: monitor_config.buildFactionSummary()
 * 3. Capa de formateo: monitor_config.formatFactionBlock()
 * 4. Capa de UI/orquestación: este archivo
 *
 * - CustomForm reactivo con múltiples labels (no monolítico)
 * - 2 labels (Foundation / Chaos) + divider entre facciones
 * - Dentro de cada label: normales y especiales como sub-secciones
 * - Navegación explícita: monitor → config → monitor
 * - Config persistida en world.setDynamicProperty vía monitor_state.ts
 */

import {
  CustomForm,
  ObservableString,
  ObservableNumber,
  DataDrivenScreenClosedReason,
  MessageBox,
} from "@minecraft/server-ui";
import { Player, system, world } from "@minecraft/server";
import { scanActiveEntities } from "../commandMenu/model/menu_entity_scanner.js";
import { Factions } from "../commandMenu/menu_config.js";
import {
  MonitorConfig,
  MonitorConfigDefaults,
  MonitorConfigLabels,
  MonitorFaction,
  MonitorLabels,
  MonitorButtons,
  MonitorTitles,
  formatFactionBlock,
  buildFactionSummary,
} from "./monitor_config.js";
import { loadMonitorConfig, saveMonitorConfig } from "./monitor_state.js";
import { debugWarn, debugMessage } from "../../utils/debug.js";

let foundationText: ObservableString;
let chaosText: ObservableString;

export function initializeMonitorObservables(): void {
  foundationText = new ObservableString(MonitorLabels.refreshing);
  chaosText = new ObservableString(MonitorLabels.refreshing);
  debugMessage("monitorCommand", "Observables del monitor inicializados en startup", "green");
}

let intervalId: number | null = null;

let lastFoundationText: string | null = null;
let lastChaosText: string | null = null;

function refresh(player: Player): void {
  try {
    const foundationScan = buildFactionSummary(
      scanActiveEntities(player.dimension, Factions.FOUNDATION),
      monitorConfig.unitType === "normales" || monitorConfig.unitType === "ambos"
    );
    const chaosScan = buildFactionSummary(
      scanActiveEntities(player.dimension, Factions.CHAOS),
      monitorConfig.unitType === "normales" || monitorConfig.unitType === "ambos"
    );

    const foundationBlock = formatFactionBlock(
      foundationScan,
      MonitorTitles.foundation,
      monitorConfig.unitType,
      monitorConfig.normalListMode,
      monitorConfig.specialListMode,
      monitorConfig.sortBy
    );
    const chaosBlock = formatFactionBlock(
      chaosScan,
      MonitorTitles.chaos,
      monitorConfig.unitType,
      monitorConfig.normalListMode,
      monitorConfig.specialListMode,
      monitorConfig.sortBy
    );

    if (foundationBlock !== lastFoundationText) {
      foundationText.setData(foundationBlock);
      lastFoundationText = foundationBlock;
    }

    if (chaosBlock !== lastChaosText) {
      chaosText.setData(chaosBlock);
      lastChaosText = chaosBlock;
    }
  } catch (e) {
    debugWarn("monitorCommand", `Error en refresco: ${e}`, "red");
  }
}

let monitorConfig: MonitorConfig = { ...MonitorConfigDefaults };

export function showMonitorMenu(player: Player): void {
  try {
    debugMessage("monitorCommand", `Mostrando monitor para ${player.name}`, "cyan");

    if (!foundationText || !chaosText) {
      throw new Error("Observables no inicializados. Llama a initializeMonitorObservables() en startup.");
    }

    monitorConfig = loadMonitorConfig();
    lastFoundationText = null;
    lastChaosText = null;

    const form = new CustomForm(player, MonitorTitles.main);

    system.run(() => {
      try {
        form.spacer();
        form.label(foundationText, {
          visible: monitorConfig.faction === "ambas" || monitorConfig.faction === "foundation",
        });
        form.divider({ visible: monitorConfig.faction === "ambas" });
        form.label(chaosText, { visible: monitorConfig.faction === "ambas" || monitorConfig.faction === "chaos" });
        form.spacer();
        form.button(MonitorButtons.config, () => {
          try {
            form.close();
            showConfigMenu(player);
          } catch (e) {
            debugWarn("monitorCommand", `Error abriendo config desde monitor: ${e}`, "red");
          }
        });
        form.button(MonitorButtons.close, () => {
          form.close();
        });

        const intervalState = { current: null as number | null };

        form
          .show()
          .then((reason: DataDrivenScreenClosedReason) => {
            debugMessage("monitorCommand", `Monitor cerrado: ${reason}`, "gray");
            if (intervalState.current !== null) {
              system.clearRun(intervalState.current);
              intervalState.current = null;
            }
          })
          .catch((showError) => {
            debugWarn("monitorCommand", `Error en form.show(): ${showError}`, "red");
            if (intervalState.current !== null) {
              system.clearRun(intervalState.current);
              intervalState.current = null;
            }
          });

        intervalState.current = system.runInterval(() => {
          refresh(player);
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
    `§bFacción: §r${MonitorConfigLabels.faction[monitorConfig.faction]}`,
    `§eTipo: §r${MonitorConfigLabels.unitType[monitorConfig.unitType]}`,
    `§aLista (No especiales): §r${MonitorConfigLabels.normalListMode[monitorConfig.normalListMode]}`,
    `§dLista (Especiales): §r${MonitorConfigLabels.specialListMode[monitorConfig.specialListMode]}`,
    `§cOrden: §r${MonitorConfigLabels.sortBy[monitorConfig.sortBy]}`,
  ];
  return lines.join("\n");
}

export function showConfigMenu(player: Player): void {
  try {
    const form = new CustomForm(player, MonitorTitles.config);

    system.run(() => {
      try {
        const factionObs = new ObservableNumber(
          monitorConfig.faction === "foundation" ? 0 : monitorConfig.faction === "chaos" ? 1 : 2,
          { clientWritable: true }
        );
        const unitTypeObs = new ObservableNumber(
          monitorConfig.unitType === "especiales" ? 0 : monitorConfig.unitType === "normales" ? 1 : 2,
          { clientWritable: true }
        );
        const normalListModeObs = new ObservableNumber(monitorConfig.normalListMode === "completa" ? 0 : 1, {
          clientWritable: true,
        });
        const specialListModeObs = new ObservableNumber(monitorConfig.specialListMode === "completa" ? 0 : 1, {
          clientWritable: true,
        });
        const sortByObs = new ObservableNumber(monitorConfig.sortBy === "alpha_asc" ? 0 : 1, { clientWritable: true });
        const configTextObs = new ObservableString(getConfigText());

        form.label(configTextObs);
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

        form.dropdown("Modo lista (No especiales):", normalListModeObs, [
          { label: "Completa", value: 0 },
          { label: "Breve", value: 1 },
        ]);

        form.dropdown("Modo lista (Especiales):", specialListModeObs, [
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
            monitorConfig.faction =
              factionObs.getData() === 0 ? "foundation" : factionObs.getData() === 1 ? "chaos" : "ambas";
            monitorConfig.unitType =
              unitTypeObs.getData() === 0 ? "especiales" : unitTypeObs.getData() === 1 ? "normales" : "ambos";
            monitorConfig.normalListMode = normalListModeObs.getData() === 0 ? "completa" : "breve";
            monitorConfig.specialListMode = specialListModeObs.getData() === 0 ? "completa" : "breve";
            monitorConfig.sortBy = sortByObs.getData() === 0 ? "alpha_asc" : "alpha_desc";
            saveMonitorConfig(monitorConfig);
            configTextObs.setData(getConfigText());
          } catch (e) {
            debugWarn("monitorCommand", `Error guardando config: ${e}`, "red");
            form.close();
          }
        });
        form.button(
          MonitorButtons.reset,
          () => {
            form.close();
            system.run(() => {
              new MessageBox(player, "Restablecer ajustes")
                .body("¿Seguro que querés volver a los ajustes predeterminados del monitor?")
                .button1("Sí, restablecer")
                .button2("Cancelar", "No, volver a la configuración")
                .show()
                .then((response) => {
                  if (response.selection === 1) {
                    try {
                      monitorConfig = { ...MonitorConfigDefaults };
                      saveMonitorConfig(monitorConfig);
                    } catch (e) {
                      debugWarn("monitorCommand", `Error reseteando config: ${e}`, "red");
                    }
                  }
                  showConfigMenu(player);
                })
                .catch(() => {
                  showConfigMenu(player);
                });
            });
          },
          { tooltip: "§cVuelve a los ajustes predeterminados del monitor" }
        );

        form.button(MonitorButtons.cancel, () => {
          form.close();
        });

        form
          .show()
          .then((reason: DataDrivenScreenClosedReason) => {
            debugMessage("monitorCommand", `Config cerrada: ${reason}`, "gray");
            showMonitorMenu(player);
          })
          .catch((showError) => {
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
