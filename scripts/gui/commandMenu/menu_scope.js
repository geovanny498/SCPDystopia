// scripts/gui/commandMenu/menu_scope.js
import { world } from "@minecraft/server";
import { debugWarn } from "../../utils/debug.js";
import { specialUnits, UnitHierarchy } from "./menu_config.js";

/**
 * Sistema de Alcance de Aplicación (Scope)
 *
 * Define A QUIÉN se aplican los cambios del menú de comandos.
 * Es independiente del formulario de sistemas (que define QUÉ se hace).
 *
 * El scope se guarda en dynamic properties y persiste hasta que el jugador lo cambie.
 */

const SCOPE_PROPERTY = "scpd_menu_scope";

/**
 * CONFIGURACIÓN: Define si por defecto se incluyen todas las unidades
 */
const INCLUDE_ALL_BY_DEFAULT = true;

/**
 * Cache del scope en memoria para evitar cargas duplicadas
 */
let scopeCache = null;

/**
 * Genera el scope por defecto
 * Incluye jerarquías separadas: basic, leader, commander
 */
function generateDefaultScope() {
  const scope = {
    foundation: {
      // Jerarquías separadas (reemplaza includeNormals)
      [UnitHierarchy.BASIC]: INCLUDE_ALL_BY_DEFAULT,
      [UnitHierarchy.LEADER]: INCLUDE_ALL_BY_DEFAULT,
      [UnitHierarchy.COMMANDER]: INCLUDE_ALL_BY_DEFAULT,
      // Especiales (se mantiene igual)
      includeSpecials: INCLUDE_ALL_BY_DEFAULT,
      specialUnits: [],
    },
    chaos: {
      [UnitHierarchy.BASIC]: INCLUDE_ALL_BY_DEFAULT,
      [UnitHierarchy.LEADER]: INCLUDE_ALL_BY_DEFAULT,
      [UnitHierarchy.COMMANDER]: INCLUDE_ALL_BY_DEFAULT,
      includeSpecials: INCLUDE_ALL_BY_DEFAULT,
      specialUnits: [],
    },
  };

  // Si la configuración indica incluir todas las especiales, agregarlas
  if (INCLUDE_ALL_BY_DEFAULT) {
    if (specialUnits.foundation && specialUnits.foundation.all) {
      scope.foundation.specialUnits = [...specialUnits.foundation.all];
    }
    if (specialUnits.chaos && specialUnits.chaos.all) {
      scope.chaos.specialUnits = [...specialUnits.chaos.all];
    }
  }

  return scope;
}

/**
 * Migra un scope antiguo al nuevo formato con jerarquías
 */
function migrateOldScope(oldScope) {
  const newScope = generateDefaultScope();

  for (const faction of ["foundation", "chaos"]) {
    if (!oldScope[faction]) continue;

    const oldFaction = oldScope[faction];

    // Migrar includeNormals a las 3 jerarquías
    if (oldFaction.includeNormals !== undefined) {
      newScope[faction][UnitHierarchy.BASIC] = oldFaction.includeNormals;
      newScope[faction][UnitHierarchy.LEADER] = oldFaction.includeNormals;
      newScope[faction][UnitHierarchy.COMMANDER] = oldFaction.includeNormals;
    }

    // Copiar jerarquías si ya existen
    if (oldFaction[UnitHierarchy.BASIC] !== undefined) {
      newScope[faction][UnitHierarchy.BASIC] = oldFaction[UnitHierarchy.BASIC];
    }
    if (oldFaction[UnitHierarchy.LEADER] !== undefined) {
      newScope[faction][UnitHierarchy.LEADER] = oldFaction[UnitHierarchy.LEADER];
    }
    if (oldFaction[UnitHierarchy.COMMANDER] !== undefined) {
      newScope[faction][UnitHierarchy.COMMANDER] = oldFaction[UnitHierarchy.COMMANDER];
    }

    // Copiar especiales
    if (oldFaction.includeSpecials !== undefined) {
      newScope[faction].includeSpecials = oldFaction.includeSpecials;
    }
    if (oldFaction.specialUnits) {
      newScope[faction].specialUnits = [...oldFaction.specialUnits];
    }
  }

  return newScope;
}

/**
 * Carga el scope desde dynamic properties
 */
export function loadScope(forceReload = false) {
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
    const parsed = JSON.parse(raw);

    // Validar estructura básica
    if (!parsed.foundation || !parsed.chaos) {
      debugWarn("menuScope", "Scope inválido, generando defaults", "yellow");
      const defaultScope = generateDefaultScope();
      scopeCache = defaultScope;
      return defaultScope;
    }

    // Verificar si necesita migración (tiene includeNormals pero no tiene jerarquías)
    const needsMigration =
      parsed.foundation.includeNormals !== undefined && parsed.foundation[UnitHierarchy.BASIC] === undefined;

    if (needsMigration) {
      debugWarn("menuScope", "Migrando scope antiguo al nuevo formato con jerarquías", "yellow");
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
export function saveScope(scope) {
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
export function isEntityInScope(ent, faction, isSpecial, nameTag, scope = null, hierarchy = null) {
  if (!scope) {
    scope = loadScope();
  }

  const factionScope = scope[faction];
  if (!factionScope) {
    debugWarn("menuScope", `No hay scope para faction: ${faction}`, "red");
    return false;
  }

  // Si es normal: verificar por jerarquía específica
  if (!isSpecial) {
    // Si se proporciona jerarquía, verificar esa específica
    if (hierarchy && factionScope[hierarchy] !== undefined) {
      const inScope = !!factionScope[hierarchy];
      debugWarn(
        "menuScope:check",
        `${nameTag} [${faction}-${hierarchy}]: ${inScope ? "EN SCOPE" : "FUERA DE SCOPE"}`,
        inScope ? "green" : "gray"
      );
      return inScope;
    }

    // Fallback: verificar si alguna jerarquía está activa (compatibilidad)
    const anyHierarchyActive =
      factionScope[UnitHierarchy.BASIC] || factionScope[UnitHierarchy.LEADER] || factionScope[UnitHierarchy.COMMANDER];
    debugWarn(
      "menuScope:check",
      `${nameTag} [${faction}-normal]: ${anyHierarchyActive ? "EN SCOPE" : "FUERA DE SCOPE"}`,
      anyHierarchyActive ? "green" : "gray"
    );
    return anyHierarchyActive;
  }

  // Si es especial: verificar si la unidad individual está en la lista
  if (!factionScope.specialUnits || factionScope.specialUnits.length === 0) {
    debugWarn(
      "menuScope:check",
      `${nameTag} [${faction}-especial]: FUERA DE SCOPE (sin unidades especiales seleccionadas)`,
      "gray"
    );
    return false;
  }

  const inScope = factionScope.specialUnits.includes(nameTag);
  debugWarn(
    "menuScope:check",
    `${nameTag} [${faction}-especial]: ${inScope ? "EN SCOPE" : "FUERA DE SCOPE"}`,
    inScope ? "green" : "gray"
  );
  return inScope;
}

/**
 * Obtiene un resumen legible del scope actual
 */
export function getScopeSummary(scope) {
  const lines = [];

  for (const faction of ["foundation", "chaos"]) {
    const factionScope = scope[faction];
    if (!factionScope) continue;

    const factionLabel = faction === "foundation" ? "§lFoundation" : "§2§lChaos";
    const parts = [];

    // Mostrar estado de cada jerarquía
    const basicStatus = factionScope[UnitHierarchy.BASIC] ? "§aON" : "§cOFF";
    const leaderStatus = factionScope[UnitHierarchy.LEADER] ? "§aON" : "§cOFF";
    const commanderStatus = factionScope[UnitHierarchy.COMMANDER] ? "§aON" : "§cOFF";
    parts.push(`§7B: ${basicStatus}§r, §eL: ${leaderStatus}§r, §6C: ${commanderStatus}§r`);

    // Mostrar unidades especiales seleccionadas
    if (factionScope.specialUnits && factionScope.specialUnits.length > 0) {
      const factionData = specialUnits[faction];
      const totalSpecials = factionData?.all?.length || 0;
      const selectedCount = factionScope.specialUnits.length;

      if (selectedCount === totalSpecials) {
        parts.push(`§eEsp: §aTodas§r`);
      } else {
        parts.push(`§eEsp: ${selectedCount}/${totalSpecials}§r`);
      }
    } else {
      parts.push("§eEsp: §c0§r");
    }

    lines.push(`${factionLabel}§r: ${parts.join(" | ")}`);
  }

  return lines.length > 0 ? lines.join("\n") : "§cNinguna unidad seleccionada";
}

/**
 * Reinicia el scope a valores por defecto
 */
export function resetScope() {
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
