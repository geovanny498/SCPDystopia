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
 *   // ── ACTIVOS ──────────────────────────────────────────────────────────────
 *   // Módulos con spam controlado (volumen bajo por diseño)
 *
 *   // ── COMENTADOS ───────────────────────────────────────────────────────────
 *   // Módulos comentados: intensivos en volumen. Descomentar solo para depuración
 *   // específica y volver a comentar después.
 */
export const DEBUG_MODULES: string[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // ACTIVOS — Scope y aplicación de sistemas
  // ═══════════════════════════════════════════════════════════════════════════
  "menuScope", // Carga/guardado del scope global
  "menuScope:check", // Verificación isEntityInScope por cada entidad
  "menuApply", // Aplicación de sistemas (resumen)
  "menuApply:entity", // Aplicación de sistemas por entidad individual
  "menuState", // Guardado/fusión de estados de sistemas
  "menuRules", // Reglas de compatibilidad (resumen)
  "menuRules:apply", // shouldApplyToFutureEntities por sistema
  "menuRules:compat", // canApplySystem verificación de requisitos
  "menuGroups", // Asignación y lectura de grupos de especiales
  "menuGroups:ui", // UI del menú de grupos

   // ═══════════════════════════════════════════════════════════════════════════
  // ACTIVOS PARA PRUEBAS DE OPTIMIZACIÓN — Verificar scanner y sincronización
  // ═══════════════════════════════════════════════════════════════════════════
  "menuScanner", // Cache de entidades (getEntitiesCached)
  "menuScanner:base", // Escaneo base de entidades (scanActiveEntities)
  "menuScanner:buckets", // Bucketing posterior (scanActiveUnits)
  // "menuScanner:ent",   // Detalle por entidad (COMENTAR: muy verboso)
  "menuEvents:spawn", // Sincronización de grupos en spawn (crítico para pruebas)
  "menuSystem", // Construcción de formularios y buckets
  "menuFaction", // Detección de facción/jerarquía (verificar clasificación)

  // ═══════════════════════════════════════════════════════════════════════════
  // COMENTADOS — Alto volumen, descomentar solo para depuración específica
  // ═══════════════════════════════════════════════════════════════════════════

  // Formularios y construcción de menús
  // "menuBuilder",       // Construcción de formularios (buildSystemForm / parseSystemFormValues)
  // "menuEvents",        // Event listeners generales del menú
  // "menuEvents:remove", // Evento de entityRemove
  // "commandMenu",       // Menú principal de ActionForm

  // Interacción con entidades (interactMenu)
  // "playerInteractWithEntity", // Evento playerInteractWithEntity (cada clic en unidad)

  // Teleport (compatibilidad legacy — eliminar al completar migración)
  // "teleportLogic",         // Lógica de teletransporte
  // "teleportLogic:error",   // Errores en teletransporte
  // "teleportUtils",         // Utilidades de teletransporte
  // "teleportUtils:all",     // Teletransporte de todos los tipos
  // "teleportUtils:normal",  // Teletransporte de unidades normales
  // "teleportUtils:special", // Teletransporte de unidades especiales

  // Otros sistemas
  // "dynamicProperties",     // Propiedades dinámicas del mundo
  // "entityDamageConfig",    // Configuración de daño de entidades
  // "knockback",             // Sistema de knockback
  // "modifiedDamageNumber",  // Daño modificado
  // "player",                // Eventos de jugador (login/join)
  // "projectileHitEntity",   // Evento de impacto de proyectil
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
