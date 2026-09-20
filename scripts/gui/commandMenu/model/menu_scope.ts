// scripts/gui/commandMenu/menu_scope.ts
import { world, Entity } from "@minecraft/server";
import { debug } from "../../../utils/debug.js";
import { ENTITY_GLOBAL_OVERWRITE_PROPERTY } from "../../shared/entityScope.js";

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
  debug("menuScope", "Migrando scope antiguo al nuevo formato simplificado", { color: "yellow", level: "warn" });
  return generateDefaultScope();
}

/**
 * Carga el scope desde dynamic properties
 */
export function loadScope(forceReload = false): ScopeData {
  try {
    if (scopeCache && !forceReload) {
      debug("menuScope", "Scope cargado desde cache en memoria", { color: "gray", level: "debug" });
      return scopeCache;
    }

    const raw = world.getDynamicProperty(SCOPE_PROPERTY);

    if (!raw) {
      debug("menuScope", "No hay scope guardado, generando defaults", { color: "yellow", level: "debug" });
      const defaultScope = generateDefaultScope();
      scopeCache = defaultScope;
      return defaultScope;
    }

    debug("menuScope", "Scope cargado desde propiedades dinámicas", { color: "aqua", level: "debug" });
    const parsed = JSON.parse(raw as string);

    if (typeof parsed.respectEntityBlocks !== "boolean") {
      debug("menuScope", "Scope antiguo o inválido, migrando a formato simplificado", { color: "yellow", level: "warn" });
      const migratedScope = migrateOldScope(parsed);
      saveScope(migratedScope);
      scopeCache = migratedScope;
      return migratedScope;
    }

    scopeCache = parsed;
    return parsed;
  } catch (e) {
    debug("menuScope", `Error cargando scope: ${e}`, { color: "red", level: "error" });
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
    debug("menuScope", "Scope guardado correctamente", { color: "green", level: "debug" });
  } catch (e) {
    debug("menuScope", `Error guardando scope: ${e}`, { color: "red", level: "error" });
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
    debug("menuScope", "Scope no válido, usando valores por defecto", { color: "yellow", level: "warn" });
    scope = generateDefaultScope();
  }

  const entityLabel = nameTag ? `§r§f${nameTag}§r` : ent && ent.typeId ? `§b${ent.typeId}§r` : "<unknown>";

  if (scope.respectEntityBlocks === false) {
    debug("menuScope:check", `${entityLabel}: scope fuerza configuración global => EN SCOPE`, { color: "green", level: "debug" });
    return true;
  }

  if (!ent || typeof ent.getDynamicProperty !== "function") {
    debug("menuScope:check", `${entityLabel}: entidad inválida, no se puede aplicar bloqueo`, { color: "yellow", level: "warn" });
    return true;
  }

  try {
    const raw = ent.getDynamicProperty(ENTITY_GLOBAL_OVERWRITE_PROPERTY);
    const allowGlobalOverwrite = normalizeBooleanDynamicProperty(raw);
    const blocked = allowGlobalOverwrite === false;
    debug(
      "menuScope:check",
      `${entityLabel}: respetar bloqueos=true, allowGlobalOverwrite=${allowGlobalOverwrite} (raw=${raw}) => ${blocked ? "FUERA DE SCOPE" : "EN SCOPE"}`,
      { color: blocked ? "gray" : "green", level: "debug" }
    );
    return !blocked;
  } catch (e) {
    debug("menuScope:check", `Error leyendo propiedad de entidad: ${e}`, { color: "red", level: "error" });
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
    debug("menuScope", "=== INICIANDO RESET DE SCOPE ===", { color: "aqua", level: "debug" });
    const newScope = generateDefaultScope();
    saveScope(newScope);
    debug("menuScope", "Scope reiniciado a valores por defecto", { color: "green", level: "debug" });
    return newScope;
  } catch (e) {
    debug("menuScope", `Error reseteando scope: ${e}`, { color: "red", level: "error" });
    const defaultScope = generateDefaultScope();
    scopeCache = defaultScope;
    return defaultScope;
  }
}
