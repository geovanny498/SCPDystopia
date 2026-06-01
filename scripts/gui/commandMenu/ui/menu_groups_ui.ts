// scripts/gui/commandMenu/menu_groups_ui.ts
import { Player, system, world, Entity } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { debugWarn, debugMessage } from "../../../utils/debug.js";
import { compareNametags } from "../../../utils/nametagSort.js";
import {
  Factions,
  SpecialGroups,
  SpecialGroupLabels,
  getGroupsOrderForAssignment,
  getGroupsOrderForSystems, // Importado para manejar prioridades del sistema
  scanActiveUnits,
  invalidateScanCache,
  invalidateEntityQueryCache,
} from "../menu_config.js";
import { setUnitGroup, getUnitGroup } from "../model/menu_groups.js";

import type { ScannedEntity } from "../model/menu_entity_scanner.js";

// ═══════════════════════════════════════════════════════════════════════════════
// §  MENÚ PRINCIPAL DE GRUPOS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Muestra el menú principal de configuración de grupos de especiales
 */
export function showGroupsMenu(player: Player): void {
  try {
    debugWarn("menuGroups", "=== showGroupsMenu iniciado ===", "cyan");

    const form = new ActionFormData()
      .title("§9Grupos de Especiales")
      .body("§7Asigna unidades especiales a grupos para configurar sus comportamientos de forma independiente:");

    form.button("§lConfigurar Foundation");
    form.button("§2§lConfigurar Chaos");
    form.button("§8« Volver");

    system.run(() => {
      form
        .show(player)
        .then((res) => {
          if (!res || res.canceled) {
            import("../builder/menu.js").then((module) => {
              system.run(() => {
                module.buildAndShowMenu(player);
              });
            });
            return;
          }

          if (res.selection === 0) {
            showFactionGroupsMenu(player, Factions.FOUNDATION);
          } else if (res.selection === 1) {
            showFactionGroupsMenu(player, Factions.CHAOS);
          } else {
            import("../builder/menu.js").then((module) => {
              system.run(() => {
                module.buildAndShowMenu(player);
              });
            });
          }
        })
        .catch((err) => {
          debugWarn("menuGroups", `Error en showGroupsMenu: ${err}`, "red");
        });
    });
  } catch (e) {
    debugWarn("menuGroups", `Error en showGroupsMenu: ${e}`, "red");
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// §  MENÚ POR FACCION — familias MTF detectadas dinámicamente
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Muestra el menú de grupos para una facción específica.
 * Usa scanActiveUnits para detectar familias MTF con entidades activas.
 */
function showFactionGroupsMenu(player: Player, faction: string): void {
  try {
    const factionLabel = faction === Factions.FOUNDATION ? "§lFoundation" : "§2§lChaos";

    // Escanear entidades activas en la dimensión del jugador
    // El cache TTL (2s) maneja la expiración natural - no forzar invalidación en navegación UI
    const scanResult = scanActiveUnits(player.dimension, faction, { withBuckets: true });
    const buckets = scanResult.buckets;

    // Resumen de grupos: contar entidades ESPECIALES vivas por grupo en la facción
    var _groupCounts: Record<string, number> = {};
    var allGroupsOrder = getGroupsOrderForAssignment();
    for (var gi = 0; gi < allGroupsOrder.length; gi++) {
      _groupCounts[allGroupsOrder[gi]] = 0;
    }

    var activeEntities = scanResult.entities;
    for (var si = 0; si < activeEntities.length; si++) {
      var e = activeEntities[si];
      if (!e.isSpecial) continue;
      if (e.faction !== faction) continue;
      var gid = e.group || SpecialGroups.NO_GROUP;
      if (_groupCounts[gid] !== undefined) {
        _groupCounts[gid] += 1;
      }
    }

    // Construir resumen de grupos
    var summaryText = "§7Resumen de grupos:\n";
    for (var li = 0; li < allGroupsOrder.length; li++) {
      var gid2 = allGroupsOrder[li];
      var lbl = SpecialGroupLabels[gid2 as keyof typeof SpecialGroupLabels];
      summaryText += lbl + "§r: §f" + _groupCounts[gid2] + " unidades\n";
    }

    // Orden fijo de buckets para Nivel 1
    var bucketOrder = [
      "commander_alpha1",
      "commander_delta1",
      "commander_other",
      "leader_any",
      "basic_any",
      "other_units",
    ];
    // @ts-ignore — arreglo tipado inline por limitación de TS en archivo JS-ish
    var nonEmptyBuckets: any[] = [];
    for (var bi = 0; bi < bucketOrder.length; bi++) {
      var bkey = bucketOrder[bi];
      if (buckets[bkey] && buckets[bkey].unitCount > 0) {
        nonEmptyBuckets.push({ id: bkey, data: buckets[bkey] });
      }
    }

    if (nonEmptyBuckets.length === 0) {
      var emptyForm2 = new ActionFormData()
        .title("§9Grupos§r - " + factionLabel)
        .body(summaryText + "\n§8No hay unidades especiales activas en esta facción.");
      emptyForm2.button("§8« Volver");

      system.run(function () {
        emptyForm2.show(player).then(function (res) {
          if (!res || res.canceled || res.selection === 0) {
            showGroupsMenu(player);
          } else {
            showGroupsMenu(player);
          }
        });
      });
      return;
    }

    var form2 = new ActionFormData().title("§9Grupos§r - " + factionLabel).body(summaryText);

    // Un botón por bucket (jerarquía + familia MTF principal)
    for (var ni = 0; ni < nonEmptyBuckets.length; ni++) {
      var bucket = nonEmptyBuckets[ni];
      var ntCount = Object.keys(bucket.data.nametags).length;
      var btnLabel = bucket.data.label + " §8(" + ntCount + " nametags)";
      form2.button(btnLabel);
    }

    form2.button("§8« Volver");

    system.run(function () {
      form2
        .show(player)
        .then(function (res) {
          if (!res || res.canceled) {
            showGroupsMenu(player);
            return;
          }

          var selection = res.selection;
          if (typeof selection !== "number") {
            showFactionGroupsMenu(player, faction);
            return;
          }

          // Verificar si seleccionó un bucket o el botón "Volver"
          if (selection >= 0 && selection < nonEmptyBuckets.length) {
            var bucketEntry = nonEmptyBuckets[selection];
            if (bucketEntry && bucketEntry.id) {
              showBucketAssignmentModal(player, faction, bucketEntry.id, scanResult);
              return;
            }
          }

          // Botón "Volver" (último botón = nonEmptyBuckets.length)
          showGroupsMenu(player);
        })
        .catch(function (err) {
          debugWarn("menuGroups", "Error en showFactionGroupsMenu: " + err, "red");
        });
    });
  } catch (e) {
    debugWarn("menuGroups", "Error en showFactionGroupsMenu: " + e, "red");
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//   MODAL DE ASIGNACIÓN DE GRUPOS  —  1 dropdown por nametag único
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Muestra el modal para asignar grupos a un bucket específico
 * (jerarquía + familia MTF principal). 1 dropdown por cada nametag único
 * encontrado en ese bucket.
 */
function showBucketAssignmentModal(player: Player, faction: string, bucketId: string, scanResult: any): void {
  try {
    debugWarn("menuGroups:ui", "=== showBucketAssignmentModal: faction=" + faction + ", bucketId=" + bucketId, "cyan");

    var bucketData = scanResult.buckets[bucketId];
    if (!bucketData) {
      player.sendMessage("§c[GRUPOS] Bucket no encontrado: " + bucketId);
      showFactionGroupsMenu(player, faction);
      return;
    }

    var bucketNametags = bucketData.nametags;

    var ntBucketEntities: Record<string, Entity[]> = {};

    // Registros en memoria para precalcular prioridades en el bucle plano
    var ntPreferredGroup: Record<string, string> = {};
    var ntMaxPriority: Record<string, number> = {};

    var bucketEntityIds = scanResult.bucketIdMap[bucketId] || [];
    var idToScanned: Record<string, ScannedEntity> = {};
    for (var eiMap = 0; eiMap < scanResult.entities.length; eiMap++) {
      idToScanned[scanResult.entities[eiMap].entity.id] = scanResult.entities[eiMap];
    }

    var prioritySystemOrder = getGroupsOrderForSystems();

    // Esto creará un objeto: { "groupA": 5, "groupB": 4, "groupC": 3, "groupD": 2, "noGroup": 1 }
    var priorityMap: Record<string, number> = {};
    for (var p = 0; p < prioritySystemOrder.length; p++) {
      priorityMap[prioritySystemOrder[p]] = prioritySystemOrder.length - p;
    }

    // PASO 1: Agrupar entidades y calcular prioridades simultáneamente (Bucle Lineal Único)
    for (var eidI = 0; eidI < bucketEntityIds.length; eidI++) {
      var eid = bucketEntityIds[eidI];
      var sc = idToScanned[eid];
      if (!sc || !sc.isSpecial) continue;
      if (sc.faction !== faction) continue;
      var nt = (sc.nametag || "").trim();
      if (!nt) continue;

      // Inicialización limpia
      if (!ntBucketEntities[nt]) {
        ntBucketEntities[nt] = [];
        ntPreferredGroup[nt] = SpecialGroups.NO_GROUP;
        ntMaxPriority[nt] = 0;
      }
      ntBucketEntities[nt].push(sc.entity);

      var entityGroup = sc.group || SpecialGroups.NO_GROUP;

      var currentPriority = priorityMap[entityGroup] || 1;

      if (currentPriority > ntMaxPriority[nt]) {
        ntMaxPriority[nt] = currentPriority;
        ntPreferredGroup[nt] = entityGroup;
      }
    }

    // Armar la lista de nametags finales para el dropdown
    var uniqueNametags: { nametag: string; entities: Entity[]; preferredGroup: string }[] = [];
    var bucketNtKeys = Object.keys(bucketNametags).sort(compareNametags);
    for (var bi2 = 0; bi2 < bucketNtKeys.length; bi2++) {
      var nt2 = bucketNtKeys[bi2];
      var ents = ntBucketEntities[nt2];
      if (!ents || ents.length === 0) continue;

      uniqueNametags.push({
        nametag: nt2,
        entities: ents.slice(0),
        preferredGroup: ntPreferredGroup[nt2] || SpecialGroups.NO_GROUP, // Guardamos el veredicto
      });
    }

    debugWarn("menuGroups:ui", "bucket " + bucketId + ": " + uniqueNametags.length + " nametags únicos", "gray");

    if (uniqueNametags.length === 0) {
      player.sendMessage("§c[GRUPOS] No hay unidades con nametag en este bucket.");
      showFactionGroupsMenu(player, faction);
      return;
    }

    // Opciones de grupos para los dropdowns
    var groupOptions = getGroupsOrderForAssignment();
    var groupLabels = groupOptions.map(function (g) {
      return SpecialGroupLabels[g] ?? g;
    });

    var bucketLabel = bucketData.label;
    var modalForm = new ModalFormData().title(bucketLabel + "§r §8(" + uniqueNametags.length + " nametags)");
    modalForm.label("§7Asigna grupo a cada nametag:");

    // PASO 2: Agregar un dropdown por cada nametag único (sin límite — other_units recibe el overflow)
    for (var di = 0; di < uniqueNametags.length; di++) {
      var entry = uniqueNametags[di];

      // La resolución ya se hizo en el Paso 1; la lectura aquí es instantánea O(1)
      var currentIndex = groupOptions.indexOf(entry.preferredGroup);

      var unitCount2 = entry.entities.length;
      var label2 = unitCount2 > 1 ? "§f" + entry.nametag + "§r §8x" + unitCount2 : "§f" + entry.nametag + "§r";
      modalForm.dropdown(label2, groupLabels, { defaultValueIndex: Math.max(0, currentIndex) });
    }

    modalForm.submitButton("§aGuardar");

    system.run(function () {
      modalForm
        .show(player)
        .then(function (res) {
          if (!res || res.canceled) {
            showFactionGroupsMenu(player, faction);
            return;
          }

          var rawValues2 = res.formValues || [];
          var dropdownValues2 = rawValues2.filter(function (v) {
            return typeof v === "number";
          });

          // Actualizar DP individual de cada entidad viva
          for (var si2 = 0; si2 < uniqueNametags.length; si2++) {
            var entry2 = uniqueNametags[si2];
            var selectedIndex2 = dropdownValues2[si2];

            if (typeof selectedIndex2 === "number" && selectedIndex2 >= 0 && selectedIndex2 < groupOptions.length) {
              var selectedGroup2 = groupOptions[selectedIndex2];
              for (var ei2 = 0; ei2 < entry2.entities.length; ei2++) {
                setUnitGroup(entry2.entities[ei2], selectedGroup2);
              }
              debugWarn("menuGroups:ui", entry2.nametag + " -> " + selectedGroup2, "green");
            }
          }

          player.sendMessage("§a[GRUPOS] " + bucketLabel + " actualizado (" + uniqueNametags.length + " nametags)");
          showFactionGroupsMenu(player, faction);
        })
        .catch(function (err) {
          debugWarn("menuGroups", "Error en showBucketAssignmentModal: " + err, "red");
        });
    });
  } catch (e) {
    debugWarn("menuGroups", "Error en showBucketAssignmentModal: " + e, "red");
  }
}
