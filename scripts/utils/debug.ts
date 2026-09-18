import { world } from "@minecraft/server";

// =====================
// Configuración global
// =====================

export const DEBUG = false; // Mensajes en el chat
export const DEBUG_CONSOLE = true; // Mensajes en consola

/**
 * Módulos activos detectados en el codebase.
 * Cualquier string es válido para máxima flexibilidad.
 *
 * Formato de secciones:
 *  - ACTIVOS:
 *   Módulos con spam controlado (volumen bajo por diseño)
 *
 *   - COMENTADOS:
 *   Módulos comentados: intensivos en volumen. Descomentar solo para depuración
 *   específica y volver a comentar después.
 */
export const DEBUG_MODULES: string[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // DEPURACIÓN DE DAÑO — Activos para verificar aplicación de daño
  // ═══════════════════════════════════════════════════════════════════════════
  // "projectileHitEntity",
  // "damage",
  "entityDie",
  "menuGroups",
  "menuFaction",
  // "menuEvents",
  "menuEvents:spawn",
  // "projectileSound",
  // "entityDamageConfig",

  // ═══════════════════════════════════════════════════════════════════════════
  // MONITOR REACTIVO — Activo para depurar transición a DDUI 2.1.0
  // ═══════════════════════════════════════════════════════════════════════════
  "monitorCommand",
  "interactDDUI",
  "interactTrigger",
  "commandMenuDDUI",
  "roleMenu",
  "lifecycle",
  "scope",
  // "player",
  // "menuScanner",
  // "menuScanner:buckets",
  // "menuScanner:base",
  // "menuScanner:base:ent",
  // "zoom",
];

/**
 * Verifica si un módulo está habilitado para debug.
 * @param module
 * @returns
 */
function isModuleEnabled(module: string): boolean {
  return DEBUG_MODULES.includes("*") || DEBUG_MODULES.includes(module);
}

// =====================
// Utilidades de color
// =====================

// Colores para chat (Minecraft §)
const CHAT_COLORS: Record<string, string> = {
  black: "§0",
  dark_blue: "§1",
  dark_green: "§2",
  dark_aqua: "§3",
  dark_red: "§4",
  dark_purple: "§5",
  orange: "§6",
  gray: "§7",
  dark: "§8",
  blue: "§9",
  green: "§a",
  aqua: "§b",
  red: "§c",
  magenta: "§d",
  yellow: "§e",
  white: "§f",
  reset: "§r",
};

// =====================
// Colores legacy (debugMessage/debugWarn/debugChat)
// NO usar en código nuevo — usar MC_NAMED_COLORS + debug()
// =====================

// Colores para consola legacy (ANSI truecolor 24-bit, con nombres no oficiales)
const CONSOLE_COLORS: Record<string, string> = {
  black: "\x1b[38;2;0;0;0m",
  dark_blue: "\x1b[38;2;0;0;170m",
  dark_green: "\x1b[38;2;0;170;0m",
  dark_aqua: "\x1b[38;2;0;170;170m",
  dark_red: "\x1b[38;2;170;0;0m",
  dark_purple: "\x1b[38;2;170;0;170m",
  orange: "\x1b[38;2;255;170;0m",
  gray: "\x1b[38;2;170;170;170m",
  dark: "\x1b[38;2;85;85;85m",
  blue: "\x1b[38;2;85;85;255m",
  green: "\x1b[38;2;85;255;85m",
  cyan: "\x1b[38;2;85;255;255m",
  aqua: "\x1b[38;2;85;255;255m",
  red: "\x1b[38;2;255;85;85m",
  magenta: "\x1b[38;2;255;85;255m",
  purple: "\x1b[38;2;170;0;170m",
  yellow: "\x1b[38;2;255;255;85m",
  white: "\x1b[38;2;255;255;255m",
};

// =====================
// Colores oficiales Minecraft → ANSI (única fuente)
// =====================

// Valores ANSI únicos: nombres oficiales → truecolor ANSI (fuente única de RGB)
const MC_NAMED_COLORS: Record<string, string> = {
  black: "\x1b[38;2;0;0;0m",
  dark_blue: "\x1b[38;2;0;0;170m",
  dark_green: "\x1b[38;2;0;170;0m",
  dark_aqua: "\x1b[38;2;0;170;170m",
  dark_red: "\x1b[38;2;170;0;0m",
  dark_purple: "\x1b[38;2;170;0;170m",
  gold: "\x1b[38;2;255;170;0m",
  gray: "\x1b[38;2;170;170;170m",
  dark_gray: "\x1b[38;2;85;85;85m",
  blue: "\x1b[38;2;85;85;255m",
  green: "\x1b[38;2;85;255;85m",
  aqua: "\x1b[38;2;85;255;255m",
  red: "\x1b[38;2;255;85;85m",
  light_purple: "\x1b[38;2;255;85;255m",
  yellow: "\x1b[38;2;255;255;85m",
  white: "\x1b[38;2;255;255;255m",
  // Material colors (Bedrock)
  minecoin_gold: "\x1b[38;2;221;214;5m",
  material_quartz: "\x1b[38;2;227;212;209m",
  material_iron: "\x1b[38;2;206;202;202m",
  material_netherite: "\x1b[38;2;68;58;59m",
  material_redstone: "\x1b[38;2;151;22;7m",
  material_copper: "\x1b[38;2;180;104;77m",
  material_gold: "\x1b[38;2;222;177;45m",
  material_emerald: "\x1b[38;2;71;160;54m",
  material_diamond: "\x1b[38;2;44;186;168m",
  material_lapis: "\x1b[38;2;33;73;123m",
  material_amethyst: "\x1b[38;2;154;92;198m",
  material_resin: "\x1b[38;2;235;114;20m",
  light_blue: "\x1b[38;2;139;179;255m",
  // Códigos de formato
  bold: "\x1b[1m",
  italic: "\x1b[3m",
  reset: "\x1b[0m",
};

// Resolución § code → nombre oficial (sin duplicar valores ANSI)
const MC_CODE_TO_NAME: Record<string, string> = {
  "§0": "black",
  "§1": "dark_blue",
  "§2": "dark_green",
  "§3": "dark_aqua",
  "§4": "dark_red",
  "§5": "dark_purple",
  "§6": "gold",
  "§7": "gray",
  "§8": "dark_gray",
  "§9": "blue",
  "§a": "green",
  "§b": "aqua",
  "§c": "red",
  "§d": "light_purple",
  "§e": "yellow",
  "§f": "white",
  "§g": "minecoin_gold",
  "§h": "material_quartz",
  "§i": "material_iron",
  "§j": "material_netherite",
  "§m": "material_redstone",
  "§n": "material_copper",
  "§p": "material_gold",
  "§q": "material_emerald",
  "§s": "material_diamond",
  "§t": "material_lapis",
  "§u": "material_amethyst",
  "§v": "material_resin",
  "§w": "light_blue",
  "§k": "", // obfuscated — sin equivalente ANSI
  "§l": "bold",
  "§o": "italic",
  "§r": "reset",
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

    const c = CONSOLE_COLORS[color.toLowerCase()] ?? CONSOLE_COLORS.gray;
    console.log(`${c}[DEBUG:${module}] ${message}\x1b[0m`);
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

    const c = CONSOLE_COLORS[color.toLowerCase()] ?? CONSOLE_COLORS.yellow;
    console.warn(`${c}[WARN:${module}] ${message}\x1b[0m`);
  }
}

// =====================
// Consola con formato Minecraft → ANSI
// =====================

/**
 * Convierte códigos de formato Minecraft (§x) en secuencias ANSI para que
 * los colores se rendericen en la consola del servidor. Los códigos que no
 * tengan equivalente ANSI (p.ej. §k) se eliminan.
 * @param text Texto con posibles códigos de color Minecraft.
 * @returns Texto con códigos convertidos a ANSI.
 */
function convertMCtoANSI(text: string): string {
  return text.replace(/§[0-9a-w]/gi, (code) => {
    const name = MC_CODE_TO_NAME[code];
    return name ? MC_NAMED_COLORS[name] ?? "" : "";
  });
}

/**
 * Opciones para la función `debug`.
 */
export type DebugColor = keyof typeof MC_NAMED_COLORS;

export interface DebugOptions {
  /** Nivel de severidad. Determina el prefijo y el método de consola. */
  level?: "debug" | "warn" | "error";
  /** Color base del texto. Por defecto `"gray"`. */
  color?: DebugColor;
}

/**
 * Función unificada de debug para consola. Convierte códigos de color Minecraft
 * (`§x`) a ANSI truecolor y re-aplica el color base tras cada `§r` para evitar
 * bleed. Usar esta función (no `debugMessage`/`debugWarn`) en código nuevo.
 *
 * Requiere `DEBUG_CONSOLE = true`.
 *
 * @param module - Nombre del módulo
 * @param message - Mensaje a mostrar (puede contener códigos `§x`)
 * @param options - Opciones de color y nivel de severidad
 */
export function debug(module: string, message: string, options: DebugOptions = {}): void {
  dev: {
    if (!DEBUG_CONSOLE || !isModuleEnabled(module)) return;

    const level = options.level ?? "debug";
    const colorName = (options.color ?? "gray").toLowerCase();
    const color = MC_NAMED_COLORS[colorName] ?? MC_NAMED_COLORS.gray;
    const prefix =
      level === "warn" ? `[WARN:${module}]` : level === "error" ? `[ERROR:${module}]` : `[DEBUG:${module}]`;
    const converted = convertMCtoANSI(message);
    const restored = converted.replace(/\x1b\[0m/g, `\x1b[0m${color}`);
    const output = `${color}${prefix} ${restored}\x1b[0m`;

    if (level === "warn") {
      console.warn(output);
    } else if (level === "error") {
      console.error(output);
    } else {
      console.log(output);
    }
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
