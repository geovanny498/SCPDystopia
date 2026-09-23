// scripts/gui/interactMenu/gui.ts
import { Entity } from "@minecraft/server";
import config, { MenuCategory, EntitySpecificConfig } from "./config.js";
import { debug } from "../../utils/debug.js";
import { getEntityFactionInfo, type EntityFactionInfo } from "../commandMenu/model/menu_faction.js";

/**
 * Estructura de categorías de menú resueltas para una entidad específica.
 */
export interface EntityConfig {
  specific: MenuCategory[];
  global: MenuCategory[];
  merged: MenuCategory[];
  isSpecial: boolean;
  submenus?: {
    advanced?: { categories: MenuCategory[] };
    unit_management?: { categories: MenuCategory[] };
  };
}

/**
 * Genera un identificador canónico de sistema a partir de una categoría.
 * Utilizado para verificar reglas de inclusión y listas de permisos en `config.global_rules`.
 *
 * @param cat Categoría de menú a evaluar.
 * @returns Identificador canónico del sistema o `null` si la categoría no es válida.
 */
export function makeSystemId(cat: MenuCategory | null | undefined): string | null {
  if (!cat) return null;
  if (cat.id) return String(cat.id);
  const name = String(cat.category || "").toLowerCase();
  return `auto:${name.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")}`;
}

/**
 * Evalúa si un sistema está permitido para un `typeId` según las reglas
 * globales (`whitelist` / `blacklist`) definidas en `config.global_rules`.
 *
 * @param sysId Identificador del sistema.
 * @param typeId Identificador de tipo de la entidad.
 * @returns `true` si el sistema está permitido para la entidad; de lo contrario `false`.
 */
export function isAllowedByRule(sysId: string | null, typeId: string): boolean {
  if (!sysId) return true;
  if (!config.global_rules || !config.global_rules[sysId]) return true;
  const rule = config.global_rules[sysId];
  if (!rule) return true;

  const mode = rule.mode;
  const list = Array.isArray(rule.list) ? rule.list : [];
  const inList = list.indexOf(typeId) !== -1;

  if (mode === "whitelist") return inList;
  if (mode === "blacklist") return !inList;
  return true;
}

/**
 * Determina si una categoría debe incluirse para una entidad basándose en sus reglas de sistema.
 *
 * @param cat Categoría a evaluar.
 * @param typeId Identificador de tipo de la entidad.
 * @returns `true` si la categoría está permitida.
 */
function shouldIncludeCategoryForEntity(cat: MenuCategory, typeId: string): boolean {
  const sysId = makeSystemId(cat);
  return isAllowedByRule(sysId, typeId);
}

/**
 * Devuelve la configuración específica configurada para una entidad desde `config.specific`.
 *
 * @param typeId Identificador de tipo de la entidad.
 * @returns Configuración específica encontrada o `undefined`.
 */
function getSpecificConfig(typeId: string): EntitySpecificConfig | undefined {
  if (!config.specific || typeof config.specific !== "object") return undefined;
  if (Object.prototype.hasOwnProperty.call(config.specific, typeId)) {
    return config.specific[typeId];
  }

  for (const spec of Object.values(config.specific)) {
    if (!spec || typeof spec !== "object") continue;
    if (Array.isArray(spec.ids) && spec.ids.includes(typeId)) {
      return spec;
    }
  }

  for (const key of Object.keys(config.specific)) {
    if (!key.includes(",")) continue;
    const ids = key
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item);
    if (ids.includes(typeId)) {
      return config.specific[key];
    }
  }

  return undefined;
}

/**
 * Resuelve y devuelve la configuración de categorías aplicables para una entidad específica.
 * Combina categorías específicas, globales filtradas por reglas y submenús.
 *
 * @param typeId Identificador de tipo de la entidad objetivo.
 * @param entity Entidad de Minecraft sobre la cual se calcula la facción y estado.
 * @param factionInfoParam Información de facción precalculada (opcional). Si se
 *   omite, se calcula vía `getEntityFactionInfo(entity)` internamente.
 * @returns Estructura `EntityConfig` con categorías resueltas, o `null` si la entidad está bloqueada.
 */
export function getConfigForEntity(
  typeId: string,
  entity: Entity,
  factionInfoParam?: EntityFactionInfo | null
): EntityConfig | null {
  const globalCats = config.global && Array.isArray(config.global.categories) ? [...config.global.categories] : [];

  // Resolver si la entidad está permitida
  let entVal: boolean | { enabled?: boolean } | undefined = undefined;
  let groupName: string | null = null;

  if (config.entities && typeof config.entities === "object") {
    for (const gName of Object.keys(config.entities)) {
      const group = config.entities[gName];
      if (group && Object.prototype.hasOwnProperty.call(group, typeId)) {
        entVal = group[typeId];
        groupName = gName;
        break;
      }
    }
  }

  if (entVal === undefined) return null;

  let allowed = true;
  if (typeof entVal === "boolean") {
    allowed = entVal;
  } else {
    // En este punto, entVal debe ser un objeto con enabled opcional
    const objVal = entVal as { enabled?: boolean };
    allowed = objVal.enabled !== undefined ? Boolean(objVal.enabled) : true;
  }

  if (!allowed) {
    debug("interactTrigger", `menu blocked by config.entities[${groupName}].${typeId} = ${JSON.stringify(entVal)}`, {
      level: "warn",
      color: "blue",
    });
    return null;
  }

  const spec: EntitySpecificConfig | undefined = getSpecificConfig(typeId);
  const specificCats = spec && Array.isArray(spec.categories) ? [...spec.categories] : [];

  // Aplicar filtrado a las categorías globales según `global_rules`.
  // Para categorías que apuntan a `submenu`, no bloqueamos la categoría
  // salvo que la categoría principal tenga su propia `id` denegada o
  // todas las categorías del submenu queden filtradas.
  const filteredGlobalCats: MenuCategory[] = [];
  const factionInfo = factionInfoParam !== undefined ? factionInfoParam : getEntityFactionInfo(entity);
  const isSpecial = factionInfo?.isSpecial ?? false;
  for (const c of globalCats) {
    if (c && c.submenu) {
      // Si la categoría principal tiene id y está denegada, excluirla
      if (c.id && !isAllowedByRule(c.id, typeId)) continue;

      const submenuCfg = config.submenus && config.submenus[c.submenu];
      const submenuCats = submenuCfg && Array.isArray(submenuCfg.categories) ? submenuCfg.categories : [];
      const filteredSub = submenuCats.filter((sc) => {
        if (!shouldIncludeCategoryForEntity(sc, typeId)) return false;
        if (sc.requiresSpecial && !isSpecial) return false;
        return true;
      });
      if (!filteredSub.length) continue; // submenu vacío -> ocultar la categoría

      // mantener la categoría (no modificar objeto original)
      filteredGlobalCats.push({ ...c });
    } else {
      if (shouldIncludeCategoryForEntity(c, typeId)) {
        // Filtrar categorías top-level con requiresSpecial
        if (c.requiresSpecial && !isSpecial) continue;
        filteredGlobalCats.push({ ...c });
      }
    }
  }

  let merged: MenuCategory[] = [];

  if (spec && spec.replace) {
    merged = [...specificCats];
  } else if (specificCats.length) {
    const insertAt = spec && spec.insertAt === "start" ? "start" : "end";
    merged = insertAt === "start" ? specificCats.concat(filteredGlobalCats) : filteredGlobalCats.concat(specificCats);
  } else {
    merged = [...filteredGlobalCats];
  }

  debug(
    "interactTrigger",
    `resolved categories for ${typeId}: specific=${specificCats.length}, global=${globalCats.length}, merged=${merged.length}`,
    { level: "debug", color: "blue" }
  );

  return {
    specific: specificCats,
    global: spec && spec.replace ? [] : filteredGlobalCats,
    merged,
    isSpecial,
    submenus: config.submenus,
  };
}

/**
 * Compara si un identificador de ítem coincide con un opener configurado,
 * admitiendo comparación exacta con namespace o coincidencia por nombre corto.
 *
 * @param mainId Identificador completo o corto del ítem a evaluar.
 * @param opener Identificador del ítem abridor configurado.
 * @returns `true` si el ítem coincide con el abridor.
 */
export function itemMatches(mainId: string | null, opener: string): boolean {
  if (!mainId || !opener) return false;
  if (opener.includes(":")) return mainId === opener;

  const parts = mainId.split(":");
  const short = parts.length > 1 ? parts[1] : parts[0];
  return short === opener || mainId === opener || mainId.endsWith(`:${opener}`);
}
