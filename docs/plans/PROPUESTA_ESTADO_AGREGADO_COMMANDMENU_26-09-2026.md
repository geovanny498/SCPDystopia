# Propuesta pendiente: estado agregado en la vista de sistemas de commandMenu

- **Última modificación:** 26/09/2026
- **Estado:** Pendiente de implementación
- **Área:** `commandMenu` DDUI, vista de sistemas

## Objetivo

Mostrar en la propia vista de sistemas si las entidades actualmente presentes en cada jerarquía o grupo coinciden con la configuración global seleccionada, sin convertir el estado de las entidades actuales en el valor del dropdown o toggle.

La vista debe seguir siendo capaz de configurar grupos vacíos o preparar el comportamiento de entidades que aparezcan más adelante. Por eso el valor seleccionado continuará representando la plantilla global persistida en la propiedad dinámica del mundo, mientras que el estado agregado será únicamente informativo.

## Problema que resuelve

Los controles de la vista de sistemas tienen dos efectos relacionados, pero distintos:

1. Al cambiar un dropdown o toggle, aplican el valor a las entidades elegibles que existen actualmente.
2. El mismo valor se guarda como configuración global para futuras aplicaciones a esa jerarquía o grupo.

El valor global puede no coincidir con el estado registrado en las entidades actuales. Esto es esperado cuando, por ejemplo:

- una entidad fue modificada individualmente desde `interactMenu`;
- una entidad normal recibió un nametag y pasó a clasificarse como especial;
- un administrador invocó directamente una entidad especial con nametag;
- una entidad fue aislada en otro grupo para que futuros cambios de `commandMenu` no la afecten.

Actualmente el formulario muestra la plantilla global y los nombres/conteos de las entidades, pero no indica si existe divergencia entre ambas capas.

## Alcance

### Incluido

- `scripts/gui/commandMenu/ddui/builders/systemBuilder.ts`.
- Todos los sistemas de `CATALOG_SYSTEMS`, tanto `dropdown` como `toggle`.
- Controles de jerarquías no especiales.
- Controles de grupos especiales.
- Facciones individuales y vista de ambas facciones.
- Entidades elegibles según la dimensión y el scope que ya utiliza la vista.

### Excluido

- Vista de asignación por buckets.
- Cálculo de prioridad de nametags en `groupsPanel.ts`.
- Cambios en `scripts/gui/commandMenu/model/menu_scope.ts`.
- Resincronización automática o reaplicación forzada de eventos.
- Cambiar el valor seleccionado del dropdown/toggle para reflejar estados actuales.

La vista de asignación por buckets ya tiene una decisión distinta y válida: cuando un mismo nametag aparece en más de un grupo, preselecciona el grupo de mayor prioridad. Esa lógica no necesita este estado agregado.

## Semántica de las dos capas

### Plantilla global

Es el valor que se muestra actualmente como seleccionado. Se obtiene desde la propiedad dinámica del mundo y usa el default del catálogo si todavía no existe un valor guardado. Se aplica por clave de jerarquía o grupo.

Fuente relacionada: `buildInitialState()` en `systemBuilder.ts`.

### Estado registrado de la entidad

Es el valor leído desde la propiedad dinámica del sistema en cada entidad mediante `getEntitySystemState(entity, systemId)`.

Este valor representa el último estado de sistema registrado por el addon, no una inspección completa de los componentes activos de Bedrock. Si un evento externo modifica componentes sin actualizar la propiedad dinámica, el agregado no podrá detectarlo y debe documentarse como una limitación.

Si la entidad no tiene propiedad dinámica del sistema, no debe asumirse automáticamente que está sincronizada. Debe distinguirse como `heredado`, `default` o `indeterminado`, según la resolución que finalmente se adopte.

## Propuesta de cálculo

El cálculo debe reutilizar el mismo conjunto de entidades que ya produce `buildCountsAndNametags()`:

1. Clasificar la entidad por facción.
2. Usar `hierarchy` para no especiales.
3. Usar `group` para especiales.
4. Leer el estado registrado del `systemId` actual.
5. Compararlo con la plantilla global correspondiente a esa facción y clave.

No debe realizarse un segundo escaneo general. El resultado agregado puede construirse durante el escaneo que ya actualiza los conteos y nametags de la vista.

La comparación debe normalizar según el tipo de sistema:

- Dropdown: comparar valores string de las opciones.
- Toggle: comparar valores booleanos.

## Estados agregados recomendados

El cálculo debe conservar información suficiente para diferenciar estos casos:

| Estado | Significado |
| --- | --- |
| Sin entidades | No hay entidades elegibles actualmente en la jerarquía o grupo. La plantilla global sigue siendo válida para futuras entidades. |
| Sincronizado | Todas las entidades con estado conocido coinciden con la plantilla global y no existe una divergencia conocida. |
| Diferente | Las entidades actuales tienen un valor conocido uniforme, pero distinto de la plantilla global. |
| Mixto | Hay dos o más valores registrados diferentes entre las entidades actuales. |
| Heredado/indeterminado | Una o más entidades no tienen estado dinámico suficiente para afirmar coincidencia. |

Para `targetFaction === "both"`, la agregación debe calcularse por facción antes de combinar el resultado. No se deben comparar directamente entidades Foundation y Chaos contra una única plantilla si sus valores globales son distintos.

## Presentación en la GUI

La vista tiene poco espacio y puede mostrar ocho controles. No se deben añadir ocho labels, spacers, botones ni dropdowns nuevos.

La primera opción es reutilizar `labelObs` y el texto que ya muestra el conteo, por ejemplo:

- `Básicos: (5) · Sincronizado`
- `Grupo A: (1) · Diferente`
- `Grupo B: (3) · Mixto`
- `Grupo C: (0)`

La descripción observable de los grupos debe conservar los nametags actuales, porque esa información ayuda a identificar qué entidades integran el grupo. El estado agregado debe ser breve y no reemplazar esos nombres.

El valor seleccionado del dropdown/toggle debe continuar siendo la plantilla global. El estado agregado no debe cambiar el índice seleccionado ni activar eventos por sí mismo.

Antes de implementar, debe probarse visualmente si las palabras completas caben. Si no caben, se puede evaluar una representación compacta y consistente, pero no se deben usar símbolos cuyo significado no sea evidente sin tooltip.

## Casos especiales que deben conservarse

### No especiales normalmente sincronizados

Las jerarquías no especiales normalmente deberían mostrar `Sincronizado` cuando sus entidades tienen el mismo valor registrado que la plantilla global. Si alguien modifica una entidad desde `interactMenu`, el agregado debe reflejar la posible divergencia sin alterar la plantilla global.

### Especial invocada directamente con nametag

Una entidad invocada por un administrador con nametag puede entrar directamente en la clasificación de especiales. Si aún no tiene `scpd:group`, el helper de grupos la trata como `noGroup`.

Ese caso no debe modificar ni recalcular la plantilla global de Grupo A, B, C o D. El estado agregado solo debe señalar la situación dentro del grupo donde la entidad esté asignada.

### Entidad convertida en especial después de aparecer

Si una entidad normal recibe un nametag después de aparecer, puede conservar un estado de sistema asociado a su situación anterior. Al cambiar su clasificación, es legítimo que no coincida con la plantilla global del nuevo grupo. El indicador debe mostrar la divergencia, pero no aplicar automáticamente el nuevo perfil.

### Asignación de bucket

La asignación de bucket modifica el grupo de la entidad y determina qué plantilla futura podrá afectarla. No debe reaplicar sistemas en ese momento. La prioridad utilizada para preseleccionar el grupo de un nametag con varias entidades pertenece exclusivamente a esa vista.

## Riesgos y decisiones pendientes

1. **Estado ausente:** decidir si se muestra como `Heredado`, `Default` o `Indeterminado`. No debe confundirse con sincronización confirmada.
2. **Estado externo:** el agregado se basa en propiedades dinámicas de entidad; no garantiza que los componentes reales sigan activos.
3. **Ambas facciones:** definir una presentación compacta para resultados diferentes por facción.
4. **Longitud:** validar en juego si los nombres de grupo, conteo y estado caben sin empeorar la vista saturada.
5. **Actualización:** reutilizar el intervalo existente de la vista, evitando crear otro intervalo o un escaneo adicional.

## Criterios de aceptación para una futura implementación

- La selección global permanece igual aunque el estado actual sea diferente o mixto.
- Un grupo vacío conserva y muestra su plantilla global sin inventar un estado actual.
- Un sistema dropdown y un sistema toggle producen estados agregados coherentes.
- Una entidad modificada desde `interactMenu` puede marcar divergencia en `commandMenu`.
- Una entidad especial recién clasificada no cambia la plantilla global del grupo.
- La vista de buckets no cambia.
- No se agregan ocho controles nuevos ni se registra historial por calcular el agregado.
- No se añaden suscripciones o intervalos globales adicionales.
