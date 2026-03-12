# Comandos Frecuentes

## Desarrollo

### Compilar y copiar a behavior/resource packs (con debug)

```bash

# Compilar
npm run build

# Copiar a rutas de development
npm run package
```

### Desarrollo continuo (watch mode)

```bash
npm run local-deploy

# Desarrollo con actualización automatica para ts y js
npx just-scripts local-deploy --watch
```

Observa cambios en archivos y recompila automáticamente.

### Comandos de formateo

```bash
# Formatear carpetas de behavior_packs
# Cambiar rutas seguido de /**/*

# Spawn rules
npx prettier --write "subpacks/ext_spawn/spawn_rules/**/*"

# Scripts
npx prettier --write "scripts/**/*"
```

## Producción

### Compilar sin debug y copiar a behavior/resource packs

```bash
npm run deploy:production
```

### Crear archivo .mcaddon sin debug

```bash
npm run mcaddon:production
```

### Solo compilar sin debug (sin copiar)

```bash
npm run build:production
```

## Otros

### Limpiar archivos generados

```bash
npm run clean

npx just-scripts clean
```

### Lint (verificar código)

```bash
npm run lint
```

### Lint y auto-corregir

```bash
npm run lint --fix
```

### Crear .mcaddon (con debug)

```bash
npm run mcaddon
```

### Habilitar loopback para Minecraft

```bash
npm run enablemcloopback
```

### Habilitar loopback para Minecraft Preview

```bash
npm run enablemcpreviewloopback
```

## Diferencias entre modos

| Comando                      | Debug incluido | Destino                           |
| ---------------------------- | -------------- | --------------------------------- |
| `npm run build`              | Sí             | dist/                             |
| `npm run build:production`   | No             | dist/                             |
| `npm run package`            | Sí             | behavior_packs/ y resource_packs/ |
| `npm run deploy:production`  | No             | behavior_packs/ y resource_packs/ |
| `npm run mcaddon`            | Sí             | dist/packages/\*.mcaddon          |
| `npm run mcaddon:production` | No             | dist/packages/\*.mcaddon          |
