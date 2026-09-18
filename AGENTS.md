# AGENTS.md

## Reglas para código escalable y mantenible

* **Encapsulación**: definir una interfaz o clase con `get/set/delete/clear` y un único punto de cleanup para cualquier `Map`/`Record` mutable global. Evitar acceder a estructuras de estado desde módulos externos sin pasar por esa interfaz.
* **Ciclo de vida**: todo recurso creado en runtime (intervalos, eventos, formularios, sesiones) debe tener un punto de cleanup explícito. No dejar listeners ni `system.runInterval` huérfanos.
* **Tamaño y responsabilidad**: si un módulo supera las ~250 líneas o mezcla configuración, query de entidades, builders de UI y lógica de aplicación, dividirlo por dominio. Un archivo = una responsabilidad principal.
* **Funciones**: evitar handlers/monolitos mayores a ~80 líneas. Extraer builders de formulario, parsers de `formValues` y ejecutores de acciones en funciones separadas.
* **Documentación**: toda función, clase, interfaz, enum y tipo exportado debe incluir JSDoc con `@param` para cada parámetro y `@returns` cuando corresponda. El JSDoc debe aportar información útil; evitar repetir simplemente el nombre, tipo o comportamiento obvio.
* **Comentarios**: nunca eliminar comentarios existentes del código base. Agregar comentarios explicativos en bucles complejos, secciones grandes y puntos donde sea difícil orientarse. Son obligatorios cuando la lógica no es obvia de un vistazo.
* **Tipos**: prohibido usar `any` en firmas públicas. Usar interfaces del dominio existentes o definirlas en el mismo módulo de la feature.
* **Logging**: usar `debug()` en **todo código nuevo**. `debugMessage`/`debugWarn` están deprecadas y se migran a `debug()` de a pocos archivos — no envolverlas con `debug()` (causaría bleed inesperado). Eliminar `console.log`/`console.warn`/`console.error` de comandos, eventos y UI.
  * `debug()` (**prioridad 1**): función unificada. Acepta `{ level?, color? }` donde `level` es `"debug"` (default, `console.log`), `"warn"` (`console.warn`), `"error"` (`console.error`). Convierte códigos `§` → ANSI truecolor y re-aplica color tras `§r`. Usar códigos `§` para destacar info clave, cerrar con `§r`. Máx. 1-2 colores por línea.
    * **Color selectivo, no obligatorio**: usar preferentemente `§` internos cuando haya un identificador o estado que merezca énfasis visual (typeId, systemId, player.name, entity name, palabras clave como `NO aplicado`, `FUERA DE SCOPE`). No añadir colores únicamente por cumplir una regla — priorizar legibilidad sobre decoración.
    * **Colores oficiales en `debug()`**: usar `MC_NAMED_COLORS` (scripts/utils/debug.ts). Nombres oficiales Java: `black`, `dark_blue`, `dark_green`, `dark_aqua`, `dark_red`, `dark_purple`, `gold`, `gray`, `dark_gray`, `blue`, `green`, `aqua`, `red`, `light_purple`, `yellow`, `white`, plus materiales BE (`minecoin_gold`, `material_quartz`, etc.) y formato (`bold`, `italic`, `reset`). No usar nombres legacy (`cyan`, `magenta`, `purple`, `orange`, `dark`).
    * `debugMessage`/`debugWarn` (**prioridad 2**): migrar gradualmente. No usar en código nuevo.
* **Configuración estática** (armas, proyectiles, sistemas, textos de UI): definirla en datos tipados separados, no como literales inline dispersos en lógica de negocio.
* **Entidades y dimensiones**: centralizar consultas en `utils/entityQuery.ts` y constantes de dimensiones en un único lugar. No duplicar escaneos ni filtros por facción/jerarquía en cada módulo GUI.
* **API Bedrock**: preferir siempre la API tipada oficial (`@minecraft/server`, `@minecraft/server-ui`) sobre patrones ad-hoc. Si una operación requiere lógica repetitiva, encapsularla en un helper del dominio, no copiarla.

## Exploración y reutilización

* **Buscar antes de crear**: antes de implementar una función, helper, query, parser, builder o lógica nueva, buscar en el proyecto si ya existe una implementación equivalente o un patrón reutilizable.
* **Revisar usos existentes**: cuando se reutilice una función, tipo o helper existente, revisar sus usos relevantes para comprender cómo se utiliza realmente. No asumir su comportamiento únicamente por el nombre o firma.
* **Evitar duplicación**: si ya existe una implementación adecuada, reutilizarla en lugar de crear otra equivalente.
* Usar `rg`/ripgrep para localizar funciones, tipos, propiedades, eventos y patrones existentes cuando sea útil.

## Contexto de la operación

* **Código válido ≠ comportamiento correcto**: que una llamada sea válida para TypeScript o Bedrock no garantiza que sea correcta para la lógica del addon. Verificar el contexto y propósito de los datos utilizados.
* **Operaciones iniciadas por jugadores**: cuando una operación se origine desde un `Player` o una sesión asociada a un jugador, considerar su contexto real antes de usar valores globales o defaults: dimensión, identidad, permisos, facción, rol, sesión, estado, etc.
* **Dimensiones**: no asumir `overworld` como dimensión en operaciones iniciadas desde un jugador. Si la operación debe actuar sobre la dimensión del jugador, usar `player.dimension` o el contexto equivalente de la sesión. Usar `world.getDimension("overworld")` solo cuando operar específicamente sobre Overworld sea intencional.
* **Preservar patrones existentes**: antes de cambiar cómo se obtiene un dato contextual, comprobar cómo se obtiene en otras partes relacionadas del proyecto.

## Estructura y dominio

* `scripts/gui/`: solo construcción de UI y eventos de formularios. Sin lógica de juego.
* `scripts/commands/`: solo registro de comandos y handlers. Sin builders de UI.
* `scripts/utils/`: helpers puros y datos tipados. Sin side effects en importación.
* `scripts/components/`: componentes de entidad/daño reutilizables.
* Dirección de dependencias: `gui → commands → utils`. Nunca al revés.

## Anti-patrones

* No registrar `world.afterEvents.xxx.subscribe` dentro de builders de formulario o funciones de UI pura. Los eventos deben subscribirse una vez en el módulo de sistemas/commands, no cada vez que se abre un menú.
* No crear `system.runInterval` ni `system.runTimeout` sin registrar su `intervalId` en un store y limpiarlo en el punto de cierre del formulario (`formResponse` con cierre, cancelación o `playerLeave`). El intervalo sin cleanup es el error real, no su existencia.
* No parsear `formValues` por índice frágil dentro de la misma función que construye el formulario; usar acceso por etiqueta/ID o un parser separado.
* No guardar estado de jugador en cierres de formularios sin registrarlo en un store con cleanup por `playerLeave`.
* No declarar `Map`/`Record` mutables globales sin una interfaz con `get/set/delete/clear` y punto de cleanup centralizado. El estado disperso sin encapsulación es bloqueante.
* No omitir el JSDoc en funciones, clases, interfaces, enums ni tipos exportados. No eliminar comentarios existentes del código base.
* No crear una segunda implementación de una función o mecanismo existente sin comprobar primero si puede reutilizarse.
* No utilizar valores globales o defaults cuando la operación requiere el contexto específico del jugador que la inició.

## Jerarquía de reglas

* **Bloqueo**: estado global sin cleanup, listeners huérfanos, `any` en firmas públicas, Maps/Records mutables globales sin interfaz encapsulada.
* **Obligatorio**: tipado explícito, JSDoc en toda exportación, logging con `debug()` (con migración gradual de `debugMessage`/`debugWarn`), separación de responsabilidades, búsqueda y reutilización del código existente.
* **Recomendado**: datos tipados en archivos `.ts` para config estática, helpers para operaciones repetitivas.

## Flujo de compilación y despliegue

* Para verificar errores y desplegar cambios al juego, ejecuta únicamente:
  `npm run local-deploy`
* NO uses el flag `--watch` ni comandos en segundo plano, ya que bloquean la ejecución de la consola.
* Si la compilación falla, corrige los errores informados en la salida de la consola antes de continuar.
* Build debe pasar sin errores antes de considerar completado un cambio relevante.

Siempre responde en español.

Está disponible la herramienta ripgrep (o `rg` en bash) y se recomienda usarla según se estime conveniente.

Estamos en windows 11, no hay otras herramientas instaladas para powershell aparte de las mencionadas en AGENTS.md y ripgrep.

El proyecto es un addon de Minecraft Bedrock que usa los archivos de ruta "scripts" para compilar JavaScript y TypeScript en un único archivo JavaScript que usa el addon al ejecutarse en el juego.

Se recomienda consultar `node_modules\@minecraft\server\index.d.ts` y `node_modules\@minecraft\server-ui\index.d.ts` dentro de `node_modules` para buscar qué funciones o métodos están vigentes en la API.

Se busca que todo lo relacionado con SCPDystopia sea escalable y modular para facilitar futuras expansiones del addon.

Hay funciones de depuración en `scripts/utils/debug.ts` para mejor personalización y depuración; cuando quieras usarlas, añade el módulo a `debug.ts` para que se puedan ver.

Todavía quedan archivos `.js` necesarios que se usan junto con los `.ts`, pero el proyecto se está adaptando de JavaScript a TypeScript. Usar TypeScript para los nuevos archivos.

No modificar `scripts/main1.js`: es una dependencia heredada del addon y no forma parte del área de trabajo actual.

Pon nombres claros a los planes para poder identificarlos.

Registra siempre fecha y hora de la última modificación de los planes con el formato `dd/mm/yyyy`. También registra si el plan fue implementado o si está pendiente de implementación.

Nunca implementes los planes sin aprobación explícita del usuario, y cuando lo hagas actualiza el plan indicando que se implementó.

## Clasificación de menús: legacy vs DDUI vs compartido

**Regla de detección:**

* Importa `ActionFormData`/`ModalFormData` → **legacy** (NO modificar sin aprobación)
* Importa `CustomForm`/`MessageBox` → **DDUI** (refactorizable)
* NO importa API de UI → **compartido/core** (refactorizable si no rompe firmas)

**Importante:** un archivo puede ser híbrido. La regla aplica por archivo, pero para funciones específicas dentro de un archivo híbrido (ej: `interactMenu/gui.ts` mezcla DDUI handler + legacy forms), clasifica cada función individualmente.

**commandMenu:**

* `ui/`, `builder/` → legacy (protegido)
* `core/` (`menu_apply.ts`, `menu_state.ts`, `menu_events.ts`) → compartido (SÍ refactorizable)
* `model/` → compartido (SÍ refactorizable, NO es legacy). Contiene lógica de dominio pura: detección de facción, jerarquía, familias, grupos, scope, scanner de entidades. Consumido por legacy (vía `ui/`, `builder/`) y por DDUI. **Se puede extender, exportar funciones nuevas y agregar helpers de visibilidad/familias sin tocar legacy.**
* `ddui/` → DDUI (refactorizable)
* `menu_config.ts` → shim legacy (mantener hasta descontinuación)

**interactMenu:**

* `gui.ts` → híbrido: funciones `show*Menu` son legacy (protegidas), helpers puros son compartidos
* `ddui/` → DDUI (refactorizable)

**Verificación de clasificación:** `rg "@minecraft/server-ui|ActionFormData|ModalFormData|CustomForm|MessageBox" scripts/gui/<ruta>/` para confirmar antes de modificar.
