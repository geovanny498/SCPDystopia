// commands/register_systems.ts
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
} from "../gui/commandMenu/menu_config.js";
import { resetAllSystems, resetAllSystemStates, resetOneSystemState } from "./worldSave";
import { resetMenuSystemStates } from "../gui/commandMenu/core/menu_events.js";
import { resetScope } from "../gui/commandMenu/model/menu_scope.js";
import { setUnitGroup, ENTITY_GROUP_DP } from "../gui/commandMenu/model/menu_groups.js";
import { applySystemsToAll } from "../gui/commandMenu/core/menu_state.js";
import { getAllAddonEntities, getAllAddonEntitiesInDimensions } from "../utils/entityQuery.js";

// ═══════════════════════════════════════════════════════════════════════════════
// §  Utilidades
// ═══════════════════════════════════════════════════════════════════════════════

function sendFeedback(origin: any, message: string, worldMsg?: string): void {
  try {
    if (origin?.sourceType === CustomCommandSource.Entity && origin?.sourceEntity) {
      (origin.sourceEntity as any).sendMessage(message);
    } else {
      world.sendMessage(worldMsg ?? message);
    }
  } catch {
    try {
      world.sendMessage(worldMsg ?? message);
    } catch {}
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// §  Comando scpd:check_world_props
// ═══════════════════════════════════════════════════════════════════════════════

system.beforeEvents.startup.subscribe((init) => {
  const checkCmd = {
    name: "scpd:check_world_props",
    description: "Muestra todas las propiedades dinámicas del mundo de forma legible",
    permissionLevel: CommandPermissionLevel.Any,
    cheatsRequired: false,
  };

  try {
    init.customCommandRegistry.registerCommand(checkCmd, (origin: any) => {
      const ids = world.getDynamicPropertyIds();
      console.log(`[SCPDystopia] Propiedades dinámicas encontradas: ${ids.length > 0 ? ids.join(", ") : "ninguna"}`);

      const systemIds = Object.keys(menuSystems);

      function getDropdownValueColor(sysConfig: any, value: string) {
        if (value === "false" || value === "off") return "§c";
        const option = sysConfig.options?.find((opt: any) => opt.value === value);
        if (option?.label) {
          const colorMatch = option.label.match(/^(§[0-9a-fk-or])/i);
          if (colorMatch) return colorMatch[1];
        }
        return "§a";
      }

      function formatSystemCompact(sysId: string, sysConfig: any, state: any, isSaved: boolean) {
        const result: any = {
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

          for (const hierarchy of Object.values(UnitHierarchy)) {
            const value = factionState[hierarchy];
            if (isDropdown) {
              const color = getDropdownValueColor(sysConfig, value);
              result[faction][hierarchy] = value === "false" ? "§cOFF§r" : `${color}${value}§r`;
            } else {
              result[faction][hierarchy] = value ? "§aON§r" : "§cOFF§r";
            }
          }

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
      const systemsData: any[] = [];
      for (const sysId of systemIds) {
        const id = `scpd_system_${sysId}`;
        const sysConfig = (menuSystems as any)[sysId];
        const raw = world.getDynamicProperty(id);
        const isSaved = raw !== undefined;
        let state;
        if (isSaved) {
          try {
            state = JSON.parse(String(raw));
          } catch {
            state = sysConfig.defaults;
          }
        } else {
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
          const factionLabel = faction === "foundation" ? "§lFoundation§r" : "§2§lChaos§r";
          message += `  ${factionLabel}:\n`;

          message += `    §8No Especiales:§r `;
          const hierarchyValues: string[] = [];
          for (const h of Object.values(UnitHierarchy)) {
            const label = UnitHierarchyLabels[h];
            hierarchyValues.push(`${label}§r=${sysData[faction][h] || "§7N/A§r"}`);
          }
          message += hierarchyValues.join("§7, §r") + "\n";

          message += `    §eEspeciales:§r `;
          const groupValues: string[] = [];
          const shortGroupLabels: Record<string, string> = {
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

// ═══════════════════════════════════════════════════════════════════════════════
// §  Comando scpd:reset_groups
// ═══════════════════════════════════════════════════════════════════════════════

system.beforeEvents.startup.subscribe((init) => {
  try {
    init.customCommandRegistry.registerCommand(
      {
        name: "scpd:reset_groups",
        description: "Reinicia los grupos de especiales a valores por defecto (Sin grupo)",
        permissionLevel: CommandPermissionLevel.Any,
        cheatsRequired: false,
      },
      (origin: any) => {
        try {
          if (origin.sourceType !== CustomCommandSource.Entity || !origin.sourceEntity) {
            return {
              status: CustomCommandStatus.Failure,
              message: "Este comando solo puede ser ejecutado por un jugador.",
            };
          }

          const playerDimension = origin.sourceEntity.dimension;
          let cleared = 0;
          try {
            // Optimización: 2 llamadas a getEntities en lugar de 4
            const allEnts = getAllAddonEntities(playerDimension);
            for (const ent of allEnts) {
              if (ent.getDynamicProperty(ENTITY_GROUP_DP) !== undefined) {
                ent.setDynamicProperty(ENTITY_GROUP_DP, undefined);
                cleared++;
              }
            }
          } catch (e) {
            console.warn(`[SCPDystopia] Error iterando entidades en reset_groups: ${e}`);
          }

          if (cleared > 0) {
            world.sendMessage(`§a[SCPDystopia] Grupos de especiales reiniciados (§6${cleared}§a DPs eliminados)`);
          } else {
            world.sendMessage(`§7[SCPDystopia] No habia grupos activos para reiniciar en esta dimension`);
          }

          return {
            status: CustomCommandStatus.Success,
            message: `Grupos reiniciados (${cleared} DPs eliminados)`,
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

// ═══════════════════════════════════════════════════════════════════════════════
// §  Comando scpd:reset_systems  —  parámetro opcional + aviso custom
// ═══════════════════════════════════════════════════════════════════════════════

system.beforeEvents.startup.subscribe((init) => {
  // ── Enum para autocompletado (<Tab>) ────────────────────────────────────
  // registerEnum() registra los valores que el motor muestra al presionar <Tab>.
  // "all" va primero para que sea la primera opción visible.
  const resetSystemEnumName = "scpd:reset_system_target";
  const systemTargetOptions = ["all", ...Object.keys(menuSystems)];

  init.customCommandRegistry.registerEnum(resetSystemEnumName, systemTargetOptions);

  try {
    init.customCommandRegistry.registerCommand(
      {
        name: "scpd:reset_systems",
        description: "Resetea un sistema o todos los sistemas. Usa 'all' para reiniciar todos.",
        permissionLevel: CommandPermissionLevel.Any,
        cheatsRequired: false,
        // Parámetro OPCIONAL: si se ejecuta sin argumento se devuelve un mensaje
        // custom de ayuda, evitando el mensaje nativo genérico de Minecraft.
        optionalParameters: [{ name: resetSystemEnumName, type: CustomCommandParamType.Enum }],
      },
      (origin: any, target: string | undefined) => {
        try {
          // ── Sin argumento: aviso amigable, NO resetea nada ─────────────────
          if (!target || target === "") {
            const validIds = Object.keys(menuSystems);
            return {
              status: CustomCommandStatus.Failure,
              message:
                `§c[SCPDystopia] Debes especificar un sistema o 'all'.\n` +
                `§7Uso: §f/scpd:reset_systems <sistema | all>\n` +
                `§7IDs de sistema: §f${validIds.join(", ")}`,
            };
          }

          // ── target === "all": reinicia TODOS los sistemas ──────────────────
          if (target === "all") {
            resetAllSystemStates();
            resetMenuSystemStates();

            system.run(() => {
              try {
                const dimension =
                  origin?.sourceType === CustomCommandSource.Entity && origin?.sourceEntity
                    ? origin.sourceEntity.dimension
                    : null;

                const systemIds = Object.keys(menuSystems);
                applySystemsToAll(systemIds, dimension, origin.sourceEntity || null);

                console.log("[SCPDystopia] Sistemas reiniciados y aplicados a entidades existentes");
                world.sendMessage("§a[SCPDystopia] Todos los sistemas reiniciados a valores por defecto");
              } catch (e) {
                console.warn(`[SCPDystopia] Error aplicando sistemas: ${e}`);
                world.sendMessage("§c[SCPDystopia] Error al reaplicar sistemas despues del reinicio");
              }
            });

            return {
              status: CustomCommandStatus.Success,
              message: "Reiniciando todos los sistemas y reaplicando a entidades...",
            };
          }

          // ── target === <systemId>: reinicia UN SOLO sistema ─────────────────
          const systemConfig = (menuSystems as any)[target];
          if (!systemConfig) {
            const validIds = Object.keys(menuSystems).join(", ");
            return {
              status: CustomCommandStatus.Failure,
              message: `§cSistema "${target}" no encontrado.\n§7IDs válidos: §f${validIds}`,
            };
          }

          const ok = resetOneSystemState(target);
          if (!ok) {
            return {
              status: CustomCommandStatus.Failure,
              message: `§cError al reiniciar el sistema "${target}".`,
            };
          }

          resetMenuSystemStates();

          system.run(() => {
            try {
              const dimension =
                origin?.sourceType === CustomCommandSource.Entity && origin?.sourceEntity
                  ? origin.sourceEntity.dimension
                  : null;

              applySystemsToAll([target], dimension, origin.sourceEntity || null);
              world.sendMessage(
                `§a[SCPDystopia] Sistema §f${systemConfig.displayName}§a reiniciado a valores por defecto`
              );
            } catch (e) {
              console.warn(`[SCPDystopia] Error aplicando sistema ${target}: ${e}`);
            }
          });

          return {
            status: CustomCommandStatus.Success,
            message: `Reiniciando sistema "${systemConfig.displayName}"...`,
          };
        } catch (e) {
          console.warn(`[SCPDystopia] Error en reset_systems: ${e}`);
          return {
            status: CustomCommandStatus.Failure,
            message: `Error al reiniciar sistemas: ${e}`,
          };
        }
      }
    );
  } catch (e) {
    console.warn(`Error registrando scpd:reset_systems: ${e}`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// §  Comando scpd:reset_all
// ═══════════════════════════════════════════════════════════════════════════════

system.beforeEvents.startup.subscribe((init) => {
  try {
    init.customCommandRegistry.registerCommand(
      {
        name: "scpd:reset_all",
        description: "Resetea todos los sistemas, scope y grupos a valores por defecto",
        permissionLevel: CommandPermissionLevel.Any,
        cheatsRequired: false,
      },
      (origin: any) => {
        try {
          resetAllSystems();
          resetMenuSystemStates();
          resetScope();

          try {
            let cleared = 0;
            const dims = ["overworld", "nether", "the_end"].map((id) => world.getDimension(id)).filter(Boolean);
            // Optimización: 2 llamadas a getEntities por dimensión en lugar de 4
            const allEnts = getAllAddonEntitiesInDimensions(dims);
            for (const ent of allEnts) {
              if (ent.getDynamicProperty(ENTITY_GROUP_DP) !== undefined) {
                ent.setDynamicProperty(ENTITY_GROUP_DP, undefined);
                cleared++;
              }
            }
            console.log(`[SCPDystopia] Grupos reseteados (${cleared} DPs eliminados)`);
          } catch (e) {
            console.warn(`[SCPDystopia] Error reseteando grupos en reset_all: ${e}`);
          }

          system.run(() => {
            try {
              const dimension =
                origin?.sourceType === CustomCommandSource.Entity && origin?.sourceEntity
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
