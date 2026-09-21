// scripts/gui/commandMenu/ddui/panels/groupsPanel.ts

import { Player, system, world } from "@minecraft/server";
import { CustomForm, ObservableNumber } from "@minecraft/server-ui";
import { debug } from "../../../../utils/debug.js";
import { Factions, FACTION_IDS, TargetFaction } from "../../../../constants/domains.js";
import {
  PANEL_TITLES,
  PANEL_DESCRIPTIONS,
  GROUP_PANEL_BUTTONS,
  FACTION_DISPLAY_NAMES,
  GROUP_LABELS,
  GROUP_DESCRIPTIONS,
  ERROR_MESSAGES,
} from "../../../shared/systemCatalog.js";
import { SYSTEM_PANEL_FEEDBACK_INITIAL } from "../../../shared/dduiFeedback.js";
import { entityHistoryStore } from "../../../shared/entityHistory.js";
import { commandMenuSessionStore } from "../sessionStore.js";
import { showMainPanel } from "./mainPanel.js";
import {
  scanActiveUnitsMerged,
  invalidateScanCache,
  invalidateEntityQueryCache,
  type ScannedEntity,
} from "../../model/menu_entity_scanner.js";
import { loadScope, isEntityInScope } from "../../model/menu_scope.js";
import { setUnitGroup } from "../../../shared/entityGroups.js";
import { stripColorCodes } from "../helpers/formHelpers.js";
import { compareNametags } from "../../../../utils/nametagSort.js";
import { addHistoryEntry, getSystemShortName } from "../helpers/historyStore.js";
import {
  SpecialGroups,
  getGroupsOrderForSystems,
  getGroupsOrderForAssignment,
  SpecialGroupLabels,
} from "../../menu_config.js";
import { SpecialGroupId } from "../../../../constants/domains.js";

/**
 * Mapa estático inmutable de prioridades para grupos especiales.
 * Resuelve la preselección en nametags con unidades en diferentes grupos (mayor valor = mayor prioridad).
 */
const GROUP_PRIORITY_MAP: Readonly<Record<string, number>> = Object.freeze(
  (() => {
    const order = getGroupsOrderForSystems();
    const map: Record<string, number> = {};
    for (let i = 0; i < order.length; i++) {
      map[order[i]] = order.length - i;
    }
    return map;
  })()
);

export function showGroupsPanel(player: Player, targetFaction: TargetFaction = Factions.FOUNDATION): void {
  showGroupsByFaction(player, targetFaction);
}

function showGroupsByFaction(player: Player, faction: TargetFaction): void {
  try {
    let closeReason: "navigation" | undefined = undefined;
    let nextPanel: (() => void) | undefined = undefined;

    const form = new CustomForm(player, `${PANEL_TITLES.groupsByFaction} - ${FACTION_DISPLAY_NAMES[faction]}`);

    form.spacer();
    form.label(PANEL_DESCRIPTIONS.groupsByFaction);
    form.spacer();

    const dimension = player.dimension;
    if (!dimension) {
      player.sendMessage(ERROR_MESSAGES.NO_DIMENSION);
      return;
    }

    const scanResult = scanActiveUnitsMerged(dimension, faction);
    const scope = loadScope();

    const groupCounts: Record<string, { total: number; foundation: number; chaos: number }> = {};
    const eligibleNametags = new Set<string>();

    for (const entity of scanResult.entities) {
      if (!entity.isSpecial) continue;
      if (!isEntityInScope(entity.entity, entity.faction, scope, entity.nametag)) continue;

      if (entity.nametag) {
        eligibleNametags.add(entity.nametag);
      }

      const group = entity.group ?? SpecialGroups.NO_GROUP;
      if (!groupCounts[group]) groupCounts[group] = { total: 0, foundation: 0, chaos: 0 };
      groupCounts[group].total++;
      if (entity.faction === Factions.FOUNDATION) groupCounts[group].foundation++;
      if (entity.faction === Factions.CHAOS) groupCounts[group].chaos++;
    }

    const groupOrder = getGroupsOrderForSystems();
    for (let i = 0; i < groupOrder.length; i++) {
      const groupId = groupOrder[i];
      const label = GROUP_LABELS[groupId as keyof typeof GROUP_LABELS] ?? groupId;
      const counts = groupCounts[groupId];
      const count = counts?.total ?? 0;
      if (i > 0) form.spacer();
      if (faction === "both" && counts) {
        form.label(`§7${label}: §f${count} unidades §8(F:${counts.foundation} | C:${counts.chaos})`);
      } else {
        form.label(`§7${label}: §f${count} unidades`);
      }
    }

    form.spacer();

    const bucketEntries = Object.entries(scanResult.buckets);
    for (const [bucketId, bucket] of bucketEntries) {
      if (bucket.unitCount === 0) continue;

      let eligibleNtCount = 0;
      for (const nt of Object.keys(bucket.nametags)) {
        if (eligibleNametags.has(nt)) eligibleNtCount++;
      }

      if (eligibleNtCount === 0) continue;

      const counterLabel = eligibleNtCount > 1 ? ` (${eligibleNtCount} nametags)` : "";
      form.button(`${stripColorCodes(bucket.label)}${counterLabel}`, () => {
        closeReason = "navigation";
        nextPanel = () => showBucketAssignment(player, faction, bucketId);
        form.close();
      });
    }

    form.divider();

    form.button(stripColorCodes(GROUP_PANEL_BUTTONS.back), () => {
      closeReason = "navigation";
      nextPanel = () => showMainPanel(player, faction);
      form.close();
    });

    form
      .show()
      .then((reason) => {
        if (reason === "ClientClosed") {
          debug("commandMenuDDUI", `Grupos por Facción cerrado: X del cliente (§b${player.name}§r)`, {
            level: "debug",
            color: "blue",
          });
          commandMenuSessionStore.cleanup(player.id);
        } else if (reason === "UserBusy") {
          debug("commandMenuDDUI", `Grupos por Facción cerrado: §cUserBusy§r (§b${player.name}§r)`, {
            level: "warn",
            color: "yellow",
          });
          commandMenuSessionStore.cleanup(player.id);
        } else if (reason === "ServerClosed") {
          if (closeReason === "navigation") {
            debug("commandMenuDDUI", `Grupos por Facción cerrado: navegación (§b${player.name}§r)`, {
              level: "debug",
              color: "gray",
            });
            nextPanel?.();
          } else {
            debug("commandMenuDDUI", `Grupos por Facción cerrado: §cServerClosed§r sin razón (§b${player.name}§r)`, {
              level: "warn",
              color: "yellow",
            });
            commandMenuSessionStore.cleanup(player.id);
          }
        }
        closeReason = undefined;
        nextPanel = undefined;
      })
      .catch((err) => {
        debug("commandMenuDDUI", `Error en form.show() grupos por facción: ${err}`, { level: "error", color: "red" });
        commandMenuSessionStore.cleanup(player.id);
      });
  } catch (e) {
    debug("commandMenuDDUI", `Error en showGroupsByFaction: ${e}`, { level: "error", color: "red" });
  }
}

function showBucketAssignment(player: Player, faction: TargetFaction, bucketId: string): void {
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

    const scanResult = scanActiveUnitsMerged(dimension, faction);
    const bucket = scanResult.buckets[bucketId];
    if (!bucket) {
      player.sendMessage(ERROR_MESSAGES.NO_BUCKET);
      return;
    }

    let closeReason: "navigation" | undefined = undefined;

    const form = new CustomForm(player, `${bucket.label} §8- Asignar Grupos`);

    form.spacer();
    form.label(`§7Facción: §f${FACTION_DISPLAY_NAMES[faction]}`);
    form.spacer();

    const scope = loadScope();

    // Filtrar nametags de este bucket que contengan al menos una entidad en scope
    const eligibleEntitiesByNametag: Record<string, ScannedEntity[]> = {};
    for (const nt of Object.keys(bucket.nametags)) {
      const entitiesInScope = (scanResult.nametagGroups[nt] || []).filter((e) =>
        isEntityInScope(e.entity, e.faction, scope, e.nametag)
      );
      if (entitiesInScope.length > 0) {
        eligibleEntitiesByNametag[nt] = entitiesInScope;
      }
    }

    const nametags = Object.keys(eligibleEntitiesByNametag).sort(compareNametags);
    const totalEligibleUnits = nametags.reduce((sum, nt) => sum + (eligibleEntitiesByNametag[nt]?.length ?? 0), 0);

    form.label(`§7Rol: §f${bucket.label} §8(${totalEligibleUnits} unidades)`);
    form.spacer();

    const feedbackPresenter = session.getOrCreateFeedbackPresenter("bucket_assignment", SYSTEM_PANEL_FEEDBACK_INITIAL);
    form.label(feedbackPresenter.getObservable());
    form.spacer();

    if (nametags.length === 0) {
      form.label("§cNo hay unidades elegibles en scope para este rol.");
    }

    const groupOptions = getGroupsOrderForAssignment().map((groupId) => ({
      value: groupId,
      label: SpecialGroupLabels[groupId] ?? groupId,
    }));

    const items = groupOptions.map((opt, idx) => ({
      label: stripColorCodes(opt.label),
      value: idx,
      description: GROUP_DESCRIPTIONS[opt.value as SpecialGroupId]
        ? stripColorCodes(GROUP_DESCRIPTIONS[opt.value as SpecialGroupId])
        : undefined,
    }));

    // Renderizado de dropdowns: solo nametags con unidades en scope generan control
    const controls: { nametag: string; obs: ObservableNumber; lastAppliedIndex: number }[] = [];
    for (const nt of nametags) {
      const entitiesForTag = eligibleEntitiesByNametag[nt] || [];
      const ntCount = entitiesForTag.length;

      let preferredGroup: string = SpecialGroups.NO_GROUP;
      let maxPriority = 0;

      for (const scanned of entitiesForTag) {
        const entityGroup = scanned.group ?? SpecialGroups.NO_GROUP;
        const currentPriority = GROUP_PRIORITY_MAP[entityGroup] || 1;
        if (currentPriority > maxPriority) {
          maxPriority = currentPriority;
          preferredGroup = entityGroup;
        }
      }

      const currentIndex = groupOptions.findIndex((opt) => opt.value === preferredGroup);
      const initialIndex =
        currentIndex >= 0 ? currentIndex : groupOptions.findIndex((opt) => opt.value === SpecialGroups.NO_GROUP);
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
    });

    form
      .show()
      .then((reason) => {
        if (reason === "ClientClosed") {
          debug("commandMenuDDUI", `Asignación por bucket cerrada: X del cliente (§b${player.name}§r)`, {
            level: "debug",
            color: "blue",
          });
          commandMenuSessionStore.cleanup(player.id);
        } else if (reason === "UserBusy") {
          debug("commandMenuDDUI", `Asignación por bucket cerrada: §cUserBusy§r (§b${player.name}§r)`, {
            level: "warn",
            color: "yellow",
          });
          commandMenuSessionStore.cleanup(player.id);
        } else if (reason === "ServerClosed") {
          if (closeReason === "navigation") {
            debug("commandMenuDDUI", `Asignación por bucket cerrada: navegación (§b${player.name}§r)`, {
              level: "debug",
              color: "gray",
            });
            showGroupsByFaction(player, faction);
          } else {
            debug("commandMenuDDUI", `Asignación por bucket cerrada: §cServerClosed§r sin razón (§b${player.name}§r)`, {
              level: "warn",
              color: "yellow",
            });
            commandMenuSessionStore.cleanup(player.id);
          }
        }
        closeReason = undefined;
      })
      .catch((err) => {
        debug("commandMenuDDUI", `Error en form.show() asignación por bucket: ${err}`, {
          level: "error",
          color: "red",
        });
        commandMenuSessionStore.cleanup(player.id);
      });
  } catch (e) {
    debug("commandMenuDDUI", `Error en showBucketAssignment: ${e}`, { level: "error", color: "red" });
  }
}

function applyGroupToNametag(player: Player, faction: TargetFaction, nametag: string, groupId: string): void {
  try {
    const dimension = player.dimension;
    if (!dimension) {
      player.sendMessage(ERROR_MESSAGES.NO_DIMENSION);
      return;
    }

    const scanResult = scanActiveUnitsMerged(dimension, faction);
    const scope = loadScope();
    const entities = (scanResult.nametagGroups[nametag] || []).filter((e) =>
      isEntityInScope(e.entity, e.faction, scope, e.nametag)
    );

    let foundationCount = 0;
    let chaosCount = 0;
    let appliedCount = 0;
    const groupLabel = GROUP_LABELS[groupId as keyof typeof GROUP_LABELS] ?? groupId;
    for (const scanned of entities) {
      setUnitGroup(scanned.entity, groupId);
      const targetName = scanned.nametag
        ? `§r§f${scanned.nametag}§r`
        : scanned.entity.nameTag
          ? `§r§f${scanned.entity.nameTag}§r`
          : `§b${scanned.entity.typeId}§r`;
      entityHistoryStore.pushHistory(scanned.entity.id, {
        source: "command",
        viewId: "group_assignment",
        context: getSystemShortName("group_assignment"),
        value: groupLabel,
        targetName,
      });
      appliedCount++;
      if (scanned.faction === Factions.FOUNDATION) foundationCount++;
      if (scanned.faction === Factions.CHAOS) chaosCount++;
    }

    if (appliedCount > 0) {
      if (faction === "both") {
        player.sendMessage(
          `§a[SCPDystopia] §7${groupLabel} asignado a ${appliedCount} unidad/es de ${nametag} §f(F:${foundationCount} | C:${chaosCount}).`
        );
      } else {
        player.sendMessage(
          `§a[SCPDystopia] §7${groupLabel} asignado a ${appliedCount} unidad/es de ${nametag} §fen ${FACTION_DISPLAY_NAMES[faction]}.`
        );
      }
    }

    const session = commandMenuSessionStore.get(player.id);
    if (session) {
      session.getOrCreateFeedbackPresenter("bucket_assignment", SYSTEM_PANEL_FEEDBACK_INITIAL).present({
        context: groupLabel,
        value: `${nametag} (${appliedCount} unidades)`,
        status: "ok",
      });
    }

    if (faction === "both") {
      if (foundationCount > 0) {
        addHistoryEntry({
          playerName: player.name,
          faction: Factions.FOUNDATION,
          systemShortName: getSystemShortName("group_assignment"),
          key: nametag,
          value: groupLabel,
        });
      }
      if (chaosCount > 0) {
        addHistoryEntry({
          playerName: player.name,
          faction: Factions.CHAOS,
          systemShortName: getSystemShortName("group_assignment"),
          key: nametag,
          value: groupLabel,
        });
      }
    } else {
      addHistoryEntry({
        playerName: player.name,
        faction,
        systemShortName: getSystemShortName("group_assignment"),
        key: nametag,
        value: groupLabel,
      });
    }
  } catch (e) {
    debug("commandMenuDDUI", `Error asignando grupo: ${e}`, { level: "error", color: "red" });
    player.sendMessage(ERROR_MESSAGES.ASSIGN_GROUP);
  }
}
