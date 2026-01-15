import { world } from "@minecraft/server";

// =====================
// Configuración global
// =====================

// Se puede aprovechar npm run deploy:production para vaciar casi todo debug.js
// incluyendo estas constantes
export const DEBUG = false; // Mensajes en el chat
export const DEBUG_CONSOLE = true; // Mensajes en consola

/*
=== CONFIGURACIONES PREESTABLECIDAS ===

PASO 1: Probar el sistema de scope (UI)
Descomenta:
- "menuScope"

PASO 2: Verificar aplicación a entidades existentes
Descomenta:
- "menuScope"
- "menuScope:check"
- "menuApply"
- "menuApply:entity"

PASO 3: Verificar aplicación a entidades futuras (spawn/load)
Descomenta:
- "menuScope"
- "menuScope:check"
- "menuEvents"
- "menuEvents:spawn"
- "menuRules:apply"

PASO 4: Debug completo (todo)
Usa: ["*"]
*/

/*
Filtros por archivo/módulo
- []            → no muestra nada
- ["*"]         → muestra todo
- ["toggle_system", "commandMenu"]

Módulos del Sistema de Menú:
- commandMenu       → Flujo general del menú (menu.js)
- menuSystem        → Formularios de sistemas (menu_system.js)
- menuCategory      → Menú de categorías (menu_category.js)
- menuBuilder       → Construcción de formularios (menu_builder.js)
- menuState         → Gestión de estados (menu_state.js)
- menuApply         → Aplicación de sistemas (menu_apply.js)
- menuApply:entity  → Aplicación por entidad (detallado)
- menuEvents        → Eventos de spawn/load (menu_events.js)
- menuEvents:spawn  → Solo eventos de spawn (detallado)
- menuRules         → Verificación de reglas (menu_rules.js)
- menuRules:compat  → Solo verificación de compatibilidad (detallado)
- menuRules:apply   → Solo verificación de applyMode (detallado)
- menuScope         → Sistema de alcance de aplicación (menu_scope.js)
- menuScope:check   → Verificación individual de entidades en scope (detallado)

Módulos de Sistemas Legacy:
- applySystems      → Sistema de aplicación antiguo
- toggle_system     → Sistema de toggle antiguo
- toggle_entity     → Interacción con entidades
- playerInteractWithEntity → Interacción jugador-entidad

Otros:
- dynamicProperties → Propiedades dinámicas del mundo
*/
export const DEBUG_MODULES = [
  // === PRUEBA DE GUI MIGRADO ===
  "playerInteractWithEntity", // Interacción jugador-entidad (GUI)
  // "projectileHitEntity",
  // === PASO 2: VERIFICAR APLICACIÓN A ENTIDADES EXISTENTES ===
  "menuScope", // Ver verificación de scope
  "menuScope:check", // Ver cada verificación individual de entidad
  "menuApply", // Ver aplicación general de sistemas
  "menuApply:entity", // Ver aplicación detallada por entidad

  // === DEPURACIÓN DE APPLYMODE (existing_only) ===
  // "menuEvents:spawn",   // Ver qué pasa cuando spawna una entidad
  // "menuRules:apply",    // Ver verificación de applyMode

  // === MENÚ: FLUJO GENERAL ===
  // "commandMenu",        // Flujo general del menú
  // "menuSystem",         // Formularios de sistemas
  // "menuCategory",       // Menú de categorías
  // "menuBuilder",        // Construcción de formularios

  // === MENÚ: ESTADOS ===
  // "menuState",          // Gestión de estados (guardar/cargar)

  // === MENÚ: APLICACIÓN ===
  // Ya activado arriba para Paso 2

  // === MENÚ: EVENTOS ===
  // "menuEvents",         // Eventos de spawn/load (general)

  // === MENÚ: REGLAS (NUEVO) ===
  // "menuRules",          // Verificación de reglas (general)
  // "menuRules:compat",   // Solo verificación de compatibilidad

  // === SISTEMAS LEGACY ===
  // "applySystems",       // Sistema de aplicación antiguo
  // "toggle_system",      // Sistema de toggle antiguo
  // "toggle_entity",      // Interacción con entidades

  // === OTROS ===
  // "dynamicProperties"   // Propiedades dinámicas del mundo
];

function isModuleEnabled(module) {
  return DEBUG_MODULES.includes("*") || DEBUG_MODULES.includes(module);
}

// =====================
// Utilidades de color
// =====================

// Colores para chat (Minecraft §)
const CHAT_COLORS = {
  gray: "§7",
  red: "§c",
  green: "§a",
  yellow: "§e",
  blue: "§9",
  aqua: "§b",
  magenta: "§d",
  white: "§f",
  dark: "§8",
  reset: "§r",
};

// Colores para consola (ANSI)
const CONSOLE_COLORS = {
  gray: 90,
  red: 31,
  green: 32,
  yellow: 33,
  blue: 34,
  magenta: 35,
  cyan: 36,
  white: 37,
};

// =====================
// Consola (console.log)
// =====================

/**
 * Muestra mensajes de debug en la consola del servidor.
 * Úsalo para información general durante el desarrollo.
 * Requiere DEBUG_CONSOLE = true
 *
 * @param {string} module - Nombre del módulo (debe estar en DEBUG_MODULES)
 * @param {string} message - Mensaje a mostrar
 * @param {string} color - Color del texto (gray, red, green, yellow, blue, magenta, cyan, white)
 *
 * @example debugMessage("menuApply", "Aplicando sistema a entidad", "green");
 */
export function debugMessage(module, message, color = "gray") {
  dev: {
    if (!DEBUG_CONSOLE || !isModuleEnabled(module)) return;

    const c = CONSOLE_COLORS[color.toLowerCase()] ?? CONSOLE_COLORS.gray;
    console.log(`\x1b[${c}m[DEBUG:${module}] ${message}\x1b[0m`);
  }
}

/**
 * Muestra advertencias en la consola del servidor.
 * Úsalo para situaciones inesperadas o potencialmente problemáticas.
 * Requiere DEBUG_CONSOLE = true
 *
 * @param {string} module - Nombre del módulo (debe estar en DEBUG_MODULES)
 * @param {string} message - Mensaje de advertencia
 * @param {string} color - Color del texto (por defecto yellow)
 *
 * @example debugWarn("menuRules", "Sistema incompatible detectado", "red");
 */
export function debugWarn(module, message, color = "yellow") {
  dev: {
    if (!DEBUG_CONSOLE || !isModuleEnabled(module)) return;

    const c = CONSOLE_COLORS[color.toLowerCase()] ?? CONSOLE_COLORS.yellow;
    console.warn(`\x1b[${c}m[WARN:${module}] ${message}\x1b[0m`);
  }
}

// =====================
// Chat del juego
// =====================

/**
 * Muestra mensajes de debug en el chat del juego.
 * Úsalo cuando necesites ver información en tiempo real mientras juegas.
 * Requiere DEBUG = true
 *
 * @param {string} module - Nombre del módulo (debe estar en DEBUG_MODULES)
 * @param {string} message - Mensaje a mostrar en el chat
 * @param {string} color - Color del texto (gray, red, green, yellow, blue, aqua, magenta, white)
 *
 * @example debugChat("menuScope", "Verificando 5 entidades en el scope", "aqua");
 */
export function debugChat(module, message, color = "gray") {
  dev: {
    if (!DEBUG || !isModuleEnabled(module)) return;

    const c = CHAT_COLORS[color.toLowerCase()] ?? CHAT_COLORS.gray;
    world.sendMessage(`${CHAT_COLORS.dark}[DEBUG:${module}]${CHAT_COLORS.reset} ${c}${message}${CHAT_COLORS.reset}`);
  }
}
