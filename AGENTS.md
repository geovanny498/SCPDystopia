# AGENTS.md

Comandos del proyecto:

- `npm run build` — Compilar TypeScript
- `npm run lint` — Ejecutar linter

Build y lint deben pasar sin errores antes de considerar completado un cambio relevantes.
Pon siempre fecha y hora en la que se escribió o se hizo la ultima modificación de los planes

Siempre responde en español.
El proyecto es de un addon de minecraft bedrock

Se recomienda consultar node_modules\@minecraft\server\index.d.ts y node_modules\@minecraft\server-ui\index.d.ts dentro de node_modules para buscar que funciones o métodos están vigentes en la api.

Se busca que todo lo relacionado a SCPDystopia sea escalable y modular para facilitar futuras expansiones para el addon.

Hay funciones de depuración en scripts/utils/debug.ts para mejor personalización y depuración, cuando quieras que las use añade el modulo a debug.ts para que se puedan ver.

El proyecto está adaptandose de javascript a typescript, por lo que es posible que algunos archivos estén en javascript y otros en typescript, se recomienda usar typescript para los nuevos archivos.
