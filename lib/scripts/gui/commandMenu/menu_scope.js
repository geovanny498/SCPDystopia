// scripts/gui/commandMenu/menu_scope.js
import { world } from "@minecraft/server";
import { debugWarn } from "../../utils/debug.js";
import { specialUnits } from "./menu_config.js";
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
 * CONFIGURACIÓN: Define si por defecto se incluyen todas las unidades especiales
 * - true: Todas las unidades especiales están seleccionadas por defecto
 * - false: Ninguna unidad especial está seleccionada por defecto (solo normales)
 */
const INCLUDE_ALL_SPECIALS_BY_DEFAULT = true;
/**
 * Cache del scope en memoria para evitar cargas duplicadas
 * Se invalida cuando se guarda un nuevo scope
 */
let scopeCache = null;
/**
 * Genera el scope por defecto
 * Si INCLUDE_ALL_SPECIALS_BY_DEFAULT es true, incluye todas las unidades especiales
 * Si es false, solo incluye normales (sin especiales)
 * @returns {Object}
 */
function generateDefaultScope() {
    const scope = {
        foundation: {
            includeNormals: true,
            includeSpecials: INCLUDE_ALL_SPECIALS_BY_DEFAULT,
            specialUnits: []
        },
        chaos: {
            includeNormals: true,
            includeSpecials: INCLUDE_ALL_SPECIALS_BY_DEFAULT,
            specialUnits: []
        }
    };
    // Si la configuración indica incluir todas las especiales, agregarlas
    if (INCLUDE_ALL_SPECIALS_BY_DEFAULT) {
        // Agregar todas las unidades especiales de Foundation
        if (specialUnits.foundation && specialUnits.foundation.all) {
            scope.foundation.specialUnits = [...specialUnits.foundation.all];
        }
        // Agregar todas las unidades especiales de Chaos
        if (specialUnits.chaos && specialUnits.chaos.all) {
            scope.chaos.specialUnits = [...specialUnits.chaos.all];
        }
    }
    // Si es false, el array queda vacío (ya inicializado arriba)
    return scope;
}
/**
 * Carga el scope desde dynamic properties
 * Usa cache en memoria para evitar cargas duplicadas
 * @param {boolean} forceReload - Si es true, ignora el cache y recarga desde propiedades
 * @returns {Object}
 */
export function loadScope(forceReload = false) {
    try {
        // Si hay cache y no se fuerza la recarga, usar el cache
        if (scopeCache && !forceReload) {
            debugWarn("menuScope", "Scope cargado desde cache en memoria", "gray");
            return scopeCache;
        }
        const raw = world.getDynamicProperty(SCOPE_PROPERTY);
        if (!raw) {
            const msg = INCLUDE_ALL_SPECIALS_BY_DEFAULT
                ? "No hay scope guardado, generando defaults (todas las unidades incluidas)"
                : "No hay scope guardado, generando defaults (solo normales, sin especiales)";
            debugWarn("menuScope", msg, "yellow");
            const defaultScope = generateDefaultScope();
            debugWarn("menuScope", `Default scope generado: ${JSON.stringify(defaultScope)}`, "gray");
            // Guardar en cache
            scopeCache = defaultScope;
            return defaultScope;
        }
        debugWarn("menuScope", `Scope cargado desde propiedades dinámicas`, "cyan");
        const parsed = JSON.parse(raw);
        debugWarn("menuScope", `Scope parseado: ${JSON.stringify(parsed)}`, "gray");
        // Validar estructura
        if (!parsed.foundation || !parsed.chaos) {
            debugWarn("menuScope", "Scope inválido, generando defaults", "yellow");
            const defaultScope = generateDefaultScope();
            scopeCache = defaultScope;
            return defaultScope;
        }
        // Guardar en cache
        scopeCache = parsed;
        return parsed;
    }
    catch (e) {
        debugWarn("menuScope", `Error cargando scope: ${e}`, "red");
        const defaultScope = generateDefaultScope();
        scopeCache = defaultScope;
        return defaultScope;
    }
}
/**
 * Guarda el scope en dynamic properties
 * Invalida el cache para forzar recarga en la próxima lectura
 * @param {Object} scope
 */
export function saveScope(scope) {
    try {
        const serialized = JSON.stringify(scope);
        world.setDynamicProperty(SCOPE_PROPERTY, serialized);
        // Invalidar cache para que la próxima carga sea desde propiedades
        scopeCache = scope;
        debugWarn("menuScope", "Scope guardado correctamente", "green");
        debugWarn("menuScope", `Scope guardado: ${serialized}`, "gray");
    }
    catch (e) {
        debugWarn("menuScope", `Error guardando scope: ${e}`, "red");
    }
}
/**
 * Verifica si una entidad está dentro del scope actual
 * @param {Entity} ent
 * @param {string} faction - "foundation" | "chaos"
 * @param {boolean} isSpecial
 * @param {string} nameTag - nameTag de la entidad
 * @param {Object} scope - Scope actual (opcional, si no se pasa se carga)
 * @returns {boolean}
 */
export function isEntityInScope(ent, faction, isSpecial, nameTag, scope = null) {
    if (!scope) {
        scope = loadScope();
    }
    const factionScope = scope[faction];
    if (!factionScope) {
        debugWarn("menuScope", `No hay scope para faction: ${faction}`, "red");
        return false;
    }
    // Si es normal: verificar includeNormals
    if (!isSpecial) {
        const inScope = !!factionScope.includeNormals;
        debugWarn("menuScope:check", `${nameTag} [${faction}-normal]: ${inScope ? 'EN SCOPE' : 'FUERA DE SCOPE'}`, inScope ? "green" : "gray");
        return inScope;
    }
    // Si es especial: verificar si la unidad individual está en la lista
    if (!factionScope.specialUnits || factionScope.specialUnits.length === 0) {
        debugWarn("menuScope:check", `${nameTag} [${faction}-especial]: FUERA DE SCOPE (sin unidades especiales seleccionadas)`, "gray");
        return false;
    }
    const inScope = factionScope.specialUnits.includes(nameTag);
    debugWarn("menuScope:check", `${nameTag} [${faction}-especial]: ${inScope ? 'EN SCOPE' : 'FUERA DE SCOPE'}`, inScope ? "green" : "gray");
    return inScope;
}
/**
 * Obtiene un resumen legible del scope actual
 * @param {Object} scope
 * @returns {string}
 */
export function getScopeSummary(scope) {
    var _a;
    const lines = [];
    for (const faction of ["foundation", "chaos"]) {
        const factionScope = scope[faction];
        if (!factionScope)
            continue;
        const factionLabel = faction === "foundation" ? "§lFoundation" : "§2§lChaos";
        const parts = [];
        if (factionScope.includeNormals) {
            parts.push("§aNormales");
        }
        // Mostrar unidades especiales seleccionadas
        if (factionScope.specialUnits && factionScope.specialUnits.length > 0) {
            const factionData = specialUnits[faction];
            const totalSpecials = ((_a = factionData === null || factionData === void 0 ? void 0 : factionData.all) === null || _a === void 0 ? void 0 : _a.length) || 0;
            const selectedCount = factionScope.specialUnits.length;
            if (selectedCount === totalSpecials) {
                parts.push(`§eEspeciales: §aTodas (${selectedCount})`);
            }
            else {
                parts.push(`§eEspeciales: ${selectedCount}/${totalSpecials}`);
            }
        }
        else {
            parts.push("§eEspeciales: §cNinguna");
        }
        if (parts.length > 0) {
            lines.push(`${factionLabel}§r: ${parts.join("§r + ")}`);
        }
        else {
            lines.push(`${factionLabel}§r: §cNinguna unidad seleccionada`);
        }
    }
    return lines.length > 0 ? lines.join("\n") : "§cNinguna unidad seleccionada en ninguna facción";
}
/**
 * Reinicia el scope a valores por defecto
 * IMPORTANTE: Sobrescribe completamente la propiedad dinámica
 */
export function resetScope() {
    try {
        debugWarn("menuScope", "=== INICIANDO RESET DE SCOPE ===", "cyan");
        // Generar el nuevo scope con defaults
        const newScope = generateDefaultScope();
        debugWarn("menuScope", `Nuevo scope generado: ${JSON.stringify(newScope)}`, "gray");
        // Sobrescribir directamente la propiedad dinámica (no intentar borrarla primero)
        saveScope(newScope);
        const msg = INCLUDE_ALL_SPECIALS_BY_DEFAULT
            ? "Scope reiniciado a valores por defecto (todas las unidades incluidas)"
            : "Scope reiniciado a valores por defecto (solo normales, sin especiales)";
        debugWarn("menuScope", msg, "green");
        debugWarn("menuScope", "=== RESET DE SCOPE COMPLETADO ===", "cyan");
        return newScope;
    }
    catch (e) {
        debugWarn("menuScope", `Error reseteando scope: ${e}`, "red");
        debugWarn("menuScope", `Stack: ${e.stack}`, "red");
        const defaultScope = generateDefaultScope();
        scopeCache = defaultScope;
        return defaultScope;
    }
}
//# sourceMappingURL=menu_scope.js.map