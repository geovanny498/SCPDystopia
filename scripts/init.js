// init.js
import { system } from "@minecraft/server";
import "./components/maxDamage.js";
import "./components/killTarget.js";
import "./components/removeTarget.js";
import "./utils/weapons.js";
import "./commands/register_systems.ts";
import "./commands/register_test_commands.ts";
import "./gui/interactMenu/gui.js";
import "./gui/commandMenu/builder/menu.js";
import "./commands/config_command.js";
import "./commands/count_special_groups.ts";
import "./commands/scope_commands.js";
// import "./commands/teleport_command.js";  // TEMPORALMENTE DESHABILITADO — ver scripts/gui/teleportMenu/teleport_config.ts

// Importar funciones de inicialización del menú
import {
  initializeMenuEvents,
  getMenuSystemStates,
  getMenuSoldiers,
  getMenuSpecialSoldiers,
} from "./gui/commandMenu/core/menu_events.js";
import { injectMenuEventAccessors } from "./gui/commandMenu/core/menu_apply.js";

// Inicializar el sistema de menú DESPUÉS de que el mundo esté listo
system.afterEvents.scriptEventReceive.subscribe(() => {}, { namespaces: ["__init__"] });

system.runTimeout(() => {
  try {
    // Inyectar accessors para evitar importaciones circulares
    injectMenuEventAccessors({
      getMenuSystemStates,
      getMenuSoldiers,
      getMenuSpecialSoldiers,
    });

    // Inicializar event listeners del menú
    initializeMenuEvents();

    console.warn("[INIT] Sistema de menú inicializado correctamente");
  } catch (e) {
    console.warn(`[INIT] Error inicializando sistema de menú: ${e}`);
  }
}, 20); // 1 segundo de delay (20 ticks)

// Inicializa la lógica principal
import "./main.js";

// Lógica de SCPDystopia v1.9.0 oficial
import "./main1.js";
