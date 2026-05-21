import { world } from "@minecraft/server";

// =====================
// Configuración global
// =====================

export const DEBUG = false; // Mensajes en el chata
export const DEBUG_CONSOLE = true; // Mensajes en consola

/**
 * Módulos activos detectados en el codebase.
 * Cualquier string es válido para máxima flexibilidad.
 */
export const DEBUG_MODULES: string[] = [
  "menuScanner",
  "menuScanner:ent",
  "menuSystem",
  "menuBuilder",
  "menuFaction",
  "menuEvents:spawn",
  "commandMenu",
];

function isModuleEnabled(module: string): boolean {
  return DEBUG_MODULES.includes("*") || DEBUG_MODULES.includes(module);
}

// =====================
// Utilidades de color
// =====================

// Colores para chat (Minecraft §)
const CHAT_COLORS: Record<string, string> = {
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
const CONSOLE_COLORS: Record<string, number> = {
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
 * @param module - Nombre del módulo
 * @param message - Mensaje a mostrar
 * @param color - Color del texto
 */
export function debugMessage(module: string, message: string, color: string = "gray"): void {
  // El bloque "dev" es para ignorar esta función en producción al eliminarla con herramientas de bundling como esbuild o webpack
  dev: {
    if (!DEBUG_CONSOLE || !isModuleEnabled(module)) return;

    const c = (CONSOLE_COLORS[color.toLowerCase()] ?? CONSOLE_COLORS.gray) as number;
    console.log(`\x1b[${c}m[DEBUG:${module}] ${message}\x1b[0m`);
  }
}

/**
 * Muestra advertencias en la consola del servidor.
 * Úsalo para situaciones inesperadas o potencialmente problemáticas.
 * Requiere DEBUG_CONSOLE = true
 *
 * @param module - Nombre del módulo
 * @param message - Mensaje de advertencia
 * @param color - Color del texto (por defecto yellow)
 */
export function debugWarn(module: string, message: string, color: string = "yellow"): void {
  dev: {
    if (!DEBUG_CONSOLE || !isModuleEnabled(module)) return;

    const c = (CONSOLE_COLORS[color.toLowerCase()] ?? CONSOLE_COLORS.yellow) as number;
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
 * @param module - Nombre del módulo
 * @param message - Mensaje a mostrar en el chat
 * @param color - Color del texto
 */
export function debugChat(module: string, message: string, color: string = "gray"): void {
  dev: {
    if (!DEBUG || !isModuleEnabled(module)) return;

    const c = (CHAT_COLORS[color.toLowerCase()] ?? CHAT_COLORS.gray) as string;
    world.sendMessage(`${CHAT_COLORS.dark}[DEBUG:${module}]${CHAT_COLORS.reset} ${c}${message}${CHAT_COLORS.reset}`);
  }
}
