// scripts/gui/commandMenu/ddui/panels/groupsPanel.ts

import { Player, system, world } from "@minecraft/server";
import { CustomForm, ObservableNumber, ObservableString } from "@minecraft/server-ui";
import { debugWarn, debugMessage } from "../../../../utils/debug.js";
import {
  PANEL_TITLES,
  PANEL_DESCRIPTIONS,
  GROUP_PANEL_BUTTONS,
  FACTION_DISPLAY_NAMES,
  GROUP_LABELS,
  SYSTEM_PANEL_FEEDBACK_INITIAL,
} from "../../../shared/systemCatalog.js";
import { cleanupSession, pauseSession, commandMenuSessionStore } from "../sessionStore.js";
import { showMainPanel } from "./mainPanel.js";
import { scanActiveUnits, invalidateScanCache, invalidateEntityQueryCache } from "../../model/menu_entity_scanner.js";
import { setUnitGroup } from "../../model/menu_groups.js";
import { stripColorCodes } from "../helpers/formHelpers.js";
import { addHistoryEntry, getSystemShortName } from "../helpers/historyStore.js";

export function showGroupsPanel(player: Player, targetFaction: string = "foundation"): void {
  system.run(() => showGroupsByFaction(player, targetFaction));
}

function showGroupsByFaction(player: Player, faction: string): void {
  try {
    const form = new CustomForm(
      player,
      `${PANEL_TITLES.groupsByFaction} - ${FACTION_DISPLAY_NAMES[faction as keyof typeof FACTION_DISPLAY_NAMES]}`
    );

    form.spacer();
    form.label(PANEL_DESCRIPTIONS.groupsByFaction);
    form.spacer();

    const dimension = world.getDimension("overworld");
    if (!dimension) {
      player.sendMessage("§c[SCPDystopia] Dimensión no disponible.");
      return;
    }

    const scanResult = scanActiveUnits(dimension, faction);

    const groupCounts: Record<string, number> = {};
    for (const entity of scanResult.entities) {
      const group = entity.group ?? "noGroup";
      groupCounts[group] = (groupCounts[group] ?? 0) + 1;
    }

    const groupOrder = ["groupA", "groupB", "groupC", "groupD", "noGroup"];
    for (let i = 0; i < groupOrder.length; i++) {
      const groupId = groupOrder[i];
      const label = GROUP_LABELS[groupId as keyof typeof GROUP_LABELS] ?? groupId;
      const count = groupCounts[groupId] ?? 0;
      if (i > 0) form.spacer();
      form.label(`§7${label}: §f${count} unidades`);
    }

    form.spacer();

    const bucketOrder = [
      "commander_alpha1",
      "commander_delta1",
      "commander_other",
      "leader_any",
      "basic_any",
      "other_units",
    ];

    for (const bucketId of bucketOrder) {
      const bucket = scanResult.buckets[bucketId];
      if (!bucket || bucket.unitCount === 0) continue;

      const ntCount = Object.keys(bucket.nametags).length;
      const counterLabel = ntCount > 1 ? ` (${ntCount} nametags)` : "";
      form.button(`${stripColorCodes(bucket.label)}${counterLabel}`, () => {
        form.close();
        system.run(() => showBucketAssignment(player, faction, bucketId));
      });
    }

    form.divider();

    form.button(stripColorCodes(GROUP_PANEL_BUTTONS.back), () => {
      form.close();
      system.run(() => showMainPanel(player));
    });

    form
      .show()
      .then((reason) => {
        debugMessage("commandMenuDDUI", `Grupos por Facción cerrado: ${reason}`, "gray");
        if (reason === "ClientClosed") {
          pauseSession(player.id);
        }
      })
      .catch((err) => {
        debugWarn("commandMenuDDUI", `Error en form.show() grupos por facción: ${err}`, "red");
        cleanupSession(player.id);
      });
  } catch (e) {
    debugWarn("commandMenuDDUI", `Error en showGroupsByFaction: ${e}`, "red");
  }
}

function showBucketAssignment(player: Player, faction: string, bucketId: string): void {
  try {
    const dimension = world.getDimension("overworld");
    if (!dimension) {
      player.sendMessage("§c[SCPDystopia] Dimensión no disponible.");
      return;
    }

    const scanResult = scanActiveUnits(dimension, faction);
    const bucket = scanResult.buckets[bucketId];
    if (!bucket) {
      player.sendMessage("§c[SCPDystopia] Bucket no encontrado.");
      return;
    }

    const form = new CustomForm(player, `${stripColorCodes(bucket.label)} §8- Asignar Grupos`);

    form.spacer();
    form.label(`§7Facción: §f${FACTION_DISPLAY_NAMES[faction as keyof typeof FACTION_DISPLAY_NAMES]}`);
    form.spacer();
    form.label(`§7Rol: §f${stripColorCodes(bucket.label)} §8(${bucket.unitCount} unidades)`);
    form.spacer();

    const feedbackText = new ObservableString(SYSTEM_PANEL_FEEDBACK_INITIAL);
    form.label(feedbackText);
    form.spacer();

    const nametags = Object.keys(bucket.nametags).sort();
    const groupOptions = [
      { value: "groupA", label: GROUP_LABELS.groupA },
      { value: "groupB", label: GROUP_LABELS.groupB },
      { value: "groupC", label: GROUP_LABELS.groupC },
      { value: "groupD", label: GROUP_LABELS.groupD },
      { value: "noGroup", label: GROUP_LABELS.noGroup },
    ];

    const items = groupOptions.map((opt, idx) => ({ label: stripColorCodes(opt.label), value: idx }));

    const controls: { nametag: string; obs: ObservableNumber; lastAppliedIndex: number }[] = [];
    for (const nt of nametags) {
      const ntCount = bucket.nametags[nt] || 0;
      const entitiesForTag = scanResult.nametagGroups[nt] || [];
      const currentGroup = entitiesForTag.length > 0 ? (entitiesForTag[0].group ?? "noGroup") : "noGroup";
      const currentIndex = groupOptions.findIndex((opt) => opt.value === currentGroup);
      const initialIndex = currentIndex >= 0 ? currentIndex : groupOptions.findIndex((opt) => opt.value === "noGroup");
      const obs = new ObservableNumber(initialIndex >= 0 ? initialIndex : 0, { clientWritable: true });
      obs.subscribe((newIndex) => {
        if (newIndex < 0) return;
        const selectedGroup = groupOptions[newIndex]?.value ?? "noGroup";
        applyGroupToNametag(player, faction, nt, selectedGroup);
      });
      form.dropdown(`${stripColorCodes(nt)}${ntCount > 1 ? ` (${ntCount})` : ""}`, obs, items);
      controls.push({ nametag: nt, obs, lastAppliedIndex: initialIndex >= 0 ? initialIndex : 0 });
    }

    form.spacer();

    form.button(stripColorCodes(GROUP_PANEL_BUTTONS.back), () => {
      invalidateScanCache();
      invalidateEntityQueryCache();
      form.close();
      system.run(() => showGroupsByFaction(player, faction));
    });

    const session = commandMenuSessionStore.get(player.id);
    if (session) {
      session.currentFormFeedback = feedbackText;
    }

    form
      .show()
      .then((reason) => {
        debugMessage("commandMenuDDUI", `Asignación por bucket cerrada: ${reason}`, "gray");
        if (reason === "ClientClosed") {
          pauseSession(player.id);
        }
      })
      .catch((err) => {
        debugWarn("commandMenuDDUI", `Error en form.show() asignación por bucket: ${err}`, "red");
        cleanupSession(player.id);
      });
  } catch (e) {
    debugWarn("commandMenuDDUI", `Error en showBucketAssignment: ${e}`, "red");
  }
}

function applyGroupToNametag(player: Player, faction: string, nametag: string, groupId: string): void {
  try {
    const dimension = world.getDimension("overworld");
    if (!dimension) {
      player.sendMessage("§c[SCPDystopia] Dimensión no disponible.");
      return;
    }

    const scanResult = scanActiveUnits(dimension, faction);
    const entities = scanResult.entities.filter((e) => e.nametag === nametag);

    let appliedCount = 0;
    for (const scanned of entities) {
      setUnitGroup(scanned.entity, groupId);
      appliedCount++;
    }

    const groupLabel = GROUP_LABELS[groupId as keyof typeof GROUP_LABELS] ?? groupId;
    const message = `§a✓ §7${groupLabel} → ${nametag} §8(${appliedCount} unidades)`;
    if (appliedCount > 0) {
      player.sendMessage(
        `§a[SCPDystopia] §7${groupLabel} asignado a ${appliedCount} unidad/es de ${nametag} §fen ${FACTION_DISPLAY_NAMES[faction as keyof typeof FACTION_DISPLAY_NAMES]}.`
      );
    }

    const session = commandMenuSessionStore.get(player.id);
    if (session && session.currentFormFeedback) {
      session.currentFormFeedback.setData(message);
    }

    addHistoryEntry({
      playerName: player.name,
      faction,
      systemShortName: getSystemShortName("group_assignment"),
      key: nametag,
      value: groupLabel,
    });
  } catch (e) {
    debugWarn("commandMenuDDUI", `Error asignando grupo: ${e}`, "red");
    player.sendMessage("§c[SCPDystopia] Error asignando grupo.");
  }
}
