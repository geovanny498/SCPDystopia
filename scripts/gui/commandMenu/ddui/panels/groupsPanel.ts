// scripts/gui/commandMenu/ddui/panels/groupsPanel.ts

import { Player, system, world } from "@minecraft/server";
import { CustomForm, ObservableNumber } from "@minecraft/server-ui";
import { debugWarn, debugMessage } from "../../../../utils/debug.js";
import {
  PANEL_TITLES,
  PANEL_DESCRIPTIONS,
  GROUP_PANEL_BUTTONS,
  FACTION_DISPLAY_NAMES,
  GROUP_LABELS,
  ERROR_MESSAGES,
} from "../../../shared/systemCatalog.js";
import { SYSTEM_PANEL_FEEDBACK_INITIAL } from "../../../shared/dduiFeedback.js";
import { commandMenuSessionStore } from "../sessionStore.js";
import { showMainPanel } from "./mainPanel.js";
import { scanActiveUnits, invalidateScanCache, invalidateEntityQueryCache } from "../../model/menu_entity_scanner.js";
import { setUnitGroup } from "../../model/menu_groups.js";
import { stripColorCodes } from "../helpers/formHelpers.js";
import { compareNametags } from "../../../../utils/nametagSort.js";
import { addHistoryEntry, getSystemShortName } from "../helpers/historyStore.js";
import { SpecialGroups, getGroupsOrderForSystems, getGroupsOrderForAssignment, SpecialGroupLabels } from "../../menu_config.js";
import { Factions } from "../../../../constants/domains.js";

export function showGroupsPanel(player: Player, targetFaction: string = Factions.FOUNDATION): void {
  system.run(() => showGroupsByFaction(player, targetFaction));
}

function showGroupsByFaction(player: Player, faction: string): void {
  try {
    let closeReason: "navigation" | undefined = undefined;

    const form = new CustomForm(
      player,
      `${PANEL_TITLES.groupsByFaction} - ${FACTION_DISPLAY_NAMES[faction as keyof typeof FACTION_DISPLAY_NAMES]}`
    );

    form.spacer();
    form.label(PANEL_DESCRIPTIONS.groupsByFaction);
    form.spacer();

    const dimension = player.dimension;
    if (!dimension) {
      player.sendMessage(ERROR_MESSAGES.NO_DIMENSION);
      return;
    }

    const scanResult = scanActiveUnits(dimension, faction);

    const groupCounts: Record<string, number> = {};
    for (const entity of scanResult.entities) {
      if (!entity.isSpecial) continue;
      const group = entity.group ?? SpecialGroups.NO_GROUP;
      groupCounts[group] = (groupCounts[group] ?? 0) + 1;
    }

    const groupOrder = getGroupsOrderForSystems();
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
        closeReason = "navigation";
        form.close();
        system.run(() => showBucketAssignment(player, faction, bucketId));
      });
    }

    form.divider();

    form.button(stripColorCodes(GROUP_PANEL_BUTTONS.back), () => {
      closeReason = "navigation";
      form.close();
      system.run(() => showMainPanel(player));
    });

    form
      .show()
      .then((reason) => {
        if (reason === "ClientClosed") {
          debugMessage("commandMenuDDUI", `Grupos por Facción cerrado: X del cliente (${player.name})`, "gray");
          commandMenuSessionStore.cleanup(player.id);
        } else if (reason === "UserBusy") {
          debugWarn("commandMenuDDUI", `Grupos por Facción cerrado: UserBusy (${player.name})`, "yellow");
          commandMenuSessionStore.cleanup(player.id);
        } else if (reason === "ServerClosed") {
          if (closeReason === "navigation") {
            debugMessage("commandMenuDDUI", `Grupos por Facción cerrado: navegación (${player.name})`, "gray");
          } else {
            debugWarn(
              "commandMenuDDUI",
              `Grupos por Facción cerrado: ServerClosed sin razón (${player.name})`,
              "yellow"
            );
            commandMenuSessionStore.cleanup(player.id);
          }
        }
        closeReason = undefined;
      })
      .catch((err) => {
        debugWarn("commandMenuDDUI", `Error en form.show() grupos por facción: ${err}`, "red");
          commandMenuSessionStore.cleanup(player.id);
      });
  } catch (e) {
    debugWarn("commandMenuDDUI", `Error en showGroupsByFaction: ${e}`, "red");
  }
}

function showBucketAssignment(player: Player, faction: string, bucketId: string): void {
  try {
    const dimension = player.dimension;
    if (!dimension) {
      player.sendMessage(ERROR_MESSAGES.NO_DIMENSION);
      return;
    }

    const session = commandMenuSessionStore.get(player.id);
    if (!session) {
      player.sendMessage(ERROR_MESSAGES.NO_SESSION);
      return;
    }

    const scanResult = scanActiveUnits(dimension, faction);
    const bucket = scanResult.buckets[bucketId];
    if (!bucket) {
      player.sendMessage(ERROR_MESSAGES.NO_BUCKET);
      return;
    }

    let closeReason: "navigation" | undefined = undefined;

    const form = new CustomForm(player, `${stripColorCodes(bucket.label)} §8- Asignar Grupos`);

    form.spacer();
    form.label(`§7Facción: §f${FACTION_DISPLAY_NAMES[faction as keyof typeof FACTION_DISPLAY_NAMES]}`);
    form.spacer();
    form.label(`§7Rol: §f${stripColorCodes(bucket.label)} §8(${bucket.unitCount} unidades)`);
    form.spacer();

    const feedbackPresenter = session.getOrCreateFeedbackPresenter("bucket_assignment", SYSTEM_PANEL_FEEDBACK_INITIAL);
    form.label(feedbackPresenter.getObservable());
    form.spacer();

    const nametags = Object.keys(bucket.nametags).sort(compareNametags);
    const groupOptions = getGroupsOrderForAssignment().map((groupId) => ({
      value: groupId,
      label: SpecialGroupLabels[groupId] ?? groupId,
    }));

    const items = groupOptions.map((opt, idx) => ({ label: stripColorCodes(opt.label), value: idx }));

    const prioritySystemOrder = getGroupsOrderForSystems();
    const priorityMap: Record<string, number> = {};
    for (let p = 0; p < prioritySystemOrder.length; p++) {
      priorityMap[prioritySystemOrder[p]] = prioritySystemOrder.length - p;
    }

    const nametagPreferredGroup: Record<string, string> = {};
    const nametagMaxPriority: Record<string, number> = {};

    for (const nt of nametags) {
      const entitiesForTag = scanResult.nametagGroups[nt] || [];
      nametagPreferredGroup[nt] = SpecialGroups.NO_GROUP;
      nametagMaxPriority[nt] = 0;

      for (const scanned of entitiesForTag) {
        const entityGroup = scanned.group ?? SpecialGroups.NO_GROUP;
        const currentPriority = priorityMap[entityGroup] || 1;
        if (currentPriority > nametagMaxPriority[nt]) {
          nametagMaxPriority[nt] = currentPriority;
          nametagPreferredGroup[nt] = entityGroup;
        }
      }
    }

    const controls: { nametag: string; obs: ObservableNumber; lastAppliedIndex: number }[] = [];
    for (const nt of nametags) {
      const ntCount = bucket.nametags[nt] || 0;
      const preferredGroup = nametagPreferredGroup[nt] ?? SpecialGroups.NO_GROUP;
      const currentIndex = groupOptions.findIndex((opt) => opt.value === preferredGroup);
        const initialIndex = currentIndex >= 0 ? currentIndex : groupOptions.findIndex((opt) => opt.value === SpecialGroups.NO_GROUP);
      const obs = new ObservableNumber(initialIndex >= 0 ? initialIndex : 0, { clientWritable: true });
      obs.subscribe((newIndex) => {
        if (newIndex < 0) return;
          const selectedGroup = groupOptions[newIndex]?.value ?? SpecialGroups.NO_GROUP;
        applyGroupToNametag(player, faction, nt, selectedGroup);
      });
      form.dropdown(`${stripColorCodes(nt)}${ntCount > 1 ? ` (${ntCount})` : ""}`, obs, items);
      controls.push({ nametag: nt, obs, lastAppliedIndex: initialIndex >= 0 ? initialIndex : 0 });
    }

    form.spacer();

    form.button(stripColorCodes(GROUP_PANEL_BUTTONS.back), () => {
      closeReason = "navigation";
      invalidateScanCache();
      invalidateEntityQueryCache();
      form.close();
      system.run(() => showGroupsByFaction(player, faction));
    });

    form
      .show()
      .then((reason) => {
        if (reason === "ClientClosed") {
          debugMessage("commandMenuDDUI", `Asignación por bucket cerrada: X del cliente (${player.name})`, "gray");
          commandMenuSessionStore.cleanup(player.id);
        } else if (reason === "UserBusy") {
          debugWarn("commandMenuDDUI", `Asignación por bucket cerrada: UserBusy (${player.name})`, "yellow");
          commandMenuSessionStore.cleanup(player.id);
        } else if (reason === "ServerClosed") {
          if (closeReason === "navigation") {
            debugMessage("commandMenuDDUI", `Asignación por bucket cerrada: navegación (${player.name})`, "gray");
          } else {
            debugWarn(
              "commandMenuDDUI",
              `Asignación por bucket cerrada: ServerClosed sin razón (${player.name})`,
              "yellow"
            );
            commandMenuSessionStore.cleanup(player.id);
          }
        }
        closeReason = undefined;
      })
      .catch((err) => {
        debugWarn("commandMenuDDUI", `Error en form.show() asignación por bucket: ${err}`, "red");
          commandMenuSessionStore.cleanup(player.id);
      });
  } catch (e) {
    debugWarn("commandMenuDDUI", `Error en showBucketAssignment: ${e}`, "red");
  }
}

function applyGroupToNametag(player: Player, faction: string, nametag: string, groupId: string): void {
  try {
    const dimension = player.dimension;
    if (!dimension) {
      player.sendMessage(ERROR_MESSAGES.NO_DIMENSION);
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
    if (appliedCount > 0) {
      player.sendMessage(
        `§a[SCPDystopia] §7${groupLabel} asignado a ${appliedCount} unidad/es de ${nametag} §fen ${FACTION_DISPLAY_NAMES[faction as keyof typeof FACTION_DISPLAY_NAMES]}.`
      );
    }

    const session = commandMenuSessionStore.get(player.id);
    if (session) {
      session.getOrCreateFeedbackPresenter("bucket_assignment", SYSTEM_PANEL_FEEDBACK_INITIAL).present({
        context: groupLabel,
        value: `${nametag} (${appliedCount} unidades)`,
        status: "ok",
      });
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
    player.sendMessage(ERROR_MESSAGES.ASSIGN_GROUP);
  }
}
