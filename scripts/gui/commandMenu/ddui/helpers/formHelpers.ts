// scripts/gui/commandMenu/ddui/helpers/formHelpers.ts

import { ObservableNumber, ObservableBoolean, ObservableString } from "@minecraft/server-ui";
import { type SystemOption } from "../../../shared/systemCatalog.js";
import { getEntitySystemState } from "../../menu_config.js";
import type { CommandMenuSession } from "../sessionStore.js";

export interface DropdownItem {
  label: string;
  value: number;
  description?: string;
}

export interface BuiltDropdown {
  obs: ObservableNumber;
  items: DropdownItem[];
  disabled: boolean;
}

export interface BuiltToggle {
  obs: ObservableBoolean;
  disabled: boolean;
}

export function stripColorCodes(text: string): string {
  return text.replace(/§[a-zA-Z0-9]/g, "");
}

export function buildSystemDropdown(entries: SystemOption[], entityId: string, systemId?: string): BuiltDropdown {
  const obs = new ObservableNumber(0, { clientWritable: true });
  const items: DropdownItem[] = entries.map((entry, idx) => ({
    label: stripColorCodes(entry.label),
    value: idx,
    description: entry.description ? stripColorCodes(entry.description) : undefined,
  }));

  let systemValue: unknown;
  if (systemId) {
    const raw = getEntitySystemState({ id: entityId } as any, systemId);
    systemValue = raw;
  }

  let initialIndex = 0;
  if (systemValue !== undefined && entries.length > 0) {
    const matchIndex = entries.findIndex((entry) => entry.value === String(systemValue));
    if (matchIndex >= 0) initialIndex = matchIndex;
  }

  obs.setData(initialIndex);
  return { obs, items, disabled: false };
}

export function buildSystemToggle(systemId: string, entityId: string): BuiltToggle {
  const raw = getEntitySystemState({ id: entityId } as any, systemId);
  const initialValue = typeof raw === "boolean" ? raw : false;
  const obs = new ObservableBoolean(initialValue, { clientWritable: true });
  return { obs, disabled: false };
}

export function buildFeedbackLabel(initialText: string): ObservableString {
  return new ObservableString(initialText);
}
