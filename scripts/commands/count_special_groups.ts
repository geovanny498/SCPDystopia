// commands/count_special_groups.js
import {
  system,
  world,
  CustomCommandStatus,
  CommandPermissionLevel,
  CustomCommandSource,
  CustomCommandParamType,
} from "@minecraft/server";
import {
  systems as menuSystems,
  ControlType,
  UnitHierarchy,
  UnitHierarchyLabels,
  SpecialGroups,
  SpecialGroupLabels,
  Factions,
  scanActiveUnits,
  getFamilyTagLabel,
  getFamilyTagOrder,
} from "../gui/commandMenu/menu_config.js";
import { getEntityFactionInfo } from "../gui/commandMenu/model/menu_faction.js";
import { compareNametags } from "../utils/nametagSort.js";
import { teamFamilies } from "../utils/teams.js";

// ═══════════════════════════════════════════════════════════════════════════════
// §  Comando scpd:count_special_groups
// ═══════════════════════════════════════════════════════════════════════════════

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
          const errorMessage = `§cFaction inválida. Usa: ${validOptions}`;
          if (origin.sourceType === CustomCommandSource.Entity && origin.sourceEntity) {
            (origin.sourceEntity as any).sendMessage(errorMessage);
          } else {
            world.sendMessage(errorMessage);
          }
          return { status: CustomCommandStatus.Failure, message: "Faction inválida" };
        }

        const selectedFaction = normalizedFaction as "foundation" | "chaos";
        const pluralizeUnit = (count: number) => (count === 1 ? "unidad" : "unidades");

        // Escanear solo la dimensión del jugador para que el cache TTL sea funcional
        const playerDim = origin.sourceEntity?.dimension.id || "overworld";
        const dims = [world.getDimension(playerDim)].filter(Boolean);

        // TODO: cuando se necesite conteo multi-dimensión, usar una cache keyed por dimension

        const counts: Record<string, string[]> = {
          [SpecialGroups.GROUP_A]: [],
          [SpecialGroups.GROUP_B]: [],
          [SpecialGroups.GROUP_C]: [],
          [SpecialGroups.GROUP_D]: [],
          [SpecialGroups.NO_GROUP]: [],
        };

        for (const dim of dims) {
          const scanResult = scanActiveUnits(dim, selectedFaction);
          for (const scanned of scanResult.entities) {
            if (!scanned.isSpecial) continue;
            if (scanned.faction !== selectedFaction) continue;
            if (!Object.keys(counts).includes(scanned.group!)) continue;

            const groupKey = scanned.group!;
            const nameTag = scanned.nametag || scanned.typeId;
            counts[groupKey].push(nameTag);
          }
        }

        const totalCount = Object.values(counts).reduce((sum, list) => sum + list.length, 0);
        const reportLines = [];
        reportLines.push("§9§l[SCPDystopia] Conteo de especiales en simulación por facción y grupo§r");
        reportLines.push(`§fTotal: §e${totalCount} ${pluralizeUnit(totalCount)}§r`);

        for (const groupId of [
          SpecialGroups.GROUP_A,
          SpecialGroups.GROUP_B,
          SpecialGroups.GROUP_C,
          SpecialGroups.GROUP_D,
          SpecialGroups.NO_GROUP,
        ]) {
          const label = SpecialGroupLabels[groupId as keyof typeof SpecialGroupLabels];
          const groupCount = counts[groupId]?.length || 0;
          if (groupCount === 0 && !showList) continue;

          reportLines.push(`§f${label}: §e${groupCount} ${pluralizeUnit(groupCount)}§r`);

          if (showList && groupCount > 0) {
            const nameCounts = counts[groupId].reduce((acc: Record<string, number>, name: string) => {
              acc[name] = (acc[name] || 0) + 1;
              return acc;
            }, {});

            // Ordenar nametags por NAMETAG_FAMILY_MAP
            const sortedNames = Object.keys(nameCounts).sort((a, b) => {
              const orderA = getFamilyTagOrder(a) || Number.MAX_SAFE_INTEGER;
              const orderB = getFamilyTagOrder(b) || Number.MAX_SAFE_INTEGER;
              if (orderA !== orderB) return orderA - orderB;
              return compareNametags(a, b);
            });

            for (const name of sortedNames) {
              const quantity = nameCounts[name];
              const suffix = quantity > 1 ? ` §8x${quantity}` : "";
              reportLines.push(`  §7- §r${name}§r${suffix}`);
            }
          }
        }

        const message = reportLines.join("\n");
        if (origin.sourceType === CustomCommandSource.Entity && origin.sourceEntity) {
          (origin.sourceEntity as any).sendMessage(message);
        } else {
          world.sendMessage(message);
        }

        return { status: CustomCommandStatus.Success, message: "Conteo de especiales generado" };
      } catch (e) {
        console.warn("scpd:count_special_groups error:", e);
        return { status: CustomCommandStatus.Failure, message: "Error al contar los especiales." };
      }
    });
  } catch (e) {
    console.warn(`Error registrando scpd:count_special_groups: ${e}`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// §  Comando scpd:count_normal_units
// ═══════════════════════════════════════════════════════════════════════════════

system.beforeEvents.startup.subscribe((init) => {
  const factionEnumName = "scpd:faction2";

  init.customCommandRegistry.registerEnum(factionEnumName, [Factions.FOUNDATION, Factions.CHAOS]);

  const countNormalMtfCmd = {
    name: "scpd:count_normal_units",
    description: "Cuenta las unidades no especiales en simulación por facción y jerarquía",
    permissionLevel: CommandPermissionLevel.Any,
    cheatsRequired: false,
    mandatoryParameters: [{ name: factionEnumName, type: CustomCommandParamType.Enum }],
    optionalParameters: [{ name: "showList", type: CustomCommandParamType.Boolean }],
  };

  try {
    init.customCommandRegistry.registerCommand(countNormalMtfCmd, (origin, faction, showList) => {
      try {
        const normalizedFaction = String(faction || "").toLowerCase();
        if (normalizedFaction !== Factions.FOUNDATION && normalizedFaction !== Factions.CHAOS) {
          const validOptions = `${Factions.FOUNDATION} / ${Factions.CHAOS}`;
          const errorMessage = `§cFaction inválida. Usa: ${validOptions}`;
          if (origin.sourceType === CustomCommandSource.Entity && origin.sourceEntity) {
            (origin.sourceEntity as any).sendMessage(errorMessage);
          } else {
            world.sendMessage(errorMessage);
          }
          return { status: CustomCommandStatus.Failure, message: "Faction inválida" };
        }

        const selectedFaction = normalizedFaction as "foundation" | "chaos";
        const pluralizeUnit = (count: number) => (count === 1 ? "unidad" : "unidades");
        const hierarchyOrder = [UnitHierarchy.BASIC, UnitHierarchy.LEADER, UnitHierarchy.COMMANDER];

        // Escanear solo la dimensión del jugador para que el cache TTL sea funcional
        const playerDim = origin.sourceEntity?.dimension.id || "overworld";
        const dims = [world.getDimension(playerDim)].filter(Boolean);

        // TODO: cuando se necesite conteo multi-dimensión, usar una cache keyed por dimension

        const counts: Record<string, { groups: Record<string, string[]>; total: number }> = {};
        for (const h of hierarchyOrder) {
          counts[h] = { groups: {}, total: 0 };
        }

        for (const dim of dims) {
          const scanResult = scanActiveUnits(dim, selectedFaction);
          for (const scanned of scanResult.entities) {
            if (scanned.isSpecial) continue;
            if (scanned.faction !== selectedFaction) continue;
            if (!scanned.hierarchy || !hierarchyOrder.includes(scanned.hierarchy)) continue;

            // Etiquetar por familia MTF detectada o tipo
            const mtfLabel = getFamilyTagLabel(scanned.nametagFamilyId) || "§7Desconocido§r";
            if (!counts[scanned.hierarchy].groups[mtfLabel]) {
              counts[scanned.hierarchy].groups[mtfLabel] = [];
            }

            const displayName = scanned.nametag?.trim() || `§b${scanned.typeId}§r`;
            counts[scanned.hierarchy].groups[mtfLabel].push(displayName);
            counts[scanned.hierarchy].total += 1;
          }
        }

        const totalCount = hierarchyOrder.reduce((sum, h) => sum + (counts[h]?.total || 0), 0);
        const reportLines: string[] = [];
        reportLines.push("§9§l[SCPDystopia] Conteo de NO especiales en simulación por facción y jerarquía§r");
        reportLines.push(`§fTotal: §e${totalCount} ${pluralizeUnit(totalCount)}§r`);

        for (const hierarchy of hierarchyOrder) {
          const hierarchyTotal = counts[hierarchy]?.total || 0;
          if (hierarchyTotal === 0 && !showList) continue;

          reportLines.push(
            `§f${UnitHierarchyLabels[hierarchy as keyof typeof UnitHierarchyLabels]}: §e${hierarchyTotal} ${pluralizeUnit(hierarchyTotal)}§r`
          );

          const groupLabels = Object.keys(counts[hierarchy].groups);
          for (const label of groupLabels) {
            const groupCount = (counts[hierarchy].groups[label] || []).length;
            if (groupCount === 0) continue;

            if (showList) {
              const nameCounts = (counts[hierarchy].groups[label] || []).reduce(
                (acc: Record<string, number>, name: string) => {
                  acc[name] = (acc[name] || 0) + 1;
                  return acc;
                },
                {}
              );

              const sortedNames = Object.keys(nameCounts).sort(compareNametags);

              if (sortedNames.length === 1) {
                const onlyName = sortedNames[0];
                reportLines.push(`    §7${label}: §e${groupCount} ${pluralizeUnit(groupCount)}§r (${onlyName}§r)`);
              } else {
                reportLines.push(`    §7${label}: §e${groupCount} ${pluralizeUnit(groupCount)}§r`);
                for (const name of sortedNames) {
                  const quantity = nameCounts[name];
                  const suffix = quantity > 1 ? ` §8x${quantity}` : "";
                  reportLines.push(`      §7- §r${name}§r${suffix}`);
                }
              }
            } else {
              reportLines.push(`    §7${label}: §e${groupCount} ${pluralizeUnit(groupCount)}§r`);
            }
          }
        }

        const message = reportLines.join("\n");
        if (origin.sourceType === CustomCommandSource.Entity && origin.sourceEntity) {
          (origin.sourceEntity as any).sendMessage(message);
        } else {
          world.sendMessage(message);
        }

        return { status: CustomCommandStatus.Success, message: "Conteo de no especiales generado" };
      } catch (e) {
        console.warn("scpd:count_normal_mtf error:", e);
        return { status: CustomCommandStatus.Failure, message: "Error al contar las unidades no especiales." };
      }
    });
  } catch (e) {
    console.warn(`Error registrando scpd:count_normal_mtf: ${e}`);
  }
});
