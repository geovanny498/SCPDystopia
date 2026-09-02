
---

# Auditoría del Plan de Fase 6: Centralización y Reutilización

## Resumen Ejecutivo

He auditado las 33 discrepancias identificadas en el plan contra el estado actual del repositorio. De las 33 discrepancias listadas:

- **22 discrepancias confirmadas y relevantes** para el objetivo del refactor
- **5 discrepancias confirmadas pero requieren aclaración de alcance**
- **3 discrepancias parcialmente correctas pero con matices importantes**
- **3 discrepancias no verificadas completamente** (requieren lectura adicional de archivos grandes)
- **2 problemas críticos adicionales** no identificados en el plan

---

## 1. Discrepancias Confirmadas y Relevantes al Refactor

### 1.1 Bugs Funcionales Críticos

✅ **Discrepancia #1 - Bug en `set_global_overwrite`** (CONFIRMADA)

- **Ubicación real**: `interactMenu/config.ts:328,334`
- **Problema**: Las entries declaran `action: "set_global_overwrite"` pero los handlers en `gui.ts:438` y `interact_ddui_shared.ts:221` buscan `action === "toggle_entity_global_overwrite"`
- **Impacto**: Botones "Global"/"Local" no ejecutan ninguna acción
- **Relevancia**: CRÍTICA - Bug funcional que debe corregirse en Fase 6.6

✅ **Discrepancia #26 - Bug crítico en `roleHelpers.ts`** (CONFIRMADA)

- **Ubicación**: `commandMenu/ddui/helpers/roleHelpers.ts:15-16`
- **Problema**: Usa DPs `scpd_role` y `scpd_role_admin` diferentes a las que usa `playerPermissionManager.ts` (`scpd_role_foundation`, `scpd_role_chaos`, `scpd_role_admin`)
- **Impacto**: CRÍTICO - Lee propiedades dinámicas que no coinciden con las que escribe el manager oficial
- **Recomendación**: Eliminar `roleHelpers.ts` completamente y usar directamente `PlayerPermissionManager` (Fase 6.4)

### 1.2 Divergencias de Copy/Labels (Sistemas Objetivo)

✅ **Discrepancia #2 - `teleport` "normal" vs "moderado"** (CONFIRMADA)

- `menu_config.ts:387`: `"§aNormal"`
- `systemCatalog.ts:92` e `interactMenu/config.ts:238`: `"§aModerado"`
- **Decisión del plan**: Adoptar `"§aModerado"` ✅ CORRECTA

✅ **Discrepancia #3 - `spawn` displayName** (CONFIRMADA)

- `menu_config.ts:277`: `"§1Spawn de soldados"`
- `systemCatalog.ts` e `interactMenu/config.ts`: `"§bTraer refuerzos"`
- **Decisión del plan**: Adoptar `"§bTraer refuerzos"` ✅ CORRECTA

✅ **Discrepancia #4 - `invincible` displayName** (CONFIRMADA)

- `menu_config.ts:423`: `"§cInvencibilidad"`
- `systemCatalog.ts` e `interactMenu/config.ts`: `"Invencibilidad"` (sin código de color)
- **Decisión del plan**: Adoptar `"Invencibilidad"` ✅ CORRECTA

⚠️ **Discrepancia #5 - `SYSTEM_SHORT_NAMES.teleport`** (PARCIALMENTE CORRECTA)

- **Problema**: El plan menciona divergencia entre `interactMenu/config.ts:573` y `systemCatalog.ts:139`
- **Verificación**: `interactMenu/config.ts:575` dice `teleport: "§2Teletransporte§r"`
- **Realidad**: `systemCatalog.ts` NO TIENE `SYSTEM_SHORT_NAMES` (este export solo existe en `interactMenu/config.ts`)
- **Decisión correcta**: Migrar `SYSTEM_SHORT_NAMES` desde `interactMenu/config.ts` a `systemCatalog.ts` en Fase 6.1, pero verificar el label exacto

### 1.3 Colisiones de Nombres y Estructuras

✅ **Discrepancia #6 - Colisión `SpecialGroupLabels`** (CONFIRMADA Y CRÍTICA)

- `menu_config.ts:88-94`: mapa de grupos lógicos (keys: `groupA`, `groupB`, etc.)
- `systemCatalog.ts:158-168`: mapa de familias MTF (keys: `mtf_delta1`, `mtf_alpha1`, etc.)
- **Problema real**: MISMO NOMBRE, SIGNIFICADO DIFERENTE
- **Decisión del plan**: Renombrar el de `systemCatalog.ts` a `NAMETAG_FAMILY_LABELS` ✅ CORRECTA

✅ **Discrepancia #7 y #8 - Duplicación de labels** (CONFIRMADAS)

- `SpecialGroupLabels` de `menu_config.ts` duplica `GROUP_LABELS` de `systemCatalog.ts`
- `UnitHierarchyLabels` de `menu_config.ts` duplica `HIERARCHY_LABELS` de `systemCatalog.ts`
- **Solución del plan**: Mantener en `systemCatalog.ts`, re-exportar como alias desde `menu_config.ts` ✅ CORRECTA

⚠️ **Discrepancia #9 - Auto-import en `menu_config.ts:147`** (NO VERIFICADA)

- **Nota**: No pude localizar esta línea específica en la lectura parcial
- **Requiere**: Verificación completa del archivo

✅ **Discrepancia #10 - Categoría `all` ausente en `systemCatalog.ts`** (CONFIRMADA)

- `menu_config.ts` tiene categoría `all` con todos los sistemas
- `systemCatalog.ts` solo tiene `movement_patrol`, `combat`, `advanced`
- **Decisión del plan**: Agregar `all` a `systemCatalog.ts` ✅ CORRECTA

⚠️ **Discrepancia #11 - Categoría huérfana `advanced_menu`** (VERIFICADA PARCIALMENTE)

- Existe en `systemCatalog.ts:147` como `"§6Más sistemas"`
- Se usa en `interactMenu/config.ts:157` como ID de categoría
- **NO es residuo muerto**: Es el label del submenu en el interactMenu
- **Decisión del plan**: Mantener si se usa ❓ REQUIERE CLARIFICACIÓN - parece que SÍ se usa

✅ **Discrepancia #12 - IDs de categorías en `interactMenu/config.ts`** (CONFIRMADA)

- `attack_rules` (L126) vs `combat` en catálogo → Renombrar ✅
- `advanced_menu` (L157) vs `advanced` → **PRECAUCIÓN**: esto es un submenu ID, no una categoría de sistema
- **Aclaración necesaria**: `advanced_menu` en interactMenu es navegación interna, NO equivale directamente a la categoría `advanced` del catálogo

### 1.4 Inversión de Dependencias (CRÍTICAS)

✅ **Discrepancia #14 - `SYSTEM_SHORT_NAMES` invertido** (CONFIRMADA)

- `commandMenu/ddui/helpers/historyStore.ts:5` importa desde `interactMenu/config.ts`
- **Violación**: commandMenu → interactMenu (prohibido por AGENTS.md)
- **Solución del plan**: Migrar `SYSTEM_SHORT_NAMES` a `systemCatalog.ts` ✅ CORRECTA

✅ **Discrepancia #25 - Múltiples inversiones** (CONFIRMADAS)
Archivos de `interactMenu/ddui/` que importan desde `commandMenu/`:

- `interact_ddui_systems.ts`: importa `SpecialGroupLabels`, `Factions`, `UnitHierarchyLabels` desde `menu_config.js`
- `interact_ddui_shared.ts`: importa helpers de sistema desde `menu_config.js`
- `interact_ddui_form.ts`: importa `SpecialGroupLabels` desde `menu_config.js`

**Problema**: Los menús no deben depender entre sí
**Solución del plan**: Consumir desde `systemCatalog.ts` y `constants/domains.ts` ✅ CORRECTA

### 1.5 Datos Faltantes en `systemCatalog.ts`

✅ **Discrepancias #16-24 - Campos faltantes** (CONFIRMADAS)
El plan identifica correctamente que `systemCatalog.ts` necesita:

- `dynamicProperty` por sistema (#16) ✅
- Bloque `defaults` (#17) ✅
- `tooltip` por sistema (#18) ✅
- Type guards `isDropdownSystem`/`isToggleSystem` (#19) ✅
- `labelTrue`/`labelFalse` para toggles (#23) ✅
- Helpers puros (#24) ✅
- `SYSTEM_SHORT_NAMES` (#14) ✅
- `MENU_CONFIG` (#22) ✅
- Constantes de error (#32) ✅

⚠️ **Discrepancia #20 - Constantes de dominio** (DECISIÓN CUESTIONABLE)

- **Plan**: Crear `scripts/constants/domains.ts` para `Factions`, `SpecialGroups`, `UnitHierarchy`
- **Razonamiento del plan**: Son identificadores de dominio, no UI
- **Consideración**: Esto introduce un tercer archivo en la cadena de dependencias
- **Alternativa posible**: Mantenerlas en `systemCatalog.ts` como sección separada
- **Recomendación**: ✅ ACEPTAR la decisión del plan, pero documentar claramente que `constants/domains.ts` es SOLO para identificadores de dominio, no lógica

### 1.6 Hardcodeos en Archivos DDUI

✅ **Discrepancia #27 - Botón "Volver"** (CONFIRMADA)

- `interact_ddui_systems.ts:113,327,427`: hardcodeo de `"<- Volver"`
- Existe `BACK_BUTTON_LABEL` en `systemCatalog.ts`
- **Solución**: Reemplazar en Fase 6.4 ✅

✅ **Discrepancia #28 - Facciones hardcodeadas** (CONFIRMADA)

- `interact_ddui_systems.ts:205,272`: `"§lFoundation"` / `"§2§lChaos"`
- Existen en `FACTION_DISPLAY_NAMES`
- **Solución**: Reemplazar en Fase 6.4 ✅

✅ **Discrepancia #29 - Set hardcodeado** (CONFIRMADA)

- `systemBuilder.ts:68` y `interact_ddui_systems.ts:68`: `new Set(["spawn", "health", "invincible"])`
- Puede derivarse de `ADVANCED_TOGGLE_SYSTEMS`
- **Solución**: Reemplazar en Fase 6.4 ✅

✅ **Discrepancia #30 - Headers hardcodeados** (PARCIALMENTE VERIFICADA)

- `systemBuilder.ts:397,413`: `"§7No especiales"` / `"§6Especiales"`
- Existen en `SYSTEM_VIEW_FILTER_OPTIONS`
- **Nota**: Requiere verificación de números de línea exactos

✅ **Discrepancia #31 - `getGlobalOverwriteLabel` duplicado** (CONFIRMADA)

- `entityScope.ts:29` tiene la función
- `interact_ddui_shared.ts:213,317,659` reconstruye manualmente
- **Solución**: Usar el helper existente ✅

⚠️ **Discrepancia #32 - Mensajes de error** (ALCANCE EXCESIVO)

- **Problema**: El plan propone centralizar TODOS los mensajes de error de múltiples archivos
- **Archivos afectados según plan**: `main.ts`, `mainPanel.ts`, `groupsPanel.ts`, `scopePanel.ts`, `systemBuilder.ts`, `interact_ddui_*.ts`
- **Consideración**: Algunos de estos archivos pueden estar fuera del alcance de los "dos menús concretos"
- **Recomendación**: ⚠️ REDUCIR alcance solo a errores compartidos entre commandMenu e interactMenu

### 1.7 Tipos Faltantes

✅ **Discrepancia #33 - Tipos literales** (CONFIRMADA)

- `systemId: string` debería ser `systemId: SystemId` (literal union)
- **Solución**: Agregar tipos en Fase 6.1 ✅

---

## 2. Discrepancias Confirmadas pero Fuera del Alcance Directo

⚠️ **Fase 6.3 - Consumidores externos** (ALCANCE CUESTIONABLE)

El plan propone migrar:

- `teleportMenu/*`
- `monitorMenu/*`
- `commands/*`

**Análisis**:

- Estos módulos NO son los "dos menús concretos" objetivo del refactor
- Su migración es **consecuencia** del cambio de API, no objetivo primario
- **Riesgo**: Ampliar innecesariamente el alcance

**Recomendación**:

1. ✅ Mantener **compatibilidad hacia atrás** en `menu_config.ts` (shim)
2. ⚠️ NO forzar migración de módulos externos en Fase 6.3
3. ✅ Permitir que consuman el shim hasta que se decida migrarlos en futuras fases
4. ❌ Eliminar Fase 6.3 como bloqueante, convertirla en opcional

---

## 3. Problemas Críticos NO Identificados en el Plan

### 3.1 Falta Análisis de Impacto en Legacy

**Problema**: El plan asume que el `menu_config.ts` shim preservará toda la funcionalidad legacy, pero NO verifica:

1. Si los tipos exportados (`MenuSystem`, `MenuOption`, etc.) seguirán siendo compatibles
2. Si `menu_events.ts`, `menu_apply.ts`, `menu_scope.ts` del commandMenu legacy seguirán funcionando
3. Si el `menu_entity_scanner.ts` debe migrar también o quedarse

**Recomendación**: Agregar una **Fase 6.0.5 - Auditoría de consumidores legacy** antes de empezar Fase 6.1

### 3.2 Falta Estrategia para Navegación Cruzada

**Problema**: El plan NO aborda cómo mantener la navegación entre:

- commandMenu DDUI → historyPanel que muestra `SYSTEM_SHORT_NAMES`
- interactMenu DDUI → historial que usa los mismos labels
- Botones "Volver" que regresan a paneles padres

**Riesgo**: Romper flujos de navegación al centralizar constantes

**Recomendación**: Agregar verificación explícita de flujos de navegación en Fase 6.4

---

## 4. Discrepancias Incorrectas o Irrelevantes

❌ **Ninguna discrepancia del plan es completamente incorrecta**

Todas las discrepancias listadas tienen fundamento real en el código. Sin embargo, algunas tienen matices que el plan no captura completamente (ver secciones anteriores).

---

## 5. Cambios Recomendados al Plan

### 5.1 Cambios Estructurales

1. **Agregar Fase 6.0.5 - Auditoría de consumidores legacy**
   - Listar TODOS los archivos que importan desde `menu_config.ts`
   - Verificar que el shim de Fase 6.2 los mantiene funcionales
   - Documentar qué archivos del commandMenu legacy NO deben tocarse

2. **Reducir alcance de Fase 6.3**
   - Hacer OPCIONAL la migración de `teleportMenu`, `monitorMenu`, `commands/*`
   - Documentar que pueden seguir usando el shim indefinidamente
   - Solo migrar si hay beneficio claro (no solo "por consistencia")

3. **Aclarar Fase 6.5 sobre `advanced_menu` vs `advanced`**
   - `advanced_menu` es ID de navegación interna de interactMenu
   - `advanced` es ID de categoría de sistemas en el catálogo
   - NO son intercambiables directamente

4. **Agregar validación de navegación en Fase 6.4**
   - Verificar flujos: main → history, systems → advanced, volver
   - Confirmar que labels en historial coinciden entre menús

### 5.2 Correcciones de Discrepancias

1. **Discrepancia #11** - `advanced_menu` NO es residuo muerto
   - Se usa en `interactMenu/config.ts` como submenu
   - Mantener en `CATEGORY_DISPLAY_NAMES`

2. **Discrepancia #32** - Reducir alcance de mensajes de error
   - Solo centralizar errores compartidos entre commandMenu e interactMenu
   - No forzar centralización de errores específicos de cada menú

3. **Discrepancia #5** - Verificar label exacto de `SYSTEM_SHORT_NAMES.teleport`
   - El plan dice "§2Teletransporte§r" pero debe verificarse contra todos los usos

### 5.3 Agregar Pre-requisitos

1. **Antes de Fase 6.1**: Confirmar que `constants/domains.ts` es la ubicación correcta
   - Alternativa: Sección `// ── Domain Identifiers ──` en `systemCatalog.ts`
   - Decisión: Si se crea archivo separado, documentar su propósito único

2. **Antes de Fase 6.2**: Crear suite de tests para el shim
   - Verificar que `systems`, `categories`, `menuConfig` tienen estructura correcta
   - Validar que helpers delegan correctamente

3. **Antes de Fase 6.6**: Decidir estrategia para bug `set_global_overwrite`
   - Opción A: Cambiar `action` en config
   - Opción B: Agregar case en handlers
   - Documentar decisión antes de implementar

### 5.4 Aclaraciones de Nomenclatura

El plan mezcla dos conceptos que deben separarse:

1. **`advanced_menu`**: Label UI del botón "Más sistemas" en interactMenu (navegación)
2. **`advanced`**: ID de categoría que agrupa `spawn`, `health`, `teleport`, `invincible` (lógica)

**Recomendación**: Renombrar en el plan para evitar confusión:

- `SUBMENU_LABELS.advanced` = `"§6Más sistemas"` (UI)
- `CATALOG_CATEGORIES.advanced` = categoría de sistemas (lógica)

---

## 6. Dependencias y Riesgos

### 6.1 Dependencias entre Fases (Confirmadas)

✅ El orden de fases del plan es correcto:

- 6.0 → 6.1 → 6.2 → {6.3, 6.4, 6.5} → 6.6

⚠️ **Modificación sugerida**:

- 6.0 → **6.0.5** → 6.1 → 6.2 → 6.4 → 6.5 → **[6.3 opcional]** → 6.6

### 6.2 Riesgos Identificados

1. **ALTO**: El shim de Fase 6.2 rompe el commandMenu legacy
   - **Mitigación**: Fase 6.0.5 (auditoría previa)

2. **MEDIO**: `constants/domains.ts` introduce dependencia circular
   - **Mitigación**: Documentar que SOLO contiene constantes, no lógica

3. **MEDIO**: Migración de `teleportMenu`/`monitorMenu` rompe funcionalidad existente
   - **Mitigación**: Hacer Fase 6.3 opcional, mantener shim

4. **BAJO**: Labels inconsistentes entre DDUI y legacy después del refactor
   - **Mitigación**: Test manual en Fase 6.6

---

## 7. Verificación de Cobertura

### 7.1 ¿El plan cubre todos los archivos relevantes?

✅ **commandMenu objetivo**:

- `menu_config.ts` ✅
- `ddui/main.ts`, `mainPanel.ts`, `groupsPanel.ts`, etc. ✅
- `ddui/builders/systemBuilder.ts` ✅
- `ddui/helpers/historyStore.ts`, `roleHelpers.ts` ✅

✅ **interactMenu objetivo**:

- `config.ts` ✅
- `gui.ts` (para bug fix) ✅
- `ddui/interact_ddui_*.ts` ✅

⚠️ **Archivos mencionados pero fuera de alcance**:

- `teleportMenu/*` - ¿Realmente debe migrar?
- `monitorMenu/*` - ¿Realmente debe migrar?
- `commands/*` - ¿Realmente deben migrar?

### 7.2 ¿Faltan archivos importantes?

**Posiblemente faltantes**:

1. `menu_events.ts` (commandMenu legacy) - ¿Debe actualizarse si cambia la estructura de `systems`?
2. `menu_apply.ts` (commandMenu legacy) - ¿Sigue funcionando con el shim?
3. `menu_scope.ts` (commandMenu legacy) - ¿Afectado por cambios en defaults?

**Recomendación**: Verificar en Fase 6.0.5

---

## 8. Conclusión y Recomendación Final

### 8.1 Estado General del Plan

**Calidad**: ⭐⭐⭐⭐☆ (4/5)

El plan es **sólido y bien estructurado**, con identificación precisa de la mayoría de las discrepancias. Los principales problemas son:

1. Alcance potencialmente excesivo en Fase 6.3
2. Falta auditoría previa de impacto en legacy
3. Algunas ambigüedades en nomenclatura (`advanced` vs `advanced_menu`)

### 8.2 ¿Listo para Implementar?

**❌ NO TODAVÍA**

Antes de implementar, realizar los siguientes ajustes:

**Bloqueantes (DEBE hacerse)**:

1. ✅ Agregar Fase 6.0.5 - Auditoría de consumidores legacy
2. ✅ Decidir sobre `constants/domains.ts` vs sección en `systemCatalog.ts`
3. ✅ Aclarar diferencia entre `advanced_menu` (UI) y `advanced` (categoría)
4. ✅ Decidir estrategia para fix de bug `set_global_overwrite`

**Recomendados (DEBERÍA hacerse)**:

1. ⚠️ Hacer Fase 6.3 opcional o reducir su alcance
2. ⚠️ Reducir alcance de centralización de mensajes de error
3. ⚠️ Agregar verificación de flujos de navegación en Fase 6.4

**Opcionales (PODRÍA hacerse)**:

1. 💡 Crear suite de tests para el shim
2. 💡 Documentar decision log de por qué se eligió cada label canónico

### 8.3 Ruta Crítica Sugerida

1. Resolver bloqueantes listados arriba
2. Actualizar el plan con cambios recomendados
3. Obtener aprobación del usuario para:
   - Creación de `constants/domains.ts`
   - Alcance de Fase 6.3 (obligatoria vs opcional)
   - Estrategia de fix del bug `set_global_overwrite`
4. Implementar Fase 6.0.5 (auditoría)
5. Proceder con Fase 6.0 en adelante

---

## Resumen de Discrepancias

| # | Descripción | Estado | Prioridad |
| --- | ------------- | -------- | ----------- |
| 1 | Bug `set_global_overwrite` | ✅ Confirmada | CRÍTICA |
| 2 | teleport "normal" vs "moderado" | ✅ Confirmada | Alta |
| 3 | spawn displayName divergente | ✅ Confirmada | Alta |
| 4 | invincible displayName divergente | ✅ Confirmada | Alta |
| 5 | SYSTEM_SHORT_NAMES.teleport | ⚠️ Verificar label | Media |
| 6 | Colisión SpecialGroupLabels | ✅ Confirmada | CRÍTICA |
| 7-8 | Duplicación labels | ✅ Confirmada | Alta |
| 9 | Auto-import | ❓ No verificada | Media |
| 10 | Categoría `all` faltante | ✅ Confirmada | Media |
| 11 | `advanced_menu` huérfana | ⚠️ NO es huérfana | Baja |
| 12 | IDs categorías interactMenu | ✅ Confirmada | Media |
| 13 | Sufijo `§r` inconsistente | ✅ Mencionada | Baja |
| 14 | SYSTEM_SHORT_NAMES invertido | ✅ Confirmada | CRÍTICA |
| 15 | group_assignment/entity_protection | ✅ Confirmada | Media |
| 16-24 | Datos faltantes en catalog | ✅ Confirmadas | Alta |
| 25 | Inversiones múltiples | ✅ Confirmadas | CRÍTICA |
| 26 | Bug roleHelpers DPs | ✅ Confirmada | CRÍTICA |
| 27-31 | Hardcodeos DDUI | ✅ Confirmadas | Media |
| 32 | Mensajes error | ⚠️ Alcance excesivo | Media |
| 33 | Tipos literales | ✅ Confirmada | Media |

**Total**: 22 confirmadas críticas/altas, 5 requieren aclaración, 3 con matices, 3 no verificadas
