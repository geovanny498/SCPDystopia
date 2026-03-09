// commands/register_systems.js
import { system, world, CustomCommandStatus, CommandPermissionLevel, CustomCommandSource } from "@minecraft/server";
import {
  systems as menuSystems,
  ControlType,
  UnitHierarchy,
  UnitHierarchyLabels,
  SpecialGroups,
  SpecialGroupLabels,
} from "../gui/commandMenu/menu_config.js";
import { resetAllSystems } from "./worldSave.js";
import { resetMenuSystemStates } from "../gui/commandMenu/core/menu_events.js";
import { resetScope } from "../gui/commandMenu/model/menu_scope.js";
import { resetGroups, loadGroups, getUnitsInGroup } from "../gui/commandMenu/model/menu_groups.js";
import { applySystemsToAll } from "../gui/commandMenu/core/menu_state.js";

// --- Comando check ---
system.beforeEvents.startup.subscribe((init) => {
  const checkCmd = {
    name: "scpd:check_world_props",
    description: "Muestra todas las propiedades dinámicas del mundo de forma legible",
    permissionLevel: CommandPermissionLevel.Any,
    cheatsRequired: false,
  };

  try {
    init.customCommandRegistry.registerCommand(checkCmd, (origin) => {
      const ids = world.getDynamicPropertyIds();
      console.log(`[SCPDystopia] Propiedades dinámicas encontradas: ${ids.length > 0 ? ids.join(", ") : "ninguna"}`);

      const systemIds = Object.keys(menuSystems);

      // Función para obtener el color de un valor de dropdown
      function getDropdownValueColor(sysConfig, value) {
        if (value === "false" || value === "off") return "§c";
        const option = sysConfig.options?.find((opt) => opt.value === value);
        if (option?.label) {
          // Extraer el código de color del label (ej: "§aSeguir..." -> "§a")
          const colorMatch = option.label.match(/^(§[0-9a-fk-or])/i);
          if (colorMatch) return colorMatch[1];
        }
        return "§a"; // Default verde
      }

      function formatSystemCompact(sysId, sysConfig, state, isSaved) {
        const result = {
          name: sysConfig.displayName,
          isSaved: isSaved,
          foundation: {},
          chaos: {},
        };

        if (!state) return result;

        const isDropdown = sysConfig.controlType === ControlType.DROPDOWN;

        for (const faction of ["foundation", "chaos"]) {
          const factionState = state[faction];
          if (!factionState) continue;

          // Jerarquías
          for (const hierarchy of Object.values(UnitHierarchy)) {
            const value = factionState[hierarchy];
            if (isDropdown) {
              const color = getDropdownValueColor(sysConfig, value);
              result[faction][hierarchy] = value === "false" ? "§cOFF§r" : `${color}${value}§r`;
            } else {
              result[faction][hierarchy] = value ? "§aON§r" : "§cOFF§r";
            }
          }

          // Grupos
          for (const groupId of Object.values(SpecialGroups)) {
            const value = factionState[groupId];
            if (isDropdown) {
              const color = getDropdownValueColor(sysConfig, value);
              result[faction][groupId] = value === "false" ? "§cOFF§r" : `${color}${value}§r`;
            } else {
              result[faction][groupId] = value ? "§aON§r" : "§cOFF§r";
            }
          }
        }

        return result;
      }

      // Recopilar datos de todos los sistemas
      const systemsData = [];
      for (const sysId of systemIds) {
        const id = `scpd_system_${sysId}`;
        const sysConfig = menuSystems[sysId];
        const raw = world.getDynamicProperty(id);
        const isSaved = raw !== undefined;
        let state;
        if (isSaved) {
          try {
            state = JSON.parse(raw);
          } catch {
            state = sysConfig.defaults;
          }
        } else {
          // Usar defaults si no hay propiedad guardada
          state = sysConfig.defaults;
        }
        systemsData.push(formatSystemCompact(sysId, sysConfig, state, isSaved));
      }

      // Construir mensaje
      let message = `§e§l[SCPDystopia] Propiedades del mundo§r\n§7${"─".repeat(60)}§r\n`;

      for (const sysData of systemsData) {
        const statusLabel = sysData.isSaved ? "§a[Guardado]§r" : "§8[Por defecto]§r";
        message += `\n§l${sysData.name}§r ${statusLabel}\n`;

        for (const faction of ["foundation", "chaos"]) {
          // Colores de facción con reset después
          const factionLabel = faction === "foundation" ? "§lFoundation§r" : "§2§lChaos§r";
          message += `  ${factionLabel}:\n`;

          // Jerarquías (No Especiales)
          message += `    §8No Especiales:§r `;
          const hierarchyValues = [];
          for (const h of Object.values(UnitHierarchy)) {
            // Usar el label con color de UnitHierarchyLabels
            const label = UnitHierarchyLabels[h];
            hierarchyValues.push(`${label}§r=${sysData[faction][h] || "§7N/A§r"}`);
          }
          message += hierarchyValues.join("§7, §r") + "\n";

          // Grupos (Especiales)
          message += `    §eEspeciales:§r `;
          const groupValues = [];
          // Labels cortos para grupos: A, B, C, D, NG
          const shortGroupLabels = {
            groupA: "§9A§r",
            groupB: "§aB§r",
            groupC: "§6C§r",
            groupD: "§dD§r",
            noGroup: "§7NG§r",
          };
          for (const g of Object.values(SpecialGroups)) {
            const label = shortGroupLabels[g] || g;
            groupValues.push(`${label}=${sysData[faction][g] || "§7N/A§r"}`);
          }
          message += groupValues.join("§7, §r") + "\n";
        }
      }

      message += `\n§7${"─".repeat(60)}§r`;

      world.sendMessage(message);

      return {
        status: CustomCommandStatus.Success,
        message: "Propiedades mostradas en chat",
      };
    });
  } catch {}
});

// --- Comando check_groups ---
system.beforeEvents.startup.subscribe((init) => {
  const checkGroupsCmd = {
    name: "scpd:check_groups",
    description: "Muestra qué especiales están asignados a cada grupo",
    permissionLevel: CommandPermissionLevel.Any,
    cheatsRequired: false,
  };

  try {
    init.customCommandRegistry.registerCommand(checkGroupsCmd, (origin) => {
      // Verificar si existe la propiedad dinámica
      const rawGroups = world.getDynamicProperty("scpd_special_groups");
      const isSaved = rawGroups !== undefined;
      const groups = loadGroups();

      // Labels cortos con colores
      const groupLabels = {
        groupA: "§9§lGrupo A§r",
        groupB: "§a§lGrupo B§r",
        groupC: "§6§lGrupo C§r",
        groupD: "§d§lGrupo D§r",
        noGroup: "§7§lSin Grupo§r",
      };

      const statusLabel = isSaved ? "§a[Guardado]§r" : "§8[Por defecto]§r";
      let message = `§9§l[SCPDystopia] Grupos de Especiales§r ${statusLabel}\n§7${"─".repeat(50)}§r\n`;

      for (const faction of ["foundation", "chaos"]) {
        const factionLabel = faction === "foundation" ? "§6§lFoundation§r" : "§2§lChaos§r";
        message += `\n${factionLabel}:\n`;

        for (const groupId of Object.values(SpecialGroups)) {
          const units = getUnitsInGroup(faction, groupId);
          const label = groupLabels[groupId] || groupId;

          if (units.length === 0) {
            message += `  ${label}: §8(vacío)§r\n`;
          } else {
            message += `  ${label}: §f${units.length} unidades§r\n`;
            for (const unit of units) {
              // Mostrar el nombre con su formato original (ya tiene colores)
              message += `    §7-§r ${unit}§r\n`;
            }
          }
        }
      }

      message += `\n§7${"─".repeat(50)}§r`;

      world.sendMessage(message);

      return {
        status: CustomCommandStatus.Success,
        message: "Grupos mostrados en chat",
      };
    });
  } catch {}
});

// --- Comando reset_groups ---
system.beforeEvents.startup.subscribe((init) => {
  try {
    init.customCommandRegistry.registerCommand(
      {
        name: "scpd:reset_groups",
        description: "Reinicia los grupos de especiales a valores por defecto (Sin grupo)",
        permissionLevel: CommandPermissionLevel.Any,
        cheatsRequired: false,
      },
      (origin) => {
        try {
          resetGroups();

          world.sendMessage("§a[SCPDystopia] Grupos de especiales reiniciados a valores por defecto");

          return {
            status: CustomCommandStatus.Success,
            message: "Grupos reiniciados",
          };
        } catch (e) {
          console.warn(`[SCPDystopia] Error en reset_groups: ${e}`);
          return {
            status: CustomCommandStatus.Failure,
            message: `Error al reiniciar grupos: ${e}`,
          };
        }
      }
    );
  } catch (e) {
    console.warn(`Error registrando scpd:reset_groups: ${e}`);
  }
});

// --- Comando reset_all ---
system.beforeEvents.startup.subscribe((init) => {
  try {
    init.customCommandRegistry.registerCommand(
      {
        name: "scpd:reset_all",
        description: "Resetea todos los sistemas, scope y grupos a valores por defecto",
        permissionLevel: CommandPermissionLevel.Any,
        cheatsRequired: false,
      },
      (origin) => {
        try {
          // 1. Limpiar todas las propiedades dinámicas
          resetAllSystems();

          // 2. Reiniciar estados del menú en memoria
          resetMenuSystemStates();

          // 3. Resetear scope
          resetScope();

          // 4. Resetear grupos de especiales
          resetGroups();

          // 5. Aplicar los sistemas reseteados a todas las entidades existentes
          system.run(() => {
            try {
              const dimension =
                origin && origin.sourceType === CustomCommandSource.Entity && origin.sourceEntity
                  ? origin.sourceEntity.dimension
                  : null;

              const systemIds = Object.keys(menuSystems);
              applySystemsToAll(systemIds, dimension, origin.sourceEntity || null);

              console.log("[SCPDystopia] Sistemas aplicados a entidades existentes");
            } catch (e) {
              console.warn(`[SCPDystopia] Error aplicando sistemas: ${e}`);
            }
          });

          return {
            status: CustomCommandStatus.Success,
            message: "Todos los sistemas, scope y grupos reseteados a valores por defecto",
          };
        } catch (e) {
          console.warn(`[SCPDystopia] Error en reset_all: ${e}`);
          return {
            status: CustomCommandStatus.Failure,
            message: `Error al resetear: ${e}`,
          };
        }
      }
    );
  } catch (e) {
    console.warn(`Error registrando scpd:reset_all: ${e}`);
  }
});
