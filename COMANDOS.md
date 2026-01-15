# Comandos Frecuentes

## Desarrollo

### Compilar y copiar a behavior/resource packs (con debug)

```bash
npm run build
npm run package
```

### Desarrollo continuo (watch mode)

```bash
npm run local-deploy
```

Observa cambios en archivos y recompila automáticamente.

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
| `npm run build`              | ✅ Sí          | dist/                             |
| `npm run build:production`   | ❌ No          | dist/                             |
| `npm run package`            | ✅ Sí          | behavior_packs/ y resource_packs/ |
| `npm run deploy:production`  | ❌ No          | behavior_packs/ y resource_packs/ |
| `npm run mcaddon`            | ✅ Sí          | dist/packages/\*.mcaddon          |
| `npm run mcaddon:production` | ❌ No          | dist/packages/\*.mcaddon          |
