// scripts/gui/teleportMenu/menus/teleport_all_menu.ts

/**
 * Menú para configurar y teletransportar TODAS las opciones de una facción
 * Muestra un ModalFormData con TODOS los toggles:
 * - Jerarquías (Básico, Líder, Comandante)
 * - TODAS las unidades especiales individuales
 */

import { Player, system } from "@minecraft/server";
import { ModalFormData } from "@minecraft/server-ui";
import { TeleportAllTexts, CommonTexts, getFactionLabel } from "../teleport_config.js";
// Eliminado import estático para evitar ciclos
import { getNormalEntitiesByHierarchy, getSpecialEntitiesByToggles } from "../core/teleport_utils.js";
import { teleportEntitiesToPlayer } from "../core/teleport_logic.js";
import { Factions, UnitHierarchy, specialUnits } from "../../commandMenu/menu_config.js";
import { debugMessage } from "../../../utils/debug.js";
import { getAllMenuSelection, saveAllMenuSelection } from "../core/teleport_session_store.js";

/**
 * Muestra el menú completo con todos los toggles de una facción
 * @param player - Jugador que ejecuta el comando
 * @param faction - Facción seleccionada
 */
export function showTeleportAllMenu(player: Player, faction: string): void {
  debugMessage("teleportMenu", `Mostrando menú TODAS para facción ${faction}`, "cyan");

  const form = new ModalFormData();
  const factionLabel = getFactionLabel(faction);
  const factionTitle = (TeleportAllTexts.title as any)[faction];
  form.title(factionTitle);
  form.label(`§7Selecciona TODAS las unidades a teletransportar de ${factionLabel}§r:`);

  // ===== SECCIÓN 1: Jerarquías (NO especiales) =====
  const saved = getAllMenuSelection(player.name, faction); // Recuperar estado

  form.label("§7─── Soldados NO Especiales ───");
  form.toggle("§7Básicos", { defaultValue: saved?.hierarchies[0] ?? true });
  form.toggle("§eLíderes", { defaultValue: saved?.hierarchies[1] ?? true });
  form.toggle("§6Comandantes", { defaultValue: saved?.hierarchies[2] ?? true });

  // ===== SECCIÓN 2: Unidades Especiales Individuales =====
  form.label("§e─── Soldados Especiales ───");
  const factionData = (specialUnits as any)[faction];
  const allSpecialUnits: string[] = [];

  if (factionData && factionData.subgroups) {
    const subgroupIds = Object.keys(factionData.subgroups);

    subgroupIds.forEach((subgroupId: string) => {
      const subgroup = factionData.subgroups[subgroupId];

      // Label para el subgrupo
      form.label(`${subgroup.label}§r`);

      // Toggle para cada unidad del subgrupo
      subgroup.units.forEach((unitName: string) => {
        allSpecialUnits.push(unitName);
        const isSelected = saved?.specialUnits.includes(unitName) ?? true;
        form.toggle(unitName, { defaultValue: isSelected });
      });
    });
  }

  form.submitButton(CommonTexts.submitButton);

  system.run(() => {
    form
      .show(player)
      .then((response) => {
        if (!response || response.canceled) {
          debugMessage("teleportMenu", `${player.name} canceló el menú TODAS, volviendo atrás`, "yellow");
          // Import dinámico para evitar dependencia circular
          import("./teleport_type_menu.js")
            .then((module) => {
              module.showTypeSelectionMenu(player, faction);
            })
            .catch((err) => console.error(err));
          return;
        }

        const values = response.formValues;
        if (!values) {
          player.sendMessage("§c[TELEPORT] Error leyendo formulario");
          return;
        }

        // Parsear valores
        let idx = 0;

        // Saltar label inicial
        while (idx < values.length && values[idx] === undefined) {
          idx++;
        }

        // Label inicial y label "NO Especiales" ya son saltados por el while si son consecutivos
        // El while avanza hasta encontrar un valor no-undefined (el primer toggle)

        // Leer toggles de jerarquías (3 toggles)
        const selectedHierarchies: string[] = [];
        const h1 = values[idx] === true;
        if (h1) selectedHierarchies.push(UnitHierarchy.BASIC);
        idx++;
        const h2 = values[idx] === true;
        if (h2) selectedHierarchies.push(UnitHierarchy.LEADER);
        idx++;
        const h3 = values[idx] === true;
        if (h3) selectedHierarchies.push(UnitHierarchy.COMMANDER);
        idx++;

        // Leer toggles de unidades especiales
        const selectedSpecialUnits: string[] = [];
        const subgroupIds = Object.keys(factionData.subgroups);

        subgroupIds.forEach((subgroupId: string) => {
          // Saltar label del subgrupo
          while (idx < values.length && values[idx] === undefined) {
            idx++;
          }

          const subgroup = factionData.subgroups[subgroupId];
          subgroup.units.forEach((unitName: string) => {
            if (idx < values.length && values[idx] === true) {
              selectedSpecialUnits.push(unitName);
            }
            idx++;
          });
        });

        // Guardar estado completo
        saveAllMenuSelection(player.name, faction, [h1, h2, h3], selectedSpecialUnits);

        // Validar que al menos algo esté seleccionado
        if (selectedHierarchies.length === 0 && selectedSpecialUnits.length === 0) {
          player.sendMessage("§c[TELEPORT] Debes seleccionar al menos una opción");
          import("./teleport_type_menu.js")
            .then((module) => {
              module.showTypeSelectionMenu(player, faction);
            })
            .catch((err) => console.error(err));
          return;
        }

        debugMessage(
          "teleportLogic",
          `Teletransportando: Jerarquías=${selectedHierarchies.join(",")} Especiales=${selectedSpecialUnits.length}`,
          "green"
        );

        // Obtener y teletransportar entidades normales
        let totalCount = 0;
        let totalErrors = 0;

        if (selectedHierarchies.length > 0) {
          const normalEntities = getNormalEntitiesByHierarchy(faction, selectedHierarchies, player.dimension);
          const normalResult = teleportEntitiesToPlayer(normalEntities, player);
          totalCount += normalResult.count;
          if (normalResult.hasErrors && normalResult.errors) {
            totalErrors += normalResult.errors.length;
          }
        }

        // Obtener y teletransportar entidades especiales
        if (selectedSpecialUnits.length > 0) {
          const specialEntities = getSpecialEntitiesByToggles(faction, selectedSpecialUnits, player.dimension);
          const specialResult = teleportEntitiesToPlayer(specialEntities, player);
          totalCount += specialResult.count;
          if (specialResult.hasErrors && specialResult.errors) {
            totalErrors += specialResult.errors.length;
          }
        }

        // Mensaje al jugador
        if (totalCount > 0) {
          player.sendMessage(`§a[TELEPORT] ${totalCount} unidades de ${factionLabel}§r teletransportadas`);
        } else {
          player.sendMessage(`§c[TELEPORT] No se encontraron unidades en esta dimensión`);
        }

        if (totalErrors > 0) {
          player.sendMessage(`§e[TELEPORT] Se produjeron ${totalErrors} errores (ver consola)`);
        }

        // Volver al menú de tipo
        import("./teleport_type_menu.js")
          .then((module) => {
            module.showTypeSelectionMenu(player, faction);
          })
          .catch((err) => console.error(err));
      })
      .catch((e) => {
        debugMessage("teleportMenu", `Error en menú TODAS: ${e}`, "red");
        console.warn(`Error mostrando menú TODAS: ${e}`);
      });
  });
}
