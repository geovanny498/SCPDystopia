// scripts/gui/commandMenu/menu_scope_ui.js
import { system } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { debugWarn } from "../../utils/debug.js";
import { loadScope, saveScope, getScopeSummary } from "./menu_scope.js";
import { specialUnits, UnitHierarchy, UnitHierarchyLabels } from "./menu_config.js";

/**
 * Muestra el menú principal de configuración de scope
 */
export function showScopeMenu(player) {
  try {
    debugWarn("menuScope", "=== showScopeMenu iniciado ===", "cyan");

    const form = new ActionFormData()
      .title("§eAlcance de Aplicación")
      .body("§7Define §la quién §r§7se aplicarán los cambios en los sistemas:");

    form.button("§lConfigurar Foundation");
    form.button("§2§lConfigurar Chaos");
    form.button("§8« Volver al menú principal");

    system.run(() => {
      form
        .show(player)
        .then((res) => {
          if (!res || res.canceled) {
            import("./menu.js").then((module) => {
              system.run(() => {
                module.buildAndShowMenu(player);
              });
            });
            return;
          }

          if (res.selection === 0) {
            showFactionScopeMenu(player, "foundation");
          } else if (res.selection === 1) {
            showFactionScopeMenu(player, "chaos");
          } else {
            import("./menu.js").then((module) => {
              system.run(() => {
                module.buildAndShowMenu(player);
              });
            });
          }
        })
        .catch((err) => {
          debugWarn("menuScope", `Error en ActionForm: ${err}`, "red");
        });
    });
  } catch (e) {
    debugWarn("menuScope", `Error en showScopeMenu: ${e}`, "red");
  }
}

/**
 * Muestra el menú de configuración de scope para una facción específica
 */
function showFactionScopeMenu(player, faction) {
  try {
    const currentScope = loadScope();
    const factionScope = currentScope[faction];
    const factionData = specialUnits[faction];
    const factionLabel = faction === "foundation" ? "§lFoundation" : "§2§lChaos";

    // Construir resumen de estado actual
    const basicStatus = factionScope[UnitHierarchy.BASIC] ? "§aIncluidos" : "§cExcluidos";
    const leaderStatus = factionScope[UnitHierarchy.LEADER] ? "§aIncluidos" : "§cExcluidos";
    const commanderStatus = factionScope[UnitHierarchy.COMMANDER] ? "§aIncluidos" : "§cExcluidos";

    const form = new ActionFormData()
      .title(`§eAlcance§r - ${factionLabel}`)
      .body("§7Selecciona qué unidades se verán afectadas:");
    // Botón para configurar jerarquías (No Especiales)
    form
      .button(`§8No Especiales\n§8B: ${basicStatus}§r §eL: ${leaderStatus}§r §6C: ${commanderStatus}§r`)
      .label("§e── Especiales ──");

    // Botones para cada subgrupo de especiales
    const subgroupIds = Object.keys(factionData.subgroups);
    subgroupIds.forEach((subgroupId) => {
      const subgroup = factionData.subgroups[subgroupId];
      const selectedCount = subgroup.units.filter((u) => factionScope.specialUnits?.includes(u)).length;
      const totalCount = subgroup.units.length;
      form.button(`${subgroup.label}\n§8${selectedCount}/${totalCount} seleccionadas`);
    });

    form.button("§8« Volver");

    system.run(() => {
      form
        .show(player)
        .then((res) => {
          if (!res || res.canceled) {
            showScopeMenu(player);
            return;
          }

          const selection = res.selection;

          if (selection === 0) {
            // Configurar jerarquías (No Especiales)
            showHierarchyModal(player, faction);
          } else if (selection > 0 && selection <= subgroupIds.length) {
            // Configurar subgrupo específico
            const subgroupId = subgroupIds[selection - 1];
            showSubgroupModal(player, faction, subgroupId);
          } else {
            showScopeMenu(player);
          }
        })
        .catch((err) => {
          debugWarn("menuScope", `Error en ActionForm: ${err}`, "red");
        });
    });
  } catch (e) {
    debugWarn("menuScope", `Error en showFactionScopeMenu: ${e}`, "red");
  }
}

/**
 * Muestra modal para configurar jerarquías (Básicos, Líderes, Comandantes)
 */
function showHierarchyModal(player, faction) {
  try {
    const currentScope = loadScope();
    const factionScope = currentScope[faction];
    const factionLabel = faction === "foundation" ? "§lFoundation" : "§2§lChaos";

    const form = new ModalFormData()
      .title(`§7No Especiales - ${factionLabel}`)
      .label("§7Selecciona qué unidades incluir según su jerarquía:");

    // Toggle para cada jerarquía
    const basicDefault = factionScope[UnitHierarchy.BASIC] !== undefined ? factionScope[UnitHierarchy.BASIC] : true;
    const leaderDefault = factionScope[UnitHierarchy.LEADER] !== undefined ? factionScope[UnitHierarchy.LEADER] : true;
    const commanderDefault =
      factionScope[UnitHierarchy.COMMANDER] !== undefined ? factionScope[UnitHierarchy.COMMANDER] : true;

    form.toggle(`${UnitHierarchyLabels[UnitHierarchy.BASIC]}§r (MTFs base)`, { defaultValue: basicDefault });
    form.toggle(`${UnitHierarchyLabels[UnitHierarchy.LEADER]}§r (Líderes de escuadrón)`, {
      defaultValue: leaderDefault,
    });
    form.toggle(`${UnitHierarchyLabels[UnitHierarchy.COMMANDER]}§r (Comandantes)`, { defaultValue: commanderDefault });

    form.submitButton("§aGuardar");

    system.run(() => {
      form
        .show(player)
        .then((res) => {
          if (!res || res.canceled) {
            showFactionScopeMenu(player, faction);
            return;
          }

          const values = res.formValues;
          // Filtrar valores undefined (del label)
          const filtered = values.filter((v) => v !== undefined && v !== null);

          currentScope[faction][UnitHierarchy.BASIC] = !!filtered[0];
          currentScope[faction][UnitHierarchy.LEADER] = !!filtered[1];
          currentScope[faction][UnitHierarchy.COMMANDER] = !!filtered[2];

          saveScope(currentScope);

          const statusMsg = [
            `§7Básicos: ${filtered[0] ? "§aON" : "§cOFF"}`,
            `§eLíderes: ${filtered[1] ? "§aON" : "§cOFF"}`,
            `§6Comandantes: ${filtered[2] ? "§aON" : "§cOFF"}`,
          ].join("§r, ");

          player.sendMessage(`§a[SCOPE] Jerarquías actualizadas: ${statusMsg}§r`);
          debugWarn(
            "menuScope",
            `Jerarquías actualizadas: B=${filtered[0]}, L=${filtered[1]}, C=${filtered[2]}`,
            "green"
          );

          showFactionScopeMenu(player, faction);
        })
        .catch((err) => {
          debugWarn("menuScope", `Error en modal jerarquías: ${err}`, "red");
        });
    });
  } catch (e) {
    debugWarn("menuScope", `Error en showHierarchyModal: ${e}`, "red");
  }
}

/**
 * Muestra modal para configurar un subgrupo específico de especiales
 */
function showSubgroupModal(player, faction, subgroupId) {
  try {
    const currentScope = loadScope();
    const factionScope = currentScope[faction];
    const factionData = specialUnits[faction];
    const subgroup = factionData.subgroups[subgroupId];
    const factionLabel = faction === "foundation" ? "§lFoundation" : "§2§lChaos";

    if (!subgroup) {
      debugWarn("menuScope", `Subgrupo no encontrado: ${subgroupId}`, "red");
      return;
    }

    const form = new ModalFormData()
      .title(`§9${subgroup.label}§r - ${factionLabel}`)
      .label("§7Selecciona las unidades especiales a incluir:");

    // Agregar toggle para cada unidad
    subgroup.units.forEach((unitName) => {
      const isSelected = factionScope.specialUnits?.includes(unitName) || false;
      form.toggle(unitName, { defaultValue: isSelected });
    });

    form.submitButton("§aGuardar");

    system.run(() => {
      form
        .show(player)
        .then((res) => {
          if (!res || res.canceled) {
            showFactionScopeMenu(player, faction);
            return;
          }

          // Obtener unidades actuales sin las del subgrupo actual
          let currentUnits = factionScope.specialUnits || [];
          currentUnits = currentUnits.filter((u) => !subgroup.units.includes(u));

          // Agregar las unidades seleccionadas del subgrupo
          const values = res.formValues;
          let idx = 0;

          // Saltar label inicial
          while (idx < values.length && values[idx] === undefined) {
            idx++;
          }

          // Leer toggles
          subgroup.units.forEach((unitName) => {
            if (idx < values.length && values[idx] === true) {
              currentUnits.push(unitName);
            }
            idx++;
          });

          // Actualizar scope
          currentScope[faction].specialUnits = currentUnits;
          currentScope[faction].includeSpecials = currentUnits.length > 0;
          saveScope(currentScope);

          const selectedCount = subgroup.units.filter((u) => currentUnits.includes(u)).length;
          player.sendMessage(`§a[SCOPE] ${subgroup.label}: ${selectedCount}/${subgroup.units.length} seleccionadas`);

          showFactionScopeMenu(player, faction);
        })
        .catch((err) => {
          debugWarn("menuScope", `Error en modal subgrupo: ${err}`, "red");
        });
    });
  } catch (e) {
    debugWarn("menuScope", `Error en showSubgroupModal: ${e}`, "red");
  }
}
