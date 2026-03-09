# SCP: Dystopia

**Versión:** 1.9.0

## Descripción

SCP: Dystopia es un addon para Minecraft Bedrock Edition que introduce el universo de la Fundación SCP al juego. Este proyecto incluye entidades humanoides personalizadas, SCPs, sistemas de combate avanzados y mecánicas de scripting complejas.

> **Nota:** No requiere opciones experimentales.

## Características Principales

### Entidades Humanoides

El addon incluye múltiples facciones de entidades humanoides ubicadas en `behavior_packs/SCPDystopia/entities/humanoid/`:

#### Soldados Normales (`Normal/`)

- **Alpha-1** - "Red Right Hand"
- **Beta-7** - "Maz Hatters"
- **Epsilon-11** - "Nine-Tailed Fox"
- **Epsilon-6** - "Village Idiots"
- **Eta-10** - "See No Evil"
- **Nu-7** - "Hammer Down"
- **Chaos Insurgency** - Facción enemiga de la Fundación

#### Comandantes y Líderes

- Variantes de comandantes para cada unidad MTF
- Líderes de escuadrones con habilidades especiales

### Sistema de Combate

El sistema de scripts implementa mecánicas avanzadas de combate:

#### Proyectiles Personalizados

- Sistema de daño configurable por proyectil
- Mecánica de penetración (pierce) de objetivos
- Detección de fuego amigo entre equipos
- Knockback personalizado

#### Equipos y Facciones

- **Foundation:** Todas las unidades MTF y personal de la Fundación
- **Chaos:** Insurgencia del Caos y sus variantes
- Sistema de identificación por casco para jugadores

#### Armas (Del addon Aplok Guns)

- M4A1 - Rifle de asalto automático
- M249 - Ametralladora ligera
- MP5A5 - Subfusil automático
- AK-47 - Rifle de asalto
- AWP - Rifle de francotirador

### Subpacks Disponibles

El addon incluye múltiples configuraciones de spawn:

- Sin spawn de entidades del addon
- Spawn solo de MTFs de la Fundación
- Spawn de MTFs y Chaos Insurgency
- Spawn de MTFs y SCPs
- Spawn de SCPs y Chaos Insurgency
- Modo World War IV
- Spawn de todas las entidades

Estructura del Proyecto

```
├── behavior_packs/SCPDystopia/
│   ├── entities/
│   │   ├── humanoid/          # Entidades humanoides
│   │   │   ├── Normal/        # Soldados estándar
│   │   │   ├── Commanders/    # Comandantes
│   │   │   └── Leader/        # Líderes
│   │   ├── scp/               # Entidades SCP
│   │   ├── dead_body/         # Cuerpos muertos
│   │   └── projectile/        # Proyectiles
│   └── manifest.json
│
└── scripts/
    ├── init.js                # Inicialización del sistema
    ├── main.js                # Lógica principal de proyectiles
    ├── commands/              # Comandos del juego
    ├── components/            # Componentes de entidades
    ├── gui/                   # Interfaces de usuario
    └── utils/                 # Utilidades
        ├── teams.js           # Sistema de equipos
        ├── damage.js          # Sistema de daño
        ├── weapons.js         # Configuración de armas
        └── knockback.js       # Sistema de knockback
```

## Sistema de Scripts

### Inicialización (`init.js`)

Punto de entrada principal que carga todos los módulos:

- Componentes de entidades
- Sistema de armas
- Comandos de configuración
- Interfaz gráfica
- Menú de comandos

### Lógica de Proyectiles (`main.js`)

Gestiona el comportamiento de proyectiles:

- Detección de impactos en entidades
- Cálculo de daño y knockback
- Sistema de penetración
- Prevención de fuego amigo

### Utilidades

#### `teams.js`

Define los equipos y sus miembros:

- Identificación de facciones por typeId
- Sistema de cascos para jugadores
- Grupos de entidades aliadas

#### `damage.js`

Sistema de daño personalizado que ignora frames de inmunidd:

- Configuración de daño por entidad mediante cause: override
- Modificadores de daño
- Aplicación de knockback

#### `weapons.js`

Configuración de armas Aplok Guns:

- Propiedades de proyectiles
- Velocidad y cadencia de fuego
- Modo automático/semiautomático

## Dependencias

```json
{
  "@minecraft/server": "^2.4.0",
  "@minecraft/server-ui": "^2.0.0",
  "@minecraft/math": "^2.2.11",
  "@minecraft/vanilla-data": "^1.21.90"
}
```

## Requisitos

- Minecraft Bedrock Edition 1.21.130 o superior

## Desarrollo

Para ver todos los comandos disponibles, consulta [COMANDOS.md](./COMANDOS.md).

### Comandos principales

```bash
# Desarrollo (con debug)
npm run build
npm run local-deploy

# Producción (sin debug)
npm run build:production
npm run deploy:production
npm run mcaddon:production
```
## Comandos de formateo

```bash
# Formatear carpetas de behavior_packs
npx prettier --write "subpacks/ext_spawn/spawn_rules/**/*"
npx prettier --write "scripts/**/*"
```


## Licencia
Créditos a LC Studios MC por el addon de SCPDystopia v1.9.0 Original, esta es una expansión enfocada en las unidades móviles de la fundación y la insurgencia del caos.

Desarrollado por LC Studios MC. Todos los derechos reservados.

---
