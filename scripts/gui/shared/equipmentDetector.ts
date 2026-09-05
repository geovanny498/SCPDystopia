// scripts/gui/shared/equipmentDetector.ts

import { Player, EquipmentSlot } from "@minecraft/server";
import { debugWarn } from "../../utils/debug.js";
import { helmetTeams } from "../../utils/teams.js";
import { HELMET_DISPLAY_NAMES } from "./systemCatalog.js";

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

  /**
   * Devuelve el `typeId` del casco sin prefijos de namespace.
   * @param player Jugador al que se le consulta el casco.
   * @returns Nombre técnico del casco o "Ninguno" si no hay casco.
   */
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

  /**
   * Devuelve el label legible y coloreado del casco usando el catálogo
   * `HELMET_DISPLAY_NAMES`. Si el casco no está catalogado, devuelve el
   * `typeId` crudo como fallback (prefijo de namespace eliminado).
   * @param player Jugador al que se le consulta el casco.
   * @returns Label del casco listo para mostrar en un `form.label(...)`.
   */
  static getHelmetDisplayLabel(player: Player): string {
    try {
      const headItem = player.getComponent("equippable")?.getEquipment(EquipmentSlot.Head);
      const typeId = headItem?.typeId ?? null;
      if (!typeId) return "§8Ninguno§r";
      if (HELMET_DISPLAY_NAMES[typeId]) return HELMET_DISPLAY_NAMES[typeId];
      const raw = typeId.replace("minecraft:", "").replace("gabrielaplok:", "");
      return `§f${raw}§r`;
    } catch {
      return "§cError§r";
    }
  }
}
