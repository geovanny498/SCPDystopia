// commands/register_test_commands.ts
import { system, world, CustomCommandStatus, CommandPermissionLevel, CustomCommandParamType } from "@minecraft/server";
import { systems as menuSystems, UnitHierarchy, SpecialGroups, Factions } from "../gui/commandMenu/menu_config.js";
import { resetMenuSystemStates } from "../gui/commandMenu/core/menu_events.js";

// ═══════════════════════════════════════════════════════════════════════════════
// §  Comando scpd:reset_systems_undefined  —  testing de estado de sistemas
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Comando de testeo para simular diferentes estados de guardado de sistemas.
 *
 * Usos:
 *   /scpd:reset_systems_undefined clear
 *     Elimina TODAS las propiedades de sistemas → menú y check_world_props muestran defaults.
 *     No toca scope ni grupos de entidades.
 *
 *   /scpd:reset_systems_undefined simulate
 *     [SOLO TESTEO] Guarda DPs INCOMPLETOS sin grupos C, D, sinGrupo para replicar
 *     el bug de la refactorización del menú. Sirve para probar el fallback del builder
 *     y verificar que check_world_props muestre undefined en esos grupos.
 *     No toca scope ni grupos de entidades.
 *
 *   /scpd:reset_systems_undefined
 *     (sin argumento) → comporta como "simulate", para testeo rápido.
 *
 *   /scpd:reset_systems_undefined complete
 *     Guarda DPs COMPLETOS con los defaults actuales (todas las claves presentes).
 *     Equivale a guardar el estado inicial sin haber configurado nada aún.
 */
system.beforeEvents.startup.subscribe((init) => {
  try {
    const modeEnumName = "scpd:reset_sys_undef_mode";
    const modeOptions = ["simulate", "clear", "complete"];

    init.customCommandRegistry.registerEnum(modeEnumName, modeOptions);

    init.customCommandRegistry.registerCommand(
      {
        name: "scpd:reset_systems_undefined",
        description: "[TESTEO] Simula estados de guardado de sistemas.",
        permissionLevel: CommandPermissionLevel.Any,
        cheatsRequired: false,
        optionalParameters: [{ name: modeEnumName, type: CustomCommandParamType.Enum }],
      },
      (origin: any, target: string | undefined) => {
        try {
          const mode = target === undefined || target === "" ? "simulate" : target;
          let msg = "";
          let cleared = 0;

          if (mode === "clear") {
            // ── CLEAR: borrar todos los DPs de sistemas ──────────────────────
            const ids = world.getDynamicPropertyIds();
            for (const id of ids) {
              if (id.startsWith("scpd_system_")) {
                world.setDynamicProperty(id, undefined);
                cleared++;
              }
            }
            resetMenuSystemStates();
            msg =
              cleared > 0
                ? `§a§l[TESTEO] §e${cleared}§a propiedades eliminadas. Todo muestra defaults.`
                : `§7[TESTEO] No habia propiedades guardadas.`;
          } else if (mode === "complete") {
            // ── COMPLETE: guardar defaults completos (todas las claves) ─────────
            const systemIds = Object.keys(menuSystems as any);
            const allSystems = menuSystems as Record<string, any>;
            for (const sysId of systemIds) {
              const defaults = allSystems[sysId]?.defaults;
              if (defaults) {
                world.setDynamicProperty(`scpd_system_${sysId}`, JSON.stringify(defaults));
                cleared++;
              }
            }
            resetMenuSystemStates();
            msg = `§a§l[TESTEO] §e${cleared}§a sistemas guardados con defaults completos (sin undefined).`;
          } else if (mode === "simulate") {
            // ── SIMULATE: DPs incompletos (sin grupos C, D, sinGrupo) ──────────
            // Simula exactamente el bug de la refactorización: el builder filtra
            // los dropdowns de esos grupos pero el estado guardado no los incluye.
            const systemIds = Object.keys(menuSystems as any);
            const allSystems = menuSystems as Record<string, any>;

            for (const sysId of systemIds) {
              const sys = allSystems[sysId];
              if (!sys) continue;

              const defaults = sys.defaults;
              const partialState: Record<string, Record<string, any>> = {};

              for (const factionName of [Factions.FOUNDATION, Factions.CHAOS]) {
                partialState[factionName] = {
                  [UnitHierarchy.BASIC]: defaults[factionName]?.[UnitHierarchy.BASIC],
                  [UnitHierarchy.LEADER]: defaults[factionName]?.[UnitHierarchy.LEADER],
                  [UnitHierarchy.COMMANDER]: defaults[factionName]?.[UnitHierarchy.COMMANDER],
                  [SpecialGroups.GROUP_A]: defaults[factionName]?.[SpecialGroups.GROUP_A],
                  [SpecialGroups.GROUP_B]: defaults[factionName]?.[SpecialGroups.GROUP_B],
                  // C, D, sinGrupo se omiten intencionalmente → undefined en el DP
                };
              }

              world.setDynamicProperty(`scpd_system_${sysId}`, JSON.stringify(partialState));
              cleared++;
            }
            resetMenuSystemStates();
            msg =
              `§c§l[TESTEO] §e${cleared}§c sistemas guardados INCOMPLETOS (C/D/SinGrupo omitidos).\n` +
              `§7check_world_props mostrará §cundefined§7 en esos grupos.\n` +
              `§7El menú usará defaults como fallback para los grupos faltantes.`;
          } else {
            return {
              status: CustomCommandStatus.Failure,
              message: `§cModo inválido: "${mode}". Usa: simulate, clear, complete`,
            };
          }

          world.sendMessage(msg);
          try {
            console.log(`[SCPDystopia] reset_systems_undefined [${mode}]: ${msg}`);
          } catch {}

          return {
            status: CustomCommandStatus.Success,
            message: `[${mode}] ${msg}`,
          };
        } catch (e) {
          console.warn(`[SCPDystopia] Error en reset_systems_undefined: ${e}`);
          return {
            status: CustomCommandStatus.Failure,
            message: `Error: ${e}`,
          };
        }
      }
    );
  } catch (e) {
    console.warn(`Error registrando scpd:reset_systems_undefined: ${e}`);
  }
});
