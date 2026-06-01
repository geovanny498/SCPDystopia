// scripts/gui/commandMenu/menu_system.js
import { world, system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { debugWarn } from "../../../utils/debug.js";
import {
  Factions,
  SpecialGroups,
  getGroupsOrderForSystems,
  scanActiveUnits,
} from "../menu_config.js";
import { buildSystemForm, parseSystemFormValues, getConfirmationMessage } from "../builder/menu_builder.js";
import { loadSystemStates, saveSystemStates, applySystemsToAll } from "../core/menu_state.js";

/**
 * Muestra el selector de facción antes de mostrar el formulario de sistemas
 */
export function showSystemMenu(player, systems, isAllCategory = false, categoryId = null) {
  try {
    if (!systems || systems.length === 0) {
      debugWarn("commandMenu", "No hay sistemas para mostrar", "red");
      return;
    }

    // Mostrar selector de facción primero
    const form = new ActionFormData().title("Seleccionar Bando").body("§7Selecciona el bando a configurar:");

    form.button("§lFoundation");
    form.button("§2§lChaos");
    form.button("§8« Volver");

    system.run(() => {
      form
        .show(player)
        .then((res) => {
          if (!res || res.canceled) {
            goBack(player, categoryId);
            return;
          }

          let selectedFaction = null;
          if (res.selection === 0) {
            selectedFaction = Factions.FOUNDATION;
          } else if (res.selection === 1) {
            selectedFaction = Factions.CHAOS;
          } else {
            goBack(player, categoryId);
            return;
          }

          // Mostrar formulario de sistemas para la facción seleccionada
          showSystemFormForFaction(player, systems, selectedFaction, isAllCategory, categoryId);
        })
        .catch((err) => {
          debugWarn("commandMenu", `Error en selector de facción: ${err}`, "red");
        });
    });
  } catch (e) {
    debugWarn("commandMenu", `Error mostrando menu de sistema: ${e}`, "red");
  }
}

/**
 * Muestra el formulario de configuración para una facción específica
 */
function showSystemFormForFaction(player, systems, selectedFaction, isAllCategory, categoryId) {
  try {
    // 1. Cargar estados actuales de los sistemas
    const systemIds = systems.map((s) => s.id);
    const loadedStates = loadSystemStates(systemIds);

    // 2. Escanear entidades activas en la dimensión del jugador
    const scanResult = scanActiveUnits(player.dimension, selectedFaction, { withBuckets: false });

    // 2.1. Grupos activos: sincroniza buildSystemForm ↔ parseSystemFormValues
    // Calcular antes de buildSystemForm para que ambos usen la misma lista
    var _allGroups = getGroupsOrderForSystems();
    var _groupCounts = {};
    for (var _gi = 0; _gi < _allGroups.length; _gi++) _groupCounts[_allGroups[_gi]] = 0;
    var _ents = scanResult.entities || [];
    for (var _si = 0; _si < _ents.length; _si++) {
      var _sc = _ents[_si];
      if (!_sc.isSpecial) continue;
      if (_sc.faction !== selectedFaction) continue;
      var _gid = _sc.group || SpecialGroups.NO_GROUP;
      debugWarn("menuSystem", `[count] type="${_sc.typeId}" nametag="${_sc.nametag}" group="${_gid}"`, "dark_gray");
      if (_groupCounts[_gid] !== undefined) _groupCounts[_gid]++;
    }
    debugWarn("menuSystem", `[activeGroups] faction=${selectedFaction} counts=${JSON.stringify(_groupCounts)}`, "cyan");
    var activeGroups = _allGroups.filter(function (g) {
      return _groupCounts[g] > 0;
    });
    debugWarn(
      "menuSystem",
      `[activeGroups] faction=${selectedFaction} activeGroups=${JSON.stringify(activeGroups)}`,
      "green"
    );

    // 3. Construir el formulario solo con entidades activas
    let form;
    try {
      debugWarn("menuSystem", `[buildForm] calling buildSystemForm...`, "cyan");
      form = buildSystemForm(
        systems,
        loadedStates,
        selectedFaction,
        scanResult.activeHierarchies,
        scanResult.activeFamilyTags,
        scanResult.entities,
        activeGroups
      );
      debugWarn("menuSystem", `[buildForm] buildSystemForm OK`, "green");
    } catch (formErr) {
      debugWarn("menuSystem", `[buildForm] ERROR: ${formErr} stack=${formErr.stack}`, "red");
      player.sendMessage("§c[ERROR] No se pudo construir el formulario de sistemas.");
      return;
    }

    // 3. Mostrar el formulario
    system.run(() => {
      try {
        form
          .show(player)
          .then((res) => {
            debugWarn(
              "menuSystem",
              `System menu - canceled=${res.canceled}, formValues length=${res.formValues?.length || 0}`,
              "cyan"
            );

            if (!res || res.canceled) {
              // Volver al selector de facción
              showSystemMenu(player, systems, isAllCategory, categoryId);
              return;
            }

            const vals = res.formValues;
            debugWarn("commandMenu", `formValues array: ${JSON.stringify(vals)}`, "cyan");

            if (!Array.isArray(vals)) return;

            // 4. Parsear los valores del formulario (pasar activeGroups para sincronizar índices)
            const parsedStates = parseSystemFormValues(systems, vals, selectedFaction, activeGroups);

            // 5. Merge con estados existentes para mantener la otra facción
            for (const systemId of systemIds) {
              const existingState = loadedStates[systemId];
              if (existingState) {
                const otherFaction = selectedFaction === Factions.FOUNDATION ? Factions.CHAOS : Factions.FOUNDATION;
                if (existingState[otherFaction]) {
                  parsedStates[systemId][otherFaction] = existingState[otherFaction];
                }
              }
            }

            // Log mejorado: separar jerarquías (no especiales) de grupos (especiales)
            debugWarn("commandMenu", `=== Parsed States (${selectedFaction}) ===`, "yellow");
            for (const systemId of systemIds) {
              const systemState = parsedStates[systemId];
              if (!systemState) continue;

              debugWarn("commandMenu", `[${systemId}]`, "cyan");

              for (const faction of [Factions.FOUNDATION, Factions.CHAOS]) {
                const factionState = systemState[faction];
                if (!factionState || Object.keys(factionState).length === 0) continue;

                const hierarchies = {};
                const groups = {};

                // Separar jerarquías de grupos
                for (const key in factionState) {
                  if (key === "basic" || key === "leader" || key === "commander") {
                    hierarchies[key] = factionState[key];
                  } else {
                    groups[key] = factionState[key];
                  }
                }

                const factionLabel = faction === Factions.FOUNDATION ? "Foundation" : "Chaos";

                // Mostrar jerarquías (no especiales)
                if (Object.keys(hierarchies).length > 0) {
                  debugWarn(
                    "commandMenu",
                    `  ${factionLabel} [No Especiales]: ${JSON.stringify(hierarchies)}`,
                    "dark_gray"
                  );
                }

                // Mostrar grupos (especiales)
                if (Object.keys(groups).length > 0) {
                  debugWarn("commandMenu", `  ${factionLabel} [Especiales]: ${JSON.stringify(groups)}`, "green");
                }
              }
            }
            debugWarn("commandMenu", `=== End Parsed States ===`, "yellow");

            // 6. Guardar todos los estados
            saveSystemStates(parsedStates);

            // 7. Aplicar todos los sistemas (pasamos jugador para posibles auto-tame)
            applySystemsToAll(systemIds, player.dimension, player);

            // 8. Mensaje de confirmación
            try {
              const factionLabel = selectedFaction === Factions.FOUNDATION ? "Foundation" : "Chaos";
              const msg = `§a[SISTEMAS] ${player.name} configuró ${factionLabel}: ${systems.map((s) => s.displayName).join(", ")}`;
              world.sendMessage(msg);
            } catch (e) {
              debugWarn("commandMenu", `Error enviando mensaje de confirmacion: ${e}`, "red");
            }

            // 9. Preguntar si quiere configurar el otro bando
            askConfigureOtherFaction(player, systems, selectedFaction, isAllCategory, categoryId);
          })
          .catch((err) => {
            debugWarn("menuSystem", `Error en formulario de sistema: ${err}`, "red");
          });
      } catch (showErr) {
        debugWarn("menuSystem", `Error mostrando formulario: ${showErr}`, "red");
        player.sendMessage("§c[ERROR] No se pudo mostrar el formulario de sistemas.");
      }
    });
  } catch (e) {
    debugWarn("commandMenu", `Error mostrando formulario de sistema: ${e}`, "red");
  }
}

/**
 * Pregunta si el usuario quiere configurar el otro bando
 */
function askConfigureOtherFaction(player, systems, currentFaction, isAllCategory, categoryId) {
  const otherFaction = currentFaction === Factions.FOUNDATION ? Factions.CHAOS : Factions.FOUNDATION;
  const otherLabel = otherFaction === Factions.FOUNDATION ? "§lFoundation" : "§2§lChaos";

  const form = new ActionFormData()
    .title("Configuración Completada")
    .body(`§a¡Configuración guardada!\n\n§7¿Deseas configurar el otro bando?`);

  form.button(`Configurar ${otherLabel}`);
  form.button("§8« Volver al menú");

  system.run(() => {
    form
      .show(player)
      .then((res) => {
        if (!res || res.canceled || res.selection === 1) {
          goBack(player, categoryId);
          return;
        }

        // Configurar el otro bando
        showSystemFormForFaction(player, systems, otherFaction, isAllCategory, categoryId);
      })
      .catch((err) => {
        debugWarn("commandMenu", `Error en askConfigureOtherFaction: ${err}`, "red");
      });
  });
}

/**
 * Vuelve al menú anterior
 */
function goBack(player, categoryId) {
  if (categoryId) {
    import("../menu_config.js").then((configModule) => {
      const category = configModule.getCategoryConfig(categoryId);
      const hasSingleSystem = category && category.systems && category.systems.length === 1;
      const isAll = categoryId === "all";

      if (hasSingleSystem || isAll) {
        import("../builder/menu.js").then((module) => {
          system.run(() => {
            module.buildAndShowMenu(player);
          });
        });
      } else {
        import("./menu_category.js").then((module) => {
          system.run(() => {
            module.showCategoryMenu(player, categoryId);
          });
        });
      }
    });
  } else {
    import("../builder/menu.js").then((module) => {
      system.run(() => {
        module.buildAndShowMenu(player);
      });
    });
  }
}
