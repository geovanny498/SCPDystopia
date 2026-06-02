// scripts/gui/commandMenu/menu_scope.ts
import { world, Entity } from "@minecraft/server";
import { debugWarn } from "../../../utils/debug.js";
import { ENTITY_GLOBAL_OVERWRITE_PROPERTY } from "../../interactMenu/gui.js";

export interface ScopeData {
  respectEntityBlocks: boolean;
}

/**
 * Sistema de Prioridad de Aplicación (Scope)
 *
 * Define A QUIÉN se aplican los cambios del menú de comandos.
 * Es independiente del formulario de sistemas (que define QUÉ se hace).
 *
 * El scope se guarda en dynamic properties y persiste hasta que el jugador lo cambie.
 */

const SCOPE_PROPERTY = "scpd_menu_scope";
const DEFAULT_RESPECT_ENTITY_BLOCKS = true;

/**
 * Cache del scope en memoria para evitar cargas duplicadas
 */
let scopeCache: ScopeData | null = null;

/**
 * Genera el scope por defecto
 */
function generateDefaultScope(): ScopeData {
  return {
    respectEntityBlocks: DEFAULT_RESPECT_ENTITY_BLOCKS,
  };
}

/**
 * Migra un scope antiguo al nuevo formato simplificado
 */
function migrateOldScope(oldScope: unknown): ScopeData {
  debugWarn("menuScope", "Migrando scope antiguo al nuevo formato simplificado", "yellow");
  return generateDefaultScope();
}

/**
 * Carga el scope desde dynamic properties
 */
export function loadScope(forceReload = false): ScopeData {
  try {
    if (scopeCache && !forceReload) {
      debugWarn("menuScope", "Scope cargado desde cache en memoria", "gray");
      return scopeCache;
    }

    const raw = world.getDynamicProperty(SCOPE_PROPERTY);

    if (!raw) {
      debugWarn("menuScope", "No hay scope guardado, generando defaults", "yellow");
      const defaultScope = generateDefaultScope();
      scopeCache = defaultScope;
      return defaultScope;
    }

    debugWarn("menuScope", "Scope cargado desde propiedades dinámicas", "cyan");
    const parsed = JSON.parse(raw as string);

    if (typeof parsed.respectEntityBlocks !== "boolean") {
      debugWarn("menuScope", "Scope antiguo o inválido, migrando a formato simplificado", "yellow");
      const migratedScope = migrateOldScope(parsed);
      saveScope(migratedScope);
      scopeCache = migratedScope;
      return migratedScope;
    }

    scopeCache = parsed;
    return parsed;
  } catch (e) {
    debugWarn("menuScope", `Error cargando scope: ${e}`, "red");
    const defaultScope = generateDefaultScope();
    scopeCache = defaultScope;
    return defaultScope;
  }
}

/**
 * Guarda el scope en dynamic properties
 */
export function saveScope(scope: ScopeData): void {
  try {
    const serialized = JSON.stringify(scope);
    world.setDynamicProperty(SCOPE_PROPERTY, serialized);
    scopeCache = scope;
    debugWarn("menuScope", "Scope guardado correctamente", "green");
  } catch (e) {
    debugWarn("menuScope", `Error guardando scope: ${e}`, "red");
  }
}

/**
 * Verifica si una entidad está dentro del scope actual
 * ACTUALIZADO: Ahora verifica por jerarquía específica para no especiales
 * @param {Entity} ent
 * @param {string} faction - "foundation" | "chaos"
 * @param {boolean} isSpecial
 * @param {string} nameTag - nameTag de la entidad
 * @param {Object} scope - Scope actual (opcional)
 * @param {string} hierarchy - Jerarquía de la entidad (basic/leader/commander) para no especiales
 */
export function isEntityInScope(
  ent: Entity,
  faction: string,
  isSpecial: boolean,
  nameTag: string,
  scope: ScopeData | null = null,
  hierarchy: string | null = null
): boolean {
  if (!scope) {
    scope = loadScope();
  }

  if (!scope || typeof scope.respectEntityBlocks !== "boolean") {
    debugWarn("menuScope", "Scope no válido, usando valores por defecto", "yellow");
    scope = generateDefaultScope();
  }

  const entityLabel = nameTag || (ent && ent.typeId) || "<unknown>";

  if (scope.respectEntityBlocks === false) {
    debugWarn("menuScope:check", `${entityLabel}: scope fuerza configuración global => EN SCOPE`, "green");
    return true;
  }

  if (!ent || typeof ent.getDynamicProperty !== "function") {
    debugWarn("menuScope:check", `${entityLabel}: entidad inválida, no se puede aplicar bloqueo`, "yellow");
    return true;
  }

  try {
    const raw = ent.getDynamicProperty(ENTITY_GLOBAL_OVERWRITE_PROPERTY);
    const allowGlobalOverwrite = normalizeBooleanDynamicProperty(raw);
    const blocked = allowGlobalOverwrite === false;
    debugWarn(
      "menuScope:check",
      `${entityLabel}: respetar bloqueos=true, allowGlobalOverwrite=${allowGlobalOverwrite} (raw=${raw}) => ${blocked ? "FUERA DE SCOPE" : "EN SCOPE"}`,
      blocked ? "gray" : "green"
    );
    return !blocked;
  } catch (e) {
    debugWarn("menuScope:check", `Error leyendo propiedad de entidad: ${e}`, "red");
    return true;
  }
}

/**
 * Obtiene un resumen legible del scope actual
 */
function normalizeBooleanDynamicProperty(raw: unknown): boolean | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (raw === true || raw === "true" || raw === 1 || raw === "1") return true;
  if (raw === false || raw === "false" || raw === 0 || raw === "0") return false;
  return undefined;
}

export function getScopeSummary(scope: ScopeData | null): string {
  if (!scope || typeof scope.respectEntityBlocks !== "boolean") {
    scope = generateDefaultScope();
  }

  return `§7Prefiere configuración local: §r${scope.respectEntityBlocks ? "§aON§r" : "§cOFF§r"}\n§7Cuando está OFF, el menú global aplica a todas las unidades.`;
}

/**
 * Reinicia el scope a valores por defecto
 */
export function resetScope(): ScopeData {
  try {
    debugWarn("menuScope", "=== INICIANDO RESET DE SCOPE ===", "cyan");
    const newScope = generateDefaultScope();
    saveScope(newScope);
    debugWarn("menuScope", "Scope reiniciado a valores por defecto", "green");
    return newScope;
  } catch (e) {
    debugWarn("menuScope", `Error reseteando scope: ${e}`, "red");
    const defaultScope = generateDefaultScope();
    scopeCache = defaultScope;
    return defaultScope;
  }
}
