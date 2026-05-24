// scripts/commands/scope_commands.js
import { system, world, CustomCommandStatus, CustomCommandSource, CommandPermissionLevel } from "@minecraft/server";
import { loadScope, resetScope, getScopeSummary, isEntityInScope } from "../gui/commandMenu/model/menu_scope.js";
import { systems as menuSystems } from "../gui/commandMenu/menu_config.js";
import { getEntityFactionInfo, isValidSoldier } from "../gui/commandMenu/model/menu_faction.js";
import { applySystemsToAll } from "../gui/commandMenu/core/menu_state.js";
import { getAllAddonEntitiesInDimensions } from "../utils/entityQuery.js";
import { compareNametags } from "../utils/nametagSort.js";
/**
 * Comandos para gestionar el scope del menú
 */

system.beforeEvents.startup.subscribe((init) => {
  // Comando para ver el scope actual
  const checkCmd = {
    name: "scpd:check_scope",
    description: "Muestra si el menú global fuerza la configuracion global y qué unidades usan configuración local",
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
        entity.sendMessage(`§d=== Prioridad de Aplicación ===§r ${statusLabel}`);
        entity.sendMessage(summary);

        if (scope.respectEntityBlocks) {
          const blockedReport = getBlockedEntitiesReport(scope);
          blockedReport.forEach((line) => entity.sendMessage(line));
        } else {
          entity.sendMessage(
            "§7No hay unidades con configuración local porque el scope está forzando la configuración global."
          );
        }

        entity.sendMessage("§8Usa el menú para modificar la configuración");

        // Mostrar en consola
        console.warn("§d=== Prioridad de Aplicación ===");
        console.warn(summary);
        if (scope.respectEntityBlocks) {
          const blockedReport = getBlockedEntitiesReport(scope);
          blockedReport.forEach((line) => console.warn(line));
        }
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
    description: "Reinicia el sistema de Prioridad de Aplicación a valores por defecto",
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

        entity.sendMessage("§a[SCOPE] §dPrioridad de Aplicación reiniciado:");
        entity.sendMessage(summary);

        // Reaplicar todos los sistemas a las entidades existentes con el nuevo scope
        system.run(() => {
          try {
            const dimension = entity.dimension;
            const systemIds = Object.keys(menuSystems);
            // El jugador que ejecutó el comando puede ser usado para auto-domesticar
            applySystemsToAll(systemIds, dimension, entity);

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

function getBlockedEntitiesReport(scope) {
  const dims = ["overworld", "nether", "the_end"].map((id) => world.getDimension(id)).filter(Boolean);
  const seen = new Set();
  const blockedSpecials = {};
  const blockedNormals = {};
  let blockedTotal = 0;

  // Optimización: 2 llamadas a getEntities por dimensión en lugar de 4
  const allEnts = getAllAddonEntitiesInDimensions(dims);

  for (const ent of allEnts) {
    if (!ent || !ent.id || seen.has(ent.id)) continue;
    seen.add(ent.id);
    if (!isValidSoldier(ent)) continue;

    const factionInfo = getEntityFactionInfo(ent);
    if (!factionInfo) continue;

    const inScope = isEntityInScope(
      ent,
      factionInfo.faction,
      factionInfo.isSpecial,
      ent.nameTag ?? "",
      scope,
      factionInfo.hierarchy
    );
    if (inScope) continue;

    blockedTotal += 1;
    const label = factionInfo.isSpecial ? ent.nameTag?.trim() || ent.typeId : ent.typeId;
    const bucket = factionInfo.isSpecial ? blockedSpecials : blockedNormals;
    bucket[label] = (bucket[label] || 0) + 1;
  }

  const reportLines = [
    "§9§l[CHECK_SCOPE] Unidades con configuración local en simulación§r",
    `§fTotal: §e${blockedTotal} ${blockedTotal === 1 ? "unidad" : "unidades"}§r`,
  ];

  if (Object.keys(blockedNormals).length) {
    reportLines.push("§7No especiales:");
    for (const typeId of Object.keys(blockedNormals).sort(compareNametags)) {
      const count = blockedNormals[typeId];
      reportLines.push(`  §7- §r${typeId}${count > 1 ? ` x${count}` : ""}`);
    }
  }

  if (Object.keys(blockedSpecials).length) {
    reportLines.push("§7Especiales:");
    for (const nameTag of Object.keys(blockedSpecials).sort(compareNametags)) {
      const count = blockedSpecials[nameTag];
      reportLines.push(`  §7- §r${nameTag}${count > 1 ? ` x${count}` : ""}`);
    }
  }

  if (!Object.keys(blockedNormals).length && !Object.keys(blockedSpecials).length) {
    reportLines.push("§7No se encontraron unidades con configuración local.");
  }

  return reportLines;
}
