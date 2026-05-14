// scripts\gui\commandMenu\menu.js
import { world, system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { debugWarn } from "../../../utils/debug.js";

// Importar módulos de configuración y lógica
import { getOrderedCategories } from "../menu_config.js";
import { showCategoryMenu } from "../ui/menu_category.js";
import { showGroupsMenu } from "../ui/menu_groups_ui.js";

/**
 * Construye y muestra el menú principal de categorías
 */
function buildAndShowMenu(player) {
  try {
    debugWarn("commandMenu", "=== Iniciando buildAndShowMenu ===", "cyan");

    const categories = getOrderedCategories();

    const form = new ActionFormData().title("SCPDystopia | Panel de Comandos").body(`§7Selecciona una categoría:`);

    // Botón para configurar grupos de especiales
    form.button("§9Grupos de Especiales\n§8Asigna especiales a grupos A-D");

    // Agregar botones para cada categoría
    categories.forEach((category) => {
      const buttonText = category.description
        ? `${category.displayName}\n§r§7${category.description}`
        : category.displayName;
      form.button(buttonText);
    });

    // Mostrar el formulario
    system.run(() => {
      form
        .show(player)
        .then((res) => {
          if (!res || res.canceled) {
            debugWarn("commandMenu", "Formulario cancelado", "yellow");
            return;
          }

          const selectedIndex = res.selection;
          if (selectedIndex === undefined || selectedIndex < 0) {
            return;
          }

          // Botón 0: Grupos de especiales
          if (selectedIndex === 0) {
            showGroupsMenu(player);
            return;
          }

          // Categorías (índice - 1 porque hay 1 botón antes)
          const categoryIndex = selectedIndex - 1;
          const selectedCategory = categories[categoryIndex];
          if (!selectedCategory) {
            debugWarn("commandMenu", `Categoría no encontrada en índice ${categoryIndex}`, "red");
            return;
          }

          showCategoryMenu(player, selectedCategory.id);
        })
        .catch((err) => {
          debugWarn("commandMenu", `Error en form.show: ${err}`, "red");
        });
    });
  } catch (e) {
    debugWarn("commandMenu", `Error mostrando menu principal: ${e}`, "red");
  }
}

export { buildAndShowMenu };
