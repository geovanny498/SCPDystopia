# Plan: Migración debugWarn/debugMessage → debug() — Candidatos priorizados

**Nombre del plan:** Plan de Migración de Logging a debug() Unificado  
**Fecha de creación:** 18/09/2026  
**Última modificación:** 19/09/2026 19:40  
**Estado:** Pendiente de implementación (Tandas 3-6 completadas; Tandas 7-11 pendientes de aprobación del usuario)  
**Tipo:** Refactorización / migración de logging  

---

## 1. Cómo ejecutar la migración

### Regla de clasificación por archivo

- **Legacy:** importa `ActionFormData`/`ModalFormData`. **No migrar.** (Protegido por `AGENTS.md`).
- **DDUI/core:** importa `CustomForm`/`MessageBox` o no importa UI. **Migrar.**
- **Mixto:** si tiene imports legacy y código no legacy (ej. `interactMenu/gui.ts`), migrar solo las secciones no legacy.

### Regla de migración por llamada

1. **No es reemplazo mecánico.** Cada llamada debe evaluar su `level` semántico:
    - `debug`: flujo normal, estados, trace de ejecución
    - `warn`: condiciones inesperadas, fallbacks, casos edge no ideales
    - `error`: fallos, excepciones, violaciones de invariantes
2. **Agregar legibilidad.** IDs/typeId/player.name → `§b`, faction/systemId/groupId → `§a`, keywords estado → `§6`, keywords negativas/errores → `§c`, nameTag sin color → `§r§f`. Terminar siempre con `§r` para evitar bleed.
3. **Comprobar compatibilidad outer/inner.** El outer no debe enmascarar el inner. Consultar la tabla de colores (Sección 7).
4. **No usar `console.log`/`console.warn`/`console.error` para lógica interna.** Todo log de juego y UI pasa por `debug()`. Se permite y recomienda conservar `console.warn`/`console.error` exclusivamente para fallos críticos de inicialización del addon (`init.ts`), errores fatales en el registro de comandos nativos de Minecraft o excepciones no recuperables que deban registrarse en `content_log.txt` / consola BDS (según `AGENTS.md`).
5. **Módulos en `DEBUG_MODULES`.** Activar solo los módulos de la tanda actual en `scripts/utils/debug.ts`. Comentar el resto para no generar spam.

### Regla de `level` por tipo de mensaje

| Contexto | Level |
| --- | --- |
| Apertura/cierre de menú, navegación, aplicación de sistemas, traces | `debug` |
| UserBusy, ServerClosed sin razón, valores por defecto, condiciones edge | `warn` |
| Catch blocks, errores de form.show(), errores de guardado/red | `error` |

### Checklist obligatoria por llamada (no omitir)

Después de migrar cada llamada, verificar:

- [ ] **Level semántico correcto:** no usar `warn`/`error` como upcast de `debugMessage`/`debugWarn`.
- [ ] **Inner colors agregados** en valores relevantes: IDs, `typeId`, `player.name`, `nameTag`, `faction`, `role`, `systemId`, keywords estado, keywords negativas.
- [ ] **Outer color compatible** con el inner: no debe ser del mismo tono que el inner predominante.
- [ ] **No hay inner redundante** cuando el outer ya pinta toda la línea (ej: `§c` en mensajes de error con outer `red`).
- [ ] **§r al final** del mensaje para resetear color.
- [ ] **Sin `console.log`/`console.warn`/`console.error`** para flujo de juego en el archivo.

### Checklist obligatoria por archivo/tanda

Después de migrar cada archivo o tanda:

- [ ] **Build y deploy pasan sin errores:** ejecutar únicamente `npm run local-deploy`. Si la compilación falla no despliega, y si no despliega no se puede probar en el juego.
- [ ] **No quedan imports** de `debugMessage`/`debugWarn` en el archivo.
- [ ] **No quedan colores legacy** en llamadas `debug()`: `cyan` → `aqua`, `magenta` → `light_purple`, `purple` → `light_purple`.
- [ ] **`DEBUG_MODULES` actualizado**: solo módulos de la tanda activa habilitados.
- [ ] **Plan actualizado**: sección de tanda completada con archivos, calls, módulos y notas de legibilidad.
- [ ] **Escenarios de prueba ejecutados** (si aplica) y logs verificados en consola.
- [ ] **Auditoría de legibilidad** ejecutada: revisar que los inner colors sean visibles con el outer elegido.

---

## 2. Completado

### Tanda 3 — main.ts (COMPLETADA 19/09/2026)

| Archivo | Calls | Módulo |
| --- | --- | --- |
| `scripts/main.ts` | 14 | `projectileHitEntity`, `entityDie`, `projectileSound` |

### Tanda 4 — Candidatos menor prioridad, bloque 1 (COMPLETADA 19/09/2026)

| Archivo | Calls | Módulo |
| --- | --- | --- |
| `scripts/gui/shared/dduiFeedback.ts` | 1 | `dduiFeedback` |
| `scripts/gui/shared/entityHistory.ts` | 1 | `entityHistory` |
| `scripts/gui/commandMenu/ddui/main.ts` | 3 | `commandMenuDDUI` |
| `scripts/gui/shared/entityScope.ts` | 2 | `scope` |
| `scripts/gui/commandMenu/menu_rules.ts` | 6 | `menuRules` |
| `scripts/gui/commandMenu/ddui/sessionStore.ts` | 6 | `commandMenuDDUI` |
| `scripts/gui/commandMenu/ddui/panels/advancedPanel.ts` | 7 | `commandMenuDDUI` |
| `scripts/gui/commandMenu/ddui/panels/historyPanel.ts` | 7 | `commandMenuDDUI` |

### Tanda 5 — Paneles DDUI (COMPLETADA 19/09/2026)

| Archivo | Calls | Módulo |
| --- | --- | --- |
| `scripts/gui/commandMenu/ddui/panels/mainPanel.ts` | 8 | `commandMenuDDUI` |
| `scripts/gui/commandMenu/ddui/panels/scopePanel.ts` | 8 | `commandMenuDDUI` |
| `scripts/gui/roleMenu/panels/rolePanel.ts` | 8 | `roleMenu` |

### Tanda 6 — lifecycle + builders + estado (COMPLETADA 19/09/2026)

| Archivo | Calls | Módulo |
| --- | --- | --- |
| `scripts/utils/lifecycle.ts` | 5 | `lifecycle` |
| `scripts/gui/commandMenu/ddui/builders/systemBuilder.ts` | 10 | `commandMenuDDUI` |
| `scripts/gui/commandMenu/core/menu_state.ts` | 11 | `menuState` |

### Archivos prioridad alta — Completada (18/09/2026)

| Archivo | Calls migradas | Notas |
| --- | --- | --- |
| `scripts/gui/interactMenu/interactTrigger.ts` | 14 | soldierName pattern, §b para typeId/player.name |
| `scripts/gui/commandMenu/core/menu_events.ts` | 18 | §r§f para nametag, §b para typeId fallback. Fix L86: typeId sin §b |
| `scripts/gui/shared/entityGroups.ts` | 2 | soldierName pattern. Fix L42/L59: typeId con §b |
| `scripts/gui/commandMenu/model/menu_faction.ts` | 2 | §b typeId, §a faction/team, §6 hierarchy/group, §r§f nametag |
| `scripts/gui/commandMenu/core/menu_apply.ts` | 31 | §a systemId, §c keywords negativas, §6 estados, §r§f nameTag |
| `scripts/gui/teleportMenu/core/teleport_utils.ts` | 11 | §a faction/IDs, §b typeId, §c Error, §r§f nameTag |
| `scripts/gui/teleportMenu/core/teleport_logic.ts` | 7 | §b typeId fallback soldierName, §r§f nameTag |
| `scripts/gui/commandMenu/model/menu_scope.ts` | 17 | §b typeId fallback entityLabel, §r§f nameTag |

### Parcialmente migrados (restante pendiente en Tanda 11)

| Archivo | Calls migradas | Calls restantes activas | Imports por limpiar |
| --- | :---: | :---: | :---: |
| `scripts/gui/interactMenu/ddui/interact_ddui_shared.ts` | 5 | 8 | `debugWarn, debugMessage` |
| `scripts/gui/interactMenu/ddui/interact_ddui_form.ts` | 1 | 12 | `debugWarn, debugMessage` |
| `scripts/gui/interactMenu/ddui/interact_ddui_systems.ts` | 3 | 31 | `debugWarn, debugMessage` |

---

## 3. Tandas pendientes — Especificación Técnica y Call Specs

### Resumen general de tandas pendientes

| Tanda | Dominio | Archivos | Calls Activas |
| :---: | :--- | :---: | :---: |
| **7** | Helpers y utilidades pequeñas | 5 | 3 activas (+3 limpiezas import) |
| **8** | Dominio de combate y armas (`damage.ts`, `weapons.ts`) | 2 | 35 activas |
| **9** | Escaneo y Paneles DDUI (`groupsPanel.ts`, `menu_entity_scanner.ts`) | 2 | 0 activas |
| **10** | Comandos SCPD y worldSave | 6 | 0 activas |
| **11** | Monitor Menu DDUI + Interact DDUI restante | 6 | 85 activas |

---

### Tanda 7 — Helpers y utilidades pequeñas (3 llamadas activas + 3 limpiezas de import)

#### 1. `scripts/gui/commandMenu/ddui/helpers/formHelpers.ts`

- **Llamadas activas:** 0
- **Acción:** Solo eliminar import no utilizado en L4: `import { debugWarn, debugMessage } from "../../../../utils/debug.js";`.

#### 2. `scripts/gui/shared/equipmentDetector.ts`

- **Llamadas activas:** 0
- **Acción:** Solo eliminar import no utilizado en L4: `import { debugWarn } from "../../utils/debug.js";`.

#### 3. `scripts/gui/commandMenu/ddui/helpers/historyStore.ts` (1 llamada activa)

- **Imports:** Reemplazar `import { debugWarn } from "../../../../utils/debug.js";` por `import { debug } from "../../../../utils/debug.js";`.
- **Línea 31:** Error en catch al guardar historial.
  - Módulo: `"historyStore"`
  - Nivel: `error` | Outer color: `red`
  - Código target: `debug("historyStore",`Error guardando entrada de historial: ${e}§r`, { level: "error", color: "red" });`

#### 4. `scripts/utils/entityConfig.ts` (0 llamadas activas)

- **Imports:** L15 `import { debugWarn } from "./debug";`.
- **Líneas 33, 47, 61:** 3 llamadas comentadas históricas (`// debugWarn("entityDamageConfig", ...)`).
- **Acción:** Mantener los comentarios intactos según regla de AGENTS.md (o convertirlos a firma `debug`), y limpiar el import si queda sin uso.

#### 5. `scripts/gui/commandMenu/menu_config.ts` (2 llamadas activas)

- **Imports:** Reemplazar `import { debugWarn } from "../../utils/debug.js";` por `import { debug } from "../../utils/debug.js";`.
- **Líneas 312 y 330:** Errores al guardar y leer propiedades dinámicas de entidad.
  - Módulo: `"menu_config"`
  - Nivel: `error` | Outer color: `red`
  - Tokens: `§b${propertyId}§r`
  - L312 target: `debug("menu_config",`Error al guardar propiedad dinámica en entidad (§b${propertyId}§r): ${err}§r`, { level: "error", color: "red" });`
  - L330 target: `debug("menu_config",`Error al leer propiedad dinámica de entidad (§b${propertyId}§r): ${err}§r`, { level: "error", color: "red" });`

##### Verificación (Tanda 7)

- **Tipo de verificación:** Build (`npm run local-deploy`) + Code review estático únicamente.
- **Razón:** Las 3 únicas llamadas activas de esta tanda pertenecen a bloques `catch` de excepción (L31 en `historyStore.ts`, L312 y L330 en `menu_config.ts`). En condiciones normales de juego no emiten logs y no se deben forzar fallos artificiales ni corrupción de datos en el mundo.
- **Módulos activos en `debug.ts`:** No requiere habilitar módulos en juego para esta tanda.

---

### Tanda 8 — Dominio de combate y armas (35 llamadas activas)

#### 1. `scripts/utils/damage.ts` (15 llamadas activas)

- **Imports:** Reemplazar `import { debugMessage, debugWarn } from "./debug.js";` por `import { debug } from "./debug.js";`.
- **Sub-patrón A: Módulo `"damage"` (8 llamadas):**
  - L20 (Inicio de daño): `level: "debug"`, outer: `aqua`, tokens: `§b${target.typeId}§r`, `§6${damage}§r`.
  - L45, L49 (Dump de config): `level: "debug"`, outer: `gray`.
  - L56 (Catch de log): `level: "error"`, outer: `red`.
  - L60 (Daño bloqueado): `level: "warn"`, outer: `light_purple` (¡migrar `"purple"` legacy a `"light_purple"`!), token: `§b${target.typeId}§r`.
  - L63 (Pre-aplicación): `level: "debug"`, outer: `aqua`, tokens: `§6${dmg}§r`, `§b${target.typeId}§r`.
  - L75 (Daño aplicado exitoso): `level: "debug"`, outer: `green`, tokens: `§b${target.typeId}§r`, `§6${dmg}§r`.
  - L77 (Daño <= 0): `level: "warn"`, outer: `yellow`, tokens: `§c0 o menor§r`, `§b${target.typeId}§r`.
- **Sub-patrón B: Módulo `"modifiedDamageNumber"` (7 llamadas):**
  - L89 (Daño negativo o nulo): `level: "warn"`, outer: `yellow`, tokens: `§cnegativo o nulo§r`.
  - L101 (Reducción por resistencia): `level: "debug"`, outer: `gray`, tokens: `§6${resLevel}§r`.
  - L108 (Anulado por resistencia): `level: "debug"`, outer: `green`, tokens: `§60§r`, `§aresistencia§r`.
  - L115 (Daño sin armadura): `level: "debug"`, outer: `green`, tokens: `§6${damage}§r`.
  - L141 (Anulado por armadura): `level: "debug"`, outer: `green`, tokens: `§60§r`, `§aarmadura/encantamientos§r`.
  - L145 (Tras armadura/encantamientos): `level: "debug"`, outer: `green`, tokens: `§6${damage}§r`.
  - L149 (Catch cálculo de daño): `level: "error"`, outer: `red`.

#### 2. `scripts/utils/weapons.ts` (20 llamadas activas)

- **Imports:** Reemplazar `import { debugMessage, debugWarn } from "./debug.js";` por `import { debug } from "./debug.js";`.
- **Sub-patrón A: Módulo `"zoom"` (7 llamadas con prefijos originales preservados):**
  - L69: `debug("zoom",`[start] Jugador §b${player.id}§r ya tiene intervalo de zoom activo§r`, { level: "warn", color: "yellow" });`
  - L73: `debug("zoom",`[start] Creando zoom para jugador §b${player.id}§r con §a${itemTypeId}§r FOV=§6${zoomFov}§r`, { level: "debug", color: "green" });`
  - L79: `debug("zoom",`[interval] Jugador §b${player.id}§r tiene item actual=§a${currentTypeId}§r, esperado=§a${state?.itemTypeId}§r`, { level: "debug", color: "blue" });`
  - L85: `debug("zoom",`[interval] Jugador §b${player.id}§r ya no tiene el arma con zoom (actual=§a${currentTypeId}§r, esperado=§a${state?.itemTypeId}§r), deteniendo zoom§r`, { level: "warn", color: "yellow" });`
  - L116: `debug("zoom",`[clear] Cámara limpiada y zoom detenido para jugador §b${player.id}§r`, { level: "debug", color: "aqua" });`
  - L126: `debug("zoom",`[hotbar] Jugador §b${player.id}§r cambió a slot §6${event.newSlotSelected}§r item=§a${itemTypeId}§r`, { level: "debug", color: "blue" });`
  - L146: `debug("zoom",`[clearAll] Limpiando todos los zooms activos (${playerZoomStates.size})§r`, { level: "debug", color: "gray" });`
- **Sub-patrón B: Módulo `"player"` — Disparo y proyectiles (10 llamadas):**
  - L176 (Arma no configurada): `level: "warn"`, outer: `yellow`, token: `§a${itemId}§r`.
  - L187 (Proyectil no creado): `level: "error"`, outer: `red`, token: `§c${data.projectile}§r`.
  - L212, L227, L233 (Info interna/equippable): `level: "debug"`, outer: `gray` o `green`.
  - L237 (Disparo en curso): `level: "debug"`, outer: `green`, tokens: `§a${itemId}§r`, `§b${data.projectile}§r`.
  - L243 (Comando ejecutado): `level: "debug"`, outer: `aqua`, token: `§6${result.successCount}§r`.
  - L245, L250, L270 (Errores de proyectil/comando): `level: "error"`, outer: `red`.
- **Sub-patrón C: OJO MODELO — Parámetros invertidos/omitidos en original (3 llamadas):**
  - *En el código original, L293, L314 y L323 omitieron el módulo (`debugWarn("msg", "cyan")`). Al migrar, DEBE pasarse el módulo `"player"` como primer argumento:*
  - L293 target: `debug("player",`Jugador §b${player.id}§r está en §6cooldown§r.§r`, { level: "debug", color: "aqua" });`
  - L314 target: `debug("player",`Jugador §b${playerId}§r dejó de disparar.§r`, { level: "debug", color: "aqua" });`
  - L323 target: `debug("player",`Borrando a Jugador §b${playerId}§r del cooldownMap§r`, { level: "debug", color: "aqua" });`

##### Escenarios de verificación en juego (Tanda 8)

- **`weapons.ts` (Zoom):**
  - Acción: Sostener un arma con zoom configurado y usar click derecho para apuntar.
  - Esperado: `[start] Creando zoom para jugador §b<id>§r con §a<itemId>§r FOV=§6<fov>§r` con outer `green`.
  - Acción: Cambiar de slot en la hotbar mientras se apunta.
  - Esperado: `Jugador §b<id>§r cambió a slot §6<slot>§r item=§a<item>§r` con outer `blue`.
  - Acción: Dejar de apuntar / soltar click derecho.
  - Esperado: `[clear] Cámara limpiada y zoom detenido para jugador §b<id>§r` con outer `aqua`.
- **`weapons.ts` (Disparo y Cooldown):**
  - Acción: Disparar el arma.
  - Esperado: `Disparando §a<itemId>§r → §b<projectile>§r` con outer `green`.
  - Acción: Intentar disparar repetidamente durante el cooldown.
  - Esperado: `Jugador §b<id>§r está en §6cooldown§r.` con outer `aqua`.
- **`damage.ts` (Cálculo y aplicación de daño):**
  - Acción: Disparar o golpear a una entidad (mob o guardia).
  - Esperado: `Daño aplicado correctamente a §b<typeId>§r: §6<dmg>§r` con outer `green`.
  - Acción: Atacar con un daño mitigado o anulado por armadura/resistencia.
  - Esperado: `Daño final: 0 (anulado por §aresistencia§r)` o `Daño final tras armadura/encantamientos: §6<damage>§r` con outer `green`.
- **Módulos activos recomendados en `debug.ts`:**
  - `zoom`
  - `player`
  - `damage`
  - `modifiedDamageNumber`

---

### Tanda 9 — Escaneo y Paneles DDUI (COMPLETADA 19/09/2026)

| Archivo | Calls | Módulo |
| --- | --- | --- |
| `scripts/gui/commandMenu/ddui/panels/groupsPanel.ts` | 13 | `commandMenuDDUI` |
| `scripts/gui/commandMenu/model/menu_entity_scanner.ts` | 15 | `menuScanner`, `menuScanner:base`, `menuScanner:buckets` |

#### 1. `scripts/gui/commandMenu/ddui/panels/groupsPanel.ts` (13 llamadas activas)

- **Imports:** Reemplazar `import { debugWarn, debugMessage } from "../../../../utils/debug.js";` por `import { debug } from "../../../../utils/debug.js";`.
- **Módulo OBLIGATORIO:** `"commandMenuDDUI"` (¡No usar `"menuGroups"` para no desalinear `DEBUG_MODULES`!).
- **L112, L245:** Cierre por X del cliente. `level: "debug"`, outer: `gray`, token: `§b${player.name}§r`.
- **L115, L248:** Cierre por UserBusy. `level: "warn"`, outer: `yellow`, tokens: `§6UserBusy§r`, `§b${player.name}§r`.
- **L119, L252:** Cierre por navegación. `level: "debug"`, outer: `gray`, token: `§b${player.name}§r`.
- **L122, L255:** Cierre por ServerClosed sin razón. `level: "warn"`, outer: `yellow`, tokens: `§6ServerClosed§r`, `§b${player.name}§r`.
- **L134, L138, L266, L270, L352:** Errores de renderizado y asignación. `level: "error"`, outer: `red`.

#### 2. `scripts/gui/commandMenu/model/menu_entity_scanner.ts` (15 invocaciones de log: 13 llamadas directas + alias con 2 usos)

- **Imports:** Reemplazar `import { debugWarn, debugMessage } from "../../../utils/debug.js";` por `import { debug } from "../../../utils/debug.js";` (limpiando `debugMessage` que no tiene usos activos).
- **Módulos:** `"menuScanner"` y `"menuScanner:base"`.
- **Desglose exacto de referencias (16 totales en código):**
  - 13 llamadas directas a `debugWarn(...)`: L71, L88, L367, L376, L389, L408, L460, L466, L485, L496, L518, L527, L551.
  - 1 definición de alias en L192: `const bucketDiagnostic = debugWarn;`.
  - 2 invocaciones del alias: L278 y L284 (`bucketDiagnostic(...)`).
- **OJO MODELO en L192 (Tratamiento del alias `bucketDiagnostic`):**
  - Reemplazar la asignación del alias por un helper tipado que invoque `debug`:

    ```typescript
    const bucketDiagnostic = (msg: string, color?: string) =>
      debug("menuScanner:buckets", msg, { level: "debug", color: color ?? "gray" });
    ```

- **L71, L88:** Diagnóstico de cache. `level: "debug"`, outer: `gray` (L71 HIT) y `yellow` (L88 MISS). Tokens: `§b${key}§r`.
- **L367, L376, L389, L408, L460, L466, L485, L496, L518, L527, L551:** Traces de escaneo. Tokens: `§a${faction}§r`, `§b${key/dimension/typeId}§r`, `§6${count/familyId}§r`, `§r§f${nametag}§r`. L496 es `warn` o `error` (outer: `red`) por "both" no soportado.

##### Escenarios de verificación en juego (Tanda 9)

- **`groupsPanel.ts`:**
  - Acción: Ejecutar `/scpd:config` y navegar al panel de Grupos / Asignación por bucket.
  - Acción: Cerrar el panel presionando la `X` del formulario.
  - Esperado: `Grupos por Facción cerrado: X del cliente (§b<player.name>§r)` con outer `gray`.
  - Acción: Cerrar navegando hacia otro panel.
  - Esperado: `Grupos por Facción cerrado: navegación (§b<player.name>§r)` con outer `gray`.
- **`menu_entity_scanner.ts`:**
  - Acción: Abrir `/scpd:config` en una zona con guardias/entidades cercanas.
  - Esperado: `Scan START: faction=§a<faction>§r rawEntities=§b<count>§r` con outer `dark_gray`.
  - Esperado: `[entityQueryCache MISS] <key> count=§b<count>§r` con outer `yellow`.
  - Esperado: Si se agrupan entidades por bucket: `"<bucketName>" (<count> unidades)` con outer `yellow` (vía `menuScanner:buckets`).
- **Módulos activos recomendados en `debug.ts`:**
  - `commandMenuDDUI`
  - `menuScanner`
  - `menuScanner:base`
  - `menuScanner:buckets`

---

### Tanda 10 — Comandos SCPD y worldSave (COMPLETADA 19/09/2026)

| Archivo | Calls | Módulo |
| --- | --- | --- |
| `scripts/commands/worldSave.ts` | 3 | `dynamicProperties` |
| `scripts/commands/role_commands.ts` | 4 | `roleMenu` |
| `scripts/commands/config_command.ts` | 6 | `configCommand` |
| `scripts/commands/teleport_command.ts` | 4 | `teleportCommand` |
| `scripts/commands/monitor_command.ts` | 5 | `monitorCommand` |
| `scripts/gui/shared/playerPermissionManager.ts` | 5 | `roleMenu` |

#### 1. `scripts/commands/worldSave.ts` (3 llamadas activas)

- **Imports:** Reemplazar `import { debugMessage, debugWarn } from "../utils/debug.js";` por `import { debug } from "../utils/debug.js";`.
- **Módulo:** `"dynamicProperties"`.
- L18 (Guardado): `level: "debug"`, outer: `blue`, token: `§b${propName}§r`.
- L20, L35 (Error guardar/cargar): `level: "error"`, outer: `red`, token: `§a${systemName}§r`.
- **Regla de console:** Conservar intactos los `console.warn` y `console.log` de mantenimiento del servidor (L51, L68, L70, L83, L84, L86).

#### 2. `scripts/commands/role_commands.ts` (4 llamadas activas)

- **Módulo:** `"roleMenu"`.
- L30 (Panel abierto): `level: "debug"`, outer: `aqua`, token: `§b${admin.name}§r`.
- L32, L42, L47 (Errores de handler y registro): `level: "error"`, outer: `red`.

#### 3. `scripts/commands/config_command.ts` (6 llamadas activas)

- **Módulo:** `"configCommand"`.
- L38, L43 (Menú abierto legacy/DDUI): `level: "debug"`, outer: `aqua`, token: `§b${player.name}§r`.
- L45, L51, L63, L68 (Errores handler y registro): `level: "error"`, outer: `red`.

#### 4. `scripts/commands/teleport_command.ts` (4 llamadas activas)

- **Módulo:** `"teleportCommand"`.
- L23 (Ejecutado): `level: "debug"`, outer: `aqua`.
- L27 (Rechazado no jugador): `level: "warn"`, outer: `yellow`.
- L35 (Abriendo menú): `level: "debug"`, outer: `green`, token: `§b${player.name}§r`.
- L41 (Error menú): `level: "error"`, outer: `red`.
- **Regla de console:** Conservar `console.warn` en L42, L54, L59 para fallos de registro nativo.

#### 5. `scripts/commands/monitor_command.ts` (5 llamadas activas)

- **Módulo:** `"monitorCommand"`.
- L25 (Ejecutado): `level: "debug"`, outer: `aqua`.
- L28 (Rechazado no jugador): `level: "warn"`, outer: `yellow`.
- L40, L52, L57 (Errores internos y registro): `level: "error"`, outer: `red`.

#### 6. `scripts/gui/shared/playerPermissionManager.ts` (5 llamadas activas)

- **Módulo:** `"roleMenu"`.
- L44 (Rol actualizado): `level: "debug"`, outer: `green`, tokens: `§b${player.name}§r`, `§a${faction}§r`, `§6${role}§r`.
- L46, L67, L85 (Errores guardando/admin/keys): `level: "error"`, outer: `red`.
- L80 (Fallback individual): `level: "warn"`, outer: `yellow`.

##### Escenarios de verificación en juego (Tanda 10)

- **`config_command.ts`:**
  - Acción: Ejecutar `/scpd:config` en el chat.
  - Esperado: `Menú DDUI abierto para §b<player.name>§r` con outer `aqua`.
- **`role_commands.ts`:**
  - Acción: Ejecutar `/scpd:roles` como administrador.
  - Esperado: `Panel de roles abierto para §b<admin.name>§r` con outer `aqua`.
- **`teleport_command.ts`:**
  - Acción: Ejecutar `/scpd:teleport` en el chat.
  - Esperado: `Comando /scpd:teleport ejecutado` con outer `aqua` y `Abriendo menú para jugador: §b<player.name>§r` con outer `green`.
- **`monitor_command.ts`:**
  - Acción: Ejecutar `/scpd:monitor_units` en el chat.
  - Esperado: `Comando /scpd:monitor_units ejecutado` con outer `aqua`.
- **`playerPermissionManager.ts`:**
  - Acción: Asignar o cambiar el rol de un jugador desde `/scpd:roles`.
  - Esperado: `Rol actualizado para §b<player.name>§r: §a<faction>§r = §6<role>§r` con outer `green`.
- **`worldSave.ts`:**
  - Acción: Guardar estado de sistemas o modificar toggles globales.
  - Esperado: `[SCPDystopia] Propiedad guardada: §b<propName>§r` con outer `blue`.
- **Módulos activos recomendados en `debug.ts`:**
  - `configCommand`
  - `roleMenu`
  - `teleportCommand`
  - `monitorCommand`
  - `dynamicProperties`

---

### Tanda 11 — Monitor Menu DDUI e interactMenu DDUI restante (85 llamadas activas)

#### 1. `scripts/gui/monitorMenu/monitor_session.ts` (3 llamadas activas)

- **Módulo:** `"monitorCommand"`.
- L95, L181, L212 (Intervalos y sesiones limpiadas): `level: "debug"`, outer: `gray`, token: `§b${this.playerId}§r`.

#### 2. `scripts/gui/monitorMenu/monitor_state.ts` (9 llamadas activas)

- **Módulo:** `"monitorCommand"`.
- L19, L27, L68 (Defaults, configs inválidas, borrado): `level: "warn"`, outer: `yellow`.
- L23, L48, L59 (Cargas y guardados exitosos): `level: "debug"`, outer: `green` o `aqua`.
- L51, L61, L70 (Errores al cargar/guardar/borrar): `level: "error"`, outer: `red`.

#### 3. `scripts/gui/monitorMenu/monitor_form.ts` (22 llamadas activas)

- **Módulo:** `"monitorCommand"`.
- Aperturas, sesiones creadas, navegación: `level: "debug"`, outer: `aqua` / `green` / `gray`, tokens: `§b${player.name}§r`.
- Cierres por `UserBusy` y `ServerClosed`: `level: "warn"`, outer: `yellow`, tokens: `§6UserBusy§r`, `§b${player.name}§r`.
- Errores en `form.show()` y handlers: `level: "error"`, outer: `red`.

#### 4. `scripts/gui/interactMenu/ddui/interact_ddui_shared.ts` (8 llamadas activas restantes)

- **Módulo:** `"interactDDUI"` (y `"dduiFeedback"` en L89).
- L89: feedback `debug("dduiFeedback", ...)`.
- L247, L767: sesiones/intervalos (`level: "debug"`, outer: `gray` / `green`).
- L290, L301, L313, L328, L921: errores en asignación y configs (`level: "error"`, outer: `red`).

#### 5. `scripts/gui/interactMenu/ddui/interact_ddui_form.ts` (12 llamadas activas restantes)

- **Módulo:** `"interactDDUI"`.
- Cierres por navegación y cliente: `level: "debug"`, outer: `gray`.
- Cierres por UserBusy: `level: "warn"`, outer: `yellow`.
- Errores de vistas y `form.show()`: `level: "error"`, outer: `red`.

#### 6. `scripts/gui/interactMenu/ddui/interact_ddui_systems.ts` (31 llamadas activas restantes)

- **Módulo:** `"interactDDUI"`.
- Cierres de vistas de sistemas (principal, gestión, etc.): `level: "debug"`, outer: `gray`.
- UserBusy en vistas: `level: "warn"`, outer: `yellow`.
- Errores de vistas y aplicación: `level: "error"`, outer: `red`.

##### Escenarios de verificación en juego (Tanda 11)

- **`monitor_form.ts` & `monitor_session.ts`:**
  - Acción: Ejecutar `/scpd:monitor_units`.
  - Esperado: `Mostrando monitor para §b<player.name>§r` con outer `aqua` y `Sesión de monitor creada para §b<player.name>§r` con outer `green`.
  - Acción: Cerrar el monitor con la `X` del cliente.
  - Esperado: `Monitor cerrado: X del cliente (§b<player.name>§r)` con outer `gray`.
  - Acción: Salir del mundo o esperar limpieza de sesión.
  - Esperado: `Sesión limpiada: §b<playerId>§r` con outer `gray`.
- **`interact_ddui_form.ts` & `interact_ddui_systems.ts`:**
  - Acción: Interactuar con un soldado o NPC para abrir el menú de interacción DDUI.
  - Esperado: `Sesión creada: §b<playerId>§r` con outer `green`.
  - Acción: Navegar a Vista Sistemas Avanzados o Gestión y volver a la principal.
  - Esperado: Logs de navegación y cambio de vista con outer `gray`.
  - Acción: Cerrar el menú con la `X`.
  - Esperado: Log de cierre con outer `gray`.
- **Módulos activos recomendados en `debug.ts`:**
  - `monitorCommand`
  - `interactDDUI`
  - `dduiFeedback`

---

## 4. Archivos excluidos permanentemente (legacy UI)

Solo archivos legacy (`ActionFormData`/`ModalFormData`) protegidos por AGENTS.md. **No tocar sin aprobación explícita:**

| Archivo | Calls | Razón |
| --- | --- | --- |
| `scripts/gui/interactMenu/gui.ts` | 9 | Legacy (`ActionFormData`) — protegido por AGENTS.md |
| `scripts/gui/commandMenu/ui/menu_system.ts` | 22 | Legacy UI |
| `scripts/gui/commandMenu/ui/menu_groups_ui.ts` | 11 | Legacy UI |
| `scripts/gui/commandMenu/ui/menu_scope_ui.ts` | 3 | Legacy UI |
| `scripts/gui/commandMenu/ui/menu_category.ts` | 3 | Legacy UI |
| `scripts/gui/commandMenu/builder/menu_builder.ts` | 3 | Legacy UI |
| `scripts/gui/commandMenu/builder/menu.ts` | 6 | Legacy UI |
| `scripts/gui/teleportMenu/menus/teleport_type_menu.ts` | 3 | Legacy (`ActionFormData`) |
| `scripts/gui/teleportMenu/menus/teleport_menu.ts` | 3 | Legacy (`ActionFormData`) |
| `scripts/gui/teleportMenu/menus/teleport_normal_menu.ts` | 4 | Legacy (`ModalFormData`) |
| `scripts/gui/teleportMenu/menus/teleport_all_menu.ts` | 9 | Legacy (`ActionFormData`) |
| `scripts/gui/teleportMenu/menus/teleport_special_menu.ts` | 10 | Legacy (`ModalFormData`) |

---

## 5. Criterios de priorización

1. **Riesgo de bleed** (`nameTag`/`nametag`/`displayName` con §x) — prioridad máxima
2. **Calls con mayor volumen** — prioridad secundaria (eficiencia de migración)
3. **Archivos en `core/` y `model/`** — shared, SÍ refactorizables
4. **Archivos legacy (`ui/`, `builder/`, `interactMenu/gui.ts`, `teleportMenu/menus/*`)** — protegidos, excluidos permanentemente
5. **Resto de archivos no legacy** — todos son candidatos, sin exclusión por “no prioridad”

---

## 6. Requisitos de evaluación de `level` por llamada

**Mandatory:** el `level` (`debug`/`warn`/`error`) **no** se hereda automáticamente de la función origen (`debugMessage`→debug, `debugWarn`→warn). Cada llamada migrada a `debug()` debe:

1. Evaluar el contexto: ¿reporta un error real, una advertencia inesperada, o información de diagnóstico?
2. Asignar `level` acorde al significado semántico, no al método de consola original:
   - `debug`: información de flujo normal, estados, trace de ejecución
   - `warn`: condiciones inesperadas, fallbacks, casos edge no ideales
   - `error`: fallos, excepciones, violaciones de invariantes
3. Defender el `level` elegido: no usar `warn` o `error` como "upcast" de `debugMessage`.

**Outer color debe ser consistente con el level** (ver tabla de colores). No usar `red`/`yellow`/`gold` en `level: "debug"` salvo que el mensaje tenga keywords negativas/estado coloreadas con §x.

---

## 7. Convenciones de color

### Constantes de color (debug.ts)

- **Legacy** (`debugMessage`/`debugWarn`/`debugChat`): `CONSOLE_COLORS`, `CHAT_COLORS` — nombres no oficiales (cyan, magenta, purple, orange, dark). **No tocar.**
- **New** (`debug()`): `MC_NAMED_COLORS` + `MC_CODE_TO_NAME` — fuente única de valores ANSI.

`MC_NAMED_COLORS` define valores ANSI una sola vez (nombres oficiales Java). `MC_CODE_TO_NAME` resuelve § codes → nombres. `convertMCtoANSI()` hace § code → nombre → ANSI. `debug()` usa `MC_NAMED_COLORS[colorName]` directamente.

**Nombres oficiales soportados en debug():**

| Categoría | Nombres |
| --- | --- |
| Básicos (16) | black, dark_blue, dark_green, dark_aqua, dark_red, dark_purple, gold, gray, dark_gray, blue, green, aqua, red, light_purple, yellow, white |
| Materiales (BE, §g-§w) | minecoin_gold, material_quartz, material_iron, material_netherite, material_redstone, material_copper, material_gold, material_emerald, material_diamond, material_lapis, material_amethyst, material_resin, light_blue |
| Formato | bold, italic, reset |

### Tabla de color outer + inner (para debug())

**Outer colors por level:**

- `debug`: `gray` (detalles), `aqua` (acciones), `light_purple` (checks/resultados), `blue` (state guards), `green` (éxito), `gold` (warn/info)
- `warn`: `yellow` (defecto), `gold` (advertencia suave)
- `error`: `red` (defecto), `dark_red` (error grave)

**Inner §x por tipo de valor:**

| Tipo | §x | Outer compatible (16 básicos) | §x incompatible (mismo tono) |
| --- | --- | --- | --- |
| IDs (`systemId`, `groupId`) | `§a` (green) | black, dark_blue, dark_aqua, dark_red, dark_purple, gold, gray, dark_gray, blue, aqua, red, light_purple, yellow, white | green, dark_green |
| typeId fallback | `§b` (aqua) | black, dark_blue, dark_green, dark_red, dark_purple, gold, gray, dark_gray, blue, red, light_purple, yellow, white | aqua, dark_aqua |
| player.name | `§b` (aqua) | (misma que typeId) | (misma que typeId) |
| nameTag sin color | `§r§f` (white) | todos | (reset protege) |
| Keywords negativas | `§c` (red) | black, dark_blue, dark_green, dark_aqua, dark_purple, gold, gray, dark_gray, blue, aqua, light_purple, yellow, white | red, dark_red |
| Keywords estado | `§6` (gold) | black, dark_blue, dark_green, dark_aqua, dark_red, dark_purple, gray, dark_gray, blue, aqua, red, light_purple, white | gold, yellow |

**Notas:**

- **Neutrals** (black, gray, dark_gray, white) siempre son compatible — usar como outer safe.
- **Material colors** siguen las mismas familias de tono.
- **Incompatible** = mismo color o hermano de tono → bajo contraste o invisible.
- Si `player.name` y `typeId` usan el mismo §x, usan la misma tabla.

### Migraciones de color nombre → oficial (18/09/2026)

- `"cyan"` → `"aqua"`
- `"magenta"` → `"light_purple"`
- `"purple"` → `"light_purple"`

### Corrección de RGB (18/09/2026)

- `§q` material_emerald: RGB confirmado como `71;160;54` (= #47A036 oficial). No cambiar.

Ver detalle completo en `PLAN_debugFormatted_mc_color_conversion.md`.

---

## 8. Limitaciones y casos no detectados

- **Variables dinámicas:** este plan identifica riesgo de bleed basado en el nombre literal `nameTag`/`displayName` en el código. Si un módulo crea strings con §x internamente, podría no haber sido detectado.
- **Archivos JavaScript (`.js`):** el análisis abarca solo `*.ts`. Existen archivos `.js` legacy que podrían usar `debugMessage`/`debugWarn` sin haber sido detectados.
- **Strings construidos dinámicamente:** si un `§x` se construye mediante concatenación o interpolación indirecta, no sería capturado por el grep estático.
- **Facción coloreada:** `faction` se asumió como string plano ("foundation"/"chaos"), pero si en algún futuro se colorea con §x, los archivos que lo usan en debugs podrían requerir migración.
- **Session `soldierName`:** `ddui/sessionStore.ts` almacena `soldierName` que proviene de `interactTrigger.ts` — este **sí** contiene §x codes. Riesgo bajo-medio. Revisar con atención.

---

## 9. Auditoría post-migración — lecciones aplicadas

Después de la migración inicial, se realizó una auditoría completa corrigiendo:

**Problemas de legibilidad (outer enmascarando inner):**

- `main.ts`: outer `aqua` + inner `§b` → cambiado a `blue`
- `sessionStore.ts` (creación): outer `green` + inner `§a` → cambiado a `light_purple`
- `advancedPanel.ts`/`historyPanel.ts` (UserBusy): outer `yellow` + inner `§6` → cambiado a `gray`
- `applySystemsToAll` (`menu_state.ts`): outer `blue` + inner `§b` → cambiado a `gray`

**Inner colors faltantes:**

- Agregados en todos los archivos para IDs, typeId, player.name, faction, roles, keywords estado y valores relevantes.

**Redundancias eliminadas:**

- En mensajes de `error` con outer `red`, se eliminó `§c` innecesario en keywords como "Error".

**Lección:** no basta con migrar la API. Cada llamada debe tener inner colors para valores relevantes y un outer compatible. Si el outer y el inner son del mismo tono, el texto queda invisible.
