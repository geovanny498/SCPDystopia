# AGENTS.md

## Reglas para código escalable y mantenible

* **Encapsulación**: todo `Map`/`Record` mutable global debe quedar detrás de una API encapsulada de acceso y modificación, con un único punto de cleanup cuando corresponda. Puede usar operaciones genéricas (`get/set/delete/clear`) o métodos del dominio equivalentes. Evitar acceder o mutar directamente estas estructuras desde módulos externos.

* **Ciclo de vida**: todo recurso temporal o asociado a un jugador, sesión, formulario u operación debe tener cleanup explícito cuando pueda sobrevivir a ese contexto. Las suscripciones globales destinadas a permanecer durante toda la ejecución deben registrarse una sola vez y no duplicarse.

* **Tamaño y responsabilidad**: un módulo que supere las ~250 líneas o mezcle configuración, query de entidades, builders de UI y lógica de aplicación debe revisarse para determinar si conviene dividirlo por dominio. No dividir únicamente por superar un umbral de líneas. Un archivo debe mantener una responsabilidad principal reconocible.

* **Funciones**: evitar handlers/monolitos mayores a ~80 líneas. Extraer builders de formulario, parsers de `formValues` y ejecutores de acciones en funciones separadas cuando corresponda.

* **Documentación**: toda función, clase, interfaz, enum y tipo exportado debe incluir JSDoc con `@param` para cada parámetro y `@returns` cuando corresponda. El JSDoc debe aportar información útil; evitar repetir simplemente el nombre, tipo o comportamiento obvio.

* **Comentarios**: preservar los comentarios existentes que sigan siendo útiles. No eliminarlos sin motivo. Si un cambio vuelve un comentario incorrecto u obsoleto, actualizarlo o retirarlo según corresponda. Agregar comentarios explicativos en lógica compleja o difícil de interpretar de un vistazo.

* **Tipos**: prohibido usar `any` en firmas públicas. Usar interfaces del dominio existentes o definirlas en el mismo módulo de la feature.

* **Logging**: el logging ordinario nuevo de lógica de juego, telemetría, raycasts, menús y flujo interno debe usar `debug()`. Reservar `console.warn`/`console.error` directos para las excepciones críticas indicadas a continuación.

  * **Uso de `debug()` vs `console.*`**: `debug()` es la infraestructura de depuración reutilizable del proyecto. Las llamadas pueden permanecer en el código aunque su módulo no esté habilitado normalmente. Usar `console.warn`/`console.error` directamente para errores críticos de inicialización del addon (`init.ts`), fallos en el registro de comandos de Minecraft o excepciones fatales no recuperables que deban registrarse siempre en `content_log.txt` / consola BDS, independientemente del estado de los módulos de debug. Evitar `console.log` superfluo en bucles, intervalos o eventos repetitivos.

  * **Módulos de debug**: la visibilidad se controla desde `scripts/utils/debug.ts`. Habilitar los módulos necesarios durante pruebas y evitar dejar habilitados permanentemente los que generen spam desde `runInterval`, eventos frecuentes, raycasts u otros flujos automáticos. Después de probar un cambio, desactivar los módulos ruidosos que ya no sean necesarios. Pueden permanecer habilitados los debugs de bajo volumen asociados a acciones manuales concretas del desarrollador.

  * `debug()` (**prioridad 1**): función unificada. Acepta `{ level?, color? }` donde `level` es `"debug"` (default, `console.log`), `"warn"` (`console.warn`) o `"error"` (`console.error`). Convierte códigos `§` → ANSI truecolor y reaplica color tras `§r`. Usar códigos `§` para destacar info clave, cerrar con `§r`. Máx. 1-2 colores por línea.

    * **Color selectivo, no obligatorio**: usar preferentemente `§` internos cuando haya un identificador o estado que merezca énfasis visual (`typeId`, `systemId`, `player.name`, entity name, palabras clave como `NO aplicado`, `FUERA DE SCOPE`). No añadir colores únicamente por cumplir una regla; priorizar legibilidad sobre decoración.

    * **Colores oficiales en `debug()`**: usar `MC_NAMED_COLORS` (`scripts/utils/debug.ts`). Nombres oficiales Java: `black`, `dark_blue`, `dark_green`, `dark_aqua`, `dark_red`, `dark_purple`, `gold`, `gray`, `dark_gray`, `blue`, `green`, `aqua`, `red`, `light_purple`, `yellow`, `white`, plus materiales BE (`minecoin_gold`, `material_quartz`, etc.) y formato (`bold`, `italic`, `reset`). No usar nombres legacy (`cyan`, `magenta`, `purple`, `orange`, `dark`).

* **Configuración estática** (armas, proyectiles, sistemas, textos de UI): definirla en datos tipados separados, no como literales inline dispersos en lógica de negocio.

* **Entidades y dimensiones**: centralizar consultas en `utils/entityQuery.ts` y constantes de dimensiones en un único lugar. No duplicar escaneos ni filtros por facción/jerarquía en cada módulo GUI.

* **API Bedrock**: preferir siempre la API tipada oficial (`@minecraft/server`, `@minecraft/server-ui`) sobre patrones ad-hoc. Si una operación requiere lógica repetitiva, encapsularla en un helper del dominio, no copiarla.

## Exploración y reutilización

* **Buscar antes de crear**: antes de implementar una función, helper, query, parser, builder o lógica nueva, buscar en el proyecto si ya existe una implementación equivalente o un patrón reutilizable.

* **Revisar usos existentes**: cuando se reutilice una función, tipo o helper existente, revisar sus usos relevantes para comprender cómo se utiliza realmente. No asumir su comportamiento únicamente por el nombre o firma.

* **Evitar duplicación**: si ya existe una implementación adecuada, reutilizarla en lugar de crear otra equivalente.

* Usar `rg`/ripgrep para localizar funciones, tipos, propiedades, imports, eventos y patrones existentes cuando sea útil.

* **Punto de entrada**: `scripts/init.ts` es el punto de inicio de los scripts del addon. Si un módulo bajo `scripts/` no es importado desde `init.ts` ni alcanzable transitivamente desde módulos cargados por este, se considera código muerto durante la ejecución.

## Contexto de la operación

* **Código válido ≠ comportamiento correcto**: que una llamada sea válida para TypeScript o Bedrock no garantiza que sea correcta para la lógica del addon. Verificar el contexto y propósito de los datos utilizados.

* **Operaciones iniciadas por jugadores**: cuando una operación se origine desde un `Player` o una sesión asociada a un jugador, considerar su contexto real antes de usar valores globales o defaults: dimensión, identidad, permisos, facción, rol, sesión, estado, etc.

* **Dimensiones**: no asumir `overworld` como dimensión en operaciones iniciadas desde un jugador. Si la operación debe actuar sobre la dimensión del jugador, usar `player.dimension` o el contexto equivalente de la sesión. Usar `world.getDimension("overworld")` solo cuando operar específicamente sobre Overworld sea intencional.

* **Preservar patrones existentes**: antes de cambiar cómo se obtiene un dato contextual, comprobar cómo se obtiene en otras partes relacionadas del proyecto.

* **Investigar antes de simplificar**: si una construcción existente parece innecesaria, redundante o más compleja de lo esperado, no eliminarla ni sustituirla basándose solo en su apariencia. Primero revisar sus usos, restricciones de la API y patrones relacionados.

* **No asumir equivalencia**: una solución más simple o idiomática no implica que sea equivalente bajo las restricciones de Bedrock/server-ui. Verificar comportamiento y contexto antes de reemplazar patrones existentes.

* **Distinguir rareza de error**: tratar código aparentemente extraño como una hipótesis a investigar, no como un bug confirmado.

* **Priorizar evidencia del proyecto**: ante una decisión ambigua, dar prioridad al código actual, patrones existentes, usos relacionados, tipos instalados de la API y restricciones documentadas sobre preferencias generales de diseño.

## Estructura y dominio

* `scripts/gui/`: macrocarpeta histórica que contiene features relacionadas con las interfaces y puede incluir UI, configuración y módulos de dominio asociados. No asumir que todo su contenido es lógica puramente visual. Dentro de cada feature, mantener la construcción DDUI separada de la lógica de dominio.

* `scripts/commands/`: registro de comandos y handlers. Sin builders de UI.

* `scripts/utils/`: helpers puros y datos tipados. Sin side effects en importación.

* `scripts/components/`: componentes de entidad/daño reutilizables.

* Evitar que lógica de dominio o utilidades reutilizables dependan de builders o detalles visuales de UI. Si distintas partes del proyecto necesitan la misma lógica, reutilizarla o extraerla a un módulo compartido apropiado.

## Anti-patrones

* No registrar `world.afterEvents.xxx.subscribe` dentro de builders de formulario o funciones de UI pura. Las suscripciones globales deben registrarse una sola vez en el módulo correspondiente, no cada vez que se abre un menú.

* No dejar `system.runInterval` activo después de terminar el contexto que lo necesita. El intervalo sin cleanup es el error real, no su existencia. Los `system.runTimeout` de una sola ejecución solo necesitan seguimiento o cancelación cuando puedan ejecutarse después de que el contexto que los originó deje de ser válido.

* No parsear `formValues` por índice frágil dentro de la misma función que construye el formulario; usar acceso por etiqueta/ID o un parser separado.

* No mantener en cierres de formularios estado asociado a un jugador que pueda sobrevivir al contexto del formulario o quedar retenido después de que dicho contexto termine. El estado persistente entre aperturas o sesiones debe gestionarse mediante un store con el cleanup correspondiente, incluido `playerLeave` cuando aplique.

* No declarar `Map`/`Record` mutables globales expuestos o modificados directamente sin una API encapsulada y un punto de cleanup cuando corresponda. El estado disperso sin encapsulación es bloqueante.

* No omitir el JSDoc en funciones, clases, interfaces, enums ni tipos exportados.

* No eliminar comentarios útiles sin motivo; actualizar los que queden obsoletos por el cambio.

* No crear una segunda implementación de una función o mecanismo existente sin comprobar primero si puede reutilizarse.

* No utilizar valores globales o defaults cuando la operación requiere el contexto específico del jugador que la inició.

## Jerarquía de reglas

* **Bloqueo**: estado global sin cleanup cuando corresponda, recursos temporales huérfanos, suscripciones globales duplicadas, `any` en firmas públicas, `Map`/`Record` mutables globales expuestos o modificados directamente sin una API encapsulada.

  Una infracción preexistente fuera del alcance de la tarea no autoriza por sí sola a modificar código adicional. Si afecta directamente al cambio actual, señalarla y tratarla según corresponda; si no, no ampliar el alcance automáticamente.

* **Obligatorio**: tipado seguro y uso adecuado de tipos de dominio, JSDoc en las * **exportaciones indicadas en la sección de Documentación, cumplimiento de la política de logging, configuración centralizada de identificadores y datos compartidos cuando corresponda, separación de responsabilidades, búsqueda y reutilización del código existente.

* **Recomendado**: helpers para operaciones repetitivas.

## Flujo de compilación y despliegue

* Para la validación final y el despliegue al juego en este entorno local, ejecutar:

  `npm run local-deploy`

* No sustituir esta validación final por otro comando salvo indicación explícita del usuario.

* NO usar el flag `--watch` ni comandos en segundo plano, ya que bloquean la ejecución de la consola.

* Si la compilación falla, corregir los errores informados en la salida de la consola antes de continuar.

* La validación final debe pasar sin errores antes de considerar completado un cambio relevante.

## Entorno y proyecto

Siempre responde en español.

El proyecto es un addon de Minecraft Bedrock desarrollado en Windows 11. Los archivos bajo `scripts/` incluyen JavaScript y TypeScript y se compilan en un único archivo JavaScript utilizado por el addon durante la ejecución.

Para comprobar qué funciones, métodos y tipos están vigentes en las versiones instaladas de la API, priorizar:

* `node_modules\@minecraft\server\index.d.ts`
* `node_modules\@minecraft\server-ui\index.d.ts`

No asumir disponibilidad, firmas o comportamiento de la API únicamente por conocimiento general del modelo.

Todavía quedan archivos `.js` necesarios junto con los `.ts`, pero el proyecto se está adaptando gradualmente de JavaScript a TypeScript. Usar TypeScript para los nuevos archivos.

No modificar `scripts/main1.js`: es una dependencia heredada del addon y no forma parte del área de trabajo actual.

## Planes

Pon nombres claros a los planes para poder identificarlos.

Registra siempre la fecha de la última modificación con formato `dd/mm/yyyy`. También registra si el plan fue implementado o si está pendiente de implementación.

Nunca implementes un plan sin aprobación explícita del usuario. Cuando se implemente con aprobación, actualiza el plan indicando que fue implementado.

## Arquitectura de interfaz: Data-Driven UI (DDUI)

Todos los menús del addon (`commandMenu`, `interactMenu`, `roleMenu`, `monitorMenu` y `teleportMenu`) operan bajo la arquitectura moderna **Data-Driven UI (DDUI)**.

* **DDUI (`ddui/`)**: formularios basados en `CustomForm` de `@minecraft/server-ui`. Es el estándar activo y prioritario del proyecto.

* **Lógica de Dominio (`model/`, `core/`, `gui.ts`, etc.)**: módulos de cálculo, configuración y estado desacoplados de la capa visual, aunque por la estructura histórica del proyecto puedan encontrarse dentro de features bajo `scripts/gui/`.

* **Sin código legacy**: prohibido crear nuevos formularios basados en `ActionFormData` o `ModalFormData`.

## Auditoría de planes

Al auditar un plan, distingue entre hechos verificados, inferencias y afirmaciones no verificadas.

No trates una afirmación del plan como verdadera solo porque el plan diga que fue confirmada, pero tampoco conviertas la falta de evidencia disponible en un error.

Las verificaciones, decisiones o correcciones ya demostradas durante la conversación deben tratarse como evidencia disponible y no volver a cuestionarse sin una razón concreta.

Busca problemas reales que puedan causar una regresión, contradicción u omisión; no critiques por obligación ni amplíes el alcance con riesgos meramente hipotéticos.

Si la evidencia disponible respalda el plan y no existe un problema concreto, apruébalo.
