// scripts/gui/shared/equipmentDetector.ts

import { Player, EquipmentSlot } from "@minecraft/server";
import { debugWarn } from "../../utils/debug.js";
import { helmetTeams } from "../../utils/teams.js";

export type FactionId = "foundation" | "chaos";

export class EquipmentDetector {
  static getActiveFaction(player: Player): FactionId | null {
    try {
      const headItem = player.getComponent("equippable")?.getEquipment(EquipmentSlot.Head);
      const typeId = headItem?.typeId ?? null;
      if (!typeId) return null;
      const value = helmetTeams[typeId];
      return value === "foundation" || value === "chaos" ? value : null;
    } catch {
      return null;
    }
  }

  static getHelmetDisplayName(player: Player): string {
    try {
      const headItem = player.getComponent("equippable")?.getEquipment(EquipmentSlot.Head);
      const typeId = headItem?.typeId ?? null;
      if (!typeId) return "Ninguno";
      return typeId.replace("minecraft:", "").replace("gabrielaplok:", "");
    } catch {
      return "Error";
    }
  }
}
