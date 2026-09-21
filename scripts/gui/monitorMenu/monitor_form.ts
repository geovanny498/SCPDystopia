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
 * - Config por jugador persistida con player.setDynamicProperty vía monitor_state.ts
 */

import {
  CustomForm,
  ObservableNumber,
  ObservableString,
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
  MonitorButtons,
  MonitorTitles,
  formatFactionBlock,
  buildFactionSummary,
} from "./monitor_config.js";
import { MonitorMenuSession, monitorMenuSessionStore } from "./monitor_session.js";
import { debug } from "../../utils/debug.js";

function refresh(session: MonitorMenuSession): void {
  try {
    const config = session.getConfig();
    const foundationScan = buildFactionSummary(
      scanActiveEntities(session.player.dimension, Factions.FOUNDATION),
      config.unitType === "normales" || config.unitType === "ambos"
    );
    const chaosScan = buildFactionSummary(
      scanActiveEntities(session.player.dimension, Factions.CHAOS),
      config.unitType === "normales" || config.unitType === "ambos"
    );

    const foundationBlock = formatFactionBlock(
      foundationScan,
      MonitorTitles.foundation,
      config.unitType,
      config.normalListMode,
      config.specialListMode,
      config.sortBy
    );
    const chaosBlock = formatFactionBlock(
      chaosScan,
      MonitorTitles.chaos,
      config.unitType,
      config.normalListMode,
      config.specialListMode,
      config.sortBy
    );

    session.getFoundationText().setData(foundationBlock);
    session.getChaosText().setData(chaosBlock);
  } catch (e) {
    debug("monitorCommand", `Error en refresco: ${e}`, {
      level: "error",
      color: "red",
    });
  }
}

export function showMonitorMenu(player: Player): void {
  debug("monitorCommand", `Mostrando monitor para §b${player.name}§r`, {
    level: "debug",
    color: "blue",
  });

  try {
    system.run(() => {
      try {
        let session = monitorMenuSessionStore.get(player.id);
        if (!session) {
          session = new MonitorMenuSession(player);
          monitorMenuSessionStore.set(player.id, session);
          debug("monitorCommand", `Sesión de monitor creada para §b${player.name}§r`, {
            level: "debug",
            color: "blue",
          });
        }

        const foundationText = session.getFoundationText();
        const chaosText = session.getChaosText();
        const config = session.getConfig();

        const form = new CustomForm(player, MonitorTitles.main);

        form.spacer();
        form.label(foundationText, {
          visible: config.faction === "ambas" || config.faction === "foundation",
        });
        form.divider({ visible: config.faction === "ambas" });
        form.label(chaosText, { visible: config.faction === "ambas" || config.faction === "chaos" });
        form.spacer();
        let closeReason: "navigation" | undefined = undefined;
        let nextPanel: (() => void) | undefined = undefined;

        form.button(MonitorButtons.config, () => {
          try {
            closeReason = "navigation";
            nextPanel = () => showConfigMenu(player);
            form.close();
          } catch (e) {
            debug("monitorCommand", `Error abriendo config desde monitor: ${e}`, {
              level: "error",
              color: "red",
            });
          }
        });

        let intervalId: number | null = null;
        if (!session.hasActiveIntervals()) {
          intervalId = system.runInterval(() => {
            refresh(session);
          }, 20);
          session.registerInterval(intervalId);
        }

        refresh(session);

        form
          .show()
          .then((reason: DataDrivenScreenClosedReason) => {
            if (reason === "ClientClosed") {
              debug("monitorCommand", `Monitor cerrado: X del cliente (§b${player.name}§r)`, {
                level: "debug",
                color: "gray",
              });
              monitorMenuSessionStore.cleanup(player.id);
            } else if (reason === "UserBusy") {
              debug("monitorCommand", `Monitor cerrado: §cUserBusy§r (§b${player.name}§r)`, {
                level: "warn",
                color: "yellow",
              });
              monitorMenuSessionStore.cleanup(player.id);
            } else if (reason === "ServerClosed") {
              if (closeReason === "navigation") {
                debug("monitorCommand", `Monitor cerrado: navegación a Config (§b${player.name}§r)`, {
                  level: "debug",
                  color: "gray",
                });
                if (intervalId !== null) {
                  session.unregisterInterval(intervalId);
                }
                nextPanel?.();
              } else {
                debug("monitorCommand", `Monitor cerrado: ServerClosed sin razón (§b${player.name}§r)`, {
                  level: "warn",
                  color: "yellow",
                });
                monitorMenuSessionStore.cleanup(player.id);
              }
            }
            closeReason = undefined;
            nextPanel = undefined;
          })
          .catch((showError) => {
            debug("monitorCommand", `Error en form.show(): ${showError}`, {
              level: "error",
              color: "red",
            });
            monitorMenuSessionStore.cleanup(player.id);
          });
      } catch (setupError) {
        debug("monitorCommand", `Error configurando DDUI en system.run: ${setupError}`, {
          level: "error",
          color: "red",
        });
      }
    });
  } catch (e) {
    debug("monitorCommand", `Error mostrando menú de monitoreo: ${e}`, {
      level: "error",
      color: "red",
    });
    try {
      player.sendMessage("§c[Monitor] Error al abrir el menú de monitoreo.");
    } catch {}
  }
}

export function showConfigMenu(player: Player): void {
  try {
    const session = monitorMenuSessionStore.get(player.id);
    if (!session) {
      debug("monitorCommand", "No hay sesión de monitor activa para este jugador", {
        level: "warn",
        color: "yellow",
      });
      return;
    }

    const config = session.getConfig();

    const form = new CustomForm(player, MonitorTitles.config);

    system.run(() => {
      try {
        const factionObs = new ObservableNumber(
          config.faction === "foundation" ? 0 : config.faction === "chaos" ? 1 : 2,
          { clientWritable: true }
        );
        const unitTypeObs = new ObservableNumber(
          config.unitType === "especiales" ? 0 : config.unitType === "normales" ? 1 : 2,
          { clientWritable: true }
        );
        const normalListModeObs = new ObservableNumber(config.normalListMode === "completa" ? 0 : 1, {
          clientWritable: true,
        });
        const specialListModeObs = new ObservableNumber(config.specialListMode === "completa" ? 0 : 1, {
          clientWritable: true,
        });
        const sortByObs = new ObservableNumber(config.sortBy === "alpha_asc" ? 0 : 1, { clientWritable: true });
        const configTextObs = new ObservableString(session.getConfigText());

        factionObs.subscribe(() => {
          const newConfig: MonitorConfig = {
            ...session.getConfig(),
            faction: factionObs.getData() === 0 ? "foundation" : factionObs.getData() === 1 ? "chaos" : "ambas",
          };
          session.saveConfig(newConfig);
          configTextObs.setData(session.getConfigText());
        });

        unitTypeObs.subscribe(() => {
          const newConfig: MonitorConfig = {
            ...session.getConfig(),
            unitType: unitTypeObs.getData() === 0 ? "especiales" : unitTypeObs.getData() === 1 ? "normales" : "ambos",
          };
          session.saveConfig(newConfig);
          configTextObs.setData(session.getConfigText());
        });

        normalListModeObs.subscribe(() => {
          const newConfig: MonitorConfig = {
            ...session.getConfig(),
            normalListMode: normalListModeObs.getData() === 0 ? "completa" : "breve",
          };
          session.saveConfig(newConfig);
          configTextObs.setData(session.getConfigText());
        });

        specialListModeObs.subscribe(() => {
          const newConfig: MonitorConfig = {
            ...session.getConfig(),
            specialListMode: specialListModeObs.getData() === 0 ? "completa" : "breve",
          };
          session.saveConfig(newConfig);
          configTextObs.setData(session.getConfigText());
        });

        sortByObs.subscribe(() => {
          const newConfig: MonitorConfig = {
            ...session.getConfig(),
            sortBy: sortByObs.getData() === 0 ? "alpha_asc" : "alpha_desc",
          };
          session.saveConfig(newConfig);
          configTextObs.setData(session.getConfigText());
        });

        form.spacer();
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
        let closeReason: "navigation" | undefined = undefined;
        let nextPanel: (() => void) | undefined = undefined;

        form.button(
          MonitorButtons.reset,
          () => {
            closeReason = "navigation";
            nextPanel = () => {
              debug("monitorCommand", "Navegando a MessageBox de confirmación de restablecimiento", {
                level: "debug",
                color: "gray",
              });
              new MessageBox(player, "Restablecer ajustes")
                .body("¿Seguro que querés volver a los ajustes predeterminados del monitor?")
                .button1("Sí, restablecer")
                .button2("Cancelar", "No, volver a la configuración")
                .show()
                .then((response) => {
                  debug(
                    "monitorCommand",
                    `MessageBox cerrado, volviendo a configuración: §6${response.closeReason}§r`,
                    {
                      level: "debug",
                      color: "gray",
                    }
                  );
                  if (response.selection === 1) {
                    try {
                      session.resetToDefaults();
                    } catch (e) {
                      debug("monitorCommand", `Error reseteando config: ${e}`, {
                        level: "error",
                        color: "red",
                      });
                    }
                  }
                  showConfigMenu(player);
                })
                .catch(() => {
                  showConfigMenu(player);
                });
            };
            form.close();
          },
          { tooltip: "§cVuelve a los ajustes predeterminados del monitor" }
        );

        form.button(MonitorButtons.back, () => {
          closeReason = "navigation";
          nextPanel = () => showMonitorMenu(player);
          form.close();
        });

        form
          .show()
          .then((reason: DataDrivenScreenClosedReason) => {
            if (reason === "ClientClosed") {
              debug("monitorCommand", `Config cerrada: X del cliente (§b${player.name}§r)`, {
                level: "debug",
                color: "gray",
              });
              monitorMenuSessionStore.cleanup(player.id);
            } else if (reason === "UserBusy") {
              debug("monitorCommand", `Config cerrada: §cUserBusy§r (§b${player.name}§r)`, {
                level: "warn",
                color: "yellow",
              });
              monitorMenuSessionStore.cleanup(player.id);
            } else if (reason === "ServerClosed") {
              if (closeReason === "navigation") {
                debug("monitorCommand", `Config cerrada: navegación (§b${player.name}§r)`, {
                  level: "debug",
                  color: "gray",
                });
                nextPanel?.();
              } else {
                debug("monitorCommand", `Config cerrada: ServerClosed sin razón (§b${player.name}§r)`, {
                  level: "warn",
                  color: "yellow",
                });
                monitorMenuSessionStore.cleanup(player.id);
              }
            }
            closeReason = undefined;
            nextPanel = undefined;
          })
          .catch((showError) => {
            debug("monitorCommand", `Error en form.show() de config: ${showError}`, {
              level: "error",
              color: "red",
            });
            monitorMenuSessionStore.cleanup(player.id);
            showMonitorMenu(player);
          });
      } catch (setupError) {
        debug("monitorCommand", `Error configurando DDUI de config en system.run: ${setupError}`, {
          level: "error",
          color: "red",
        });
        showMonitorMenu(player);
      }
    });
  } catch (e) {
    debug("monitorCommand", `Error mostrando configuración del monitor: ${e}`, {
      level: "error",
      color: "red",
    });
    showMonitorMenu(player);
  }
}
