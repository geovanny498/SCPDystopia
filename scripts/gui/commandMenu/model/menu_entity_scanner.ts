// scripts/gui/commandMenu/model/menu_entity_scanner.ts
/**
 * Escaneo dinámico de unidades activas en una dimensión.
 * Sin listas hardcodeadas de unidades.
 * Cache TTL de 40 ticks (~2 s) para evitar sobrescrituras en aperturas sucesivas.
 */

import { Entity, Dimension, EntityComponentTypes } from "@minecraft/server";
import { Factions, UnitHierarchy, NAMETAG_FAMILY_MAP, SpecialGroups } from "../menu_config.js";
import { debugWarn } from "../../../utils/debug.js";
import { getUnitGroup, ENTITY_GROUP_DP } from "./menu_groups.js";
import { compareNametags } from "../../../utils/nametagSort.js";
import { getEntitiesByFaction } from "../../../utils/entityQuery.js";
import { teamFamilies } from "../../../utils/teams.js";

// ── Cache TTL ────────────────────────────────────────────────────────────────

interface _ScanCacheEntry {
  result: ScanResult;
  tick: number;
}

const _scanCache = new Map<string, _ScanCacheEntry>();
const CACHE_TTL_TICKS = 40;

export function invalidateScanCache(): void {
  _scanCache.clear();
}

export function getScanCache(): ScanResult | null {
  // Devuelve la entrada más reciente si existe
  let newest: _ScanCacheEntry | undefined;
  for (const entry of _scanCache.values()) {
    if (!newest || entry.tick > newest.tick) newest = entry;
  }
  return newest?.result ?? null;
}

// ── Cache de getEntities por dimensión + facción ───────────────────────────────
// Evita llamadas repetidas a dimension.getEntities durante ráfagas de spawn
// (EntitySpawn se dispara una vez por entidad → sin cache: N llamadas para N entidades).

interface _EntityQueryCacheEntry {
  entities: any[];
  tick: number;
}

const _entityQueryCache = new Map<string, _EntityQueryCacheEntry>();
const ENTITY_QUERY_CACHE_TTL = 5; // 5 ticks ~ 250ms: solo cubre la ráfaga de spawn

/**
 * Invalida el cache de consultas de entidades.
 * Se llama junto con invalidateScanCache en eventos que modifican el mundo.
 */
export function invalidateEntityQueryCache(): void {
  _entityQueryCache.clear();
}

/**
 * Obtiene entidades filtradas por familias de facción, con cache de 250ms
 * para evitar getEntities repetidas dentro de la misma ráfaga de spawn.
 */
export function getEntitiesCached(dimension: Dimension, faction: string): any[] {
  const key = `${dimension.id}:${faction}`;
  const now = Date.now();

  const cached = _entityQueryCache.get(key);
  if (cached && now - cached.tick < ENTITY_QUERY_CACHE_TTL * 50) {
    debugWarn(
      "menuScanner",
      `[entityQueryCache HIT] ${key} age=${now - cached.tick}ms count=${cached.entities.length}`,
      "blue"
    );
    return cached.entities;
  }

  // Optimización O1-Extended: usar función centralizada
  const rawAll = getEntitiesByFaction(dimension, faction as "foundation" | "chaos");

  const result: any[] = [];
  for (const e of rawAll) {
    result.push(e);
  }

  _entityQueryCache.set(key, { entities: result, tick: now });
  debugWarn("menuScanner", `[entityQueryCache MISS] ${key} count=${result.length}`, "yellow");

  return result;
}

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface ScannedEntity {
  entity: Entity;
  nametag: string;
  typeId: string;
  families: string[];
  faction: string;
  isSpecial: boolean;
  hierarchy: string;
  nametagFamilyId: string;
  group?: string; // Para especiales: el grupo asignado (A-D / Sin grupo)
}

interface BucketData {
  label: string;
  nametags: { [nametag: string]: number };
  unitCount: number;
}

export interface ScanResult {
  entities: ScannedEntity[];
  byHierarchy: Record<string, ScannedEntity[]>;
  byFamilyTag: Record<string, ScannedEntity[]>;
  nametagGroups: Record<string, ScannedEntity[]>;
  activeHierarchies: string[];
  activeFamilyTags: { [tagId: string]: { label: string; unitCount: number } };
  // Clave: bucketId, Valor: datos del bucket
  buckets: Record<string, BucketData>;
  // Mapa pre-computado: bucketId → IDs de entidades que pertenecen a ese bucket después de dedup
  bucketIdMap: Record<string, string[]>;
  dimension: string;
  faction: string;
}

// ── Detección de facción por familias ───────────────────────────────────────

function detectFaction(ent: Entity): string | null {
  const typeFamilies = ent.getComponent(EntityComponentTypes.TypeFamily);
  if (!typeFamilies) return null;

  const families = typeFamilies.getTypeFamilies();

  for (const fam of teamFamilies.foundation) {
    if (families.includes(fam)) return Factions.FOUNDATION;
  }
  for (const fam of teamFamilies.chaos) {
    if (families.includes(fam)) return Factions.CHAOS;
  }

  return null;
}

// ── Detección de jerarquía por type_family de la entidad ───────────────────
// Jerarquía confiable: coincide con las familias de jerarquía agregadas a los
// paquetes de comportamiento (Normal/, Leaders/, Commanders/). Se extrae
// directamente de type_family, sin depender de convenciones en el typeId.

function detectHierarchyFromFamilies(families: string[]): string {
  for (const f of families) {
    if (f === "hierarchy_commander") return UnitHierarchy.COMMANDER;
    if (f === "hierarchy_leader") return UnitHierarchy.LEADER;
    if (f === "hierarchy_basic") return UnitHierarchy.BASIC;
  }
  return UnitHierarchy.BASIC;
}

// ── Extracción de familia MTF para agrupación UI ─────────────────────────────

function extractMtfFamily(families: string[]): string {
  for (const f of families) {
    if (f.startsWith("mtf_") || f.startsWith("chaos_")) return f;
  }
  return families[0] ?? "unknown";
}

// ── Agrupación de nametags por bucket (jerarquía + familia MTF principal) ───────
// Devuelve un Record<bucketId, { label, nametags[], unitCount }>
// donde bucketId combina jerarquía y familia MTF para crear agrupaciones
// sin duplicar nametags aunque aparezcan en múltiples familias.

function groupNametagsByBucket(
  entities: ScannedEntity[],
  nametagGroups: Record<string, ScannedEntity[]>
): { buckets: Record<string, BucketData>; bucketEntityMap: Record<string, string[]> } {
  const bucketDiagnostic = debugWarn;

  const buckets: Record<string, BucketData> = {};
  // nameTagBuckets: cada nametag → buckets en los que aparece (para dedup cross-bucket)
  const nameTagBuckets = new Map<string, Set<string>>();

  // ── BUCLE 1: clasificación inicial + construcción de nameTagBuckets ──────────
  for (let i = 0; i < entities.length; i++) {
    const e = entities[i];
    if (!e.isSpecial) continue;
    if (!e.nametag) continue;

    let bucketKey: string;
    if (e.hierarchy === UnitHierarchy.COMMANDER) {
      if (e.nametagFamilyId === "mtf_alpha1") {
        bucketKey = "commander_alpha1";
      } else if (e.nametagFamilyId === "mtf_delta1") {
        bucketKey = "commander_delta1";
      } else {
        bucketKey = "commander_other";
      }
    } else if (e.hierarchy === UnitHierarchy.LEADER) {
      bucketKey = "leader_any";
    } else {
      bucketKey = "basic_any";
    }

    if (!buckets[bucketKey]) {
      let bucketLabel: string;
      switch (bucketKey) {
        case "commander_delta1":
          bucketLabel = NAMETAG_FAMILY_MAP["mtf_delta1"].label;
          break;
        case "commander_alpha1":
          bucketLabel = NAMETAG_FAMILY_MAP["mtf_alpha1"].label + " §8(Comandantes)";
          break;
        case "commander_other":
          bucketLabel = "§6§lOtros Comandantes";
          break;
        case "leader_any":
          bucketLabel = "§e§lLíderes";
          break;
        case "basic_any":
          bucketLabel = "§a§lBásicos";
          break;
        default:
          bucketLabel = bucketKey;
      }
      buckets[bucketKey] = { label: bucketLabel, nametags: {}, unitCount: 0 };
    }

    buckets[bucketKey].unitCount += 1;
    if (!buckets[bucketKey].nametags[e.nametag]) {
      buckets[bucketKey].nametags[e.nametag] = 0;
    }
    buckets[bucketKey].nametags[e.nametag] += 1;

    // Rastrear en qué buckets aparece cada nametag (reemplaza Fases 2+3 enteras)
    if (!nameTagBuckets.has(e.nametag)) {
      nameTagBuckets.set(e.nametag, new Set());
    }
    nameTagBuckets.get(e.nametag)!.add(bucketKey);
  }

  // ── BUCLE 2: Pre-construir estructuras de búsqueda (optimización) ────────────
  const crossBucketNametags = new Set<string>();
  const otherUnitsCounts = new Map<string, number>();
  const mixedEntries: [string, number][] = [];

  for (const [nt, bucketSet] of nameTagBuckets) {
    if (bucketSet.size > 1) {
      crossBucketNametags.add(nt);

      // Calcular total de instancias usando reduce (más funcional)
      const rawTotal = Array.from(bucketSet).reduce(
        (sum, bucketKey) => sum + (buckets[bucketKey].nametags[nt] ?? 0),
        0
      );

      otherUnitsCounts.set(nt, rawTotal);
      mixedEntries.push([nt, rawTotal]);
    }
  }

  // Diagnostic logging
  if (mixedEntries.length > 0) {
    bucketDiagnostic(
      "menuScanner",
      `[dedupCrossBucket] ${mixedEntries.length} nametags cruzaron buckets → other_units`,
      "yellow"
    );
    for (const [name, count] of mixedEntries) {
      bucketDiagnostic("menuScanner", `  "${name}" (${count} unidades)`, "yellow");
    }
  }

  // ── BUCLE 3: Pasada 2 optimizada con lookups O(1) ────────────────────────────
  const maxDropdowns = 10;
  const finalBucketOrder: string[] = [
    "commander_alpha1",
    "commander_delta1",
    "commander_other",
    "leader_any",
    "basic_any",
    "other_units",
  ];

  const result: Record<string, BucketData> = {};
  const resultEntityMap: Record<string, string[]> = {};
  const overflowEntries: [string, number][] = [];

  for (const fk of finalBucketOrder) {
    let ntKeysFo: string[];
    let label: string;

    if (fk === "other_units") {
      // other_units = cross-bucket dedup + overflow de maxDropdowns de todos los buckets
      const combined = new Set(mixedEntries.map((e) => e[0]));
      overflowEntries.forEach(([nt, cnt]) => {
        combined.add(nt);
        if (!otherUnitsCounts.has(nt)) {
          otherUnitsCounts.set(nt, cnt);
        }
      });
      ntKeysFo = Array.from(combined).sort(compareNametags);
      label = "§8§lOtras unidades";
    } else {
      const src = buckets[fk];
      if (!src || Object.keys(src.nametags).length === 0) continue;
      ntKeysFo = Object.keys(src.nametags).sort(compareNametags);
      label = src.label;
    }
    const finalNt: Record<string, number> = {};
    let finalCount = 0;
    let includedCount = 0;

    for (const nt of ntKeysFo) {
      // Lookup O(1) en lugar de búsqueda lineal
      if (crossBucketNametags.has(nt) && fk !== "other_units") continue;

      const cnt = fk === "other_units" ? (otherUnitsCounts.get(nt) ?? 0) : (buckets[fk].nametags[nt] ?? 0);

      if (includedCount >= maxDropdowns && fk !== "other_units") {
        overflowEntries.push([nt, cnt]);
        continue;
      }

      finalNt[nt] = cnt;
      finalCount += cnt;
      includedCount++;

      // Acumular entityIds
      if (!resultEntityMap[fk]) resultEntityMap[fk] = [];
      const entsForTag = nametagGroups[nt] || [];
      for (const se of entsForTag) {
        resultEntityMap[fk].push(se.entity.id);
      }
    }

    result[fk] = { label, nametags: finalNt, unitCount: finalCount };
  }

  return { buckets: result, bucketEntityMap: resultEntityMap };
}

// ── Escaneo principal ─────────────────────────────────────────────────────────

export function scanActiveUnits(dimension: Dimension, faction: string): ScanResult {
  const now = Date.now();
  const cacheKey = `${dimension.id}:${faction}`;

  // Verificar cache por clave compuesta (dimension + faction) y TTL
  const cached = _scanCache.get(cacheKey);
  if (cached) {
    const age = now - cached.tick;
    if (age < CACHE_TTL_TICKS * 50) {
      debugWarn(
        "menuScanner",
        `[CACHE HIT] key=${cacheKey} age=${age}ms < ${CACHE_TTL_TICKS * 50}ms TTL, dimension=${cached.result.dimension} entities=${cached.result.entities.length}`,
        "blue"
      );
      return cached.result;
    }
  }

  debugWarn(
    "menuScanner",
    `[CACHE MISS] key=${cacheKey} faction=${faction} age=${cached ? now - cached.tick : "n/a"}ms TTL=${CACHE_TTL_TICKS * 50}ms dim=${dimension.id}`,
    "yellow"
  );

  const entities: ScannedEntity[] = [];
  const byHierarchy: Record<string, ScannedEntity[]> = {};
  const byFamilyTag: Record<string, ScannedEntity[]> = {};
  const nametagGroups: Record<string, ScannedEntity[]> = {};
  const activeFamilyTags: { [tagId: string]: { label: string; unitCount: number } } = {};

  // Optimización O1-Extended: usar función centralizada
  const rawEntities = getEntitiesByFaction(dimension, faction as "foundation" | "chaos");

  debugWarn("menuScanner", `Scan START: faction=${faction} rawEntities=${rawEntities.length}`, "dark_gray");

  // ── BUCLE 1: Escaneo principal ────────────────────────────────────────────────
  for (const ent of rawEntities) {
    try {
      if (!ent || !ent.id) continue;

      const typeFamiliesComp = ent.getComponent(EntityComponentTypes.TypeFamily);
      const families: string[] = typeFamiliesComp ? typeFamiliesComp.getTypeFamilies() : [];

      const detectedFaction = detectFaction(ent);
      if (!detectedFaction) continue;

      const nametag = (ent.nameTag ?? "").trim();
      const typeId = ent.typeId;
      const isSpecial = nametag !== "";
      const hierarchy = detectHierarchyFromFamilies(families);
      const nametagFamilyId = isSpecial ? extractMtfFamily(families) : "";

      const scanned: ScannedEntity = {
        entity: ent,
        nametag,
        typeId,
        families,
        faction: detectedFaction,
        isSpecial,
        hierarchy,
        nametagFamilyId,
        group: isSpecial ? getUnitGroup(ent) : undefined,
      };
      entities.push(scanned);

      if (!byHierarchy[hierarchy]) byHierarchy[hierarchy] = [];
      byHierarchy[hierarchy].push(scanned);

      if (isSpecial && nametagFamilyId) {
        // Construir byFamilyTag y activeFamilyTags inline (optimización)
        if (!byFamilyTag[nametagFamilyId]) {
          byFamilyTag[nametagFamilyId] = [];
          activeFamilyTags[nametagFamilyId] = { label: nametagFamilyId, unitCount: 0 };
        }
        byFamilyTag[nametagFamilyId].push(scanned);
        activeFamilyTags[nametagFamilyId].unitCount++;

        if (!nametagGroups[nametag]) nametagGroups[nametag] = [];
        nametagGroups[nametag].push(scanned);
      }

      debugWarn(
        "menuScanner:ent",
        `  ent="${typeId}" nametag="${nametag}" isSpecial=${isSpecial} faction=${detectedFaction} familyId="${nametagFamilyId}" group="${isSpecial ? scanned.group : "n/a"}"`,
        "dark_gray"
      );
    } catch (e) {
      debugWarn("menuScanner", `Error escaneando entidad ${ent?.typeId}: ${e}`, "yellow");
    }
  }

  // ── BUCLE 2: Construir mapa de grupos de referencia (sin anidación) ──────────
  // Primera pasada sobre entities: encontrar el primer grupo válido para cada nametag
  const nametagToRefGroup = new Map<string, string>();

  for (let i = 0; i < entities.length; i++) {
    const scanned = entities[i];
    if (!scanned.isSpecial || !scanned.nametag) continue;

    // Si ya encontramos un grupo para este nametag, skip
    if (nametagToRefGroup.has(scanned.nametag)) continue;

    // IMPORTANTE: Usar getDynamicProperty directo, NO getUnitGroup()
    // getUnitGroup() convierte undefined → NO_GROUP, perdiendo la distinción entre:
    // - undefined: entidad nueva sin asignar (debe sincronizarse)
    // - NO_GROUP: entidad explícitamente asignada a "Sin grupo" (NO debe sincronizarse)
    const g = scanned.entity.getDynamicProperty(ENTITY_GROUP_DP);
    if (g) {
      nametagToRefGroup.set(scanned.nametag, String(g));
    }
  }

  // ── BUCLE 3: Aplicar sincronización de grupos (sin anidación) ────────────────
  // Segunda pasada sobre entities: aplicar grupos de referencia a entidades sin grupo
  for (let i = 0; i < entities.length; i++) {
    const scanned = entities[i];
    if (!scanned.isSpecial || !scanned.nametag) continue;

    const refGroup = nametagToRefGroup.get(scanned.nametag);
    if (!refGroup) continue;

    // Solo actualizar si NO tiene propiedad dinámica (undefined)
    // NO usar getUnitGroup() aquí por la misma razón
    if (!scanned.entity.getDynamicProperty(ENTITY_GROUP_DP)) {
      scanned.entity.setDynamicProperty(ENTITY_GROUP_DP, refGroup);
      scanned.group = refGroup; // Actualizar inmediatamente (elimina bucle de re-lectura)
      debugWarn("menuScanner", `Sync nametag '${scanned.nametag}' -> ${refGroup}`, "cyan");
    }
  }

  const activeHierarchies = Object.keys(byHierarchy).filter((h) => (byHierarchy[h]?.length ?? 0) > 0);

  const bucketResult = groupNametagsByBucket(entities, nametagGroups);

  const result: ScanResult = {
    entities,
    byHierarchy,
    byFamilyTag,
    nametagGroups,
    activeHierarchies,
    activeFamilyTags,
    buckets: bucketResult.buckets,
    bucketIdMap: bucketResult.bucketEntityMap,
    dimension: dimension.id,
    faction,
  };

  _scanCache.set(cacheKey, { result, tick: now });

  debugWarn(
    "menuScanner",
    `Scan: ${entities.length} entidades, ${activeHierarchies.length} jerarquías, ${Object.keys(activeFamilyTags).length} familias`,
    "cyan"
  );

  return result;
}
