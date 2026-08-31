// scripts/gui/commandMenu/ddui/builders/groupBuilder.ts

import { Player, system, world } from "@minecraft/server";
import { CustomForm, ObservableNumber } from "@minecraft/server-ui";
import {
  PANEL_TITLES,
  PANEL_DESCRIPTIONS,
  GROUP_PANEL_BUTTONS,
  GROUP_FACTION_BUTTONS,
  GROUP_ASSIGNMENT_BUTTONS,
  PANEL_TITLE_ASIGNAR_GRUPO,
  GROUP_ASSIGNMENT_DESCRIPTION_PREFIX,
  FACTION_DISPLAY_NAMES,
  GROUP_LABELS,
  SpecialGroupLabels,
} from "../../../shared/systemCatalog.js";
import { SpecialGroups } from "../../menu_config.js";
import { cleanupCommandMenuSession, pauseSession } from "../sessionStore.js";
import { scanActiveUnits, invalidateScanCache, invalidateEntityQueryCache } from "../../model/menu_entity_scanner.js";
import { setUnitGroup } from "../../model/menu_groups.js";
import { stripColorCodes } from "../helpers/formHelpers.js";

export interface GroupViewParams {
  player: Player;
}

export function buildGroupsView({ player }: GroupViewParams): () => void {
  return () => showGroupsPanel(player);
}

export function buildGroupsByFactionView({ player }: GroupViewParams, faction: string): () => void {
  return () => showGroupsByFaction(player, faction);
}

export function buildGroupAssignmentView({ player }: GroupViewParams, faction: string, nametag: string): () => void {
  return () => showGroupAssignment(player, faction, nametag);
}

function showGroupsPanel(player: Player): void {
  try {
    const form = new CustomForm(player, PANEL_TITLES.groups);

    form.spacer();
    form.label(PANEL_DESCRIPTIONS.groups);
    form.spacer();

    form.button(stripColorCodes(GROUP_PANEL_BUTTONS.assignByFaction), () => {
      form.close();
      system.run(() => showGroupsByFaction(player, "foundation"));
    });

    form.button(stripColorCodes(GROUP_PANEL_BUTTONS.back), () => {
      form.close();
      system.run(() => import("../panels/mainPanel.js").then(({ showMainPanel }) => showMainPanel(player)));
    });

    form
      .show()
      .then((reason) => {
        if (reason === "ClientClosed") {
          pauseSession(player.id);
        }
      })
      .catch((err) => {
        cleanupCommandMenuSession(player.id);
      });
  } catch (e) {
    cleanupCommandMenuSession(player.id);
  }
}

function showGroupsByFaction(player: Player, faction: string): void {
  try {
    const form = new CustomForm(player, `${PANEL_TITLES.groupsByFaction} - ${FACTION_DISPLAY_NAMES[faction]}`);

    form.spacer();
    form.label(PANEL_DESCRIPTIONS.groupsByFaction);
    form.spacer();

    const dimension = world.getDimension("overworld");
    const scanResult = scanActiveUnits(dimension, faction);

    const allGroups = Object.values(SpecialGroups);
    const groupCounts: Record<string, number> = {};
    for (const groupId of allGroups) {
      groupCounts[groupId] = 0;
    }

    for (const entity of scanResult.entities) {
      const group = entity.group ?? SpecialGroups.NO_GROUP;
      if (group in groupCounts) {
        groupCounts[group]++;
      }
    }

    for (const groupId of allGroups) {
      const label = GROUP_LABELS[groupId] ?? groupId;
      const count = groupCounts[groupId] ?? 0;
      form.label(`§7${label}: §f${count} unidades`);
    }

    form.spacer();

    const sortedNametags = Object.keys(scanResult.nametagGroups).sort((a, b) => {
      const countA = scanResult.nametagGroups[a]?.length ?? 0;
      const countB = scanResult.nametagGroups[b]?.length ?? 0;
      return countB - countA;
    });

    for (const nametag of sortedNametags) {
      const entities = scanResult.nametagGroups[nametag] ?? [];
      const count = entities.length;
      const familyId = entities[0]?.nametagFamilyId ?? nametag;
      const familyLabel = familyId ? (SpecialGroupLabels[familyId] ?? `§f${familyId}`) : `§f${nametag}`;
      const buttonLabel = `${stripColorCodes(familyLabel)} (${count} nt)`;

      form.button(buttonLabel, () => {
        form.close();
        system.run(() => showGroupAssignment(player, faction, nametag));
      });
    }

    form.button(stripColorCodes(GROUP_PANEL_BUTTONS.back), () => {
      form.close();
      system.run(() => showGroupsPanel(player));
    });

    form
      .show()
      .then((reason) => {
        if (reason === "ClientClosed") {
          pauseSession(player.id);
        }
      })
      .catch((err) => {
        cleanupCommandMenuSession(player.id);
      });
  } catch (e) {
    cleanupCommandMenuSession(player.id);
  }
}

function showGroupAssignment(player: Player, faction: string, nametag: string): void {
  try {
    const formTitle = `${PANEL_TITLE_ASIGNAR_GRUPO}${nametag}`;
    const form = new CustomForm(player, formTitle);

    form.spacer();
    form.label(`${GROUP_ASSIGNMENT_DESCRIPTION_PREFIX}${nametag}`);
    form.spacer();

    const dimension = world.getDimension("overworld");
    const scanResult = scanActiveUnits(dimension, faction);
    const entities = scanResult.nametagGroups[nametag] ?? [];

    const groupOptions = Object.values(SpecialGroups);
    const items = groupOptions.map((groupId, idx) => ({
      label: stripColorCodes(GROUP_LABELS[groupId] ?? groupId),
      value: idx,
    }));

    const groupObs = new ObservableNumber(0, { clientWritable: true });
    form.dropdown(stripColorCodes("Grupo"), groupObs, items);

    form.spacer();

    form.button(stripColorCodes(GROUP_ASSIGNMENT_BUTTONS.back), () => {
      invalidateScanCache();
      invalidateEntityQueryCache();
      form.close();
      system.run(() => showGroupsByFaction(player, faction));
    });

    form
      .show()
      .then((reason) => {
        if (reason === "ClientClosed") {
          pauseSession(player.id);
          return;
        }

        const selectedIndex = groupObs.getData();
        const selectedGroup = groupOptions[selectedIndex];
        if (selectedGroup) {
          for (const scannedEntity of entities) {
            setUnitGroup(scannedEntity.entity, selectedGroup);
          }
          player.sendMessage(
            `§a[SCPDystopia] Grupo ${selectedGroup} asignado a ${entities.length} unidades de ${nametag}.`
          );
        }
      })
      .catch((err) => {
        cleanupCommandMenuSession(player.id);
      });
  } catch (e) {
    cleanupCommandMenuSession(player.id);
  }
}
