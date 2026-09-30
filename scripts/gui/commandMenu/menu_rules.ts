// scripts/gui/commandMenu/menu_rules.js

/**
 * Sistema de reglas declarativas para compatibilidad entre sistemas
 *
 * Este módulo maneja:
 * 1. Compatibilidad entre sistemas (requires, locks)
 * 2. Control de aplicación (applyMode: "all" | "existing_only")
 */

import { debug } from "../../utils/debug.js";
import type { FactionId } from "../../constants/domains.js";
import type { AllSystemStates } from "./model/menu_system_state.js";

/**
 * Definición de reglas de compatibilidad para cada sistema
 *
 * Propiedades:
 * - domain: Dominio al que pertenece el sistema (ej: "movement", "fire")
 * - requires: Objeto con dominios y valores requeridos para que este sistema se aplique
 * - locks: Array de dominios que este sistema bloquea (no se pueden aplicar simultáneamente)
 * - applyMode: "all" | "existing_only" | "spawn_only"
 *   - "all": Se aplica a entidades existentes Y futuras (spawn + load)
 *   - "existing_only": Solo al enviar el formulario; no aplica en spawn ni load
 *   - "spawn_only": Aplica en spawn (futuras) y al enviar el formulario, pero NO en entityLoad (recarga de mundo)
 */
export const systemRules: Record<
  string,
  {
    domain: string;
    applyMode: "all" | "existing_only" | "spawn_only";
    requires?: Record<string, string[] | string>;
    locks?: string[];
  }
> = {
  movement: {
    domain: "movement",
    applyMode: "existing_only", // se utiliza "existing_only" para evitar colisiones con domesticación (tame)
  },

  fire: {
    domain: "fire",
    applyMode: "all", // Algunas unidades dependen de all para ser hostiles por defecto
  },

  // Ejemplo antiguo para requires:
  /* 
    distance: {
        domain: "distance",
        applyMode: "existing_only",  // ← Cambiado de "all" a "existing_only" para no colisionar con movement
        // Distance requiere que movement esté en modo "follow"
        // Si movement está en "free" o "stop", distance NO se aplica
        requires: {
            movement: ["follow"]
        }
    }, 
    */

  weapon: {
    domain: "weapon",
    applyMode: "existing_only", // Para evitar colisiones con las armas base de las unidades
  },

  armament: {
    domain: "armament",
    // spawn (futuras) + menú (existentes), pero NO re-aplica en entityLoad (evita re-roll al recargar el mundo).
    // La aplicación manual desde el menú es independiente de applyMode (systemBuilder -> applySystemsToEntities).
    applyMode: "spawn_only",
  },

  spawn: {
    domain: "spawn",
    applyMode: "all",
  },

  health: {
    domain: "health",
    applyMode: "all",
  },

  teleport: {
    domain: "teleport",
    applyMode: "all",
  },
  invincible: {
    domain: "invincible",
    applyMode: "existing_only",
  },
};

/**
 * Obtiene las reglas de un sistema
 * @param {string} systemId
 * @returns {Object|null}
 */
export function getSystemRules(systemId: string) {
  return systemRules[systemId] || null;
}

/**
 * Verifica si un sistema puede aplicarse según sus reglas de compatibilidad
 *
 * @param systemId - ID del sistema a verificar.
 * @param allSystemStates - Colección dispersa de estados por sistema y facción.
 * @param faction - Facción de la entidad evaluada.
 * @param isSpecial - Si la entidad es especial.
 * @returns Resultado de compatibilidad y motivo de la decisión.
 */
export function canApplySystem(
  systemId: string,
  allSystemStates: AllSystemStates,
  faction: FactionId,
  isSpecial: boolean
) {
  const rules = getSystemRules(systemId);

  // Si no hay reglas, el sistema siempre se puede aplicar
  if (!rules) {
    return { canApply: true, reason: "No hay reglas definidas" };
  }

  // Si no hay requires, el sistema se puede aplicar
  if (!rules.requires) {
    return { canApply: true, reason: "No hay requisitos" };
  }

  // Verificar cada requisito
  for (const [requiredDomain, allowedValues] of Object.entries(rules.requires)) {
    // Buscar el sistema que pertenece a este dominio
    const requiredSystemId = findSystemByDomain(requiredDomain);

    if (!requiredSystemId) {
      debug("menuRules:compat", `No se encontró sistema para dominio: §b${requiredDomain}§r`, {
        level: "warn",
        color: "yellow",
      });
      return {
        canApply: false,
        reason: `Sistema requerido no encontrado para dominio: ${requiredDomain}`,
      };
    }

    const requiredState = allSystemStates[requiredSystemId];
    const factionState = requiredState?.[faction];
    if (!factionState) {
      debug("menuRules:compat", `No hay estado para §b${requiredSystemId}§r en faction §a${faction}§r`, {
        level: "warn",
        color: "yellow",
      });
      return {
        canApply: false,
        reason: `No hay estado para ${requiredSystemId}`,
      };
    }

    // Obtener el valor actual (mode para dropdown, enable para toggle)
    const currentValue = isSpecial
      ? factionState.includeSpecial
      : factionState.mode !== undefined
        ? factionState.mode
        : factionState.enable;

    // Verificar si el valor actual está en los valores permitidos
    const isAllowed = Array.isArray(allowedValues)
      ? typeof currentValue === "string" && allowedValues.includes(currentValue)
      : allowedValues === currentValue;

    if (!isAllowed) {
      debug(
        "menuRules:compat",
        `Sistema §b${systemId}§r §cNO puede aplicarse§r: §b${requiredSystemId}§r debe ser ${JSON.stringify(allowedValues)}, pero es ${currentValue}`,
        { level: "warn", color: "yellow" }
      );
      return {
        canApply: false,
        reason: `Requiere ${requiredSystemId}=${JSON.stringify(allowedValues)}, actual: ${currentValue}`,
      };
    }
  }

  return { canApply: true, reason: "Todos los requisitos cumplidos" };
}

/**
 * Busca el ID de un sistema por su dominio
 * @param {string} domain
 * @returns {string|null}
 */
function findSystemByDomain(domain: string) {
  for (const [systemId, rules] of Object.entries(systemRules)) {
    if (rules.domain === domain) {
      return systemId;
    }
  }
  return null;
}

/**
 * Verifica si un sistema debe aplicarse a entidades futuras (spawn/load)
 * @param {string} systemId
 * @param {boolean} isSpawn - true si el disparador es entitySpawn; false para entityLoad.
 *   "spawn_only" aplica solo cuando isSpawn es true (evita re-aplicar al recargar el mundo).
 *   La aplicación manual desde el menú no pasa por aquí: sigue aplicándose a entidades existentes.
 * @returns {boolean}
 */
export function shouldApplyToFutureEntities(systemId: string, isSpawn: boolean = false) {
  const rules = getSystemRules(systemId);

  if (!rules) {
    debug("menuRules:apply", `Sistema §b${systemId}§r: §6Sin reglas§r, aplicar a futuras (default)`, {
      level: "debug",
      color: "gray",
    });
    return true; // Por defecto, aplicar a futuras
  }

  const shouldApply = rules.applyMode === "all" || (rules.applyMode === "spawn_only" && isSpawn);
  debug(
    "menuRules:apply",
    `Sistema §b${systemId}§r: applyMode=§6${rules.applyMode}§r, aplicar a futuras=${shouldApply}`,
    { level: "debug", color: shouldApply ? "green" : "gray" }
  );

  return shouldApply;
}

/**
 * Filtra los sistemas que deben aplicarse según las reglas de compatibilidad
 * @param systemIds - IDs de sistemas a aplicar.
 * @param allSystemStates - Colección dispersa de estados por sistema y facción.
 * @param faction - Facción de la entidad evaluada.
 * @param isSpecial - Si la entidad es especial.
 * @returns IDs de sistemas que pueden aplicarse.
 */
export function filterApplicableSystems(
  systemIds: string[],
  allSystemStates: AllSystemStates,
  faction: FactionId,
  isSpecial: boolean
) {
  return systemIds.filter((systemId) => {
    const result = canApplySystem(systemId, allSystemStates, faction, isSpecial);
    return result.canApply;
  });
}
