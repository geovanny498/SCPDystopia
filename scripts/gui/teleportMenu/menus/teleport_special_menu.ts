// scripts/gui/teleportMenu/menus/teleport_special_menu.ts

/**
 * Menú de soldados ESPECIALES
 * Refactorizado para usar buckets dinámicos de scanActiveUnits()
 * en lugar de subgrupos hardcodeados
 */

import { Player, system } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { SpecialSoldiersTexts, CommonTexts } from "../teleport_config.js";
import {
  getSpecialEntitiesByNametags,
  getCoordinateInputFromFormValues,
  parseTeleportDestination,
} from "../core/teleport_utils.js";
import { teleportEntitiesToPlayer } from "../core/teleport_logic.js";
import { scanActiveUnits } from "../../commandMenu/menu_config.js";
import { compareNametags } from "../../../utils/nametagSort.js";
import { debugMessage } from "../../../utils/debug.js";
import { isSpecialUnitSelected, saveSpecialSelection } from "../core/teleport_session_store.js";

import type { ScanResult } from "../../commandMenu/model/menu_entity_scanner.js";

/**
 * Muestra el menú de navegación de buckets de especiales
 * @param player - Jugador que ejecuta el comando
 * @param faction - Facción seleccionada
 */
export function showSpecialSoldiersMenu(player: Player, faction: string): void {
  debugMessage("teleportMenu", `Mostrando menú de especiales para facción ${faction}`, "cyan");

  // 1. Escanear entidades activas
  const scanResult = scanActiveUnits(player.dimension, faction);
  const buckets = scanResult.buckets;

  // 2. Orden fijo de buckets
  const bucketOrder = [
    "commander_alpha1",
    "commander_delta1",
    "commander_other",
    "leader_any",
    "basic_any",
    "other_units",
  ];

  // 3. Filtrar buckets no vacíos
  const nonEmptyBuckets = bucketOrder
    .filter((bucketId) => buckets[bucketId] && buckets[bucketId].unitCount > 0)
    .map((bucketId) => ({ id: bucketId, data: buckets[bucketId] }));

  if (nonEmptyBuckets.length === 0) {
    // Mostrar un menú informativo en lugar de volver directamente
    const emptyForm = new ActionFormData();
    const factionTitle = (SpecialSoldiersTexts.title as any)[faction];
    emptyForm.title(factionTitle);
    emptyForm.body(
      "§c§lNo hay unidades especiales activas en esta facción\n\n§7No se encontraron unidades con nametag en esta dimensión."
    );
    emptyForm.button(CommonTexts.backButton);

    system.run(() => {
      emptyForm
        .show(player)
        .then((response) => {
          import("./teleport_type_menu.js")
            .then((m) => m.showTypeSelectionMenu(player, faction))
            .catch((err) => console.error(err));
        })
        .catch((err) => console.error(err));
    });
    return;
  }

  // 4. Construir ActionFormData
  const form = new ActionFormData();
  const factionTitle = (SpecialSoldiersTexts.title as any)[faction];
  form.title(factionTitle);
  form.body(SpecialSoldiersTexts.description);

  nonEmptyBuckets.forEach((bucket) => {
    const nametagCount = Object.keys(bucket.data.nametags).length;
    form.button(`${bucket.data.label}\n§8${nametagCount} nametags`);
  });

  form.button(CommonTexts.backButton);

  // 5. Mostrar y manejar respuesta
  system.run(() => {
    form
      .show(player)
      .then((response) => {
        if (!response || response.canceled) {
          debugMessage("teleportMenu", `${player.name} canceló el menú de especiales, volviendo atrás`, "yellow");
          import("./teleport_type_menu.js")
            .then((m) => m.showTypeSelectionMenu(player, faction))
            .catch((err) => console.error(err));
          return;
        }

        const selection = response.selection;
        if (selection === undefined) return;

        if (selection === nonEmptyBuckets.length) {
          // Botón "Volver"
          import("./teleport_type_menu.js")
            .then((m) => m.showTypeSelectionMenu(player, faction))
            .catch((err) => console.error(err));
          return;
        }

        // Mostrar toggles del bucket seleccionado
        const bucketId = nonEmptyBuckets[selection].id;
        showBucketTogglesMenu(player, faction, bucketId, scanResult);
      })
      .catch((e) => {
        debugMessage("teleportMenu", `Error en menú de especiales: ${e}`, "red");
        console.warn(`Error mostrando menú de especiales: ${e}`);
      });
  });
}

/**
 * Muestra modal con toggles individuales para cada nametag del bucket
 * @param player - Jugador que ejecuta el comando
 * @param faction - Facción seleccionada
 * @param bucketId - ID del bucket (commander_alpha1, leader_any, etc.)
 * @param scanResult - Resultado del escaneo de entidades
 */
function showBucketTogglesMenu(player: Player, faction: string, bucketId: string, scanResult: ScanResult): void {
  const bucketData = scanResult.buckets[bucketId];
  if (!bucketData) {
    player.sendMessage("§c[TELEPORT] Bucket no encontrado");
    showSpecialSoldiersMenu(player, faction);
    return;
  }

  // 1. Obtener nametags únicos del bucket y contar entidades por nametag
  const uniqueNametags = Object.keys(bucketData.nametags).sort(compareNametags);

  // Mapa pre construido de entidades por nametag usando bucketIdMap del scanner
  const bucketEntityIds = scanResult.bucketIdMap[bucketId] || [];
  const idToScanned: Record<string, any> = {};
  for (let i = 0; i < scanResult.entities.length; i++) {
    idToScanned[scanResult.entities[i].entity.id] = scanResult.entities[i];
  }
  const bucketEntitiesByNametag: Record<string, any[]> = {};
  for (let j = 0; j < bucketEntityIds.length; j++) {
    const sc = idToScanned[bucketEntityIds[j]];
    if (!sc || !sc.isSpecial || sc.faction !== faction) continue;
    const nt = (sc.nametag || "").trim();
    if (!nt) continue;
    if (!bucketEntitiesByNametag[nt]) bucketEntitiesByNametag[nt] = [];
    bucketEntitiesByNametag[nt].push(sc.entity);
  }

  debugMessage("teleportMenu", `Mostrando toggles para ${bucketId}: ${uniqueNametags.length} nametags`, "cyan");

  // 2. Construir ModalFormData
  const form = new ModalFormData();
  form.title(`${bucketData.label}§r | Teletransporte`);
  form.label(CommonTexts.toggleLabel);

  uniqueNametags.forEach((nametag) => {
    const isSelected = isSpecialUnitSelected(player.name, faction, nametag);
    const unitCount = bucketEntitiesByNametag[nametag]?.length || 1;
    const label = unitCount > 1 ? "§f" + nametag + "§r §8x" + unitCount : "§f" + nametag + "§r";
    form.toggle(label, { defaultValue: isSelected });
  });

  form.textField("§7Coordenadas destino (x y z)", "Ej: 100 64 -200");
  form.submitButton(CommonTexts.submitButton);

  // 3. Mostrar y manejar respuesta
  system.run(() => {
    form
      .show(player)
      .then((response) => {
        if (!response || response.canceled) {
          debugMessage("teleportMenu", `${player.name} canceló el modal de toggles, volviendo atrás`, "yellow");
          showSpecialSoldiersMenu(player, faction);
          return;
        }

        const values = response.formValues;
        if (!values) {
          player.sendMessage("§c[TELEPORT] Error leyendo formulario");
          return;
        }

        // 4. Filtrar nametags seleccionados
        const selectedNametags: string[] = [];
        let idx = 0;

        // Saltar label inicial
        while (idx < values.length && values[idx] === undefined) idx++;

        // Leer toggles
        uniqueNametags.forEach((nametag) => {
          if (idx < values.length && values[idx] === true) {
            selectedNametags.push(nametag);
          }
          idx++;
        });

        // Guardar selección (fusionando con otros buckets)
        saveSpecialSelection(player.name, faction, bucketId, selectedNametags, uniqueNametags);

        if (selectedNametags.length === 0) {
          player.sendMessage("§c[TELEPORT] No seleccionaste ninguna unidad");
          showSpecialSoldiersMenu(player, faction);
          return;
        }

        // 5. Obtener coordenadas
        const coordString = getCoordinateInputFromFormValues(values);
        const destination = parseTeleportDestination(coordString, player);

        if (!destination) {
          player.sendMessage("§c[TELEPORT] Coordenadas inválidas. Usa formato x y z o x,y,z.");
          showSpecialSoldiersMenu(player, faction);
          return;
        }

        // 6. Teletransportar
        debugMessage(
          "teleportLogic",
          `Teletransportando ${selectedNametags.length} unidades especiales: ${selectedNametags.join(", ")}`,
          "green"
        );

        const entities = getSpecialEntitiesByNametags(faction, selectedNametags, player.dimension);

        // Debug: Mostrar entidades encontradas
        debugMessage("teleportLogic", `Entidades encontradas: ${entities.length}`, "cyan");
        entities.forEach((ent, idx) => {
          debugMessage(
            "teleportLogic",
            `  [${idx + 1}] ${ent.nameTag || "sin nombre"} (${ent.typeId}) - ID: ${ent.id}`,
            "dark_gray"
          );
        });

        const result = teleportEntitiesToPlayer(entities, player, destination);

        // 7. Mensaje al jugador
        if (result.count > 0) {
          player.sendMessage(`§a[TELEPORT] ${result.count} unidades de ${bucketData.label}§r teletransportadas`);
        } else {
          player.sendMessage(`§c[TELEPORT] No se encontraron unidades en esta dimensión`);
        }

        if (result.hasErrors && result.errors) {
          player.sendMessage(`§e[TELEPORT] ${result.errors.length} errores (ver consola)`);
        }

        // Volver al menú de buckets
        showSpecialSoldiersMenu(player, faction);
      })
      .catch((e) => {
        debugMessage("teleportMenu", `Error en modal de toggles: ${e}`, "red");
        console.warn(`Error en modal de toggles: ${e}`);
      });
  });
}
