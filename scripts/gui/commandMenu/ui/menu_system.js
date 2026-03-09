// scripts/gui/commandMenu/menu_system.js
import { world, system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { debugWarn } from "../../../utils/debug.js";
import { Factions } from "../menu_config.js";
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

    // 2. Construir el formulario para la facción seleccionada
    const form = buildSystemForm(systems, loadedStates, selectedFaction);

    // 3. Mostrar el formulario
    system.run(() => {
      form
        .show(player)
        .then((res) => {
          debugWarn("commandMenu", `System menu result: ${JSON.stringify(res)}`, "cyan");

          if (!res || res.canceled) {
            // Volver al selector de facción
            showSystemMenu(player, systems, isAllCategory, categoryId);
            return;
          }

          const vals = res.formValues;
          debugWarn("commandMenu", `formValues array: ${JSON.stringify(vals)}`, "cyan");

          if (!Array.isArray(vals)) return;

          // 4. Parsear los valores del formulario
          const parsedStates = parseSystemFormValues(systems, vals, selectedFaction);

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

          debugWarn("commandMenu", `Parsed states: ${JSON.stringify(parsedStates)}`, "cyan");

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
          debugWarn("commandMenu", `Error en formulario de sistema: ${err}`, "red");
        });
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
