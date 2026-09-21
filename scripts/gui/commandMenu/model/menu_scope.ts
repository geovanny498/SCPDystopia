// scripts/gui/commandMenu/model/menu_scope.ts
import { world, Entity } from "@minecraft/server";
import { debug } from "../../../utils/debug.js";
import { ENTITY_GLOBAL_OVERWRITE_PROPERTY } from "../../shared/entityScope.js";
import type { ScopeData, FactionScopeData } from "../../shared/entityScope.js";
import type { TargetFaction } from "../../../constants/domains.js";

export type { ScopeData, FactionScopeData };

/**
 * Sistema de Prioridad de Aplicación (Scope) por Facción.
 *
 * Define A QUIÉN se aplican los cambios del menú de comandos según su facción.
 * Foundation y Chaos poseen configuraciones de scope independientes.
 *
 * El scope se guarda en dynamic properties del mundo y persiste hasta que el jugador lo cambie.
 */

const SCOPE_PROPERTY = "scpd_menu_scope";
const DEFAULT_RESPECT_ENTITY_BLOCKS = true;

/**
 * Cache del scope en memoria para evitar lecturas duplicadas de dynamic properties
 */
let scopeCache: ScopeData | null = null;

/**
 * Genera el scope por defecto para ambas facciones
 * @returns {ScopeData} ScopeData con configuración inicial por defecto
 */
function generateDefaultScope(): ScopeData {
  return {
    foundation: { respectEntityBlocks: DEFAULT_RESPECT_ENTITY_BLOCKS },
    chaos: { respectEntityBlocks: DEFAULT_RESPECT_ENTITY_BLOCKS },
  };
}

/**
 * Migra un scope antiguo al formato por facción duplicando el valor a ambas facciones
 * @param {unknown} oldScope - Objeto parseado previo a la migración
 * @returns {ScopeData} ScopeData migrado
 */
function migrateOldScope(oldScope: unknown): ScopeData {
  debug("menuScope", "Migrando scope antiguo al formato independiente por facción", { color: "yellow", level: "warn" });
  if (
    oldScope &&
    typeof oldScope === "object" &&
    "respectEntityBlocks" in oldScope &&
    typeof (oldScope as { respectEntityBlocks: unknown }).respectEntityBlocks === "boolean"
  ) {
    const val = (oldScope as { respectEntityBlocks: boolean }).respectEntityBlocks;
    return {
      foundation: { respectEntityBlocks: val },
      chaos: { respectEntityBlocks: val },
    };
  }
  return generateDefaultScope();
}

/**
 * Carga el scope desde dynamic properties o cache en memoria
 * @param {boolean} [forceReload=false] - Forzar recarga desde dynamic properties ignorando cache
 * @returns {ScopeData} ScopeData actual cargado
 */
export function loadScope(forceReload = false): ScopeData {
  try {
    if (scopeCache && !forceReload) {
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

    // Formato legacy: { respectEntityBlocks: boolean }
    if (typeof parsed?.respectEntityBlocks === "boolean" && (!parsed.foundation || !parsed.chaos)) {
      debug("menuScope", "Scope legacy detectado, migrando a formato por facción", { color: "yellow", level: "warn" });
      const migratedScope = migrateOldScope(parsed);
      saveScope(migratedScope);
      scopeCache = migratedScope;
      return migratedScope;
    }

    // Validación de formato nuevo
    if (
      typeof parsed?.foundation?.respectEntityBlocks !== "boolean" ||
      typeof parsed?.chaos?.respectEntityBlocks !== "boolean"
    ) {
      debug("menuScope", "Scope inválido o corrupto, restaurando defaults", { color: "yellow", level: "warn" });
      const defaultScope = generateDefaultScope();
      saveScope(defaultScope);
      scopeCache = defaultScope;
      return defaultScope;
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
 * Guarda el scope en dynamic properties del mundo y sincroniza el cache en memoria
 * @param {ScopeData} scope - ScopeData a persistir
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
 * Normaliza valores de propiedades dinámicas a boolean o undefined
 * @param {unknown} raw - Valor crudo de dynamic property
 * @returns {boolean | undefined} Booleano normalizado o undefined si no está configurado
 */
function normalizeBooleanDynamicProperty(raw: unknown): boolean | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (raw === true || raw === "true" || raw === 1 || raw === "1") return true;
  if (raw === false || raw === "false" || raw === 0 || raw === "0") return false;
  return undefined;
}

/**
 * Verifica si una entidad individual está dentro del scope de su facción correspondiente.
 * No realiza fallback silencioso a Foundation si la facción es desconocida o inválida.
 * @param {Entity} ent - Entidad a evaluar
 * @param {string} faction - Facción concreta de la entidad ("foundation" o "chaos")
 * @param {ScopeData | null} [scope=null] - Scope actual (opcional, se carga si es null)
 * @param {string} [nameTag] - Nametag de la entidad (opcional para logs/etiqueta)
 * @returns {boolean} true si la entidad está dentro del scope de aplicación
 */
export function isEntityInScope(
  ent: Entity,
  faction: string,
  scope: ScopeData | null = null,
  nameTag?: string
): boolean {
  if (!scope) {
    scope = loadScope();
  }

  let factionScope: FactionScopeData | null = null;
  if (faction === "foundation") {
    factionScope = scope.foundation;
  } else if (faction === "chaos") {
    factionScope = scope.chaos;
  } else {
    debug("menuScope:check", `Facción inválida para entidad individual: "${faction}". No se asume Foundation.`, {
      color: "red",
      level: "warn",
    });
    return false;
  }

  if (!factionScope || typeof factionScope.respectEntityBlocks !== "boolean") {
    debug("menuScope:check", `Scope de facción "${faction}" no válido, usando defaults`, {
      color: "yellow",
      level: "warn",
    });
    factionScope = { respectEntityBlocks: DEFAULT_RESPECT_ENTITY_BLOCKS };
  }

  const entityLabel = nameTag ? `§r§f${nameTag}§r` : ent && ent.typeId ? `§b${ent.typeId}§r` : "<unknown>";

  if (factionScope.respectEntityBlocks === false) {
    debug("menuScope:check", `${entityLabel} [${faction}]: scope fuerza configuración global => EN SCOPE`, {
      color: "green",
      level: "debug",
    });
    return true;
  }

  if (!ent || typeof ent.getDynamicProperty !== "function") {
    debug("menuScope:check", `${entityLabel}: entidad inválida, no se puede aplicar bloqueo`, {
      color: "yellow",
      level: "warn",
    });
    return true;
  }

  try {
    const raw = ent.getDynamicProperty(ENTITY_GLOBAL_OVERWRITE_PROPERTY);
    const allowGlobalOverwrite = normalizeBooleanDynamicProperty(raw);
    const blocked = allowGlobalOverwrite === false;
    debug(
      "menuScope:check",
      `${entityLabel} [${faction}]: respetar bloqueos=true, allowGlobalOverwrite=${allowGlobalOverwrite} (raw=${raw}) => ${blocked ? "FUERA DE SCOPE" : "EN SCOPE"}`,
      { color: blocked ? "gray" : "green", level: "debug" }
    );
    return !blocked;
  } catch (e) {
    debug("menuScope:check", `Error leyendo propiedad de entidad: ${e}`, { color: "red", level: "error" });
    return true;
  }
}

/**
 * Obtiene un resumen legible del scope actual por facción o consolidado
 * @param {ScopeData | null} scope - ScopeData actual
 * @param {TargetFaction} [targetFaction] - Facción opcional para filtrar el resumen
 * @returns {string} Resumen formateado para mostrar en UI o consola
 */
export function getScopeSummary(scope: ScopeData | null, targetFaction?: TargetFaction): string {
  if (
    !scope ||
    typeof scope.foundation?.respectEntityBlocks !== "boolean" ||
    typeof scope.chaos?.respectEntityBlocks !== "boolean"
  ) {
    scope = generateDefaultScope();
  }

  if (targetFaction === "foundation") {
    const status = scope.foundation.respectEntityBlocks ? "§aON§r" : "§cOFF§r";
    return `§9Foundation: §7Prefiere configuración local: ${status}`;
  }

  if (targetFaction === "chaos") {
    const status = scope.chaos.respectEntityBlocks ? "§aON§r" : "§cOFF§r";
    return `§cChaos: §7Prefiere configuración local: ${status}`;
  }

  const foundationStatus = scope.foundation.respectEntityBlocks ? "§aON§r" : "§cOFF§r";
  const chaosStatus = scope.chaos.respectEntityBlocks ? "§aON§r" : "§cOFF§r";
  return `§9Foundation: §7Prefiere config local: ${foundationStatus}\n§cChaos: §7Prefiere config local: ${chaosStatus}\n§7Cuando está OFF, el menú global aplica a todas las unidades.`;
}

/**
 * Reinicia el scope de ambas facciones a valores por defecto y lo persiste
 * @returns {ScopeData} ScopeData reiniciado
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
