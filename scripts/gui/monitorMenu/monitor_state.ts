// scripts/gui/monitorMenu/monitor_state.ts

/**
 * Persistencia de configuración del monitor
 * - Carga desde world.setDynamicProperty al abrir el menú
 * - Guarda al confirmar cambios en la vista de configuración
 */

import { world } from "@minecraft/server";
import { MonitorConfig, MonitorConfigDefaults } from "./monitor_config.js";
import { debugMessage, debugWarn } from "../../utils/debug.js";

export const MONITOR_CONFIG_PROPERTY = "scpd_monitor_config";

export function loadMonitorConfig(): MonitorConfig {
  try {
    const saved = world.getDynamicProperty(MONITOR_CONFIG_PROPERTY);
    if (!saved) {
      debugMessage("monitorCommand", "No hay config del monitor guardada, usando defaults", "yellow");
      return { ...MonitorConfigDefaults };
    }

    debugMessage("monitorCommand", "Config del monitor cargada desde propiedades dinámicas", "cyan");
    const parsed = JSON.parse(String(saved));

    if (!parsed || typeof parsed !== "object") {
      debugWarn("monitorCommand", "Config del monitor inválida, usando defaults", "yellow");
      return { ...MonitorConfigDefaults };
    }

    const validFactions = ["foundation", "chaos", "ambas"];
    const validUnitTypes = ["especiales", "normales", "ambos"];
    const validListModes = ["breve", "completa"];
    const validSortBys = ["alpha_asc", "alpha_desc"];

    const config: MonitorConfig = {
      faction: validFactions.includes(parsed.faction) ? parsed.faction : MonitorConfigDefaults.faction,
      unitType: validUnitTypes.includes(parsed.unitType) ? parsed.unitType : MonitorConfigDefaults.unitType,
      normalListMode: validListModes.includes(parsed.normalListMode) ? parsed.normalListMode : MonitorConfigDefaults.normalListMode,
      specialListMode: validListModes.includes(parsed.specialListMode) ? parsed.specialListMode : MonitorConfigDefaults.specialListMode,
      sortBy: validSortBys.includes(parsed.sortBy) ? parsed.sortBy : MonitorConfigDefaults.sortBy,
    };

    debugMessage("monitorCommand", `Config cargada: ${JSON.stringify(config)}`, "green");
    return config;
  } catch (e) {
    debugWarn("monitorCommand", `Error cargando config del monitor: ${e}`, "red");
    return { ...MonitorConfigDefaults };
  }
}

export function saveMonitorConfig(config: MonitorConfig): void {
  try {
    world.setDynamicProperty(MONITOR_CONFIG_PROPERTY, JSON.stringify(config));
    debugMessage("monitorCommand", `Config del monitor guardada: ${JSON.stringify(config)}`, "green");
  } catch (e) {
    debugWarn("monitorCommand", `Error guardando config del monitor: ${e}`, "red");
  }
}
