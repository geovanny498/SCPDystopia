// scripts/gui/commandMenu/menu_groups_ui.ts
import { Player, system } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { debugWarn } from "../../../utils/debug.js";
import {
  Factions,
  SpecialGroups,
  SpecialGroupLabels,
  specialUnits,
  getGroupsOrderForAssignment,
} from "../menu_config.js";
import { loadGroups, saveGroups, getGroupsSummary } from "../model/menu_groups.js";

/**
 * Muestra el menú principal de configuración de grupos de especiales
 */
export function showGroupsMenu(player: Player): void {
  try {
    debugWarn("menuGroups", "=== showGroupsMenu iniciado ===", "cyan");

    const form = new ActionFormData()
      .title("§9Grupos de Especiales")
      .body("§7Asigna unidades especiales a grupos para configurar sus comportamientos de forma independiente:");

    form.button("§lConfigurar Foundation");
    form.button("§2§lConfigurar Chaos");
    form.button("§8« Volver");

    system.run(() => {
      form
        .show(player)
        .then((res) => {
          if (!res || res.canceled) {
            // Volver al menú principal
            import("../builder/menu.js").then((module) => {
              system.run(() => {
                module.buildAndShowMenu(player);
              });
            });
            return;
          }

          if (res.selection === 0) {
            showFactionGroupsMenu(player, Factions.FOUNDATION);
          } else if (res.selection === 1) {
            showFactionGroupsMenu(player, Factions.CHAOS);
          } else {
            import("../builder/menu.js").then((module) => {
              system.run(() => {
                module.buildAndShowMenu(player);
              });
            });
          }
        })
        .catch((err) => {
          debugWarn("menuGroups", `Error en showGroupsMenu: ${err}`, "red");
        });
    });
  } catch (e) {
    debugWarn("menuGroups", `Error en showGroupsMenu: ${e}`, "red");
  }
}

/**
 * Muestra el menú de grupos para una facción específica
 */
function showFactionGroupsMenu(player: Player, faction: string): void {
  try {
    const factionLabel = faction === Factions.FOUNDATION ? "§lFoundation" : "§2§lChaos";
    const factionData = specialUnits[faction as keyof typeof specialUnits];

    if (!factionData?.subgroups) {
      player.sendMessage("§c[GRUPOS] No hay subgrupos definidos para esta facción");
      showGroupsMenu(player);
      return;
    }

    const summary = getGroupsSummary(faction);

    // Construir resumen de grupos
    let summaryText = "§7Resumen de grupos:\n";
    for (const [groupId, label] of Object.entries(SpecialGroupLabels)) {
      const count = summary[groupId] || 0;
      summaryText += `${label}§r: §f${count} unidades\n`;
    }

    const form = new ActionFormData().title(`§9Grupos§r - ${factionLabel}`).body(summaryText);

    // Botones para cada subgrupo de especiales
    const subgroupIds = Object.keys(factionData.subgroups);
    for (const subgroupId of subgroupIds) {
      const subgroup = (factionData.subgroups as unknown as Record<string, { label: string; units: string[] }>)[
        subgroupId
      ];
      form.button(`${subgroup.label}\n§8${subgroup.units.length} unidades`);
    }

    form.button("§8« Volver");

    system.run(() => {
      form
        .show(player)
        .then((res) => {
          if (!res || res.canceled) {
            showGroupsMenu(player);
            return;
          }

          const selection = res.selection!;

          if (selection < subgroupIds.length) {
            const subgroupId = subgroupIds[selection];
            showSubgroupAssignmentModal(player, faction, subgroupId);
          } else {
            showGroupsMenu(player);
          }
        })
        .catch((err) => {
          debugWarn("menuGroups", `Error en showFactionGroupsMenu: ${err}`, "red");
        });
    });
  } catch (e) {
    debugWarn("menuGroups", `Error en showFactionGroupsMenu: ${e}`, "red");
  }
}

/**
 * Muestra el modal para asignar grupos a un subgrupo de especiales
 */
function showSubgroupAssignmentModal(player: Player, faction: string, subgroupId: string): void {
  try {
    const factionData = specialUnits[faction as keyof typeof specialUnits];
    const subgroup = (factionData?.subgroups as unknown as Record<string, { label: string; units: string[] }>)?.[
      subgroupId
    ];

    if (!subgroup) {
      debugWarn("menuGroups", `Subgrupo no encontrado: ${subgroupId}`, "red");
      showFactionGroupsMenu(player, faction);
      return;
    }

    // Cargar grupos frescos
    const groups = loadGroups(true); // Forzar recarga
    const factionGroups = groups[faction as keyof typeof groups] || {};

    // Opciones de grupos para el dropdown (Sin grupo primero para usabilidad)
    const groupOptions = getGroupsOrderForAssignment();
    const groupLabels = groupOptions.map((g) => SpecialGroupLabels[g as keyof typeof SpecialGroupLabels]);

    const form = new ModalFormData().title(`${subgroup.label}`);

    // Agregar label informativo
    form.label("§7Selecciona el grupo para cada unidad:");

    // Agregar un dropdown por cada unidad
    for (const unitName of subgroup.units) {
      const currentGroup = factionGroups[unitName] || SpecialGroups.NO_GROUP;
      const currentIndex = groupOptions.indexOf(currentGroup);

      debugWarn("menuGroups:ui", `${unitName}: grupo actual=${currentGroup}, index=${currentIndex}`, "gray");

      form.dropdown(unitName, groupLabels, { defaultValueIndex: Math.max(0, currentIndex) });
    }

    form.submitButton("§aGuardar");

    system.run(() => {
      form
        .show(player)
        .then((res) => {
          if (!res || res.canceled) {
            showFactionGroupsMenu(player, faction);
            return;
          }

          const rawValues = res.formValues!;

          debugWarn("menuGroups:ui", `formValues raw: ${JSON.stringify(rawValues)}`, "cyan");

          // Filtrar solo los valores numéricos (dropdowns), ignorando undefined del label
          const dropdownValues = rawValues.filter((v): v is number => typeof v === "number");

          debugWarn("menuGroups:ui", `dropdownValues filtrados: ${JSON.stringify(dropdownValues)}`, "cyan");

          // Recargar grupos para no perder datos de otros subgrupos
          const freshGroups = loadGroups(true);

          if (!freshGroups[faction as keyof typeof freshGroups]) {
            freshGroups[faction as keyof typeof freshGroups] = {};
          }

          // Actualizar grupos - usar los valores filtrados
          for (let i = 0; i < subgroup.units.length; i++) {
            const unitName = subgroup.units[i];
            const selectedIndex = dropdownValues[i];

            if (typeof selectedIndex === "number" && selectedIndex >= 0 && selectedIndex < groupOptions.length) {
              const selectedGroup = groupOptions[selectedIndex];
              freshGroups[faction as keyof typeof freshGroups][unitName] = selectedGroup;
              debugWarn("menuGroups:ui", `${unitName} -> ${selectedGroup} (index ${selectedIndex})`, "green");
            } else {
              debugWarn("menuGroups:ui", `${unitName}: índice inválido ${selectedIndex}`, "red");
            }
          }

          saveGroups(freshGroups);

          player.sendMessage(`§a[GRUPOS] ${subgroup.label} actualizado`);
          debugWarn("menuGroups:ui", `Subgrupo ${subgroupId} actualizado`, "green");

          showFactionGroupsMenu(player, faction);
        })
        .catch((err) => {
          debugWarn("menuGroups:ui", `Error en showSubgroupAssignmentModal: ${err}`, "red");
        });
    });
  } catch (e) {
    debugWarn("menuGroups:ui", `Error en showSubgroupAssignmentModal: ${e}`, "red");
  }
}
