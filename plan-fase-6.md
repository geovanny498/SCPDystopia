# Plan: Fase 6 — Centralización final, reutilización y limpieza

- **Estado:** Pendiente de implementación (revisión cruzada con `auditoria-fase-6.md` integrada 01/09/2026)
- **Fecha última actualización:** 01/09/2026
- **Plan padre:** `plan-commandmenu-ddui.md`
- **Auditoría independiente:** `auditoria-fase-6.md` (Sonnet 4.5) — integrada en este plan; ver sección "Trazabilidad de análisis".
- **Objetivo:** Eliminar la duplicación entre `scripts/gui/commandMenu/menu_config.ts` (legacy), `scripts/gui/interactMenu/config.ts` y `scripts/gui/shared/systemCatalog.ts` (DDUI), centralizando textos, eventos, defaults y constantes de UI en un único catálogo compartido. Migrar gradualmente los consumidores actuales del legacy (`commandMenu/ddui`, `interactMenu`; los demás quedan opcionales si no necesitan migración inmediata) sin romper la fuente de verdad del commandMenu legacy ni el funcionamiento de los otros menús.

---

## Pre-requisito común a TODAS las subfases

**Antes de comenzar la implementación de cualquier subfase (6.1, 6.2, 6.3, 6.4, 6.5, 6.6):**

1. Releer íntegramente este `plan-fase-6.md`.
2. Releer los archivos vigentes al momento de iniciar la fase:
   - `scripts/gui/shared/systemCatalog.ts`
   - `scripts/gui/commandMenu/menu_config.ts`
   - `scripts/gui/interactMenu/config.ts`
   - `scripts/gui/interactMenu/gui.ts`
   - `scripts/gui/shared/playerPermissionManager.ts`
   - `scripts/gui/shared/entityScope.ts`
   - Los archivos de cada subfase a tocar.
3. Ejecutar `rg`/`grep` para confirmar que no aparezcan:
   - Nuevos literales duplicados fuera del catálogo.
   - Nuevos IDs de sistema (`movement`, `fire`, `spawn`, `health`, `teleport`, `invincible`) hardcodeados fuera del catálogo.
   - Nuevos eventos `humanoid:*` o `mtf:*` fuera del catálogo.
   - Nuevos nombres de DP `scpd_system_*` o `scpd_menu_*` fuera del catálogo.
4. Si se encuentra cualquier discrepancia no listada en este plan, **detener la implementación**, actualizar el plan con la nueva discrepancia y reanudar la fase solo después de aprobada la actualización.
5. Verificar `npm run local-deploy` antes y después de la fase.

Este pre-requisito aplica también para fases 6.2 → 6.3 → 6.4 → 6.5 → 6.6: cada fase debe confirmar que las anteriores siguen válidas (no hubo cambios upstream que invaliden su trabajo).

---

## Contexto y aclaraciones del usuario

- El plan original de Fase 6 quedó desactualizado porque se redactó contra una versión previa del código.
- Los **textos más actualizados y descripciones funcionales trabajadas** viven en `scripts/gui/interactMenu/gui.ts` (consumidos desde `interactMenu/config.ts`). Sin embargo, las **IDs que importan para la configuración de sistemas** son las de `scripts/gui/commandMenu/menu_config.ts`:
  - `menu_config.ts` aplica configuraciones a **entidades existentes** (que ya están cargadas en la dimensión del jugador) y a **entidades recién spawneadas/cargadas**.
  - `interactMenu/gui.ts` solo opera sobre **una entidad individual** en el momento de la interacción. Sus textos son más detallados pero NO son los IDs del sistema que se persisten en DP.
- Las IDs de sistemas (`movement`, `fire`, `spawn`, `health`, `teleport`, `invincible`) son las mismas entre `menu_config.ts` y los eventos del `interactMenu` (`humanoid:set_tamed_close`, `humanoid:fire_*`, etc.). Esta equivalencia es la base de la centralización.
- **Mismos sistemas, capa de aplicación diferente:** commandMenu aplica masivamente (entidades existentes + recién spawneadas), interactMenu aplica individualmente. Ambos consumen las mismas IDs, eventos y descripciones desde el catálogo. La descripción funcional de cada opción de cada menú (`"Escolta cercana. Teletransporte de combate activo"`, `"Detección máxima. Guerra y defensa. Hasta ~48m-64m según unidad"`, etc.) debe vivir en el catálogo para que ambos menús la lean desde la misma fuente.

---

## Discrepancias críticas detectadas en la auditoría (01/09/2026)

Estas discrepancias son hallazgos de la revisión contra el código actual. **No son opcionales**: deben resolverse en las subfases correspondientes.

### Discrepancias en IDs / eventos / descripciones

1. **"Bug" funcional en `interactMenu/config.ts:328,334` vs `gui.ts:438` — RESUELTO NO ES BLOQUEANTE.** Verificación específica 01/09/2026: hay **dos rutas distintas** para procesar `entity_protection` (Global/Local):
   - **Ruta DDUI (la moderna, la ruta normal):** `interact_ddui_shared.ts:210-213` y `interact_ddui_systems.ts:315-317` buscan `action === "set_global_overwrite"`, leen `entry.value` y llaman directamente a `setGlobalOverwriteAllowed(entity, entry.value)`. **Funciona correctamente.** Las entradas en `config.ts:328,334` están alineadas con esta ruta.
   - **Ruta legacy (`gui.ts:438`):** busca `action === "toggle_entity_global_overwrite"`. **Código muerto**: nunca se ejecuta porque `config.ts` ya no declara esa action. El bloque `if (singleEntry.action === "toggle_entity_global_overwrite")` en `gui.ts:438` es inalcanzable. La rama `if (action === "toggle_entity_global_overwrite")` en `interact_ddui_shared.ts:221` también es código muerto.
   - **Decisión del usuario (01/09/2026):** No corregir legacy. El menú legacy está previsto para descontinuación (la ruta normal de apertura pasará a ser interactMenu DDUI). La descontinuación se ejecuta como **Fase 6.7** posterior a 6.6. Antes de eliminar legacy, se verifica que ninguna ruta normal siga dependiendo de él.

2. **`teleport` opción `normal` — divergencia de label entre archivos**:
   - `menu_config.ts:387`: `"§aNormal"`
   - `systemCatalog.ts:92` y `interactMenu/config.ts:238`: `"§aModerado"`
   - **Decisión:** Adoptar `"§aModerado"` como canónico (en systemCatalog). Actualizar `menu_config.ts:387` en Fase 6.1.

3. **`spawn` — divergencia de `displayName` entre archivos**:
   - `menu_config.ts:277`: `"§1Spawn de soldados"`
   - `systemCatalog.ts:113,137` y `interactMenu/config.ts:203`: `"§bTraer refuerzos"`
   - **Decisión:** Adoptar `"§bTraer refuerzos"` como canónico. Actualizar `menu_config.ts:277` en Fase 6.1.

4. **`invincible` — divergencia de `displayName`**:
   - `menu_config.ts:423`: `"§cInvencibilidad"`
   - `systemCatalog.ts:127,140` y `interactMenu/config.ts:256`: `"Invencibilidad"`
   - **Decisión:** Adoptar `"Invencibilidad"` (sin `§c`) para consistencia con el resto del catálogo. Actualizar `menu_config.ts:423` en Fase 6.1.

5. **`SYSTEM_SHORT_NAMES.teleport` — divergencia entre**:
   - `interactMenu/config.ts:573`: `"§2Teletransporte§r"`
   - `systemCatalog.ts:139`: `"§2Teletransportación"`
   - **Decisión:** Mantener `"§2Teletransporte§r"` en el catálogo (es lo que el historial usa, no se debe introducir typo). Resolver en Fase 6.1.

### Discrepancias estructurales

6. **Colisión de nombres `SpecialGroupLabels`**:
   - `menu_config.ts:88-94`: mapa de grupos lógicos A-D (key=`groupA`).
   - `systemCatalog.ts:158-168`: mapa de familias MTF (key=`mtf_delta1`). **Mismo nombre, distinto significado.**
   - **Decisión:** Renombrar `systemCatalog.ts:158-168` a `NAMETAG_FAMILY_LABELS` (alineado con `NAMETAG_FAMILY_MAP` que vive en `menu_config.ts:116-126`). Migrar consumidores. Resolver en Fase 6.1.

7. **`SpecialGroupLabels` de `menu_config.ts`** está duplicado literalmente con `GROUP_LABELS` de `systemCatalog.ts:150-156`. **Decisión:** Mantener `GROUP_LABELS` del systemCatalog como fuente; el shim de `menu_config.ts` (Fase 6.2) re-exporta `GROUP_LABELS` como `SpecialGroupLabels` para compatibilidad.

8. **`UnitHierarchyLabels` de `menu_config.ts:104-108` duplicado con `HIERARCHY_LABELS` de `systemCatalog.ts:178-182`.** Mismo tratamiento que el punto 7.

9. *(Descartado tras verificación de Sonnet 4.5)* — La línea `menu_config.ts:147` no es un auto-import; es la re-exportación del scanner (`./model/menu_entity_scanner.js`). No existe el bug de auto-referencia que mi plan original asumía. Eliminado de la lista.

10. **Categoría `all` ausente en `CATALOG_CATEGORIES`** (`systemCatalog.ts:346-361` solo tiene `movement_patrol`, `combat`, `advanced`). Agregar en Fase 6.1.

11. **`advanced_menu` NO es huérfana.** Tras verificación de Sonnet 4.5: se usa en `interactMenu/config.ts:157` como label del submenu `"§6Más sistemas"`. Mantenerla en `CATEGORY_DISPLAY_NAMES` y separar semánticamente como navegación interna de interactMenu (NO como categoría de catálogo). Ver ítem #12.

12. **IDs de categorías de `interactMenu/config.ts`**:
    - `attack_rules` (L126) vs catálogo `combat` → **Decisión:** Renombrar en `interactMenu/config.ts` a `combat` para alinear con el catálogo.
    - `advanced_menu` (L157) vs catálogo `advanced` → **Decisión corregida tras auditoría de Sonnet 4.5:** NO renombrar. `advanced_menu` es label de navegación UI (`§6Más sistemas`), no categoría de catálogo. Mantener ambos con sus nombres actuales para preservar la navegación. Ver Fase 6.5.
    - `unit_management` (L162) → **Decisión:** Mantener (es navegación interna de interactMenu sin contraparte en systemCatalog).

13. **Sufijo `§r` inconsistente** entre `interactMenu/config.ts` y systemCatalog. Ej: `interactMenu/config.ts:96 "§1Movimiento / Patrulla§r"` vs `systemCatalog.ts:144 "§1Movimiento / Patrulla"`. **Decisión:** Convención única: el catálogo NO incluye `§r`; interactMenu lo agrega al renderizar (transformador). Documentar en JSDoc.

14. **`SYSTEM_SHORT_NAMES` vive en `interactMenu/config.ts:568-577`** pero lo importa `commandMenu/ddui/helpers/historyStore.ts:5` (dependencia inversa prohibida: commandMenu → interactMenu). **Migrar a systemCatalog en Fase 6.1.**

15. **`SYSTEM_SHORT_NAMES.group_assignment` y `entity_protection`** son entradas que NO corresponden a sistemas del commandMenu. Son features del interactMenu. **Decisión:** Mantenerlos en `interactMenu/config.ts` (no migran al catálogo). El catálogo solo recibe las 6 entradas de sistemas reales.

### Discrepancias en datos faltantes en `systemCatalog.ts`

16. **Falta `dynamicProperty` por sistema** (verificado: ninguna de las 6 entradas en `CATALOG_SYSTEMS` L304-344 tiene este campo). Migrar los 6 nombres `scpd_system_*` desde `menu_config.ts` en Fase 6.1.

17. **Falta bloque `defaults`** en `systemCatalog.ts` (verificado: ninguna entrada tiene defaults). Migrar la estructura completa desde `menu_config.ts:201-466` con tipado `Record<FactionId, Record<KeyId, OptionValue>>` en Fase 6.1.

18. **Falta `tooltip` por sistema** (al menos para los sistemas que lo tienen en `menu_config.ts:156,229,279,328,377,425`). Migrar en Fase 6.1.

19. **Faltan type guards `isDropdownSystem`/`isToggleSystem`** en systemCatalog. Agregar en Fase 6.1.

20. **Faltan constantes tipadas `Factions`, `SpecialGroups`, `UnitHierarchy`** en systemCatalog (solo existen en `menu_config.ts:73,80,98`). **Decisión:** Estas constantes son **identificadores de dominio** (claves en DPs, scanner, defaults). NO deben vivir en `systemCatalog.ts` porque ese archivo es **datos UI + catálogo de sistemas**. Migrarlas a `scripts/constants/domains.ts` (o equivalente), re-exportadas desde `menu_config.ts` (shim) y consumidas por todos los menús. Resolver en sub-fase 6.0 (nueva).

21. **Falta `NAMETAG_FAMILY_MAP` + helpers** (`getFamilyTagLabel`, `getFamilyTagOrder`) en systemCatalog. Migrar desde `menu_config.ts:116-138` en Fase 6.1.

22. **Falta `MENU_CONFIG`** (title, categoryOrder, useDividers, messages) en systemCatalog. Migrar desde `menu_config.ts:501-510` en Fase 6.1. **Title divergente:** `menu_config.ts:502 "SCPDystopia | Panel de Comandos"` vs `systemCatalog.ts:185 PANEL_TITLES.main = "§9Menú de comandos"`. Adoptar `"SCPDystopia | Panel de Comandos"` (canónico del legacy) y migrar a systemCatalog.

23. **Falta `labelTrue`/`labelFalse`** en `AdvancedToggleSystem` para que el catálogo exponga los labels visibles (`"§aActivar"`/`"§cDesactivar"`, etc.) que viven en `interactMenu/config.ts:207,212,224,228,260,265`. Agregar en Fase 6.1.

24. **Faltan helpers puros** en systemCatalog: `isDropdownSystem`, `isToggleSystem`, `getSystemOption(systemId, value)`, `getSystemEvent(systemId, value)`, `isAutoTameSystem(systemId, value)`, `getSystemProperty(systemId)`, `getSystemDefaults(systemId)`, `getSystemDefaultForKey(systemId, faction, key)`, `getGroupsOrderForAssignment`, `getGroupsOrderForSystems`. Agregar en Fase 6.1.

### Discrepancias en imports / dependencias

25. **Inversión de dependencias** (regla AGENTS.md: `gui → commands → utils`, nunca al revés):
    - `commandMenu/ddui/helpers/historyStore.ts:5` importa `SYSTEM_SHORT_NAMES` desde `interactMenu/config.ts`. Prohibido.
    - `interactMenu/ddui/interact_ddui_*.ts` importan desde `commandMenu/menu_config.ts`. Prohibido (los menús no deben depender entre sí).
    - `interactMenu/ddui/interact_ddui_systems.ts:27,29` importa `SpecialGroupLabels` dos veces.
    - `interactMenu/ddui/interact_ddui_form.ts:15` importa `SpecialGroupLabels` que **no se usa en el archivo** (import muerto).
    - **Resolver:** Mover todo lo compartido a `systemCatalog.ts` o `constants/domains.ts`. Resolver en Fases 6.1, 6.4 y 6.6.

26. **Imports duplicados / muertos**:
    - `commandMenu/ddui/helpers/formHelpers.ts` importa constantes de systemCatalog que **no usa** (MOVEMENT_OPTIONS, FIRE_OPTIONS, etc.). Limpiar.
    - `commands/worldSave.ts:3` importa `menu_config` sin extensión `.js`. Corregir.
    - `commandMenu/ddui/helpers/roleHelpers.ts` duplica `FactionId`/`RoleId` de `playerPermissionManager.ts` con DP keys distintas (`"scpd_role"` vs `"scpd_role_admin"`). **BUG CRÍTICO:** el roleHelpers lee un DP distinto al que escribe el manager. **Resolver en Fase 6.6.**

### Discrepancias en DDUI hardcodeos

27. **Botón "Volver" hardcodeado** en `interact_ddui_systems.ts:113,327,427` con `"<- Volver"`. Existe `BACK_BUTTON_LABEL` en systemCatalog. Reemplazar en Fase 6.4.

28. **Facciones hardcodeadas** `"§lFoundation"` / `"§2§lChaos"` en `interact_ddui_systems.ts:205,272`. Existe `FACTION_DISPLAY_NAMES`. Reemplazar en Fase 6.4.

29. **`new Set(["spawn", "health", "invincible"])`** hardcodeado en `systemBuilder.ts:68` y `interact_ddui_systems.ts:68`. Derivar de `ADVANCED_TOGGLE_SYSTEMS` en Fase 6.4.

30. **Headers `§7No especiales` / `§6Especiales`** hardcodeados en `systemBuilder.ts:397,413`. Existe `SYSTEM_VIEW_FILTER_OPTIONS` con esos labels. Reemplazar en Fase 6.4.

31. **`getGlobalOverwriteLabel(entity)`** ya existe en `entityScope.ts:29` pero `interact_ddui_shared.ts:213,317,659` reconstruye los literales `"Global"`/`"Local"` manualmente. Reemplazar en Fase 6.4.

32. **Mensajes de error hardcodeados** dispersos en `main.ts`, `mainPanel.ts`, `groupsPanel.ts`, `scopePanel.ts`, `systemBuilder.ts`, `interact_ddui_*.ts`. Centralizar como constantes `ERROR_*` en systemCatalog en Fase 6.1.

### Tipos faltantes

33. **No existe `SystemId`/`CategoryId` union type** en systemCatalog. Todos los `systemId: string` deberían ser `systemId: SystemId` (literal union). Agregar en Fase 6.1.

---

## Fuente de verdad (post-Fase 6)

`scripts/gui/shared/systemCatalog.ts` será la **única fuente de verdad** para:

- IDs de sistemas (literal type `SystemId`).
- `controlType`, `options` (con `label`, `description`, `eventStart`, `eventStop`, `autoTame`), `eventTrue`/`eventFalse`, `labelTrue`/`labelFalse`, `tooltip`, `description`, `category`, `dynamicProperty`, `supportsSpecials`/`supportsHierarchy`/`supportsGroups`, `defaults` por facción/jerarquía/grupo.
- Categorías (`movement_patrol`, `combat`, `advanced`, `all`) con sus `systemIds`.
- Constantes UI: `SYSTEM_DISPLAY_NAMES`, `CATEGORY_DISPLAY_NAMES`, `GROUP_LABELS`, `HIERARCHY_LABELS`, `FACTION_DISPLAY_NAMES`, `PANEL_TITLES`, `PANEL_DESCRIPTIONS`, `MAIN_PANEL_BUTTONS`, `ADVANCED_PANEL_BUTTONS`, `GROUP_PANEL_BUTTONS`, `GROUP_FACTION_BUTTONS`, `GROUP_ASSIGNMENT_BUTTONS`, `ROLE_LABELS`, `TARGET_FACTION_OPTIONS`, `SYSTEM_VIEW_FILTER_OPTIONS`, `HIERARCHY_AND_GROUP_OPTIONS`, `HIERARCHY_OPTIONS`, `SPECIAL_GROUP_OPTIONS`, `BACK_BUTTON_LABEL`, `PANEL_TITLE_ASIGNAR_GRUPO`, `GROUP_ASSIGNMENT_DESCRIPTION_PREFIX`, `HISTORY_INITIAL_TEXT`.
- `SYSTEM_SHORT_NAMES` (6 entradas de sistemas reales; `group_assignment` y `entity_protection` se quedan en interactMenu).
- `MENU_CONFIG` (title, categoryOrder, useDividers, messages).
- `NAMETAG_FAMILY_LABELS` (renombrado desde `SpecialGroupLabels` actual, derivado de `NAMETAG_FAMILY_MAP`).
- `ERROR_*` constants para mensajes de feedback al jugador.
- Helpers puros: `isDropdownSystem`, `isToggleSystem`, `getSystemOption`, `getSystemEvent`, `isAutoTameSystem`, `getSystemProperty`, `getSystemDefaults`, `getSystemDefaultForKey`, `getGroupsOrderForAssignment`, `getGroupsOrderForSystems`, `getCategoryConfig`, `getSystemsByCategory`, `getOrderedCategories`.

`scripts/constants/domains.ts` (nuevo en Fase 6.0) será la fuente de verdad para **identificadores de dominio** (claves en DPs, scanner, defaults):

- `Factions`, `SpecialGroups`, `UnitHierarchy` (constantes tipadas `as const`).
- `FactionId`, `SpecialGroupId`, `UnitHierarchyId`, `KeyId` (union types).
- `NAMETAG_FAMILY_MAP` + `getFamilyTagLabel` + `getFamilyTagOrder`.

`scripts/gui/commandMenu/menu_config.ts` pasa a ser un **shim de re-export** que consume `systemCatalog.ts` y `constants/domains.ts`, y conserva la firma de la API existente para no romper el commandMenu legacy ni los menús que aún la consumen.

`scripts/gui/interactMenu/config.ts` pasa a importar labels, descripciones y eventos desde el catálogo compartido, conservando sus definiciones específicas de GUI por entidad (submenús, `global_rules`, `openItem`, `entities`, `specific` con variantes, `requiresSpecial`, `SYSTEM_SHORT_NAMES.group_assignment`/`entity_protection`).

---

## Subfases

### Fase 6.0 — Constantes de dominio en `scripts/constants/domains.ts`

**Objetivo:** Centralizar `Factions`, `SpecialGroups`, `UnitHierarchy`, `NAMETAG_FAMILY_MAP` y sus helpers en un módulo de constantes de dominio (no UI), separado del catálogo UI.

**Pre-requisito (ver sección superior).**

1. Crear `scripts/constants/domains.ts` con:
   - `Factions` (FOUNDATION/CHAOS) y tipo `FactionId`.
   - `SpecialGroups` (GROUP_A..D, NO_GROUP) y tipo `SpecialGroupId`.
   - `UnitHierarchy` (BASIC/LEADER/COMMANDER) y tipo `UnitHierarchyId`.
   - Tipo `KeyId = FactionId | SpecialGroupId` para `defaults`.
   - `NAMETAG_FAMILY_MAP` con `label` + `order` (idéntico a `menu_config.ts:116-126`).
   - `getFamilyTagLabel(familyId)` y `getFamilyTagOrder(familyId)`.
2. JSDoc completo en cada exportación.
3. Verificación: `npm run local-deploy`. El módulo no debe romper ningún import existente (todavía no se migra ningún consumidor en esta fase).

### Fase 6.0.5 — Auditoría de consumidores legacy del commandMenu (PREVIA A 6.1)

> **Bloqueante según auditoría de Sonnet 4.5.** Antes de iniciar Fase 6.1, debe verificarse que el shim de Fase 6.2 podrá reemplazar `menu_config.ts` sin romper el commandMenu legacy. Esta fase NO modifica código; es una verificación documental.

**Objetivo:** Confirmar que el plan de Fase 6.2 (shim de `menu_config.ts`) preservará la compatibilidad con todos los consumidores internos del commandMenu legacy, y documentar los puntos críticos.

**Pre-requisito (ver sección superior).**

1. **Inventario de consumidores legacy internos** del commandMenu que NO son DDUI:
   - `scripts/gui/commandMenu/core/menu_apply.ts` — usa `isAutoTameEvent`, `systems`, helpers varios. Verificar que la firma se preserve.
   - `scripts/gui/commandMenu/core/menu_events.ts` — usa `systems`, `invalidateScanCache`, `invalidateEntityQueryCache`, `getEntitiesCached`. Verificar.
   - `scripts/gui/commandMenu/core/menu_state.ts` — usa `getSystemConfig`, `getSystemDefaults`, `Factions`, `UnitHierarchy`, `SpecialGroups`. Verificar que el shim siga exponiendo todo.
   - `scripts/gui/commandMenu/model/menu_faction.ts` — usa `Factions`, `UnitHierarchy`, `SpecialGroups`. Verificar.
   - `scripts/gui/commandMenu/model/menu_groups.ts` — usa `SpecialGroups`. Verificar.
   - `scripts/gui/commandMenu/model/menu_entity_scanner.ts` — usa `Factions`, `UnitHierarchy`, `NAMETAG_FAMILY_MAP`, `SpecialGroups`. Verificar.
   - `scripts/gui/commandMenu/ui/menu_category.ts` — usa `getCategoryConfig`, `getSystemsByCategory`, `MenuSystem`. Verificar firma de tipos.
   - `scripts/gui/commandMenu/ui/menu_system.ts` — usa `Factions`, `SpecialGroups`, `getGroupsOrderForSystems`, `scanActiveEntities`, `MenuSystem`. Verificar.
   - `scripts/gui/commandMenu/ui/menu_groups_ui.ts` — usar `rg` para confirmar símbolos importados.
   - `scripts/gui/commandMenu/builder/menu.ts`, `menu_builder.ts` — usar `rg` para confirmar.
2. **Para cada consumidor:** Documentar qué importa exactamente, qué firmas públicas requiere, y confirmar que el shim de Fase 6.2 las preserva byte a byte (especialmente los tipos `MenuSystem`, `MenuOption`, `DropdownMenuSystem`, `ToggleMenuSystem`, `MenuControlType`, `MenuSystems`, `ControlType`).
3. **Validación de scanner:** Confirmar que `menu_entity_scanner.ts` puede migrar a `constants/domains.ts` para `Factions`/`UnitHierarchy`/`SpecialGroups`/`NAMETAG_FAMILY_MAP` sin romper consumidores internos. Si no, dejar scanner como está y delegar re-export desde `menu_config.ts`.
4. **Salida de esta fase:** Documento (anexo a este plan o comentario en commit) con:
   - Lista exhaustiva de símbolos legacy que el shim DEBE preservar.
   - Lista de archivos legacy que NO deben modificarse en Fase 6.x (regla de protección del legacy).
   - Confirmación de que el shim de Fase 6.2 es viable.
5. **Si se encuentran símbolos que el shim NO puede preservar sin cambios:** Detener la planificación y notificar al usuario antes de continuar.

### Fase 6.1 — Completar `systemCatalog.ts` con datos faltantes y corregir divergencias

**Objetivo:** Que el catálogo contenga todos los datos que `menu_config.ts` necesita para ser reemplazado como fuente de verdad, y corregir las divergencias de copy detectadas.

**Pre-requisito (ver sección superior).**

1. **Corregir divergencias de copy** (antes de migrar):
   - `teleport.options[0].label`: cambiar `menu_config.ts:387` de `"§aNormal"` a `"§aModerado"`.
   - `systems.spawn.displayName`: cambiar `menu_config.ts:277` de `"§1Spawn de soldados"` a `"§bTraer refuerzos"`.
   - `systems.invincible.displayName`: cambiar `menu_config.ts:423` de `"§cInvencibilidad"` a `"Invencibilidad"`.
   - `SYSTEM_SHORT_NAMES.teleport`: en systemCatalog `"§2Teletransporte§r"` (NO `"§2Teletransportación"`).

2. **Renombrar `SpecialGroupLabels` de systemCatalog** (L158-168) a `NAMETAG_FAMILY_LABELS`. Migrar `NAMETAG_FAMILY_MAP` desde `menu_config.ts:116-126` como fuente de verdad; `NAMETAG_FAMILY_LABELS` se deriva de ella. Actualizar todos los importadores del nombre viejo dentro de `systemCatalog.ts` (si los hay).

3. **Agregar literal types** al inicio del archivo:
   - `export type SystemId = "movement" | "fire" | "spawn" | "health" | "teleport" | "invincible";`
   - `export type CategoryId = "movement_patrol" | "combat" | "advanced" | "all";`
   - `export type FactionId = "foundation" | "chaos";`
   - `export type OptionValue = string | boolean;`

4. **Agregar campos faltantes a `CatalogSystem`**:
   - `dynamicProperty: string` (los 6 `scpd_system_*`).
   - `defaults: Record<FactionId, Record<KeyId, OptionValue>>` (los 6 sistemas × 16 keys).
   - `tooltip?: string` (copy multilínea de menu_config).
   - `description: string` (resumen corto).
   - `category: CategoryId`.
   - `supportsSpecials: boolean`, `supportsHierarchy: boolean`, `supportsGroups: boolean` (todos `true` actualmente).
   - `labelTrue?: string`, `labelFalse?: string` (para `AdvancedToggleSystem`).

5. **Migrar `ADVANCED_TOGGLE_SYSTEMS`** con `labelTrue`/`labelFalse` desde `interactMenu/config.ts:207,212,224,228,260,265`:
   - `spawn`: `"§aActivar"` / `"§cDesactivar"`.
   - `health`: `"§aMostrar"` / `"§cOcultar"`.
   - `invincible`: `"§aActivar"` / `"§cDesactivar"`.

6. **Agregar categoría `all`** en `CATALOG_CATEGORIES`: `systemIds: ["movement", "fire", "spawn", "health", "teleport", "invincible"]`, `displayName: "§lTodos los Sistemas"`.

7. **Agregar `MENU_CONFIG`**:
   ```ts
   export const MENU_CONFIG = {
     title: "SCPDystopia | Panel de Comandos",
     categoryOrder: ["movement_patrol", "combat", "advanced", "all"],
     useDividers: true,
     messages: {
       allSystems: "§8[MENU] §7{player} §rconfiguró §6todos los sistemas§r. Usa §bscpd:check_world_props§r para ver las opciones aplicadas§r.",
       specificSystems: "§8[MENU] §7{player} §rconfiguró: §6{systems}§r.",
     },
   };
   ```

8. **Migrar `SYSTEM_SHORT_NAMES`** (solo las 6 entradas de sistemas reales; `group_assignment` y `entity_protection` se quedan en `interactMenu/config.ts`):
   ```ts
   export const SYSTEM_SHORT_NAMES: Record<string, string> = {
     movement: "§1Movimiento§r",
     fire: "§cIniciativa§r",
     spawn: "§bRefuerzos§r",
     health: "§cBarra de vida§r",
     teleport: "§2Teletransporte§r",
     invincible: "Invencibilidad",
   };
   ```

9. **Centralizar constantes de error** en systemCatalog:
   ```ts
   export const ERROR_MESSAGES = {
     NEED_FACTION_HELMET: "§c[SCPDystopia] Necesitas llevar el casco de tu facción para acceder al menú.",
     OPEN_MENU: "§c[SCPDystopia] Error al abrir el menú.",
     NO_DIMENSION: "§c[SCPDystopia] Dimensión no disponible.",
     NO_SESSION: "§c[SCPDystopia] Sesión no encontrada para el menú de comandos.",
     NO_BUCKET: "§c[SCPDystopia] Bucket no encontrado.",
     ASSIGN_GROUP: "§c[SCPDystopia] Error asignando grupo.",
     SYSTEM_NOT_FOUND: "§c[SCPDystopia] Sistema no encontrado.",
     SCOPE_SAVE: "§c[SCPDystopia] Error guardando scope.",
     APPLY: "Error al aplicar",
     DDUI_OPEN: "§c[DDUI] Error al abrir el menú de interacción.",
     DDUI_OPEN_SYSTEMS: "§c[DDUI] Error al abrir el menú de sistemas avanzados.",
     DDUI_OPEN_MANAGEMENT: "§c[DDUI] Error al abrir el menú de gestión y estado.",
     DDUI_OPEN_HISTORY: "§c[DDUI] Error al abrir el historial.",
   };
   ```

10. **Agregar helpers puros** al catálogo (sin side effects):
    - `isDropdownSystem(sys)` y `isToggleSystem(sys)` (type guards sobre `CatalogSystem`).
    - `getSystemOption(systemId, value)` → `SystemOption | undefined`.
    - `getSystemEvent(systemId, value)` → `{ event: string, autoTame?: boolean }`.
    - `isAutoTameSystem(systemId, value)` → `boolean`.
    - `getSystemProperty(systemId)` → `string | undefined`.
    - `getSystemDefaults(systemId)` → defaults crudos del catálogo.
    - `getSystemDefaultForKey(systemId, faction, key)` → `OptionValue | undefined`.
    - `getGroupsOrderForAssignment()` y `getGroupsOrderForSystems()`.
    - `getCategoryConfig(categoryId)`, `getSystemsByCategory(categoryId)`, `getOrderedCategories()`.
    - `getSystemConfig(systemId)` (wrapper sobre `CATALOG_SYSTEMS[id]` con tipo).

11. JSDoc completo en cada nueva exportación. Logging con `debugWarn`/`debugMessage` solo donde aplique.

12. **Decidir sobre `advanced_menu` en `CATEGORY_DISPLAY_NAMES`:** Si está muerta, eliminarla; si se usa en algún panel, mantenerla con JSDoc explicando su propósito.

13. Verificación: `npm run local-deploy` sin errores. La forma pública del catálogo se amplía; no debe romper importadores previos.

### Fase 6.2 — `menu_config.ts` como shim de re-export

**Objetivo:** Que `menu_config.ts` deje de definir su propio `systems`, `categories`, `SpecialGroups`, `UnitHierarchy`, `SpecialGroupLabels`, `UnitHierarchyLabels`, `Factions`, `NAMETAG_FAMILY_MAP` y consuma todo desde `systemCatalog.ts` y `constants/domains.ts`, preservando la firma de cada export para no romper importadores externos.

**Pre-requisito (ver sección superior).**

1. Reemplazar el cuerpo de `menu_config.ts`:
   - Importar `CATALOG_SYSTEMS`, `CATALOG_CATEGORIES`, `MENU_CONFIG`, `SYSTEM_SHORT_NAMES`, `SYSTEM_DISPLAY_NAMES`, `NAMETAG_FAMILY_LABELS`, helpers desde `../shared/systemCatalog.js`.
   - Importar `Factions`, `SpecialGroups`, `UnitHierarchy`, `NAMETAG_FAMILY_MAP`, `getFamilyTagLabel`, `getFamilyTagOrder`, tipos desde `../../constants/domains.js`.
   - Reconstruir el objeto `systems: MenuSystems` mapeando `CATALOG_SYSTEMS` a la forma `MenuSystem` legacy (incluyendo `controlType`, `options` con `events: { start?, stop? }` reconstruido a partir de `eventStart`/`eventStop`/`eventTrue`/`eventFalse`, `supportsSpecials`/`supportsHierarchy`/`supportsGroups`, `defaults`, `dynamicProperty`, `tooltip`, `category`, `labelTrue`/`labelFalse`).
   - Reconstruir `categories` mapeando `CATALOG_CATEGORIES` (incluyendo `all`).
   - `menuConfig = MENU_CONFIG`.
   - **Re-exportar alias para no romper importadores externos:**
     - `export { Factions, SpecialGroups, UnitHierarchy } from "../../constants/domains.js";`
     - `export const SpecialGroupLabels = GROUP_LABELS;` (alias de systemCatalog).
     - `export const UnitHierarchyLabels = HIERARCHY_LABELS;`
     - `export { NAMETAG_FAMILY_MAP, getFamilyTagLabel, getFamilyTagOrder, NAMETAG_FAMILY_LABELS } from "../../constants/domains.js";`
2. Mantener las funciones helpers existentes (`getSystemConfig`, `getSystemDefaults`, `setEntitySystemState`, `getEntitySystemState`, `findSystemStateByEvent`, `formatEntitySystemStateLabel`, `getEntitySystemsStatus`, `getSystemEvents`, `isAutoTameEvent`, `getHierarchyList`, `getGroupsOrderForAssignment`, `getGroupsOrderForSystems`, `getSystemPropertyId`, `getCategoryConfig`, `getSystemsByCategory`, `getOrderedCategories`) **delegando** a los helpers puros del catálogo. Mantener sus firmas exactas.
3. Re-exportar `scanActiveUnits`, `scanActiveEntities`, `invalidateScanCache`, `getScanCache`, `invalidateEntityQueryCache`, `getEntitiesCached` desde `./model/menu_entity_scanner.js`.
4. Logging: usar `debugWarn`/`debugMessage` en `setEntitySystemState` / `getEntitySystemState` si conservan logs. Eliminar cualquier `console.log`/`console.warn`/`console.error`.
5. Verificación: `npm run local-deploy` sin errores. El commandMenu legacy debe seguir funcionando exactamente igual.
6. **Criterio de éxito:** El archivo debe quedar ≤120 líneas (solo re-exporta y delega). Ningún literal de sistema/evento/label fuera de `systemCatalog.ts`/`constants/domains.ts`.

### Fase 6.3 — (OPCIONAL) Consumidores externos `teleportMenu`, `monitorMenu`, `commands/*` migran a constantes de dominio

> **Estado:** OPCIONAL. Esta fase NO es bloqueante para la finalización de la Fase 6. Tras auditoría de Sonnet 4.5, se concluyó que estos módulos NO son los dos menús objetivo del refactor (`commandMenu` e `interactMenu`) y su migración es consecuencia del cambio de API, no objetivo primario. Mantener el shim `menu_config.ts` (Fase 6.2) los mantiene funcionales indefinidamente. Migrar solo si hay beneficio claro (no solo "por consistencia"). **Requiere aprobación explícita del usuario para ejecutarse.**

**Objetivo (si se aprueba):** Migrar los consumidores externos de `menu_config.ts` para que consuman `constants/domains.ts` y `systemCatalog.ts`. Mantener la lógica de sistema importada desde `menu_config.ts` (que es el shim de Fase 6.2).

**Pre-requisito (ver sección superior).**

1. **Auditoría previa:** Listar todos los archivos que importan desde `menu_config.ts` y clasificar el consumo:
   - IDs y constantes (`Factions`, `UnitHierarchy`, `SpecialGroups`, `SpecialGroupLabels`, `UnitHierarchyLabels`, `NAMETAG_FAMILY_MAP`, `getFamilyTagLabel`): **migrar a `constants/domains.ts`**.
   - Labels UI (`GROUP_LABELS`, `HIERARCHY_LABELS`): **migrar a `systemCatalog.ts`**.
   - `systems` (objeto completo): en `commands/worldSave.ts` y `commands/scope_commands.ts` se usa para iterar IDs y leer `dynamicProperty`. Mantener `systems` desde `menu_config.ts` (es shim).
   - Scanner: mantener desde `menu_config.ts` (re-export).
   - Helpers de sistema (`getSystemConfig`, `getSystemDefaults`, `getEntitySystemState`, `setEntitySystemState`, `findSystemStateByEvent`, `formatEntitySystemStateLabel`, `getEntitySystemsStatus`, `isAutoTameEvent`, `getSystemEvents`): mantener desde `menu_config.ts` (lógica).

2. **Migrar imports (solo si se aprueba esta fase)**:
   - `scripts/gui/teleportMenu/teleport_config.ts`: `Factions` desde `../../constants/domains.js`.
   - `scripts/gui/teleportMenu/core/teleport_utils.ts`: `Factions`, `UnitHierarchy` desde `constants/domains.js`.
   - `scripts/gui/teleportMenu/menus/teleport_menu.ts`, `teleport_normal_menu.ts`, `teleport_all_menu.ts`: `Factions`, `UnitHierarchy` desde `constants/domains.js`.
   - `scripts/gui/teleportMenu/menus/teleport_special_menu.ts`: mantener `scanActiveUnits` desde `commandMenu/menu_config.js` (re-export del scanner).
   - `scripts/gui/monitorMenu/monitor_form.ts`: `Factions` desde `constants/domains.js`.
   - `scripts/gui/monitorMenu/monitor_config.ts`: `Factions`, `SpecialGroups`, `UnitHierarchy` desde `constants/domains.js`; `SpecialGroupLabels` y `UnitHierarchyLabels` desde `systemCatalog.ts` (o sus alias en `menu_config.ts` shim). `NAMETAG_FAMILY_MAP`/`getFamilyTagLabel` desde `constants/domains.js`.
   - `scripts/commands/worldSave.ts`: mantener `systems as menuSystems` desde `commandMenu/menu_config.js`. Corregir import a `.js` si falta.
   - `scripts/commands/scope_commands.ts`: mantener `systems as menuSystems` desde `commandMenu/menu_config.js`.
   - `scripts/commands/register_test_commands.ts`: `Factions`, `UnitHierarchy`, `SpecialGroups` desde `constants/domains.js`. `systems` desde `menu_config.ts` (necesita `defaults`).
   - `scripts/commands/register_systems.ts`: igual que el anterior.
   - `scripts/commands/count_special_groups.ts`: `Factions`, `SpecialGroups`, `UnitHierarchy`, `NAMETAG_FAMILY_MAP`, `getFamilyTagLabel`, `getFamilyTagOrder` desde `constants/domains.js`. `ControlType`, `systems`, `SpecialGroupLabels`, `UnitHierarchyLabels` desde `commandMenu/menu_config.js` (shim con alias).
   - **Internos del commandMenu** (`commandMenu/core/*`, `commandMenu/model/*`, `commandMenu/ui/*`, `commandMenu/builder/*`): mantener `Factions`, `UnitHierarchy`, `SpecialGroups` desde `constants/domains.js` (Fase 6.4 los migra también). No es bloqueante para esta fase; se pueden quedar importando del shim `menu_config.ts` mientras no se rompa la compilación.

3. Verificación: `npm run local-deploy` sin errores. Todos los menús deben seguir funcionando.

**Riesgo:** Migración innecesaria que podría introducir regresiones sin beneficio claro. **Recomendación:** Mantener shim indefinidamente. Re-evaluar en una fase futura si se requiere.

### Fase 6.4 — `commandMenu/ddui/` consume el catálogo + interactMenu DDUI consume el catálogo

**Objetivo:** Migrar los archivos DDUI de commandMenu y de interactMenu para consumir `systemCatalog.ts` y `constants/domains.ts`, eliminando hardcodeos y la inversión de dependencias.

**Pre-requisito (ver sección superior).**

#### commandMenu/ddui/

1. `scripts/gui/commandMenu/ddui/main.ts`: usar `ERROR_MESSAGES.NEED_FACTION_HELMET` (L13) y `ERROR_MESSAGES.OPEN_MENU` (L21) desde systemCatalog.
2. `scripts/gui/commandMenu/ddui/panels/mainPanel.ts`: usar `ERROR_MESSAGES.NEED_FACTION_HELMET` (L35). Migrar literales de prefijo (`§7Facción: §f`, `§6Rol: §f`) a constantes (opcional, baja prioridad).
3. `scripts/gui/commandMenu/ddui/panels/groupsPanel.ts`:
   - `SpecialGroups`, `getGroupsOrderForSystems`, `getGroupsOrderForAssignment` desde `constants/domains.js` (Fase 6.0).
   - `SpecialGroupLabels` desde `commandMenu/menu_config.js` (alias de `GROUP_LABELS`).
   - Reemplazar mensajes hardcodeados con `ERROR_MESSAGES.NO_DIMENSION`, `ERROR_MESSAGES.NO_SESSION`, `ERROR_MESSAGES.NO_BUCKET`, `ERROR_MESSAGES.ASSIGN_GROUP`.
4. `scripts/gui/commandMenu/ddui/panels/historyPanel.ts`: revisar si usa `SYSTEM_SHORT_NAMES` desde interactMenu (no debería).
5. `scripts/gui/commandMenu/ddui/panels/scopePanel.ts`: usar `ERROR_MESSAGES.NO_SESSION`, `ERROR_MESSAGES.SCOPE_SAVE`. Crear constantes `SCOPE_RESPECT_LABEL`/`SCOPE_GLOBAL_LABEL`/`SCOPE_CONTEXT` en systemCatalog (Fase 6.1, o agregar aquí si no se hizo).
6. `scripts/gui/commandMenu/ddui/builders/systemBuilder.ts`:
   - `getSystemConfig`, `getSystemDefaults` desde `commandMenu/menu_config.js` (shim) — OK porque el shim ya delega al catálogo.
   - `SpecialGroups` desde `constants/domains.js`.
   - Reemplazar `new Set(["spawn", "health", "invincible"])` (L68) por `new Set(ADVANCED_TOGGLE_SYSTEMS.map(s => s.id))` o derivar `TOGGLE_SYSTEM_IDS` en systemCatalog.
   - Reemplazar literales `§7No especiales`/`§6Especiales` (L397, 413) por `SYSTEM_VIEW_FILTER_OPTIONS[1].label`/`[2].label` o constantes dedicadas.
   - Reemplazar `Mostrar:` (L379), `Activado`/`Desactivado` (L476, 532), `Error al aplicar` (L464, 489, 519, 545) por constantes de systemCatalog (Fase 6.1 las agrega).
   - Tipar `systemId: SystemId` en lugar de `string` donde aplique.
7. `scripts/gui/commandMenu/ddui/helpers/formHelpers.ts`: eliminar imports muertos de systemCatalog. Mantener `getEntitySystemState` desde `menu_config.js` (shim).
8. `scripts/gui/commandMenu/ddui/helpers/historyStore.ts`: cambiar import de `SYSTEM_SHORT_NAMES` de `interactMenu/config.ts` a `systemCatalog.ts`. Tipar la DP key como `HISTORY_DP_KEY` en systemCatalog (Fase 6.1).
9. `scripts/gui/commandMenu/ddui/helpers/roleHelpers.ts`: **ELIMINAR** este archivo. Delegar toda la funcionalidad a `PlayerPermissionManager.getRoleInfo()` y `EquipmentDetector.getActiveFaction(player)`. Actualizar `main.ts` y `mainPanel.ts` para que importen directamente desde `playerPermissionManager.ts` y `equipmentDetector.ts` (ya están en `scripts/gui/shared/`). **CRÍTICO:** el archivo duplica `FactionId`/`RoleId` con DP keys distintas (`"scpd_role"` vs `"scpd_role_admin"`), bug latente de lectura de DPs.

#### interactMenu/ddui/

10. `scripts/gui/interactMenu/ddui/interact_ddui_form.ts`:
    - **Eliminar import muerto** de `SpecialGroupLabels` (L15).
    - Reemplazar `§dMenú de Interacción` (L32) por constante `INTERACT_PANEL_TITLE` en systemCatalog.
    - Reemplazar `Historial` (L116) por `MAIN_PANEL_BUTTONS.history`.
    - Reemplazar mensaje de error (L164, 171) por `ERROR_MESSAGES.DDUI_OPEN`.
    - Reemplazar `§7Unidad: §f` (L37) por constante `UNIT_LINE_PREFIX` en systemCatalog.
11. `scripts/gui/interactMenu/ddui/interact_ddui_systems.ts`:
    - **Eliminar inversión de dependencia**: dejar de importar desde `commandMenu/menu_config.js`. Importar `SpecialGroups`, `UnitHierarchy`, `Factions` desde `constants/domains.js`.
    - **Consolidar doble import** de `SpecialGroupLabels` (L27, 29): importar `GROUP_LABELS` desde `systemCatalog.js` (o `SpecialGroupLabels` desde `commandMenu/menu_config.js` que es alias de `GROUP_LABELS`). Eliminar el duplicado.
    - Tipar `getEntitySystemState` y `findSystemStateByEvent` desde `commandMenu/menu_config.js` (shim que delega al catálogo) — OK.
    - Reemplazar literales: `§6Sistemas Avanzados` → `INTERACT_SYSTEMS_TITLE`; `§dGestión y Estado` → `INTERACT_MANAGEMENT_TITLE`; `§dHistorial` → `INTERACT_HISTORY_TITLE`; `§6Historial de cambios (10 más recientes):§r` → `INTERACT_HISTORY_HEADER`; `§7Sin cambios registrados.` → `HISTORY_INITIAL_TEXT` (ya existe en systemCatalog).
    - Reemplazar `"<- Volver"` (L113, 327, 427) por `BACK_BUTTON_LABEL`.
    - Reemplazar `"§lFoundation"` / `"§2§lChaos"` (L205, 207, 272, 274) por `FACTION_DISPLAY_NAMES[Factions.FOUNDATION]` / `FACTION_DISPLAY_NAMES[Factions.CHAOS]`.
    - Reemplazar `new Set(["spawn", "health", "invincible"])` (L68) por `new Set(ADVANCED_TOGGLE_SYSTEMS.map(s => s.id))`.
    - Reemplazar mensajes de error (L161, 168, 375, 382, 475, 482) por `ERROR_MESSAGES` correspondientes.
12. `scripts/gui/interactMenu/ddui/interact_ddui_shared.ts`:
    - **Eliminar inversión de dependencia**: dejar de importar `SpecialGroupLabels`, `SpecialGroups`, `UnitHierarchyLabels`, `UnitHierarchy`, `Factions` desde `commandMenu/menu_config.js`. Importar desde `constants/domains.js` y `systemCatalog.js`.
    - Reemplazar `"§cVida: §a-- / --"` (L115) por constante `HEALTH_PLACEHOLDER_LABEL`.
    - Reemplazar `"Asignar grupo"` (L267) por `CONTEXT_ASSIGN_GROUP`.
    - Reemplazar `"Global"` / `"Local"` (L213, 317, 659) por `getGlobalOverwriteLabel(entity)` de `entityScope.ts:29`.
    - Reemplazar `"Configuración"` (L225) por `CONTEXT_CONFIG`.
    - Reemplazar `"Variante"` (L249) por `CONTEXT_VARIANT`.
    - Reemplazar prefijo `§cVida: §a` y `§7Sistemas: §a` (L638-641) por helpers `formatHealthLine` y `formatSystemsLine`.
    - Reemplazar `§7Configuración de la entidad:` (L648) por `CONFIG_ENTITY_HEADER`.
    - Reemplazar `§7No hay sistemas configurados para esta unidad.` (L653) por `NO_SYSTEMS_CONFIGURED_LABEL`.
13. Tipar `systemId: SystemId` en firmas públicas donde aplique.
14. Verificación: `npm run local-deploy` sin errores. commandMenu DDUI y interactMenu DDUI deben seguir funcionando.

### Fase 6.5 — `interactMenu/config.ts` consume el catálogo

**Objetivo:** Que `interactMenu/config.ts` importe labels, descripciones y eventos desde el catálogo compartido, conservando su estructura específica de GUI por entidad (submenús, `global_rules`, `openItem`, `entities`, `specific`).

> **Aclaración de nomenclatura (integrada tras auditoría de Sonnet 4.5):** `advanced_menu` (label de navegación interna en interactMenu) y `advanced` (ID de categoría de sistemas en el catálogo) **NO son intercambiables directamente**. Son conceptos distintos:
> - `CATALOG_CATEGORIES.advanced` = categoría de sistemas (`spawn`, `health`, `teleport`, `invincible`) en `systemCatalog.ts`.
> - `CATEGORY_DISPLAY_NAMES.advanced_menu` = label UI `"§6Más sistemas"` usado por `interactMenu/config.ts:157` como botón de navegación al submenú `"advanced"`. Tras verificación de Sonnet 4.5, `advanced_menu` NO es residuo muerto; se usa en interactMenu.
> - Mantener ambos con sus nombres actuales. NO renombrar `advanced_menu` → `advanced` en interactMenu (rompería la navegación).

**Pre-requisito (ver sección superior).**

1. Renombrar IDs de categorías globales para alinearse con el catálogo:
   - `id: "attack_rules"` → `id: "combat"` (L126).
   - `id: "advanced_menu"` se MANTIENE como label de navegación interna (NO renombrar a `advanced`).
   - `id: "unit_management"` se mantiene (navegación interna sin contraparte en catálogo).
2. Reemplazar `SYSTEM_SHORT_NAMES` (L568-577) por re-export desde systemCatalog para las 6 entradas de sistemas reales. Mantener `group_assignment` y `entity_protection` en este archivo (específicas de interactMenu).
3. Reemplazar labels de categorías globales que representan sistemas:
   - `§1Movimiento / Patrulla§r` → `CATEGORY_DISPLAY_NAMES.movement_patrol + "§r"`.
   - `§cIniciativa de Combate§r` → `CATEGORY_DISPLAY_NAMES.combat + "§r"`.
   - Mantener `§6Más sistemas`, `§dGestión de Unidad` (específicas de interactMenu).
4. Reemplazar `label` y `description` literales de las entries que representan sistemas (`movement_patrol`, `attack_rules`/`combat`, `spawn`, `health`, `teleport`, `invincible`) por consumo directo de `SystemOption.label` y `SystemOption.description` desde systemCatalog. Mantener intactas las entries que NO son sistemas (`variant`, `view_entity_system_state`, `assign_group`, `set_global_overwrite`).
5. Reemplazar labels de categorías en submenús (`§bTraer refuerzos§r`, `§cBarra de vida§r`, `§2Teletransportación§r`, `Invencibilidad`) por consumo de `SYSTEM_DISPLAY_NAMES` + sufijo `§r` donde corresponda.
6. Reemplazar `Asignar Grupo` (L287) por `SYSTEM_SHORT_NAMES.group_assignment` (mantener el §r interno).
7. Mantener `global_rules.spawn.list`, `openItem`, `entities`, `submenus.advanced.categories[].id`, `submenus.unit_management.categories[].id`, `specific.*` intactos.
8. **Decisión:** `variant` y demás entries específicas de interactMenu **NO migran** al catálogo. Son propias del flujo de variantes por entidad.
9. Verificación: `npm run local-deploy` sin errores. El interactMenu legacy debe seguir funcionando exactamente igual.

### Fase 6.6 — Limpieza final y validación (sin fix de bug legacy)

**Objetivo:** Eliminar archivos huérfanos, limpiar imports muertos, consolidar duplicaciones y validar que no quedan literales fuera del catálogo. **NO incluye fix del bug de `set_global_overwrite`** porque ese bug solo afecta al legacy, que está previsto para descontinuación.

**Pre-requisito (ver sección superior).**

1. **`set_global_overwrite` — NO se corrige (decisión del usuario 01/09/2026):**
   - La ruta DDUI (`interact_ddui_shared.ts:210-213`, `interact_ddui_systems.ts:315-317`) **funciona correctamente**: busca `action === "set_global_overwrite"` y aplica `entry.value` directamente.
   - La rama legacy `gui.ts:438` que busca `toggle_entity_global_overwrite` es **código muerto** inalcanzable.
   - El menú legacy está previsto para descontinuación. Antes de eliminarlo (fuera del alcance de Fase 6), se verificará que ninguna ruta normal siga dependiendo.
   - Esta fase NO toca `gui.ts:438` ni las ramas `toggle_entity_global_overwrite` de `interact_ddui_shared.ts:221` / `interact_ddui_systems.ts`. Permanecen como código muerto hasta la descontinuación del legacy.
2. **Eliminar `scripts/gui/commandMenu/ddui/helpers/roleHelpers.ts`** (Fase 6.4 si no se hizo). Verificar que `main.ts` y `mainPanel.ts` ya importen desde `playerPermissionManager.ts` y `equipmentDetector.ts`.
3. **`ENTITY_GLOBAL_OVERWRITE_PROPERTY` ya vive en `scripts/gui/shared/entityScope.ts:3` (fuente canónica).** La declaración local en `interactMenu/gui.ts:201` es duplicada y debe eliminarse en esta fase. Consumir el símbolo desde `entityScope.ts`:
   - `ENTITY_GLOBAL_OVERWRITE_PROPERTY` se importa desde `../../shared/entityScope.js` en `interactMenu/gui.ts`. Eliminar la línea 201 local.
   - `isGlobalOverwriteAllowed` / `setGlobalOverwriteAllowed`: verificar si la firma de `entityScope.ts:9,20` coincide con la de `interactMenu/gui.ts:224,235`. Si coincide, eliminar la re-declaración local y consumir desde `entityScope.ts`. Si difieren (por ejemplo porque `entityScope.ts` usa un tipo más permisivo de `entity`), mantener ambas versiones y dejar nota en JSDoc.
   - **Justificación de la ubicación:** la propiedad no pertenece solo a interactMenu legacy/DDUI — `scripts/gui/commandMenu/model/menu_scope.ts:4` ya importa `ENTITY_GLOBAL_OVERWRITE_PROPERTY` desde `entityScope.ts` (línea 4). El scope es transversal al commandMenu y al interactMenu; debe vivir en `shared/entityScope.ts`.
4. **Limpiar imports muertos:**
   - `interact_ddui_form.ts:15`: eliminar import de `SpecialGroupLabels` (no se usa).
   - `commandMenu/ddui/helpers/formHelpers.ts`: eliminar constantes de systemCatalog no usadas.
   - `commands/worldSave.ts:3`: añadir `.js` al import.
   - `interact_ddui_systems.ts:27,29`: consolidar doble import de `SpecialGroupLabels` (Fase 6.4 si no se hizo).
5. **Validación con `rg`** para confirmar que no queden literales duplicados fuera del catálogo:
   - `humanoid:set_tamed_close|humanoid:fire_maximum|humanoid:start_spawn_soldiers|humanoid:show_boss_bar|humanoid:start_teleport|humanoid:start_invincible` solo aparece en `systemCatalog.ts` y `menu_config.ts` (shim de re-export).
   - `scpd_system_movement|scpd_system_fire|scpd_system_spawn|scpd_system_health|scpd_system_teleport|scpd_system_invincible` solo aparece en `systemCatalog.ts` y `menu_config.ts`.
   - `§9Grupo A|§aGrupo B|§6Grupo C|§dGrupo D|§8Sin grupo` solo aparece en `systemCatalog.ts` y re-exports.
   - `§1Movimiento|§cIniciativa|§bRefuerzos|§cBarra de vida|§2Teletransporte|Invencibilidad` solo aparece en `systemCatalog.ts` (vía `SYSTEM_SHORT_NAMES`).
   - `Factions\.|SpecialGroups\.|UnitHierarchy\.` solo aparece en `constants/domains.ts` y re-exports desde `menu_config.ts`.
   - `scpd_menu_config_allow_global_overwrite` solo aparece en `entityScope.ts` y re-exports.
6. **Test manual en juego:**
   1. commandMenu legacy como miembro → ver sistemas con defaults correctos.
   2. commandMenu DDUI como comandante → cambiar dropdown de `fire` → confirmar evento `humanoid:fire_*` aplicado.
   3. interactMenu DDUI sobre una entidad → cambiar `fire` → confirmar evento `humanoid:fire_*` aplicado y persistido en DP.
   4. interactMenu DDUI → pulsar "Global"/"Local" en `entity_protection` → debe aplicar `setGlobalOverwriteAllowed` correctamente (verificar que la ruta DDUI funciona).
   5. interactMenu legacy → probar `view_entity_system_state` → labels visibles deben coincidir entre DDUI y legacy (verificar que el formato del resumen sigue presente).
   6. `teleportMenu` → confirmar facciones correctas (sigue funcionando con shim).
   7. `monitorMenu` → confirmar unidades con labels correctos (sigue funcionando con shim).
   8. `scpd:check_world_props` → confirmar DPs `scpd_system_*` existen.

---

## Principios no negociables (AGENTS.md)

- **Encapsulación:** Constantes de dominio (`Factions`, `SpecialGroups`, `UnitHierarchy`) en `constants/domains.ts`. Datos UI y catálogo de sistemas en `systemCatalog.ts`. Operaciones sobre entidades (`setEntitySystemState`, `getEntitySystemState`, etc.) en `menu_config.ts` (shim que delega a catálogo) o en `utils/`. Prohibido exponer `Maps`/`Records` mutables.
- **Tamaño y responsabilidad:**
  - `systemCatalog.ts` post-Fase 6.1: si supera, dividir en `systemCatalog/{systems,categories,labels,helpers,errors}.ts` con barrel en `systemCatalog.ts`.
  - `menu_config.ts` post-Fase 6.2: ≤120 líneas (solo re-export y delegación).
  - `constants/domains.ts`: ≤80 líneas.
- **Funciones:** Cada helper ≤40 líneas.
- **Comentarios:** No eliminar comentarios existentes. JSDoc obligatorio en cada exportación con `@param` y `@returns` cuando corresponda.
- **Tipos:** Prohibido `any` en firmas públicas. Usar `SystemId`, `CategoryId`, `FactionId`, `OptionValue` para tipar parámetros.
- **Logging:** Usar exclusivamente `debugWarn`/`debugMessage`. Eliminar `console.log`/`console.warn`/`console.error` de `menu_config.ts`, `interactMenu/config.ts`, `systemCatalog.ts` y los consumidores migrados.
- **Configuración estática:** Todos los textos, labels, descripciones, eventos, defaults y nombres de DP en datos tipados (`systemCatalog.ts`, `constants/domains.ts`). Prohibido hardcodear en builders/panels/commands.
- **Dirección de dependencias:**
  - `gui/commandMenu/menu_config.ts` → `gui/shared/systemCatalog.ts` + `constants/domains.ts`.
  - `gui/interactMenu/config.ts` → `gui/shared/systemCatalog.ts` + `constants/domains.ts`. NO a `commandMenu/menu_config.ts`.
  - `gui/commandMenu/ddui/**`, `gui/interactMenu/ddui/**` → `gui/shared/systemCatalog.ts` + `constants/domains.ts`. NO a `commandMenu/menu_config.ts` directo (puede pasar por shim si necesita helpers).
  - `teleportMenu`, `monitorMenu`, `commands/*` → `constants/domains.ts` (dominio) + `systemCatalog.ts` (UI) + `commandMenu/menu_config.ts` (shim, solo si necesita helpers de sistema).
  - **Nunca:** `commandMenu/* → interactMenu/*` o viceversa. Nunca `commandMenu/ddui/* → interactMenu/*` (caso histórico del `SYSTEM_SHORT_NAMES` que se corrige en Fase 6.4).
- **Ciclo de vida:** Sin `system.runInterval` ni listeners nuevos. Esta fase no agrega runtime, solo reorganiza código estático.

## Reglas de protección del legacy

- **No modificar** el comportamiento de `commandMenu/menu_apply.ts`, `commandMenu/menu_state.ts`, `commandMenu/menu_events.ts`, `commandMenu/menu_scope.ts` ni el `main.ts` del commandMenu legacy.
- `menu_config.ts` post-Fase 6.2 **debe seguir exportando** la misma API pública. El commandMenu legacy consume `systems`, `categories`, `getSystemConfig`, `getSystemDefaults`, `setEntitySystemState`, `getEntitySystemState`, `findSystemStateByEvent`, `formatEntitySystemStateLabel`, `getEntitySystemsStatus`, `getSystemEvents`, `isAutoTameEvent`, `getHierarchyList`, `getGroupsOrderForAssignment`, `getGroupsOrderForSystems`, `getSystemPropertyId`, `getCategoryConfig`, `getSystemsByCategory`, `getOrderedCategories`, `getFamilyTagLabel`, `getFamilyTagOrder`, `Factions`, `SpecialGroups`, `UnitHierarchy`, `SpecialGroupLabels`, `UnitHierarchyLabels`, `NAMETAG_FAMILY_MAP`, `ControlType`, `MenuControlType`, `MenuOption`, `MenuSystemBase`, `DropdownMenuSystem`, `ToggleMenuSystem`, `MenuSystem`, `MenuSystems`.
- El interactMenu legacy (`interactMenu/gui.ts` + `interactMenu/config.ts`) debe seguir funcionando exactamente igual post-Fase 6.5, salvo la corrección del bug de `set_global_overwrite` (Fase 6.6).

## Dependencias entre subfases

- **6.0** debe completarse antes que **6.1** (las constantes de dominio se usan en 6.1).
- **6.1** debe completarse antes que **6.2**, **6.3** (si se ejecuta), **6.4**, **6.5**, **6.6**.
- **6.2** debe completarse antes que **6.4** (systemBuilder.ts y otros consumen el shim).
- **6.3** es OPCIONAL. Si se ejecuta, es independiente de 6.4/6.5 pero debe correr antes que **6.6** para validación.
- **6.4** y **6.5** son independientes entre sí pero ambas antes de **6.6**.
- **6.6** es la fase final y depende de 6.1, 6.2, 6.4 y 6.5. **6.3 NO es bloqueante para 6.6.**

**Ruta crítica mínima (sin Fase 6.3):** 6.0 → 6.1 → 6.2 → {6.4 || 6.5} → 6.6
**Ruta completa (con Fase 6.3 opcional):** 6.0 → 6.1 → 6.2 → {6.4 || 6.5} → 6.3 → 6.6

## Consideraciones abiertas

- **Tamaño de `systemCatalog.ts`:** Si supera ~400 líneas después de Fase 6.1, dividirlo en `systemCatalog/{systems,categories,labels,helpers,errors}.ts` con barrel re-export. Esto solo si el AGENTS.md lo exige; de lo contrario mantener un solo archivo.
- **Tipado de `defaults`:** Evaluar si conviene tipar `OptionValue` como unión `string | boolean` o separar `defaults` por `controlType`. Si se separa, mantener `getSystemDefaultForKey(systemId, faction, key)` como única API pública.
- **Decisión sobre bug `set_global_overwrite`:** Decidir antes de Fase 6.6 si la corrección es renombrar `action` o agregar case en `gui.ts`. Recomendación: renombrar `action` para alinear con el handler existente.
- **Migración de `variant`:** El campo `variante` del interactMenu **NO migra** al catálogo porque es exclusivo del flujo de variantes por entidad (no aplica a commandMenu). Se documenta como decisión explícita.
- **`SpecialGroupLabels` rename:** El nuevo nombre `NAMETAG_FAMILY_LABELS` (para systemCatalog L158) debe propagarse a TODOS los consumidores. Verificar con `rg` antes de cerrar Fase 6.1.
- **Title del menú principal:** `"SCPDystopia | Panel de Comandos"` (canónico del legacy) vs `"§9Menú de comandos"` (systemCatalog actual). Adoptar el del legacy; `PANEL_TITLES.main` se mantiene como label de la categoría principal (no es lo mismo que el título del form).

---

## Decisiones que requieren aprobación explícita del usuario

Las siguientes decisiones fueron identificadas durante el análisis cruzado (Kilo + Sonnet 4.5) y permanecen **pendientes de aprobación** antes de implementar las fases correspondientes:

## Decisiones del usuario (01/09/2026)

### 1. `scripts/constants/domains.ts` — ✅ APROBADO (Opción A)

**Decisión:** Crear `scripts/constants/domains.ts` como módulo separado para identificadores de dominio (`Factions`, `SpecialGroups`, `UnitHierarchy`, `NAMETAG_FAMILY_MAP`). Razón: el usuario planea seguir haciendo mejoras al addon, entonces más modularidad mejor. Implementar en Fase 6.0.

### 2. Diferencia entre `advanced_menu` y `advanced` — ✅ CONFIRMADO

**Decisión:** Mantener ambos con sus nombres actuales. NO renombrar `advanced_menu` → `advanced` en interactMenu. `advanced_menu` es label de navegación UI (`§6Más sistemas`); `advanced` es categoría de catálogo. Ya integrado en Fase 6.5.

### 3. `set_global_overwrite` — ✅ DECIDIDO: NO CORREGIR

**Diagnóstico verificado 01/09/2026:** hay dos rutas distintas:
- **Ruta DDUI** (la moderna): `interact_ddui_shared.ts:210-213` y `interact_ddui_systems.ts:315-317` buscan `action === "set_global_overwrite"` y aplican correctamente. **Funciona.**
- **Ruta legacy** (`gui.ts:438`): busca `action === "toggle_entity_global_overwrite"`. **Código muerto** inalcanzable.

**Decisión:** No corregir el bug legacy. El menú legacy está previsto para descontinuación (la ruta normal de apertura pasará a ser interactMenu DDUI). La descontinuación se ejecuta como **Fase 6.7** posterior a 6.6 (ver bloque al final del plan). Antes de eliminarlo, se verifica que ninguna ruta normal siga dependiendo de él.

**Implicación para Fase 6:** la fase 6.6 ya NO incluye fix de bug legacy. Se reduce a limpieza + validación. `gui.ts:438`, `interact_ddui_shared.ts:221` y `interact_ddui_systems.ts:308` (ramas `toggle_entity_global_overwrite`) permanecen como código muerto hasta la descontinuación del legacy.

### 4. Alcance de Fase 6.3 — ✅ APROBADO: SALTAR (Opción B)

**Decisión:** Saltar Fase 6.3. Los consumidores externos (`teleportMenu`, `monitorMenu`, `commands/*`) permanecen utilizando el shim mientras continúen siendo necesarios. Su migración se realizará como parte de una futura conversión a DDUI o cuando exista una necesidad concreta. Fase 6.3 queda como opcional documentada pero NO se ejecuta en esta iteración.

**Implicación para dependencias:** 6.3 NO es ruta crítica. La ruta crítica mínima queda: 6.0 → 6.0.5 → 6.1 → 6.2 → {6.4 || 6.5} → 6.6.

---

### Fase 6.7 — Migración de la ruta de apertura y descontinuación del interactMenu legacy

> **Agregada por instrucción del usuario (01/09/2026).** El menú interactMenu legacy está previsto para descontinuación. Esta fase hace dos cosas en orden: (a) que la ruta de apertura "normal" (los ítems que la gente usa hoy) abra el interactMenu DDUI; (b) una vez validado, eliminar el legacy.

**Estado del flujo actual (referencia):**

- En `scripts/gui/interactMenu/gui.ts:590-636`, `world.beforeEvents.playerInteractWithEntity` decide qué menú abrir según el ítem en mano:
  - `lc:dt_commander` (Foundation, ítem "normal") o `breeze_rod` (Chaos, ítem "normal") → `showCategoryMenu` (legacy).
  - `blaze_rod` → `showInteractDDUI` (DDUI, ítem de testing actual).
- El ítem "normal" es el que la gente usa para abrir el menú de interacción hoy. La Fase 6.7 invierte esa asociación: los ítems "normales" deben abrir DDUI.

**Pre-requisito (ver sección superior).**

**Subfase 6.7.A — Cambiar la asociación opener → menú**

1. Modificar `scripts/gui/interactMenu/gui.ts:590-636` para que los ítems "normales" (`lc:dt_commander` para Foundation, `breeze_rod` para Chaos) abran `showInteractDDUI` en lugar de `showCategoryMenu`.
2. Decidir qué hacer con `blaze_rod`:
   - **Opción recomendada:** mantenerlo como alias temporal (también abre DDUI) para evitar romper a quienes ya lo tengan en mano durante el rollout. Marcar para eliminar después de validar.
   - **Opción alternativa:** eliminar `blaze_rod` y dejar solo los ítems normales.
3. Verificar que `showInteractDDUI` soporte todos los flujos que cubre `showCategoryMenu`:
   - Categorías globales con filtrado por `global_rules`.
   - Submenús `advanced` y `unit_management`.
   - Asignación de grupo (`assign_group`).
   - Configuración overwrite (`set_global_overwrite`) — ya funciona por la ruta DDUI.
   - Visualización de estado de sistemas (`view_entity_system_state`).
   - Variantes por entidad.
4. Si alguna ruta legacy no tiene equivalente DDUI, **detener** y crear plan de porting antes de continuar.

**Subfase 6.7.B — Período de validación**

5. Período de validación en juego con ambos entrypoints activos (ítems normales abren DDUI; `blaze_rod` también). El legacy `showCategoryMenu` queda intacto pero inactivo (ningún ítem lo abre).
6. Verificación manual:
   - Todos los flujos DDUI funcionan con los ítems normales.
   - No hay regresiones en features cubiertos por legacy.
   - El historial, scope y overwrite funcionan correctamente desde DDUI.
7. Si se detectan regresiones: parchear DDUI hasta cubrir el caso, no reintroducir legacy.

**Subfase 6.7.C — Eliminación del interactMenu legacy**

8. Eliminar `showCategoryMenu`, `handleCategorySelection`, `showEntryMenu`, `showEntitySystemStatus`, `showEntityGlobalOverwriteToggle` y el handler legacy en `gui.ts:590-636` que enruta según opener.
9. Eliminar referencias al opener legacy (`lc:dt_commander`, `breeze_rod` como legacy) si ya no se usan.
10. Eliminar `blaze_rod` si se eligió esa opción en subfase A.
11. Limpiar imports muertos en `gui.ts` y en archivos que solo el legacy usaba.
12. Eliminar `scripts/gui/interactMenu/ddui/interact_ddui_*.ts` referencias a `toggle_entity_global_overwrite` en `interact_ddui_shared.ts:221` y `interact_ddui_systems.ts:308` (código muerto que ya no aplica).
13. Verificación: `npm run local-deploy` sin errores. Test manual exhaustivo en juego.
14. Criterio de éxito: el único entrypoint válido es DDUI vía ítems normales. No quedan referencias a `ActionFormData`/`ModalFormData` (legacy UI) en `interactMenu/` salvo las que el DDUI use.

**Dependencias:** 6.7 depende de 6.4 (DDUI completamente migrado) y 6.6 (limpieza completada). 6.7 NO bloquea otras fases.

**Riesgos:**
- Si DDUI no cubre todos los flujos legacy, la descontinuación es prematura. La subfase 6.7.A es la verificación; no avanzar a 6.7.B/C sin cobertura completa.
- Eliminar legacy sin validar provoca pérdida de features. Período de validación obligatorio.

---

## Trazabilidad de análisis

Esta sección documenta qué análisis provino de cada agente (Kilo = plan original; Sonnet 4.5 = auditoría independiente) para preservar la autoría.

### Conclusiones del plan original Kilo que SE MANTIENEN (validadas por Sonnet 4.5)

- **Discrepancia #1** (bug `set_global_overwrite`): confirmada por ambos.
- **Discrepancia #2** (`teleport.normal` → `"§aModerado"`): decisión correcta confirmada.
- **Discrepancia #3** (`spawn.displayName` → `"§bTraer refuerzos"`): decisión correcta confirmada.
- **Discrepancia #4** (`invincible.displayName` → `"Invencibilidad"`): decisión correcta confirmada.
- **Discrepancia #6** (colisión `SpecialGroupLabels` → renombrar a `NAMETAG_FAMILY_LABELS`): decisión correcta confirmada.
- **Discrepancias #7, #8** (duplicación de labels): decisiones correctas confirmadas.
- **Discrepancia #10** (categoría `all` ausente): confirmada.
- **Discrepancia #12** (renombrar `attack_rules` → `combat`): confirmada.
- **Discrepancia #14** (inversión `SYSTEM_SHORT_NAMES`): confirmada.
- **Discrepancia #15** (`group_assignment`/`entity_protection` específicos de interactMenu): confirmada.
- **Discrepancias #16-24** (datos faltantes en systemCatalog): todas confirmadas.
- **Discrepancia #25** (múltiples inversiones de dependencia): confirmadas.
- **Discrepancia #26** (bug crítico `roleHelpers.ts` con `scpd_role` vs `scpd_role_admin`): confirmada.
- **Discrepancias #27-31** (hardcodeos DDUI): confirmadas.
- **Discrepancia #33** (tipos literales `SystemId`): confirmada.

### Conclusiones del plan original Kilo que FUERON MODIFICADAS por la auditoría de Sonnet 4.5

- **Discrepancia #5** (`SYSTEM_SHORT_NAMES.teleport`): mi plan proponía `"§2Teletransporte§r"` por considerarlo label correcto. Sonnet verificó que es el que existe en `interactMenu/config.ts:573` y que el catálogo NO lo tiene aún. Plan mantiene `"§2Teletransporte§r"` y agrega acción explícita de verificar consumidores al migrar.
- **Discrepancia #9** (auto-import `menu_config.ts:147`): mi plan asumía un bug. Sonnet no pudo verificarlo por lectura parcial. Tras verificación específica mía con `Read`, **confirmé que NO existe tal auto-import**: la línea 147 es la re-exportación normal del scanner (`./model/menu_entity_scanner.js`). Discrepancia eliminada.
- **Discrepancia #11** (`advanced_menu` huérfana): mi plan asumía residuo muerto. Sonnet confirmó que NO es huérfana; se usa en `interactMenu/config.ts:157` como label del submenú. Plan corregido para mantenerla.
- **Discrepancia #12 (sub-ítem `advanced_menu`)**: mi plan proponía renombrar a `advanced`. Sonnet señaló que NO son intercambiables (UI vs lógica). **Decisión corregida**: mantener `advanced_menu` como label de navegación.
- **Discrepancia #32** (mensajes de error): mi plan proponía centralizar TODOS los mensajes. Plan corregido para reducir alcance solo a errores compartidos entre commandMenu e interactMenu (recomendación Sonnet).
- **Fase 6.3**: mi plan la hacía bloqueante. Sonnet la cuestionó como ampliación innecesaria de alcance. **Fase 6.3 convertida en OPCIONAL**, no bloqueante para 6.6.

### Hallazgos nuevos de Sonnet 4.5 INCORPORADOS al plan

- **Fase 6.0.5 (Auditoría de consumidores legacy)**: Sonnet identificó que el plan no verificaba si el shim de Fase 6.2 rompería el commandMenu legacy. Agregada como fase previa a 6.1 (bloqueante según Sonnet, mantenida como fase formal en el plan).
- **Aclaración `advanced_menu` vs `advanced`**: incorporado en Fase 6.5 y en discrepancia #12.
- **Estrategia de tests del shim**: Sonnet sugirió crear suite de tests para Fase 6.2. Marcado como opcional (no bloqueante) en consideraciones abiertas.
- **Validación de flujos de navegación en Fase 6.4**: Sonnet señaló riesgo de romper navegación al centralizar. Agregado a Fase 6.4 como verificación explícita.

### Conclusiones del plan original Kilo que NO proceden (descartadas)

- **Discrepancia #9** (auto-import en `menu_config.ts:147`): eliminada tras verificación específica. La línea 147 es re-exportación del scanner, no auto-import.

---

## Resumen ejecutivo del estado del plan

### Estado final por fase (decisiones 01/09/2026 aplicadas)

| Fase | Estado | Bloqueante | Depende de | Salidas principales |
|------|--------|------------|------------|---------------------|
| **6.0** | PENDIENTE | Sí (previa a 6.1) | — | `scripts/constants/domains.ts` (APROBADO) |
| **6.0.5** | PENDIENTE | Sí (auditoría previa) | — | Documento de compatibilidad de shim |
| **6.1** | PENDIENTE | Sí | 6.0, 6.0.5 | `systemCatalog.ts` completo + correcciones de copy |
| **6.2** | PENDIENTE | Sí (previa a 6.4) | 6.1 | `menu_config.ts` shim ≤120 líneas |
| **6.3** | **DESCARTADA** (01/09/2026) | No | — | Consumidores externos siguen usando shim |
| **6.4** | PENDIENTE | Sí (previa a 6.6/6.7) | 6.2 | DDUI commandMenu + interactMenu consumen catálogo |
| **6.5** | PENDIENTE | Sí (previa a 6.6) | 6.1 | `interactMenu/config.ts` consume catálogo |
| **6.6** | PENDIENTE | Sí (previa a 6.7) | 6.1, 6.2, 6.4, 6.5 | Limpieza + eliminar duplicación `ENTITY_GLOBAL_OVERWRITE_PROPERTY` en `interactMenu/gui.ts` + validación `rg` (sin fix legacy) |
| **6.7** | PENDIENTE | No (final opcional) | 6.4, 6.6 | (A) ítems normales abren DDUI; (B) período validación; (C) eliminación de legacy `showCategoryMenu`/`showEntryMenu`/etc. |

### Decisiones resueltas por el usuario (01/09/2026)

1. ✅ **`constants/domains.ts`** — APROBADO Opción A. Se crea el módulo separado.
2. ✅ **`advanced_menu` vs `advanced`** — CONFIRMADO. Mantener ambos nombres.
3. ✅ **`set_global_overwrite`** — DECIDIDO: NO CORREGIR. Legacy en descontinuación vía Fase 6.7.
4. ✅ **Alcance de Fase 6.3** — APROBADO Opción B: SALTAR. Consumidores externos siguen con shim.

- **Fecha implementación Fase 6.0:** PENDIENTE
- **Fecha implementación Fase 6.1:** PENDIENTE
- **Fecha implementación Fase 6.2:** PENDIENTE
- **Fecha implementación Fase 6.3 (opcional):** PENDIENTE
- **Fecha implementación Fase 6.4:** PENDIENTE
- **Fecha implementación Fase 6.5:** PENDIENTE
- **Fecha implementación Fase 6.6:** PENDIENTE
- **Fecha implementación Fase 6.7:** PENDIENTE
- **Implementado por:** PENDIENTE
- **Aprobación decisiones pendientes (dominios/advanced_menu/set_global_overwrite/Fase 6.3):** PENDIENTE
- **Build verificado:** PENDIENTE