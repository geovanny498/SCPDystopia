// scripts/commands/scope_commands.js
import { system, world, CustomCommandStatus, CustomCommandSource, CommandPermissionLevel } from "@minecraft/server";
import { loadScope, resetScope, getScopeSummary } from "../gui/commandMenu/model/menu_scope.js";
import { systems as menuSystems } from "../gui/commandMenu/menu_config.js";
import { applySystemsToAll } from "../gui/commandMenu/core/menu_state.js";

/**
 * Comandos para gestionar el scope del menú
 */

system.beforeEvents.startup.subscribe((init) => {
  // Comando para ver el scope actual
  const checkCmd = {
    name: "scpd:check_scope",
    description: "Muestra el alcance de aplicación actual del menú",
    permissionLevel: CommandPermissionLevel.Any,
    cheatsRequired: false,
  };

  try {
    init.customCommandRegistry.registerCommand(checkCmd, (origin) => {
      try {
        // Solo permitir ejecución por entidad (jugador)
        if (origin.sourceType !== CustomCommandSource.Entity || !origin.sourceEntity) {
          return {
            status: CustomCommandStatus.Failure,
            message: "Este comando solo puede ser ejecutado por un jugador.",
          };
        }

        const entity = origin.sourceEntity;

        // Verificar si existe la propiedad dinámica
        const rawScope = world.getDynamicProperty("scpd_menu_scope");
        const isSaved = rawScope !== undefined;

        const scope = loadScope();
        const summary = getScopeSummary(scope);

        // Mostrar en chat del jugador
        const statusLabel = isSaved ? "§a[Guardado]§r" : "§8[Por defecto]§r";
        entity.sendMessage(`§e=== Alcance de Aplicación Actual ===§r ${statusLabel}`);
        entity.sendMessage(summary);
        entity.sendMessage("§8Usa el menú para modificar el alcance");
        // entity.sendMessage("§8Datos técnicos: " + JSON.stringify(scope));

        // Mostrar en consola
        console.warn("§e=== Alcance de Aplicación Actual ===");
        console.warn(summary);
        console.warn(`Datos técnicos: ${JSON.stringify(scope)}`);
        console.warn(`Consultado por: ${entity.name}`);

        return {
          status: CustomCommandStatus.Success,
          message: "Scope mostrado correctamente.",
        };
      } catch (e) {
        console.warn("scpd:check_scope handler error:", e);
        return {
          status: CustomCommandStatus.Failure,
          message: "Error al consultar el scope.",
        };
      }
    });
  } catch (e) {
    console.warn("Error registrando scpd:check_scope:", e);
  }

  // Comando para resetear el scope
  const resetCmd = {
    name: "scpd:reset_scope",
    description: "Resetea el alcance de aplicación a valores por defecto (todos)",
    permissionLevel: CommandPermissionLevel.GameDirectors,
    cheatsRequired: false,
  };

  try {
    init.customCommandRegistry.registerCommand(resetCmd, (origin) => {
      try {
        // Solo permitir ejecución por entidad (jugador)
        if (origin.sourceType !== CustomCommandSource.Entity || !origin.sourceEntity) {
          return {
            status: CustomCommandStatus.Failure,
            message: "Este comando solo puede ser ejecutado por un jugador.",
          };
        }

        const entity = origin.sourceEntity;

        // Resetear el scope
        resetScope();
        const scope = loadScope();
        const summary = getScopeSummary(scope);

        entity.sendMessage("§a[SCOPE] Alcance de aplicación reseteado:");
        entity.sendMessage(summary);

        // Reaplicar todos los sistemas a las entidades existentes con el nuevo scope
        system.run(() => {
          try {
            const dimension = entity.dimension;
            const systemIds = Object.keys(menuSystems);
            applySystemsToAll(systemIds, dimension);

            console.log("[SCPDystopia] Sistemas reaplicados a entidades existentes con nuevo scope");
            entity.sendMessage("§a[SCOPE] Sistemas reaplicados a entidades existentes");
          } catch (e) {
            console.warn(`[SCPDystopia] Error aplicando sistemas: ${e}`);
            entity.sendMessage("§c[SCOPE] Error al reaplicar sistemas");
          }
        });

        return {
          status: CustomCommandStatus.Success,
          message: "Scope reseteado y sistemas reaplicados.",
        };
      } catch (e) {
        console.warn("scpd:reset_scope handler error:", e);
        return {
          status: CustomCommandStatus.Failure,
          message: "Error al resetear el scope.",
        };
      }
    });
  } catch (e) {
    console.warn("Error registrando scpd:reset_scope:", e);
  }
});
