// scripts/gui/commandMenu/model/menu_entity_scanner.ts
/**
 * Escaneo dinámico de unidades activas en una dimensión.
 * Sin listas hardcodeadas de unidades.
 * Cache TTL de 40 ticks (~2 s) para evitar sobrescrituras en aperturas sucesivas.
 */

import { world, Entity, Dimension, EntityComponentTypes } from "@minecraft/server";
import {
  Factions,
  UnitHierarchy,
  NAMETAG_FAMILY_MAP,
  getFamilyTagLabel,
  getFamilyTagOrder,
  SpecialGroups,
} from "../menu_config.js";
import { teamFamilies } from "../../../utils/teams.js";
import { debugWarn } from "../../../utils/debug.js";
import { getUnitGroup } from "./menu_groups.js";

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

interface ScanResult {
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

interface FamilyInfo {
  familyId: string;
  count: number;
}
interface BucketData {
  label: string;
  nametags: Record<string, number>; // nametag -> cantidad de instancias
  unitCount: number;
}

function groupNametagsByBucket(
  entities: ScannedEntity[],
  nametagGroups: Record<string, ScannedEntity[]>
): { buckets: Record<string, BucketData>; bucketEntityMap: Record<string, string[]> } {
  // Acumulador: bucketKey -> BucketData
  var buckets: Record<string, BucketData> = {};

  for (var i = 0; i < entities.length; i++) {
    var e = entities[i];
    if (!e.isSpecial) continue;
    if (!e.nametag) continue;

    // Determinar bucketKey según jerarquía + familia MTF
    var bucketKey: string;
    if (e.hierarchy === UnitHierarchy.COMMANDER) {
      // Comandantes: separar alpha1, delta1 y "otros"
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
      // Label según bucketKey
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
  }

  // ── Cross-bucket dedup ─────────────────────────────────────────────────────
  // Construir allNametags = { nametag → { firstBucketKey, count, bucketCount } }
  // rastrea en cuántos buckets distintos aparece cada nametag.
  var allNametagInfo: Record<string, { firstBucketKey: string; count: number; bucketCount: number }> = {};
  var bucketOrderDedup = ["commander_alpha1", "commander_delta1", "commander_other", "leader_any", "basic_any"];
  for (var boD = 0; boD < bucketOrderDedup.length; boD++) {
    var bkD = bucketOrderDedup[boD];
    if (!buckets[bkD]) continue;
    var ntKeysD = Object.keys(buckets[bkD].nametags);
    for (var nD = 0; nD < ntKeysD.length; nD++) {
      var ntD = ntKeysD[nD];
      var cntD = buckets[bkD].nametags[ntD];
      if (!allNametagInfo[ntD]) {
        allNametagInfo[ntD] = { firstBucketKey: bkD, count: cntD, bucketCount: 1 };
      } else {
        allNametagInfo[ntD].count += cntD;
        allNametagInfo[ntD].bucketCount += 1;
      }
    }
  }

  // Separar nametags:
  // exclusivos  → bucketCount === 1 → van a su bucket original
  // duplicados  → bucketCount > 1   → TODOS van a mixed_hierarchy, NINGUNO en buckets originales
  var mixedNametags: Record<string, number> = {};
  for (var ntCheck in allNametagInfo) {
    if (allNametagInfo[ntCheck].bucketCount > 1) {
      mixedNametags[ntCheck] = allNametagInfo[ntCheck].count;
    }
  }

  // Armar resultBuckets: buckets individuales con nametags exclusivos solamente
  var resultBuckets: Record<string, BucketData> = {};
  for (var bo2 = 0; bo2 < bucketOrderDedup.length; bo2++) {
    var bk2 = bucketOrderDedup[bo2];
    if (!buckets[bk2]) continue;
    var ntKeys2 = Object.keys(buckets[bk2].nametags);
    if (ntKeys2.length === 0) continue;

    var finalNt2: Record<string, number> = {};
    var finalCount2 = 0;
    for (var n2 = 0; n2 < ntKeys2.length; n2++) {
      var nt2 = ntKeys2[n2];
      // Solo incluir si NO es duplicado (no está en mixedNametags)
      if (!mixedNametags[nt2]) {
        finalNt2[nt2] = buckets[bk2].nametags[nt2];
        finalCount2 += buckets[bk2].nametags[nt2];
      }
    }

    if (Object.keys(finalNt2).length > 0) {
      resultBuckets[bk2] = {
        label: buckets[bk2].label,
        nametags: finalNt2,
        unitCount: finalCount2,
      };
    }
  }

  // Transferir nametags sobrantes (>10 por bucket) a other_units
  var maxDropdowns = 10;
  for (var bkOver of Object.keys(resultBuckets)) {
    if (bkOver === "other_units") continue; // ya fue procesado o se crea después
    var ntKeys = Object.keys(resultBuckets[bkOver].nametags);
    if (ntKeys.length <= maxDropdowns) continue;
    var excess = ntKeys.slice(maxDropdowns);
    for (var i = 0; i < excess.length; i++) {
      var nt = excess[i];
      var cnt = resultBuckets[bkOver].nametags[nt];
      delete resultBuckets[bkOver].nametags[nt];
      resultBuckets[bkOver].unitCount -= cnt;
      if (!resultBuckets["other_units"]) {
        resultBuckets["other_units"] = { label: "§8§lOtras unidades", nametags: {}, unitCount: 0 };
      }
      if (!resultBuckets["other_units"].nametags[nt]) resultBuckets["other_units"].nametags[nt] = 0;
      resultBuckets["other_units"].nametags[nt] += cnt;
      resultBuckets["other_units"].unitCount += cnt;
    }
  }

  // Agregar other_units si hay duplicados cross-bucket (ya existentes en mixedNametags)
  if (Object.keys(mixedNametags).length > 0) {
    resultBuckets["other_units"] = {
      label: "§8§lOtras unidades",
      nametags: mixedNametags,
      unitCount: Object.values(mixedNametags).reduce(function (a, b) {
        return a + b;
      }, 0),
    };
  }

  // Armar resultado final: buckets de jerarquía primero, other_units al final
  var result: Record<string, BucketData> = {};
  var finalBucketOrder = [
    "commander_alpha1",
    "commander_delta1",
    "commander_other",
    "leader_any",
    "basic_any",
    "other_units",
  ];
  for (var fi = 0; fi < finalBucketOrder.length; fi++) {
    var fk = finalBucketOrder[fi];
    if (resultBuckets[fk]) {
      result[fk] = resultBuckets[fk];
    }
  }

  // ── Mapa bucketId → IDs de entidades  (para el build del modal) ───────────
  // Construido DESPUÉS de la dedup cross-bucket: cada bucket ya tiene sus
  // nametags finales (incluyendo mixed_hierarchy), así que bucketEntityMap
  // contiene las entidades correctas para cada bucket sin duplicar.
  var bucketEntityMap: Record<string, string[]> = {};
  var allResultKeys = Object.keys(resultBuckets);
  for (var mk = 0; mk < allResultKeys.length; mk++) {
    var bkMap = allResultKeys[mk];
    var bkNts = Object.keys(resultBuckets[bkMap].nametags);
    for (var ntM = 0; ntM < bkNts.length; ntM++) {
      var scEntsM = nametagGroups[bkNts[ntM]] || [];
      for (var se = 0; se < scEntsM.length; se++) {
        var eidM = scEntsM[se].entity.id;
        if (!bucketEntityMap[bkMap]) bucketEntityMap[bkMap] = [];
        bucketEntityMap[bkMap].push(eidM);
      }
    }
  }
  return { buckets: result, bucketEntityMap };
}

// ── Escaneo principal ─────────────────────────────────────────────────────────

export function scanActiveUnits(dimension: Dimension, faction: string): ScanResult {
  const now = Date.now();

  // Verificar cache por TTL
  if (_scanCache && _scanCache.dimension === dimension.id && now - _scanCacheTick < CACHE_TTL_TICKS * 50) {
    return _scanCache;
  }

  const entities: ScannedEntity[] = [];
  const byHierarchy: Record<string, ScannedEntity[]> = {};
  const byFamilyTag: Record<string, ScannedEntity[]> = {};
  const nametagGroups: Record<string, ScannedEntity[]> = {};

  const targetFamilies = teamFamilies[faction as keyof typeof teamFamilies] ?? [];

  const rawEntities =
    targetFamilies.length > 0 ? dimension.getEntities({ families: targetFamilies }) : dimension.getEntities({});

  debugWarn(
    "menuScanner",
    `Scan START: faction=${faction} targetFamilies=${JSON.stringify(targetFamilies)} rawEntities=${rawEntities.length}`,
    "dark_gray"
  );

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
