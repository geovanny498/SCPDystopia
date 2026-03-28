// scripts/gui/teleportMenu/teleport_normal_menu.ts

/**
 * Menú de soldados NO especiales (básicos, líderes, comandantes)
 * Usa ModalFormData con toggles para seleccionar jerarquías
 */

import { Player, system } from "@minecraft/server";
import { ModalFormData } from "@minecraft/server-ui";
import { NormalSoldiersTexts, ResultMessages, CommonTexts } from "../teleport_config.js";
import {
  getNormalEntitiesByHierarchy,
  getCoordinateInputFromFormValues,
  parseTeleportDestination,
} from "../core/teleport_utils.js";
import { teleportEntitiesToPlayer } from "../core/teleport_logic.js";
import { UnitHierarchy } from "../../commandMenu/menu_config.js";
import { debugMessage } from "../../../utils/debug.js";
import { getNormalSelection, saveNormalSelection } from "../core/teleport_session_store.js";

/**
 * Muestra el menú de soldados NO especiales
 * @param player - Jugador que ejecuta el comando
 * @param faction - Facción seleccionada
 */
export function showNormalSoldiersMenu(player: Player, faction: string): void {
  // Usar system.run para evitar errores de ejecución restringida
  const form = new ModalFormData();
  form.title(NormalSoldiersTexts.title[faction]);

  // Recuperar estado guardado
  const saved = getNormalSelection(player.name, faction);

  form.label(NormalSoldiersTexts.description);
  form.toggle(NormalSoldiersTexts.toggleBasic, { defaultValue: saved[0] });
  form.toggle(NormalSoldiersTexts.toggleLeader, { defaultValue: saved[1] });
  form.toggle(NormalSoldiersTexts.toggleCommander, { defaultValue: saved[2] });
  form.textField("§7Coordenadas destino (x y z)", "Ej: 100 64 -200");
  form.submitButton(CommonTexts.submitButton);
  system.run(() => {
    form
      .show(player)
      .then((response) => {
        if (response.canceled || !response.formValues) {
          debugMessage("teleportMenu", `${player.name} canceló el menú normal, volviendo atrás`, "yellow");
          // Import dinámico para evitar dependencia circular
          import("./teleport_type_menu.js")
            .then((module) => {
              module.showTypeSelectionMenu(player, faction);
            })
            .catch((err) => console.error(err));
          return;
        }

        // Guardar nueva selección (incluso si no selecciona nada y da error luego, es bueno guardar el estado del intento)
        // Indices desplazados +1 por el label de descripción
        const currentSelection = [!!response.formValues[1], !!response.formValues[2], !!response.formValues[3]];
        saveNormalSelection(player.name, faction, currentSelection);

        // Construir array de jerarquías según toggles
        const hierarchies: string[] = [];
        if (response.formValues[1]) hierarchies.push(UnitHierarchy.BASIC);
        if (response.formValues[2]) hierarchies.push(UnitHierarchy.LEADER);
        if (response.formValues[3]) hierarchies.push(UnitHierarchy.COMMANDER);

        // Validar que se haya seleccionado al menos una
        if (hierarchies.length === 0) {
          player.sendMessage(ResultMessages.noSelection);
          return;
        }

        // Analizar coordenadas destino
        const coordString = getCoordinateInputFromFormValues(response.formValues);
        const destination = parseTeleportDestination(coordString, player);

        if (!destination) {
          player.sendMessage("§c[TELEPORT] Coordenadas inválidas. Usa formato x y z o x,y,z.");
          return;
        }

        // Usar system.run para la operación de teletransporte
        system.run(() => {
          try {
            // Obtener entidades filtradas
            const entities = getNormalEntitiesByHierarchy(faction, hierarchies, player.dimension);

            if (entities.length === 0) {
              player.sendMessage(ResultMessages.noEntities(faction));
              return;
            }

            // Teletransportar
            const result = teleportEntitiesToPlayer(entities, player, destination);
            player.sendMessage(ResultMessages.success(result.count, faction));
          } catch (e) {
            console.warn(`Error en teletransporte normal: ${e}`);
            player.sendMessage(ResultMessages.error);
          }
        });
      })
      .catch((e) => {
        console.warn(`Error mostrando menú de normales: ${e}`);
      });
  });
}
