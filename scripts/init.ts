// init.ts
import { system } from "@minecraft/server";

// Inicializa componentes
import "./components/maxDamage.js";
import "./components/killTarget.js";
import "./components/removeTarget.js";

// Inicializa utilidades
import "./utils/weapons.js";

// Inicializa sistemas
import "./commands/register_systems.js";
import "./commands/register_test_commands.js";

// Inicializa GUI
import "./gui/interactMenu/gui.js";
import "./gui/commandMenu/builder/menu.js";

// Inicializa comandos
import "./commands/config_command.js";
import "./commands/count_special_groups.js";
import "./commands/scope_commands.js";
import "./commands/teleport_command.js";
import "./commands/monitor_command.js";

// Importar funciones de inicialización del menú
import { initializeMenuEvents, getMenuSystemStates } from "./gui/commandMenu/core/menu_events.js";
import { injectMenuEventAccessors } from "./gui/commandMenu/core/menu_apply.js";

system.afterEvents.scriptEventReceive.subscribe(() => {}, { namespaces: ["__init__"] });

system.runTimeout(() => {
  try {
    injectMenuEventAccessors({
      getMenuSystemStates,
    });

    initializeMenuEvents();

    console.warn("[INIT] Sistema de menú inicializado correctamente");
  } catch (e) {
    console.warn(`[INIT] Error inicializando sistema de menú: ${e}`);
  }
}, 20);

// Inicializa la lógica principal
import "./main.js";

// Lógica de SCPDystopia v1.9.0 oficial
import "./main1.js";
