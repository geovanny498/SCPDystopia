// scripts/gui/commandMenu/menu_scope_ui.js
import { system } from "@minecraft/server";
import { ModalFormData } from "@minecraft/server-ui";
import { debugWarn } from "../../../utils/debug.js";
import { loadScope, saveScope } from "../model/menu_scope.js";

/**
 * Muestra el único toggle de scope simplificado
 */
export function showScopeMenu(player) {
  try {
    debugWarn("menuScope", "=== showScopeMenu iniciado ===", "cyan");

    const currentScope = loadScope();
    const respectBlocks = currentScope?.respectEntityBlocks ?? true;

    const form = new ModalFormData()
      .title("§dPrioridad de Aplicación")
      .label(
        "§aActivado: §7Solo afecta a las unidades que tengan 'Uso de Configuración Global' activado.\n§cDesactivado: §7Forzar configuración global en todas las unidades."
      )
      .toggle("Preferir configuración local", { defaultValue: respectBlocks })
      .submitButton("§aGuardar");

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

          const allowRespect = res.formValues && res.formValues.length > 1 && res.formValues[1] === true;
          currentScope.respectEntityBlocks = allowRespect;
          saveScope(currentScope);

          player.sendMessage(
            `§a[SCOPE] Toggle guardado: ${allowRespect ? "§aPreferir configuración local" : "§cForzar configuración global en todas las unidades"}§r`
          );

          import("../builder/menu.js").then((module) => {
            system.run(() => {
              module.buildAndShowMenu(player);
            });
          });
        })
        .catch((err) => {
          debugWarn("menuScope", `Error en ModalForm: ${err}`, "red");
          import("../builder/menu.js").then((module) => {
            system.run(() => {
              module.buildAndShowMenu(player);
            });
          });
        });
    });
  } catch (e) {
    debugWarn("menuScope", `Error en showScopeMenu: ${e}`, "red");
  }
}
