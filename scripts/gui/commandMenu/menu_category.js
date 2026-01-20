// scripts/gui/commandMenu/menu_category.js
import { system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { debugWarn } from "../../utils/debug.js";

import { getCategoryConfig, getSystemsByCategory } from "./menu_config.js";
import { showSystemMenu } from "./menu_system.js";
import { showScopeMenu } from "./menu_scope_ui.js";

/**
 * Muestra el menú de una categoría específica
 * @param {Player} player
 * @param {string} categoryId
 */
export function showCategoryMenu(player, categoryId) {
  try {
    const category = getCategoryConfig(categoryId);
    if (!category) {
      debugWarn("commandMenu", `Categoría no encontrada: ${categoryId}`, "red");
      return;
    }

    const systems = getSystemsByCategory(categoryId);

    // Si la categoría es "all", mostrar el formulario combinado
    if (categoryId === "all") {
      showSystemMenu(player, systems, true, categoryId); // true = isAllCategory
      return;
    }

    // Si solo hay un sistema, ir directo a su formulario
    if (systems.length === 1) {
      showSystemMenu(player, systems, false, categoryId);
      return;
    }

    // Si hay múltiples sistemas, mostrar menú de selección
    const form = new ActionFormData().title(`${category.displayName}`);

    // Solo agregar body si hay descripción
    if (category.description) {
      form.body(`§7${category.description}\n\n§7Selecciona un sistema para configurar:`);
    } else {
      form.body("§7Selecciona un sistema para configurar:");
    }

    // Agregar botones para cada sistema
    systems.forEach((sys) => {
      // Si la descripción está vacía, no agregar salto de línea
      const buttonText = sys.description ? `${sys.displayName}\n§r§7${sys.description}` : sys.displayName;
      form.button(buttonText);
    });

    // Agregar botón para configurar todos
    form.button(`§lConfigurar Todos\n§r§8todos los sistemas de esta categoría`);

    // Si es la categoría "advanced", agregar botón de Alcance
    const isAdvanced = categoryId === "advanced";
    if (isAdvanced) {
      form.button("§eConfigurar Alcance\n§8Define a quién se aplican los cambios");
    }

    // Agregar botón de volver
    form.button("§8« Volver al menú principal");

    system.run(() => {
      form.show(player).then((res) => {
        // Si el usuario canceló, volver al menú principal
        if (!res || res.canceled) {
          import("./menu.js").then((module) => {
            system.run(() => {
              module.buildAndShowMenu(player);
            });
          });
          return;
        }

        const selectedIndex = res.selection;
        if (selectedIndex === undefined || selectedIndex < 0) return;

        // Calcular índices según si es advanced o no
        const configureAllIndex = systems.length;
        const scopeIndex = isAdvanced ? systems.length + 1 : -1;
        const backIndex = isAdvanced ? systems.length + 2 : systems.length + 1;

        // Botón "Volver"
        if (selectedIndex === backIndex) {
          import("./menu.js").then((module) => {
            module.buildAndShowMenu(player);
          });
          return;
        }

        // Botón "Configurar Alcance" (solo en advanced)
        if (isAdvanced && selectedIndex === scopeIndex) {
          showScopeMenu(player);
          return;
        }

        // Botón "Configurar Todos"
        if (selectedIndex === configureAllIndex) {
          showSystemMenu(player, systems, false, categoryId);
          return;
        }

        // Sistema individual
        const selectedSystem = systems[selectedIndex];
        if (selectedSystem) {
          showSystemMenu(player, [selectedSystem], false, categoryId);
        }
      });
    });
  } catch (e) {
    debugWarn("commandMenu", `Error mostrando menú de categoría: ${e}`, "red");
  }
}
