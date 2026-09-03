// scripts/gui/commandMenu/ddui/helpers/historyStore.ts

import { world } from "@minecraft/server";
import { debugWarn } from "../../../../utils/debug.js";
import { SYSTEM_SHORT_NAMES } from "../../../shared/systemCatalog.js";
import { formatLocalTimeShort } from "../../../shared/timeHelpers.js";

const HISTORY_KEY = "scpdystopia_command_menu_history";
const MAX_ENTRIES = 20;

interface HistoryEntry {
  timestamp: string;
  playerName: string;
  faction: string;
  systemShortName: string;
  key: string;
  value: string;
}

export function addHistoryEntry(entry: Omit<HistoryEntry, "timestamp">): void {
  try {
    const raw = world.getDynamicProperty(HISTORY_KEY);
    const entries: HistoryEntry[] = raw ? JSON.parse(raw as string) : [];
    entries.push({
      ...entry,
      timestamp: formatLocalTimeShort(Date.now()),
    });
    while (entries.length > MAX_ENTRIES) entries.shift();
    world.setDynamicProperty(HISTORY_KEY, JSON.stringify(entries));
  } catch (e) {
    debugWarn("historyStore", `Error guardando entrada de historial: ${e}`, "red");
  }
}

export function getHistoryEntries(faction?: string): HistoryEntry[] {
  try {
    const raw = world.getDynamicProperty(HISTORY_KEY);
    if (!raw) return [];
    const entries: HistoryEntry[] = JSON.parse(raw as string);
    if (!faction || faction === "both") return entries;
    return entries.filter((e) => e.faction === faction);
  } catch {
    return [];
  }
}

export function getSystemShortName(systemId: string): string {
  return SYSTEM_SHORT_NAMES[systemId] || systemId;
}
