// scripts/gui/commandMenu/model/menu_entity_scanner.ts
/**
 * Escaneo dinámico de unidades activas en una dimensión.
 * Sin listas hardcodeadas de unidades.
 * Cache TTL de 40 ticks (~2 s) para evitar sobrescrituras en aperturas sucesivas.
 */

import { world, Entity, Dimension, EntityComponentTypes } from "@minecraft/server";
import { Factions, UnitHierarchy, NAMETAG_FAMILY_MAP, SpecialGroups } from "../menu_config.js";
import { debugWarn } from "../../../utils/debug.js";
import { getUnitGroup } from "./menu_groups.js";
import { getEntitiesByFaction } from "../../../utils/entityQuery.js";
import { teamFamilies } from "../../../utils/teams.js";

// ── Cache TTL ────────────────────────────────────────────────────────────────

let _scanCache: ScanResult | null = null;
let _scanCacheTick = 0;
const CACHE_TTL_TICKS = 40;

export function invalidateScanCache(): void {
  _scanCache = null;
}

export function getScanCache(): ScanResult | null {
  return _scanCache;
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

interface BucketData {
  label: string;
  nametags: Record<string, number>; // nametag -> cantidad de instancias
  unitCount: number;
}

function groupNametagsByBucket(
  entities: ScannedEntity[],
  nametagGroups: Record<string, ScannedEntity[]>
): { buckets: Record<string, BucketData>; bucketEntityMap: Record<string, string[]> } {
  const bucketDiagnostic = debugWarn;

  var buckets: Record<string, BucketData> = {};
  // nameTagBuckets: cada nametag → buckets en los que aparece (para dedup cross-bucket)
  var nameTagBuckets: Map<string, Set<string>> = new Map();

  // ── PASADA 1: clasificación inicial + construcción de nameTagBuckets ──────────
  for (var i = 0; i < entities.length; i++) {
    var e = entities[i];
    if (!e.isSpecial) continue;
    if (!e.nametag) continue;

    var bucketKey: string;
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
      var bucketLabel: string;
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

  // Nametags cross-bucket: marcar cuáles lo son (sin construir other_units aquí)
  // other_units se construye completamente en Pasada 2 desde mixedEntries
  var mixedEntries: [string, number][] = [];
  var mixedTotalCount = 0;
  for (var [nt, sets] of nameTagBuckets) {
    if (sets.size > 1) {
      // Contar total de instancias de este nametag en todos los buckets originales
      var rawTotal = 0;
      for (var s of sets) {
        rawTotal += buckets[s].nametags[nt] ?? 0;
      }
      mixedEntries.push([nt, rawTotal]);
      mixedTotalCount += rawTotal;
    }
  }

  // Diagnostic logging
  if (mixedEntries.length > 0) {
    bucketDiagnostic(
      "menuScanner",
      `[dedupCrossBucket] ${mixedEntries.length} nametags cruzaron buckets → other_units`,
      "yellow"
    );
    for (var mei = 0; mei < mixedEntries.length; mei++) {
      bucketDiagnostic("menuScanner", `  "${mixedEntries[mei][0]}" (${mixedEntries[mei][1]} unidades)`, "yellow");
    }
  }

  // ── PASADA 2: límite maxDropdowns + orden final + entity map ──────────────────
  var maxDropdowns = 10;
  var finalBucketOrder: string[] = [
    "commander_alpha1",
    "commander_delta1",
    "commander_other",
    "leader_any",
    "basic_any",
    "other_units",
  ];

  var result: Record<string, BucketData> = {};
  // Acumula entity IDs por bucket final: evita iteración duplicada en skipFlag dedup
  var resultEntityMap: Record<string, string[]> = {};

  // Nametags que sobran de maxDropdowns en buckets originales → van a other_units
  var overflowEntries: [string, number][] = [];

  for (var fo = 0; fo < finalBucketOrder.length; fo++) {
    var fk = finalBucketOrder[fo];
    var ntKeysFo: string[];
    var label: string;

    if (fk === "other_units") {
      // other_units = cross-bucket dedup + overflow de maxDropdowns de todos los buckets
      ntKeysFo = mixedEntries.map(function (e: [string, number]) {
        return e[0];
      });
      // Agregar nametags de overflow que no estén ya en mixedEntries
      for (var ov = 0; ov < overflowEntries.length; ov++) {
        var ovNt = overflowEntries[ov][0];
        var alreadyInMixed = false;
        for (var me = 0; me < mixedEntries.length; me++) {
          if (mixedEntries[me][0] === ovNt) {
            alreadyInMixed = true;
            break;
          }
        }
        if (!alreadyInMixed) ntKeysFo.push(ovNt);
      }
      label = "§8§lOtras unidades";
    } else {
      var src = buckets[fk];
      if (!src || Object.keys(src.nametags).length === 0) continue;
      ntKeysFo = Object.keys(src.nametags).sort();
      label = src.label;
    }

    var finalNt: Record<string, number> = {};
    var finalCount = 0;
    var includedCount = 0;

    // Map pre-construido de counts para other_units (optimización)
    var otherUnitsCounts: Record<string, number> = {};
    if (fk === "other_units") {
      for (var mei = 0; mei < mixedEntries.length; mei++) {
        otherUnitsCounts[mixedEntries[mei][0]] = mixedEntries[mei][1];
      }
      for (var ov2 = 0; ov2 < overflowEntries.length; ov2++) {
        if (!otherUnitsCounts[overflowEntries[ov2][0]]) {
          otherUnitsCounts[overflowEntries[ov2][0]] = overflowEntries[ov2][1];
        }
      }
    }

    for (var nf = 0; nf < ntKeysFo.length; nf++) {
      var nt = ntKeysFo[nf];
      var cnt: number;

      if (fk === "other_units") {
        // Usar el map pre-construido
        cnt = otherUnitsCounts[nt] ?? 0;
      } else {
        cnt = buckets[fk].nametags[nt] ?? 0;
      }

      // Saltar en buckets originales: los nametags cross-bucket van exclusivamente a other_units
      const bucketSet = nameTagBuckets.get(nt);
      if (bucketSet && bucketSet.size > 1 && fk !== "other_units") continue;

      // Aplicar límite de maxDropdowns (no aplica a other_units)
      // Los nametags que sobran se envían a overflow → other_units
      if (includedCount >= maxDropdowns && fk !== "other_units") {
        overflowEntries.push([nt, cnt]);
        continue;
      }

      finalNt[nt] = cnt;
      finalCount += cnt;
      includedCount++;

      // Acumular entityIds por bucket final (se usa directamente como bucketEntityMap)
      if (!resultEntityMap[fk]) resultEntityMap[fk] = [];
      var entsForTag = nametagGroups[nt] || [];
      for (var se = 0; se < entsForTag.length; se++) {
        var eid = entsForTag[se].entity.id;
        resultEntityMap[fk].push(eid);
      }
    }

    result[fk] = { label: label, nametags: finalNt, unitCount: finalCount };
  }

  return { buckets: result, bucketEntityMap: resultEntityMap };
}

// ── Escaneo principal ─────────────────────────────────────────────────────────

export function scanActiveUnits(dimension: Dimension, faction: string): ScanResult {
  const now = Date.now();

  // Verificar cache por TTL
  if (_scanCache && _scanCache.dimension === dimension.id && now - _scanCacheTick < CACHE_TTL_TICKS * 50) {
    debugWarn(
      "menuScanner",
      `[CACHE HIT] Reusando scan de ${_scanCacheTick} (${now - _scanCacheTick}ms < ${CACHE_TTL_TICKS * 50}ms TTL), dimension=${_scanCache.dimension} entities=${_scanCache.entities.length}`,
      "blue"
    );
    return _scanCache;
  }

  debugWarn(
    "menuScanner",
    `[CACHE MISS] TTL expirado o sin cache (tick=${_scanCacheTick} age=${now - (_scanCacheTick || 0)}ms TTL=${CACHE_TTL_TICKS * 50}ms dim=${_scanCache?.dimension || "none"} vs ${dimension.id})`,
    "yellow"
  );

  const entities: ScannedEntity[] = [];
  const byHierarchy: Record<string, ScannedEntity[]> = {};
  const byFamilyTag: Record<string, ScannedEntity[]> = {};
  const nametagGroups: Record<string, ScannedEntity[]> = {};

  // Optimización O1-Extended: usar función centralizada
  const rawEntities = getEntitiesByFaction(dimension, faction as "foundation" | "chaos");

  debugWarn("menuScanner", `Scan START: faction=${faction} rawEntities=${rawEntities.length}`, "dark_gray");

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
        if (!byFamilyTag[nametagFamilyId]) byFamilyTag[nametagFamilyId] = [];
        byFamilyTag[nametagFamilyId].push(scanned);

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

  // ── Sincronización de grupos entre entidades del mismo nametag ─────────────────
  // Si una instancia no tiene scpd:group pero otra del mismo nametag sí lo tiene,
  // copiarlo para mantener la consistencia.
  // IMPORTANTE: Sincroniza TODAS las entidades con el mismo nametag, sin importar
  // el bucket (jerarquía/familia MTF). Replica el comportamiento de comandos
  // vanilla como "/kill @e[name=mtf]" que operan por nametag sin distinción de jerarquía.
  for (const nametag in nametagGroups) {
    var ents = nametagGroups[nametag];
    if (ents.length < 2) continue;

    // Buscar una entidad con grupo válido
    var refGroup: string | undefined;
    for (var iRef = 0; iRef < ents.length; iRef++) {
      var g = ents[iRef].entity.getDynamicProperty("scpd:group");
      if (g) {
        refGroup = String(g);
        break;
      }
    }
    if (!refGroup) continue;

    // Asignar el grupo a todas las entidades del nametag que no lo tengan
    // (sin filtrar por bucket: cross-bucket sync)
    for (var iAssign = 0; iAssign < ents.length; iAssign++) {
      if (!ents[iAssign].entity.getDynamicProperty("scpd:group")) {
        ents[iAssign].entity.setDynamicProperty("scpd:group", refGroup);
        debugWarn("menuScanner", "Sync nametag '" + nametag + "' -> " + refGroup, "cyan");
      }
    }
  }

  // ── RE-LEER grupo después del sync para actualizar ScannedEntity ─────────────────
  // El sync anterior actualiza los DP en el mundo, pero `scanned.group`
  // se capturó antes en el loop de escaneo. Re-leer getUnitGroup de las
  // entidades que tenían NO_GROUP para que menu_system.js / buildSystemForm
  // usen el grupo correcto sin necesidad de un segundo scan.
  for (var iSync = 0; iSync < entities.length; iSync++) {
    var entSync = entities[iSync];
    if (!entSync.isSpecial) continue;
    if (entSync.faction !== faction) continue;
    if (entSync.group === SpecialGroups.NO_GROUP) {
      var newGroup = getUnitGroup(entSync.entity);
      if (newGroup !== SpecialGroups.NO_GROUP) {
        entSync.group = newGroup;
        debugWarn(
          "menuScanner",
          `[postSync] "${entSync.nametag}" (${entSync.typeId}): group actualizado a ${newGroup}`,
          "green"
        );
      }
    }
  }

  const activeHierarchies = Object.keys(byHierarchy).filter((h) => (byHierarchy[h]?.length ?? 0) > 0);

  const activeFamilyTags: { [tagId: string]: { label: string; unitCount: number } } = {};
  for (const [tagId, ents] of Object.entries(byFamilyTag)) {
    if (ents.length > 0) {
      activeFamilyTags[tagId] = { label: tagId, unitCount: ents.length };
    }
  }

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
  };

  _scanCache = result;
  _scanCacheTick = now;

  debugWarn(
    "menuScanner",
    `Scan: ${entities.length} entidades, ${activeHierarchies.length} jerarquías, ${Object.keys(activeFamilyTags).length} familias`,
    "cyan"
  );

  return result;
}
