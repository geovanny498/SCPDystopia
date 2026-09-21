// scripts/commands/scope_commands.ts
import {
  system,
  world,
  CustomCommandStatus,
  CustomCommandSource,
  CommandPermissionLevel,
  Entity,
  Player,
} from "@minecraft/server";
import {
  loadScope,
  resetScope,
  getScopeSummary,
  isEntityInScope,
  type ScopeData,
} from "../gui/commandMenu/model/menu_scope.js";
import { COMMAND_SYSTEM_IDS } from "../gui/shared/systemCatalog.js";
import { getEntityFactionInfo, isValidSoldier } from "../gui/commandMenu/model/menu_faction.js";
import { applySystemsToAll } from "../gui/commandMenu/core/menu_state.js";
import { getAllAddonEntitiesInDimensions } from "../utils/entityQuery.js";
import { compareNametags } from "../utils/nametagSort.js";
import { debug } from "../utils/debug.js";

system.beforeEvents.startup.subscribe((init) => {
  const checkCmd = {
    name: "scpd:check_scope",
    description: "Muestra si el menú global fuerza la configuracion global y qué unidades usan configuración local",
    permissionLevel: CommandPermissionLevel.Any,
    cheatsRequired: false,
  };

  let lastCheckTick = -1;
  let lastCheckPlayer = "";

  try {
    init.customCommandRegistry.registerCommand(checkCmd, (origin) => {
      try {
        if (origin.sourceType !== CustomCommandSource.Entity || !origin.sourceEntity) {
          return {
            status: CustomCommandStatus.Failure,
            message: "Este comando solo puede ser ejecutado por un jugador.",
          };
        }

        const entity = origin.sourceEntity as Player;

        // Debounce para prevenir doble ejecución en el mismo tick por duplicación de eventos de comando en BDS
        const currentTick = system.currentTick;
        debug(
          "scope_commands",
          `comando scpd:check_scope ejecutado por ${entity.name} (${entity.id}) en tick ${currentTick}`
        );

        if (currentTick === lastCheckTick && lastCheckPlayer === entity.id) {
          debug(
            "scope_commands",
            `Comando scpd:check_scope ignorado por duplicación en el mismo tick (${currentTick}) para ${entity.name} (${entity.id})`
          );
          return {
            status: CustomCommandStatus.Success,
            message: "Scope mostrado correctamente.",
          };
        }
        lastCheckTick = currentTick;
        lastCheckPlayer = entity.id;

        const rawScope = world.getDynamicProperty("scpd_menu_scope");
        const isSaved = rawScope !== undefined;

        const scope = loadScope();
        const summary = getScopeSummary(scope);

        const statusLabel = isSaved ? "§a[Guardado]§r" : "§8[Por defecto]§r";
        const anyRespect = scope.foundation.respectEntityBlocks || scope.chaos.respectEntityBlocks;
        const blockedReport = anyRespect ? getBlockedEntitiesReport(scope) : [];

        // 1. Salida en el juego (chat para el jugador)
        entity.sendMessage(`§d=== Prioridad de Aplicación ===§r ${statusLabel}`);
        entity.sendMessage(summary);

        if (anyRespect) {
          blockedReport.forEach((line) => entity.sendMessage(line));
        } else {
          entity.sendMessage(
            "§7No hay unidades con configuración local porque el scope está forzando la configuración global en ambas facciones."
          );
        }

        entity.sendMessage("§8Usa el menú para modificar la configuración");

        // 2. Salida única consolidada en consola (stdout directo con console.log en un solo bloque,
        // evitando streams duplicados de stderr/console.warn de BDS para fácil copia en portapapeles)
        const consoleLines: string[] = [`§d=== Prioridad de Aplicación ===§r ${statusLabel}`, summary];
        if (anyRespect) {
          consoleLines.push(...blockedReport);
        } else {
          consoleLines.push(
            "§7No hay unidades con configuración local porque el scope está forzando la configuración global en ambas facciones."
          );
        }
        consoleLines.push(`Datos técnicos: ${JSON.stringify(scope)}`);
        consoleLines.push(`Consultado por: ${entity.name}`);

        console.log(consoleLines.join("\n"));

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

  const resetCmd = {
    name: "scpd:reset_scope",
    description: "Reinicia el sistema de Prioridad de Aplicación a valores por defecto",
    permissionLevel: CommandPermissionLevel.Admin,
    cheatsRequired: false,
  };

  try {
    init.customCommandRegistry.registerCommand(resetCmd, (origin) => {
      try {
        if (origin.sourceType !== CustomCommandSource.Entity || !origin.sourceEntity) {
          return {
            status: CustomCommandStatus.Failure,
            message: "Este comando solo puede ser ejecutado por un jugador.",
          };
        }

        const entity = origin.sourceEntity as Player;

        resetScope();
        const scope = loadScope();
        const summary = getScopeSummary(scope);

        entity.sendMessage("§a[SCOPE] §dPrioridad de Aplicación reiniciado:");
        entity.sendMessage(summary);

        system.run(() => {
          try {
            const dimension = entity.dimension;
            const systemIds = COMMAND_SYSTEM_IDS;
            applySystemsToAll(systemIds, dimension, entity as any);

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

function getBlockedEntitiesReport(scope: ScopeData): string[] {
  const dims = ["overworld", "nether", "the_end"].map((id) => world.getDimension(id)).filter(Boolean);
  const seen = new Set<string>();
  const blockedSpecials: Record<string, number> = {};
  const blockedNormals: Record<string, number> = {};
  let blockedTotal = 0;

  const allEnts = getAllAddonEntitiesInDimensions(dims);

  for (const ent of allEnts) {
    if (!ent || !ent.id || seen.has(ent.id)) continue;
    seen.add(ent.id);
    if (!isValidSoldier(ent)) continue;

    const factionInfo = getEntityFactionInfo(ent);
    if (!factionInfo) continue;

    const inScope = isEntityInScope(ent, factionInfo.faction, scope, ent.nameTag ?? "");
    if (inScope) continue;

    blockedTotal += 1;
    const label = factionInfo.isSpecial ? ent.nameTag?.trim() || ent.typeId : ent.typeId;
    const bucket = factionInfo.isSpecial ? blockedSpecials : blockedNormals;
    bucket[label] = (bucket[label] || 0) + 1;
  }

  const reportLines: string[] = [
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
