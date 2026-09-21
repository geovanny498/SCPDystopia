// scripts/gui/shared/playerPermissionManager.ts

import { Player } from "@minecraft/server";
import { debug } from "../../utils/debug.js";

export type FactionId = "foundation" | "chaos";
export type RoleId = "member" | "commander" | "admin";

/**
 * Identificadores canónicos de rol como objeto de constantes.
 * Permite propagación: si renombras aquí, todos los consumidores
 * que usan `RoleIds.ADMIN` se actualizan automáticamente.
 */
export const RoleIds = {
  MEMBER: "member",
  COMMANDER: "commander",
  ADMIN: "admin",
} as const;

export const ROLE_DP_KEY_FOUNDATION = "scpd_role_foundation";
export const ROLE_DP_KEY_CHAOS = "scpd_role_chaos";

export class PlayerPermissionManager {
  static getPlayerRole(player: Player, faction: FactionId): RoleId {
    try {
      const key = faction === "foundation" ? ROLE_DP_KEY_FOUNDATION : ROLE_DP_KEY_CHAOS;
      const raw = player.getDynamicProperty(key);
      if (typeof raw === "string") {
        const trimmed = raw.trim().toLowerCase();
        if (trimmed === "commander" || trimmed === "admin") {
          return trimmed;
        }
      }
    } catch {
      // DP no existe o no es accesible
    }
    return "member";
  }

  static setPlayerRole(player: Player, faction: FactionId, role: RoleId): void {
    const key = faction === "foundation" ? ROLE_DP_KEY_FOUNDATION : ROLE_DP_KEY_CHAOS;
    try {
      player.setDynamicProperty(key, role);
      debug("roleMenu", `Rol actualizado para §b${player.name}§r: §a${faction}§r = §6${role}§r`, {
        level: "debug",
        color: "light_purple",
      });
    } catch (e) {
      debug("roleMenu", `Error guardando rol para §b${player.name}§r: ${e}§r`, { level: "error", color: "red" });
    }
  }

  static isAdmin(player: Player): boolean {
    try {
      const raw = player.getDynamicProperty("scpd_role_admin");
      return raw === true || raw === "true" || raw === 1 || raw === "1";
    } catch {
      return false;
    }
  }

  static setAdmin(player: Player, value: boolean): void {
    try {
      if (value) {
        player.setDynamicProperty("scpd_role_admin", true);
      } else {
        player.setDynamicProperty("scpd_role_admin", null as any);
      }
    } catch (e) {
      debug("roleMenu", `Error actualizando admin global para §b${player.name}§r: ${e}§r`, {
        level: "error",
        color: "red",
      });
    }
  }

  static setRolesBatch(player: Player, values: Record<string, string | boolean | number | null>): void {
    const payload: Record<string, string | boolean | number | null> = {};
    for (const key of Object.keys(values)) {
      payload[key] = values[key] === undefined ? null : values[key];
    }

    try {
      (player as any).setDynamicProperties(payload);
    } catch (e) {
      debug("roleMenu", `setDynamicProperties falló, aplicando fallback individual: ${e}§r`, {
        level: "warn",
        color: "yellow",
      });
      for (const key of Object.keys(payload)) {
        try {
          player.setDynamicProperty(key, payload[key] as any);
        } catch (inner) {
          debug("roleMenu", `Error aplicando §a${key}§r: ${inner}§r`, { level: "error", color: "red" });
        }
      }
    }
  }

  static getRoleInfo(player: Player): { faction: FactionId | null; role: RoleId; isAdmin: boolean } {
    return {
      faction: null,
      role: this.getPlayerRole(player, "foundation"),
      isAdmin: this.isAdmin(player),
    };
  }
}
