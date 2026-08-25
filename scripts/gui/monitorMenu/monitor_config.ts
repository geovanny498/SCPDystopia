// scripts/gui/monitorMenu/monitor_config.ts

import {
  Factions,
  SpecialGroups,
  SpecialGroupLabels,
  UnitHierarchyLabels,
  UnitHierarchy,
} from "../commandMenu/menu_config.js";
import { NAMETAG_FAMILY_MAP, getFamilyTagLabel } from "../commandMenu/menu_config.js";

export type MonitorFaction = "foundation" | "chaos" | "ambas";
export type MonitorUnitType = "especiales" | "normales" | "ambos";
export type MonitorSortBy = "alpha_asc" | "alpha_desc";
export type MonitorListMode = "breve" | "completa";

export interface MonitorConfig {
  faction: MonitorFaction;
  unitType: MonitorUnitType;
  listMode: MonitorListMode;
  sortBy: MonitorSortBy;
}

export const MonitorConfigDefaults: MonitorConfig = {
  faction: "ambas",
  unitType: "especiales",
  listMode: "completa",
  sortBy: "alpha_asc",
};

export const MonitorTitles = {
  main: "§bMonitor de Unidades en Tiempo Real",
  foundation: "§lFoundation",
  chaos: "§2§lChaos",
  config: "§6§l§nConfiguración del Monitor§r",
};

export const MonitorLabels = {
  total: "§7Total:§r",
  noSpecials: "§7No especiales:§r",
  specials: "§eEspeciales:§r",
  noUnits: "§8No hay unidades",
  units: "unidades",
  refreshing: "§8Actualizando...",
};

export const MonitorButtons = {
  config: "Configuración",
  save: "Guardar",
  cancel: "Cancelar",
};

export const MonitorConfigLabels = {
  faction: {
    foundation: "§bFoundation§r",
    chaos: "§2Chaos§r",
    ambas: "§bFoundation§r / §2Chaos§r",
  },
  unitType: {
    especiales: "§eEspeciales§r",
    normales: "§7No especiales§r",
    ambos: "§7Todos§r",
  },
  listMode: {
    completa: "§aCompleta§r",
    breve: "§8Breve§r",
  },
  sortBy: {
    alpha_asc: "§aAscendente§r",
    alpha_desc: "§cDescendente§r",
  },
};

export function pluralizeUnit(count: number): string {
  return count === 1 ? "unidad" : "unidades";
}

export function stripColorCodes(text: string): string {
  return text.replace(/§[0-9a-fk-or]/gi, "");
}

export function buildFactionSummary(
  scan: {
    entities: {
      isSpecial: boolean;
      hierarchy?: string;
      group?: string;
      nametag?: string;
      typeId: string;
      families?: string[];
    }[];
  },
  includeNormals: boolean
): {
  total: number;
  basic: number;
  leader: number;
  commander: number;
  specialsByGroup: Record<string, { count: number; nametags: string[] }>;
  normalsByHierarchy: Record<
    string,
    {
      label: string;
      count: number;
      familyTags: Record<string, { label: string; count: number; typeIds: string[]; nametags: string[] }>;
    }
  >;
} {
  const specialsByGroup: Record<string, { count: number; nametags: string[] }> = {};
  for (const gid of Object.values(SpecialGroups)) {
    specialsByGroup[gid] = { count: 0, nametags: [] };
  }

  const normalsByHierarchy: Record<
    string,
    {
      label: string;
      count: number;
      familyTags: Record<string, { label: string; count: number; typeIds: string[]; nametags: string[] }>;
    }
  > = {};

  let total = 0;
  let basic = 0;
  let leader = 0;
  let commander = 0;

  const normalHierarchyKeys = [UnitHierarchy.BASIC, UnitHierarchy.LEADER, UnitHierarchy.COMMANDER] as const;

  for (const scanned of scan.entities) {
    total++;
    if (!scanned.isSpecial) {
      const hierarchy = scanned.hierarchy;
      if (!hierarchy || !normalHierarchyKeys.includes(hierarchy)) continue;

      if (hierarchy === UnitHierarchy.BASIC) basic++;
      else if (hierarchy === UnitHierarchy.LEADER) leader++;
      else if (hierarchy === UnitHierarchy.COMMANDER) commander++;

      if (!includeNormals) continue;

      if (!normalsByHierarchy[hierarchy]) {
        normalsByHierarchy[hierarchy] = {
          label: UnitHierarchyLabels[hierarchy],
          count: 0,
          familyTags: {},
        };
      }
      normalsByHierarchy[hierarchy].count++;

      const familyId = (scanned.families || []).find((f: string) => f in NAMETAG_FAMILY_MAP) || "unknown";
      const familyLabel = getFamilyTagLabel(familyId);
      if (!normalsByHierarchy[hierarchy].familyTags[familyId]) {
        normalsByHierarchy[hierarchy].familyTags[familyId] = {
          label: familyLabel,
          count: 0,
          typeIds: [],
          nametags: [],
        };
      }
      normalsByHierarchy[hierarchy].familyTags[familyId].count++;
      const tag = scanned.nametag?.trim();
      if (tag) {
        normalsByHierarchy[hierarchy].familyTags[familyId].nametags.push(tag);
      } else {
        normalsByHierarchy[hierarchy].familyTags[familyId].typeIds.push(scanned.typeId);
      }
      continue;
    }

    const groupKey = scanned.group || SpecialGroups.NO_GROUP;
    if (!specialsByGroup[groupKey]) {
      specialsByGroup[groupKey] = { count: 0, nametags: [] };
    }
    specialsByGroup[groupKey].count++;
    specialsByGroup[groupKey].nametags.push(scanned.nametag || scanned.typeId);
  }

  return { total, basic, leader, commander, specialsByGroup, normalsByHierarchy };
}

function sortNametags(nameCounts: Record<string, number>, sortBy: MonitorSortBy): string[] {
  const multiplier = sortBy === "alpha_desc" ? -1 : 1;
  return Object.keys(nameCounts).sort((a, b) => {
    const orderA = NAMETAG_FAMILY_MAP[stripColorCodes(a) as keyof typeof NAMETAG_FAMILY_MAP]?.order ?? 999;
    const orderB = NAMETAG_FAMILY_MAP[stripColorCodes(b) as keyof typeof NAMETAG_FAMILY_MAP]?.order ?? 999;
    if (orderA !== orderB) return (orderA - orderB) * multiplier;
    return stripColorCodes(a).localeCompare(stripColorCodes(b)) * multiplier;
  });
}

function getSortedFamilies(
  familyTags: Record<string, { label: string; count: number; typeIds: string[]; nametags: string[] }>,
  sortBy: MonitorSortBy
): [string, { label: string; count: number; typeIds: string[]; nametags: string[] }][] {
  const multiplier = sortBy === "alpha_desc" ? -1 : 1;
  return Object.entries(familyTags).sort(([, a], [, b]) => {
    const orderA = NAMETAG_FAMILY_MAP[a.label as keyof typeof NAMETAG_FAMILY_MAP]?.order ?? 999;
    const orderB = NAMETAG_FAMILY_MAP[b.label as keyof typeof NAMETAG_FAMILY_MAP]?.order ?? 999;
    if (orderA !== orderB) return (orderA - orderB) * multiplier;
    return stripColorCodes(a.label).localeCompare(stripColorCodes(b.label)) * multiplier;
  });
}

function buildSortedNametagLines(nametags: string[], sortBy: MonitorSortBy): string[] {
  const nameCounts = nametags.reduce(
    (acc, name) => {
      acc[name] = (acc[name] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
  const sortedNames = sortNametags(nameCounts, sortBy);
  return sortedNames.map((name) => {
    const quantity = nameCounts[name];
    const suffix = quantity > 1 ? ` §8x${quantity}` : "";
    return `§7- §r${name}§r${suffix}`;
  });
}

function formatSpecialGroupLines(
  data: { count: number; nametags: string[] },
  sortBy: MonitorSortBy,
  listMode: MonitorListMode
): string[] {
  const lines: string[] = [];
  if (listMode === "breve") return lines;

  if (data.nametags.length === 0) return lines;

  const nametagLines = buildSortedNametagLines(data.nametags, sortBy);
  return nametagLines.map((line) => `  ${line}`);
}

export function formatFactionSummary(
  foundationScan: ReturnType<typeof buildFactionSummary>,
  chaosScan: ReturnType<typeof buildFactionSummary>,
  faction: MonitorFaction,
  unitType: MonitorUnitType,
  listMode: MonitorListMode,
  sortBy: MonitorSortBy
): string {
  const includeFoundation = faction === "ambas" || faction === "foundation";
  const includeChaos = faction === "ambas" || faction === "chaos";
  const includeSpecials = unitType === "especiales" || unitType === "ambos";
  const includeNormals = unitType === "normales" || unitType === "ambos";

  const scans: { label: string; scan: ReturnType<typeof buildFactionSummary> }[] = [];
  if (includeFoundation) scans.push({ label: "§lFoundation", scan: foundationScan });
  if (includeChaos) scans.push({ label: "§2§lChaos", scan: chaosScan });

  let text = "";
  for (const { label, scan } of scans) {
    text += `§6§l§n${label}§r\n`;
    text += `${MonitorLabels.total} §e${scan.total} ${pluralizeUnit(scan.total)}§r\n`;

    if (includeNormals) {
      const hierarchies = [UnitHierarchy.BASIC, UnitHierarchy.LEADER, UnitHierarchy.COMMANDER];
      for (const h of hierarchies) {
        const data = scan.normalsByHierarchy[h];
        if (!data || data.count === 0) continue;

        const hierarchyLabel = UnitHierarchyLabels[h as keyof typeof UnitHierarchyLabels];
        text += `§f${hierarchyLabel}:§r §e${data.count} ${pluralizeUnit(data.count)}§r\n`;

        const sortedFamilies = getSortedFamilies(data.familyTags, sortBy);
        if (sortedFamilies.length === 0) continue;

        if (listMode === "breve") {
          for (const [, family] of sortedFamilies) {
            text += `    §7- §r${family.label}:§r §e${family.count} ${pluralizeUnit(family.count)}§r\n`;
          }
        } else {
          for (const [, family] of sortedFamilies) {
            const uniqueTypeIds = [...new Set(family.typeIds)].join(", ");
            const typeIdPart = uniqueTypeIds ? ` §8(${uniqueTypeIds})§r` : "";

            if (family.nametags.length === 1 && !uniqueTypeIds) {
              const onlyName = family.nametags[0];
              text += `    §7- §r${family.label}:§r §e${family.count} ${pluralizeUnit(family.count)}§r (${onlyName}§r)\n`;
            } else {
              text += `    §7- §r${family.label}:§r §e${family.count} ${pluralizeUnit(family.count)}§r${typeIdPart}\n`;
              if (family.nametags.length > 0) {
                const nametagLines = buildSortedNametagLines(family.nametags, sortBy);
                if (nametagLines.length === 1 && !uniqueTypeIds) {
                  text += `      §7(${nametagLines[0].replace(/^§7- §r/, "").replace(/§r$/, "")}§r)\n`;
                } else {
                  for (const line of nametagLines) {
                    text += `      ${line}\n`;
                  }
                }
              }
            }
          }
        }
      }
    }

    if (includeNormals && includeSpecials) {
      text += "\n";
    }

    if (includeSpecials) {
      const totalSpecials = Object.values(scan.specialsByGroup).reduce((sum, v) => sum + v.count, 0);
      text += `${MonitorLabels.specials} §e${totalSpecials} ${pluralizeUnit(totalSpecials)}§r\n`;

      const orderedGroups = [
        SpecialGroups.GROUP_A,
        SpecialGroups.GROUP_B,
        SpecialGroups.GROUP_C,
        SpecialGroups.GROUP_D,
        SpecialGroups.NO_GROUP,
      ];

      if (listMode === "breve") {
        for (const gid of orderedGroups) {
          const data = scan.specialsByGroup[gid];
          if (!data || data.count === 0) continue;
          const label = SpecialGroupLabels[gid as keyof typeof SpecialGroupLabels];
          text += `§f  ${label}:§r §e${data.count} ${pluralizeUnit(data.count)}§r\n`;
        }
      } else {
        for (const gid of orderedGroups) {
          const data = scan.specialsByGroup[gid];
          if (!data || data.count === 0) continue;
          const label = SpecialGroupLabels[gid as keyof typeof SpecialGroupLabels];
          text += `§f  ${label}:§r §e${data.count} ${pluralizeUnit(data.count)}§r\n`;
          const groupLines = formatSpecialGroupLines(data, sortBy, listMode);
          for (const line of groupLines) {
            text += `${line}\n`;
          }
        }
      }
    }

    text += "\n";
  }

  return text.trimEnd();
}
