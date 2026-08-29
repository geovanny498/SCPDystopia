// scripts/gui/commandMenu/ddui/helpers/roleHelpers.ts

import { Player, EquipmentSlot } from "@minecraft/server";
import { debugWarn, debugMessage } from "../../../../utils/debug.js";

export type FactionId = "foundation" | "chaos";
export type RoleId = "member" | "commander" | "admin";

export interface RoleInfo {
  faction: FactionId;
  role: RoleId;
  isAdmin: boolean;
}

const ROLE_DP_KEY = "scpd_role";
const ADMIN_DP_KEY = "scpd_role_admin";

const HELMET_TEAMS: Record<string, FactionId> = {
  "minecraft:golden_helmet": "chaos",
  "minecraft:netherite_helmet": "foundation",
  "minecraft:diamond_helmet": "foundation",
  "minecraft:iron_helmet": "foundation",
  "gabrielaplok:nv_goggles": "foundation",
};

function getFactionByHelmet(player: Player): FactionId | null {
  try {
    const headItem = player.getComponent("equippable")?.getEquipment(EquipmentSlot.Head);
    const typeId = headItem?.typeId ?? null;
    if (!typeId) return null;
    return HELMET_TEAMS[typeId] ?? null;
  } catch {
    return null;
  }
}

function getRoleFromDynamicProperties(player: Player, faction: FactionId): RoleId {
  try {
    const raw = player.getDynamicProperty(ROLE_DP_KEY);
    if (typeof raw === "string") {
      const parsed = JSON.parse(raw) as Record<string, string>;
      const roleForFaction = parsed[faction];
      if (roleForFaction === "commander") return "commander";
    }
  } catch {
    // DP no parseable o inexistente
  }
  return "member";
}

function isAdmin(player: Player): boolean {
  try {
    const raw = player.getDynamicProperty(ADMIN_DP_KEY);
    return raw === true || raw === "true" || raw === 1 || raw === "1";
  } catch {
    return false;
  }
}

export function getRoleInfo(player: Player): RoleInfo | null {
  if (!player) return null;

  let faction = getFactionByHelmet(player);

  if (!faction) {
    debugWarn("roleHelpers", `Jugador ${player.name}: sin casco, usando acceso admin temporal`, "yellow");
    faction = "foundation";
  }

  const admin = isAdmin(player);
  const role = admin ? "admin" : getRoleFromDynamicProperties(player, faction);

  debugMessage(
    "commandMenuDDUI",
    `Rol detectado para ${player.name}: faction=${faction}, role=${role}, admin=${admin}`,
    "cyan"
  );

  return { faction, role, isAdmin: admin };
}

export function canAccessSystems(role: RoleId): boolean {
  return role === "commander" || role === "admin";
}

export function canAccessGroups(role: RoleId): boolean {
  return true;
}

export function canAccessHistory(role: RoleId): boolean {
  return role === "commander" || role === "admin";
}

export function canAccessScope(role: RoleId): boolean {
  return role === "commander" || role === "admin";
}
