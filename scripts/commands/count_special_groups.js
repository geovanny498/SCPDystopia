// commands/register_systems.js
import {
  system,
  world,
  CustomCommandStatus,
  CommandPermissionLevel,
  CustomCommandSource,
  CustomCommandParamType,
  CustomCommandErrorReason,
} from "@minecraft/server";
import {
  systems as menuSystems,
  ControlType,
  UnitHierarchy,
  UnitHierarchyLabels,
  SpecialGroups,
  SpecialGroupLabels,
  Factions,
  specialUnits,
} from "../gui/commandMenu/menu_config.js";
import { getEntityFactionInfo, isValidSoldier } from "../gui/commandMenu/model/menu_faction.js";
import { teamFamilies } from "../utils/teams.js";

// --- Comando count_special_groups ---
system.beforeEvents.startup.subscribe((init) => {
  const factionEnumName = "scpd:faction";

  init.customCommandRegistry.registerEnum(factionEnumName, [Factions.FOUNDATION, Factions.CHAOS]);

  const countGroupsCmd = {
    name: "scpd:count_special_groups",
    description: "Cuenta las unidades especiales en simulación por facción y grupo A-D / Sin grupo",
    permissionLevel: CommandPermissionLevel.Any,
    cheatsRequired: false,
    mandatoryParameters: [{ name: factionEnumName, type: CustomCommandParamType.Enum }],
    optionalParameters: [{ name: "showList", type: CustomCommandParamType.Boolean }],
  };

  try {
    init.customCommandRegistry.registerCommand(countGroupsCmd, (origin, faction, showList) => {
      try {
        const normalizedFaction = String(faction || "").toLowerCase();
        if (normalizedFaction !== Factions.FOUNDATION && normalizedFaction !== Factions.CHAOS) {
          const validOptions = `${Factions.FOUNDATION} / ${Factions.CHAOS}`;
          const errorMessage = `Faction inválida. Usa: ${validOptions}`;
          if (origin.sourceType === CustomCommandSource.Entity && origin.sourceEntity) {
            origin.sourceEntity.sendMessage(`§c${errorMessage}`);
          } else {
            world.sendMessage(`§c${errorMessage}`);
          }
          return {
            status: CustomCommandStatus.Failure,
            message: errorMessage,
          };
        }
        const selectedFaction = normalizedFaction;
        const specialOrder = specialUnits[selectedFaction]?.all || [];
        const specialOrderIndex = new Map(specialOrder.map((name, index) => [name, index]));
        const sortByMenuConfig = (a, b) => {
          const indexA = specialOrderIndex.has(a) ? specialOrderIndex.get(a) : Number.MAX_SAFE_INTEGER;
          const indexB = specialOrderIndex.has(b) ? specialOrderIndex.get(b) : Number.MAX_SAFE_INTEGER;
          if (indexA !== indexB) return indexA - indexB;
          return a.localeCompare(b, undefined, { sensitivity: "base" });
        };
        const pluralizeUnit = (count) => (count === 1 ? "unidad" : "unidades");

        const reportLines = [];
        const counts = {
          [SpecialGroups.GROUP_A]: [],
          [SpecialGroups.GROUP_B]: [],
          [SpecialGroups.GROUP_C]: [],
          [SpecialGroups.GROUP_D]: [],
          [SpecialGroups.NO_GROUP]: [],
        };

        const validFamilies = selectedFaction === Factions.FOUNDATION ? teamFamilies.foundation : teamFamilies.chaos;
        const dims = ["overworld", "nether", "the_end"].map((id) => world.getDimension(id)).filter(Boolean);
        const seen = new Set();

        for (const dim of dims) {
          for (const family of validFamilies) {
            const ents = dim.getEntities({ families: [family] });
            for (const ent of ents) {
              if (!ent || !ent.id || seen.has(ent.id)) continue;
              seen.add(ent.id);
              if (!isValidSoldier(ent)) continue;

              const factionInfo = getEntityFactionInfo(ent);
              if (!factionInfo || !factionInfo.isSpecial || !factionInfo.group) continue;
              if (factionInfo.faction !== selectedFaction) continue;

              const nameTag = ent.nameTag ?? ent.typeId;
              const groupId = factionInfo.group;
              if (!counts[groupId]) continue;
              counts[groupId].push(nameTag);
            }
          }
        }

        const totalCount = Object.values(counts).reduce((sum, list) => sum + list.length, 0);
        reportLines.push("§9§l[SCPDystopia] Conteo de especiales en simulación§r");
        reportLines.push(`§fTotal: §e${totalCount} ${pluralizeUnit(totalCount)}§r`);
        for (const groupId of [
          SpecialGroups.GROUP_A,
          SpecialGroups.GROUP_B,
          SpecialGroups.GROUP_C,
          SpecialGroups.GROUP_D,
          SpecialGroups.NO_GROUP,
        ]) {
          const label = {
            [SpecialGroups.GROUP_A]: "§9Grupo A§r",
            [SpecialGroups.GROUP_B]: "§aGrupo B§r",
            [SpecialGroups.GROUP_C]: "§6Grupo C§r",
            [SpecialGroups.GROUP_D]: "§dGrupo D§r",
            [SpecialGroups.NO_GROUP]: "§7Sin grupo§r",
          }[groupId];
          const groupCount = counts[groupId].length;
          if (groupCount === 0 && !showList) continue;
          reportLines.push(`§f${label}: §e${groupCount} ${pluralizeUnit(groupCount)}§r`);
          if (showList && groupCount > 0) {
            const nameCounts = counts[groupId].reduce((acc, name) => {
              acc[name] = (acc[name] || 0) + 1;
              return acc;
            }, {});

            const sortedNames = Object.keys(nameCounts).sort(sortByMenuConfig);
            for (const name of sortedNames) {
              const quantity = nameCounts[name];
              const suffix = quantity > 1 ? ` x${quantity}` : "";
              reportLines.push(`  §7- §r${name}§r${suffix}`);
            }
          }
        }

        const message = reportLines.join("\n");
        if (origin.sourceType === CustomCommandSource.Entity && origin.sourceEntity) {
          origin.sourceEntity.sendMessage(message);
        } else {
          world.sendMessage(message);
        }

        return {
          status: CustomCommandStatus.Success,
          message: "Conteo de especiales generado",
        };
      } catch (e) {
        console.warn("scpd:count_special_groups error:", e);
        return {
          status: CustomCommandStatus.Failure,
          message: "Error al contar los especiales en simulación.",
        };
      }
    });
  } catch (e) {
    console.warn(`Error registrando scpd:count_special_groups: ${e}`);
  }
});
