# Plan: Análisis y decisión sobre optimización de `groupNametagsByBucket`

**Fecha:** 2026-05-21 12:40 (America/New_York)

---

## Hallazgos sobre la función actual

Archivo: `scripts/gui/commandMenu/model/menu_entity_scanner.ts:125–313`

La función `groupNametagsByBucket` tiene **8 fases distintas de procesamiento**, de las cuales solo las fases 2 a 5 sufren de iteraciones redundantes explícitas:

| #   | Fase                       | Líneas  | Bucle                                                   | Propósito                                   |
| --- | -------------------------- | ------- | ------------------------------------------------------- | ------------------------------------------- |
| 1   | Clasificación por bucket   | 132–184 | **1** sobre `entities` (O(n))                           | Construye `buckets` con conteos             |
| 2   | Cross-bucket dedup         | 191–205 | 2 anidados sobre `bucketOrderDedup × nametags/bucket`   | Construye `allNametagInfo`                  |
| 3   | Marcar duplicados          | 211–214 | 1 sobre `allNametagInfo`                                | Arma `mixedNametags`                        |
| 4   | Armado exclusivos          | 219–243 | 2 anidados sobre `bucketOrderDedup × nametags/bucket`   | Arma `resultBuckets` sin duplicados         |
| 5   | Excedentes por bucket      | 247–264 | 2 anidados sobre `resultBuckets × nametags`             | Mueve nametags >10 a `other_units`          |
| 6   | other_units por duplicados | 267–275 | —                                                       | Agrega `other_units` si hay `mixedNametags` |
| 7   | Reorden final              | 287–292 | 1 sobre `finalBucketOrder` (6 items fijos)              | Arma `result`                               |
| 8   | bucketEntityMap            | 300–311 | 2 anidados sobre `resultBuckets × nametags × entidades` | Mapea bucketId → IDs                        |

---

## Problemática identificada

### Redundancias graves

**Fases 2 + 3 + 4 son triplemente redundantes:**

```
Fase 2 (todas las nametags)  →  construye allNametagInfo con bucketCount
Fase 3 (todas las nametags)  →  extrae mixedNametags (los duplicados)
Fase 4 (todas las nametags)  →  re-itera los mismos datos para armar resultBuckets con exclusivos
```

Estas tres fases juntas re-re-corren **exactamente los mismos nametags** 3 veces. La información de "¿qué buckets contiene un nametag?" se calcula en la Fase 2, se usa en la Fase 3, y se vuelve a consultar en la Fase 4 — pero la Fase 4 no usa `allNametagInfo` ni `mixedNametags`, solo mira si una nametag está en `mixedNametags`, es decir que es una re-iteración disfrazada de filtrado.

**Fase 4 y Fase 5 re-iteran los mismos buckets:**

- Fase 4 recorre todos los buckets y nametags para armar `resultBuckets` (filtrado de no-duplicados)
- Fase 5 recorre los mismos `resultBuckets` para mover excedentes — estos son los mismos nametags que acabamos de meter en Fase 4.

### ¿Por qué no se hizo así desde el principio?

La separación en fases hace el código más fácil de testear visualmente cada paso, pero introduce O(2–3 × total_nametags) de iteraciones innecesarias. No hay dependencias funcionales que lo justifiquen.

---

## Propuesta de optimización

Se puede reducir el total de iteraciones sobre nametags de **~7 pasadas a solo 2**, fusionando:

### Bucle 1 — Sobre `entities` (Fase 1 original)

Lo que ya hace: clasifica cada entidad en un bucket y acumula `buckets[bucketKey].nametags`.

**Cambio**: además de `buckets`, también construir `nameTagBuckets: Record<string, Set<string>>` (nametag → set de bucketKeys en los que aparece). Esto reemplaza las Fases 2 y 3 enteras — en la MISMA pasada que ya existe.

### Bucle 2 — Sobre los 6 buckets finales (fijos, ≤6 iteraciones)

Única iteración donde se decide tanto la deduplicación como el límite de excedentes:

```
Para cada bucket en finalBucketOrder:
  1. Filtrar nametags: exclusivas → bucket original | duplicadas → other_units
  2. Aplicar límite maxDropdowns: sobrantes → other_units
  3. Acumular unitCount correcto
Todo en el mismo bucle, sin estructuras intermedias innecesarias.
```

Esto reemplaza las Fases 4 y 5 en una sola pasada sobre ≤6 buckets.

### Bucle 3 — Para `bucketEntityMap` (Fase 8)

Mantener igual; es necesario y no se puede evitar sin cambiar la lógica del modal.

---

## Resumen de iteraciones

|                                                          | Actual                 | Optimizado     |
| -------------------------------------------------------- | ---------------------- | -------------- |
| Sobre `entities`                                         | 1                      | 1              |
| Sobre buckets × nametags (cross-bucket dedup)            | 2 (Fases 2 y 4 aprox.) | **eliminadas** |
| Sobre `allNametagInfo` / `mixedNametags`                 | 1 (Fase 3)             | **eliminada**  |
| Sobre `resultBuckets` (dedup + excedentes)               | 2 (Fases 4 y 5)        | **1 (fusión)** |
| Sobre `finalBucketOrder`                                 | 1 (Fase 7)             | 1 (sin cambio) |
| Sobre buckets × nametags × entidades (`bucketEntityMap`) | 1 (Fase 8)             | 1 (sin cambio) |
| **Total de bucles distintos**                            | **8**                  | **4**          |
| **Pasadas sobre nametags**                               | **~7**                 | **~2**         |

---

## Decisión

**Sí, la función es iterativa y redundante.** Las fases 2–5 contienen **3 re-iteraciones completas sobre el mismo conjunto de nametags** que no están justificadas por ninguna dependencia real — son un patrón de "procesar en pasos pequeños" que sacrifica rendimiento por legibilidad pasiva.

Se puede reducir el código de **~190 líneas** (líneas 186–293) a **~40–60 líneas** fusionando fases, eliminando estructuras intermedias (`allNametagInfo`, `mixedNametags` como paso separado) y combinando la deduplicación con el límite de excedentes en un solo bucle de buckets final.

Los dos cambios recomendados:

1. **Construir `nameTagBuckets` en la Fase 1** (elimina Fases 2 y 3)
2. **Fusionar Fases 4 y 5** en un solo bucle sobre los 6 buckets finales

El resto del código de la función (clasificación inicial, bucketEntityMap, reorden) se mantiene igual o se simplifica marginalmente.
