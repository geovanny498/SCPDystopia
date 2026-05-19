// scripts/gui/config.ts

/** Configuración de GUI para entidades
 * - `global` contiene categorías/entradas que estarán disponibles por defecto
 * - `entities` lista las entidades que aceptan abrir el GUI (referenciando `global`)
 * - `specific` permite añadir o sobrescribir configuraciones por entidad
 */

export interface MenuEntry {
  label: string;
  event?: string;
  action?: string;
}

export interface MenuCategory {
  id?: string;
  category: string;
  entries?: MenuEntry[];
  submenu?: string;
}

export interface SubmenuConfig {
  categories: MenuCategory[];
}

export interface EntitySpecificConfig {
  ids?: string[];
  replace: boolean;
  insertAt?: "start" | "end";
  categories: MenuCategory[];
}

export interface GlobalRule {
  mode: "whitelist" | "blacklist";
  list: string[];
}

export interface GuiConfig {
  openItem: Record<string, string>;
  entities: Record<string, Record<string, boolean>>;
  global: {
    categories: MenuCategory[];
  };
  global_rules: Record<string, GlobalRule>;
  submenus: Record<string, SubmenuConfig>;
  specific: Record<string, EntitySpecificConfig>;
}

const config: GuiConfig = {
  // Qué ítem debe tener el jugador en mano para abrir el menú según la facción
  // key = grupo en `entities`
  openItem: {
    foundation: "lc:dt_commander",
    chaos: "breeze_rod",
  },

  // Lista de entidades que abrirán el GUI.
  // true | false para activar/desactivar el menú.
  // Si una entidad no está listada, no abrirá el menú.
  entities: {
    foundation: {
      "lc:dt_chara": true,
      "lc:dt_thedeath": true,
      "lc:dt_alpha1c": true,
      "lc:dt_alpha1l": true,
      "lc:dt_alpha1": true,
      "lc:dt_epsilon11c": true,
      "lc:dt_epsilon11": true,
      "lc:dt_eta10c": true,
      "lc:dt_eta10": true,
      "lc:dt_nu7c": true,
      "lc:dt_nu7": true,
      "lc:dt_beta7c": true,
      "lc:dt_beta7": true,
      "lc:dt_epsilon6c": true,
      "lc:dt_epsilon6": true,
    },
    chaos: {
      "lc:dt_cd_commander": true,
      "lc:dt_cd_leader": true,
      "lc:dt_cd": true,
      "lc:dt_chaos_insurgency": true,
    },
  },

  // Categorías y entradas globales (disponibles para todas las entidades, a menos que se sobrescriba)
  global: {
    categories: [
      {
        id: "movement_patrol",
        category: "§1Movimiento / Patrulla§r",
        entries: [
          {
            label: "§aSeguir jugador (Cerca)",
            event: "humanoid:set_tamed_close",
          },
          {
            label: "§eSeguir jugador (Media)",
            event: "humanoid:set_tamed_mid",
          },
          {
            label: "§6Seguir jugador (Lejos)",
            event: "humanoid:set_tamed_far",
          },
          {
            label: "§9Caminar libremente",
            event: "mtf:to_move_free",
          },
          {
            label: "§cDetenerse",
            event: "mtf:to_stop",
          },
        ],
      },
      {
        id: "attack_rules",
        category: "§cIniciativa de Combate§r",
        entries: [
          {
            label: "§cMáxima",
            event: "humanoid:fire_open_warfare",
          },
          {
            label: "§9Avanzada",
            event: "humanoid:fire_advanced",
          },
          {
            label: "§aIntermedia",
            event: "humanoid:fire_armed_presence",
          },
          {
            label: "§bCercana",
            event: "humanoid:fire_defensive",
          },
          {
            label: "§eNeutral / Sigilo",
            event: "humanoid:fire_mode_hit",
          },
        ],
      },
      {
        id: "entity_system_state",
        category: "§2Estado y configuración",
        entries: [
          {
            label: "Ver opciones configuradas",
            action: "view_entity_system_state",
          },
        ],
      },
      {
        id: "advanced_menu",
        category: "Configuración avanzada",
        submenu: "advanced",
      },
    ],
  },

  /** Reglas para aplicar/ocultar sistemas globales por entidad.
   * Cada clave representa un "sistema global"
   * los submenús cuentan como sistemas globales.
   * Cada regla admite:
   * - mode: whitelist" | "blacklist"
   * - list: array de entity typeIds (ej: "lc:dt_chara")
   * Si no existe una regla para un sistema, el sistema se aplica a todas las entidades.
   * Se puede ocultar submenus
   */
  global_rules: {
    // categoría del submenu (ver abajo: "spawn").
    spawn: {
      mode: "whitelist",
      list: [
        "lc:dt_alpha1l",
        "lc:dt_epsilon11c",
        "lc:dt_eta10c",
        "lc:dt_nu7c",
        "lc:dt_beta7c",
        "lc:dt_epsilon6c",
        "lc:dt_cd_commander",
        "lc:dt_cd_leader",
        "lc:dt_cd",
      ],
    },
  },

  // Submenus — permite definir conjuntos de categorías reutilizables
  submenus: {
    // submenu id: "advanced"
    advanced: {
      categories: [
        {
          id: "spawn",
          category: "§bInvocar soldados§r",
          entries: [
            {
              label: "§aActivar",
              event: "humanoid:start_spawn_soldiers",
            },
            {
              label: "§cDesactivar",
              event: "humanoid:stop_spawn_soldiers",
            },
          ],
        },
        {
          id: "boss_bar",
          category: "§cBarra de vida§r",
          entries: [
            {
              label: "§aMostrar",
              event: "humanoid:show_boss_bar",
            },
            {
              label: "§cOcultar",
              event: "humanoid:dont_show_boss_bar",
            },
          ],
        },
        {
          id: "teleport",
          category: "§2Teletransportación§r",
          entries: [
            {
              label: "§aIniciar teletransporte",
              event: "humanoid:start_teleport",
            },
            {
              label: "§6Iniciar teletransporte cercano",
              event: "humanoid:start_teleport_near",
            },
            {
              label: "§cDetener teletransporte",
              event: "humanoid:stop_teleport",
            },
          ],
        },
        {
          id: "invincible",
          category: "Invencibilidad",
          entries: [
            {
              label: "§aActivar",
              event: "humanoid:start_invincible",
            },
            {
              label: "§cDesactivar",
              event: "humanoid:stop_invincible",
            },
          ],
        },
        {
          id: "entity_protection",
          category: "§dControl de Configuración",
          entries: [
            {
              label: "Control de Configuración",
              action: "toggle_entity_global_overwrite",
            },
          ],
        },
      ],
    },
  },

  // Configuraciones específicas por entidad. Cada entrada puede tener:
  // - `replace: true` para reemplazar las categorías globales por las específicas
  // - `categories: [...]` para añadir o reemplazar
  // - `ids: string[]` permite agrupar varias entidades bajo la misma configuración.
  specific: {
    "lc:dt_chara": {
      replace: false,
      // `insertAt`: "start" | "end" — dónde insertar las categorías específicas respecto a las globales
      insertAt: "end",
      categories: [
        {
          category: "Variante",
          entries: [
            {
              label: "Sin máscara",
              event: "start_variant0",
            },
            {
              label: "Con máscara",
              event: "start_variant1",
            },
            {
              label: "Sin máscara (Sangre)",
              event: "start_variant2",
            },
            {
              label: "Con máscara (Sangre)",
              event: "start_variant3",
            },
          ],
        },
      ],
    },
    "lc:dt_thedeath": {
      replace: false,
      insertAt: "end",
      categories: [
        {
          category: "Variante",
          entries: [
            {
              label: "Normal",
              event: "start_variant",
            },
            {
              label: "Normal (Sangre)",
              event: "start_variant1",
            },
            {
              label: "Hazmat",
              event: "start_variant2",
            },
            {
              label: "Hazmat (Sangre)",
              event: "start_variant3",
            },
          ],
        },
      ],
    },
    "lc:dt_alpha1c": {
      replace: false,
      insertAt: "end",
      categories: [
        {
          category: "Variante",
          entries: [
            {
              label: "MTF Delta-1 Commander",
              event: "start_variant1",
            },
            {
              label: "MTF Delta-1 Mita",
              event: "start_variant3",
            },
            {
              label: "MTF Delta-1 Leader",
              event: "start_variant0",
            },
            {
              label: "MTF Delta-1 Frisk",
              event: "start_variant2",
            },
          ],
        },
      ],
    },
    "lc:dt_alpha1l": {
      replace: false,
      insertAt: "end",
      categories: [
        {
          category: "Variante",
          entries: [
            {
              label: "MTF Alpha-1 Commander",
              event: "start_variant0",
            },
            {
              label: "MTF Alpha-1 Commander 2",
              event: "start_variant1",
            },
            {
              label: "MTF Alpha-1 Commander 3",
              event: "start_variant2",
            },
            {
              label: "MMTF Alpha-1 Leader",
              event: "start_variant3",
            },
          ],
        },
      ],
    },
    "lc:dt_alpha1": {
      replace: false,
      insertAt: "end",
      categories: [
        {
          category: "Variante",
          entries: [
            {
              label: "Masculino 1",
              event: "start_variant0",
            },
            {
              label: "Masculino 2",
              event: "start_variant1",
            },
            {
              label: "Masculino 3",
              event: "start_variant2",
            },
            {
              label: "Femenino 1",
              event: "start_variant3",
            },
            {
              label: "Femenino 2",
              event: "start_variant4",
            },
            {
              label: "Femenino 3",
              event: "start_variant5",
            },
          ],
        },
      ],
    },
    normal: {
      ids: ["lc:dt_epsilon11", "lc:dt_nu7", "lc:dt_eta10", "lc:dt_beta7", "lc:dt_epsilon6", "lc:dt_chaos_insurgency"],
      replace: false,
      insertAt: "end",
      categories: [
        {
          category: "Variante",
          entries: [
            {
              label: "Masculino 1",
              event: "start_variant0",
            },
            {
              label: "Masculino 2",
              event: "start_variant1",
            },
            {
              label: "Femenino 1",
              event: "start_variant2",
            },
            {
              label: "Femenino 2",
              event: "start_variant3",
            },
          ],
        },
      ],
    },
    leader: {
      ids: ["lc:dt_cd"],
      replace: false,
      insertAt: "end",
      categories: [
        {
          category: "Variante",
          entries: [
            {
              label: "Masculino 1",
              event: "start_variant0",
            },
            {
              label: "Masculino 2",
              event: "start_variant1",
            },
            {
              label: "Femenino 1",
              event: "start_variant2",
            },
          ],
        },
      ],
    },

    "lc:dt_cd_commander": {
      replace: false,
      // `insertAt`: "start" | "end" — dónde insertar las categorías específicas respecto a las globales
      insertAt: "end",
      categories: [
        {
          category: "Variante",
          entries: [
            {
              label: "§2§lChaos Delta Commander 1",
              event: "start_variant0",
            },
            {
              label: "§b§lChaos Delta Commander 2",
              event: "start_variant1",
            },
          ],
        },
      ],
    },
  },
};

export default config;
