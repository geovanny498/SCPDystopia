# AGENTS.md

Comandos del proyecto:

- `npm run build` — Compilar TypeScript

Build debe pasar sin errores antes de considerar completado un cambio relevantes.
Está disponible la herramienta ripgrep (o rg en bash) y se recomienda usarla según se estime conveniente.

Siempre responde en español.

El proyecto es de un addon de minecraft bedrock que usa los archivos de ruta "scripts" para compilar JavaScript y TypeScript en un único archivo JavaScript que usa el addon al ejecutarse en el juego.

Se recomienda consultar node_modules\@minecraft\server\index.d.ts y node_modules\@minecraft\server-ui\index.d.ts dentro de node_modules para buscar que funciones o métodos están vigentes en la api.

Se busca que todo lo relacionado a SCPDystopia sea escalable y modular para facilitar futuras expansiones para el addon.

Hay funciones de depuración en scripts/utils/debug.ts para mejor personalización y depuración, cuando quieras que las use añade el modulo a debug.ts para que se puedan ver.

Todavia quedan archivos js necesarios que si se usan junto con los ts, pero el proyecto está adaptandose de JavaScript a TypeScript, entonces, se recomienda usar TypeScript para los nuevos archivos.

Pon nombres claros a los planes para poder identificarlos.

Registra siempre fecha y hora en la que se escribió o se hizo la ultima modificación de los planes con el formato dd/mm/yyyy. También registra si el plan fue implementado o si está pendiente de implementación.

Nunca implementes los planes sin aprobación explícita del usuario, y cuando lo hagas actualiza el plan poniendo que si se implementó.
