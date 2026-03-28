// scripts/gui/teleportMenu/teleport_special_menu.ts

/**
 * Menú de soldados ESPECIALES
 * Usa ActionFormData para navegación de subgrupos
 * Usa ModalFormData para toggles individuales de cada unidad
 */

import { Player, system } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { SpecialSoldiersTexts, CommonTexts, getSubgroupLabel } from "../teleport_config.js";
// Import dinámico para evitar ciclos: import { showTypeSelectionMenu } from "./teleport_type_menu.js";
import {
  getSpecialEntitiesByToggles,
  getCoordinateInputFromFormValues,
  parseTeleportDestination,
} from "../core/teleport_utils.js";
import { teleportEntitiesToPlayer } from "../core/teleport_logic.js";
import { Factions, specialUnits } from "../../commandMenu/menu_config.js";
import { debugMessage } from "../../../utils/debug.js";
import { isSpecialUnitSelected, saveSpecialSelection } from "../core/teleport_session_store.js";

/**
 * Muestra el menú de navegación de subgrupos de especiales
 * @param player - Jugador que ejecuta el comando
 * @param faction - Facción seleccionada
 */
export function showSpecialSoldiersMenu(player: Player, faction: string): void {
  debugMessage("teleportMenu", `Mostrando menú de especiales para facción ${faction}`, "cyan");

  const form = new ActionFormData();
  const factionTitle = (SpecialSoldiersTexts.title as any)[faction];
  form.title(factionTitle);
  form.body(SpecialSoldiersTexts.description);

  // Obtener subgrupos de la facción
  const factionData = (specialUnits as any)[faction];
  if (!factionData || !factionData.subgroups) {
    player.sendMessage("§c[ERROR] Datos de facción no encontrados");
    return;
  }

  const subgroupIds = Object.keys(factionData.subgroups);

  // Añadir botón para cada subgrupo
  subgroupIds.forEach((subgroupId: string) => {
    const subgroup = factionData.subgroups[subgroupId];
    const label = subgroup.label;
    const desc = `${subgroup.units.length} unidades disponibles`;
    form.button(`${label}\n§8${desc}`);
  });

  // Botón volver
  form.button(CommonTexts.backButton);

  system.run(() => {
    form
      .show(player)
      .then((response) => {
        if (!response || response.canceled) {
          debugMessage("teleportMenu", `${player.name} canceló el menú de especiales, volviendo atrás`, "yellow");
          import("./teleport_type_menu.js")
            .then((module) => {
              module.showTypeSelectionMenu(player, faction);
            })
            .catch((err) => console.error(err));
          return;
        }

        const selection = response.selection;
        if (selection === undefined) return;

        // Si presionó "Volver"
        if (selection === subgroupIds.length) {
          import("./teleport_type_menu.js")
            .then((module) => {
              module.showTypeSelectionMenu(player, faction);
            })
            .catch((err) => console.error(err));
          return;
        }

        // Mostrar modal de toggles para el subgrupo seleccionado
        const subgroupId = subgroupIds[selection];
        showSubgroupTogglesMenu(player, faction, subgroupId);
      })
      .catch((e) => {
        debugMessage("teleportMenu", `Error en menú de especiales: ${e}`, "red");
        console.warn(`Error mostrando menú de especiales: ${e}`);
      });
  });
}

/**
 * Muestra modal con toggles individuales para cada unidad del subgrupo
 * @param player - Jugador que ejecuta el comando
 * @param faction - Facción seleccionada
 * @param sub groupId - ID del subgrupo (delta1, alpha1, etc.)
 */
function showSubgroupTogglesMenu(player: Player, faction: string, subgroupId: string): void {
  const factionData = (specialUnits as any)[faction];
  const subgroup = factionData.subgroups[subgroupId];

  if (!subgroup) {
    debugMessage("teleportMenu", `Subgrupo no encontrado: ${subgroupId}`, "red");
    return;
  }

  debugMessage("teleportMenu", `Mostrando toggles para ${subgroupId}: ${subgroup.units.length} unidades`, "cyan");

  const form = new ModalFormData();
  form.title(`${subgroup.label}${"§r | Teletransporte"}`);
  form.label(CommonTexts.toggleLabel);

  // Añadir toggle para cada unidad del subgrupo
  subgroup.units.forEach((unitName: string) => {
    const isSelected = isSpecialUnitSelected(player.name, faction, subgroupId, unitName);
    form.toggle(unitName, { defaultValue: isSelected });
  });

  form.textField("§7Coordenadas destino (x y z)", "Ej: 100 64 -200");
  form.submitButton(CommonTexts.submitButton);

  system.run(() => {
    form
      .show(player)
      .then((response) => {
        if (!response || response.canceled) {
          debugMessage("teleportMenu", `${player.name} canceló el modal de toggles, volviendo atras`, "yellow");
          // Volver al menú de navegación de subgrupos
          showSpecialSoldiersMenu(player, faction);
          return;
        }

        // Obtener valores de los toggles
        const values = response.formValues;
        if (!values) {
          player.sendMessage("§c[TELEPORT] Error leyendo formulario");
          return;
        }

        // Filtrar valores undefined (del label) y obtener unidades seleccionadas
        const selectedUnits: string[] = [];
        let toggleIndex = 0;

        // Saltar label inicial
        let idx = 0;
        while (idx < values.length && values[idx] === undefined) {
          idx++;
        }

        // Leer toggles
        subgroup.units.forEach((unitName: string) => {
          if (idx < values.length && values[idx] === true) {
            selectedUnits.push(unitName);
          }
          idx++;
        });

        // Guardar selección en sesión
        saveSpecialSelection(player.name, faction, subgroupId, selectedUnits);

        if (selectedUnits.length === 0) {
          player.sendMessage("§c[TELEPORT] No seleccionaste ninguna unidad");
          showSpecialSoldiersMenu(player, faction);
          return;
        }

        // Obtener coordenadas destino del campo de texto
        const coordString = getCoordinateInputFromFormValues(values);
        const destination = parseTeleportDestination(coordString, player);

        if (!destination) {
          player.sendMessage("§c[TELEPORT] Coordenadas inválidas. Usa formato x y z o x,y,z.");
          showSpecialSoldiersMenu(player, faction);
          return;
        }

        debugMessage(
          "teleportLogic",
          `Teletransportando ${selectedUnits.length} unidades especiales: ${selectedUnits.join(", ")}`,
          "green"
        );

        // Obtener entidades y teletransportar
        const entities = getSpecialEntitiesByToggles(faction, selectedUnits, player.dimension);
        const result = teleportEntitiesToPlayer(entities, player, destination);

        // Mensaje al jugador
        const subgroupLabel = getSubgroupLabel(faction, subgroupId);
        if (result.count > 0) {
          player.sendMessage(`§a[TELEPORT] ${result.count} unidades de ${subgroupLabel}§r teletransportadas`);
        } else {
          player.sendMessage(`§c[TELEPORT] No se encontraron unidades de ${subgroupLabel}§r en esta dimensión`);
        }

        if (result.hasErrors && result.errors) {
          player.sendMessage(`§e[TELEPORT] Se produjeron ${result.errors.length} errores (ver consola)`);
        }

        // Volver al menú de navegación de subgrupos
        showSpecialSoldiersMenu(player, faction);
      })
      .catch((e) => {
        debugMessage("teleportMenu", `Error en modal de toggles: ${e}`, "red");
        console.warn(`Error en modal de toggles de subgrupo: ${e}`);
      });
  });
}
