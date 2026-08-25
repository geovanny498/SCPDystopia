// scripts\utils\entityConfig.js

// Aquí defines entidades y si reciben daño/knockback
// La configuración definida aquí no cambia el daño o knockback definido en los json de las entidades

// true = recibe daño y knockback
// false = es inmune

// Si no está definido, se asume que recibe ambos del script
// Debido a que no se puede leer knockback_resistance, se usaba esta configuración para forzar inmunidad

// Ahora el campo de knockback está en deshuso, pero se mantiene para compatibilidad con scripts antiguos
import type { Entity } from "@minecraft/server";
import { EntityComponentTypes } from "@minecraft/server";
import { debugWarn } from "./debug";

export type EntityDamageDecision = boolean | ((entity: Entity) => boolean);
export type EntityDamageRule = {
  damage: EntityDamageDecision;
  knockback: EntityDamageDecision;
};

export const entityDamageConfig: Record<string, EntityDamageRule> = {
  "minecraft:creaking": {
    damage: false,
    knockback: false,
  },
  "minecraft:wither": {
    damage: (entity: Entity) => {
      const health = entity.getComponent("health");
      if (!health) return false;
      const maxHealth = health.effectiveMax;
      // debugWarn("entityDamageConfig",`Wither salud actual: ${health.currentValue}, máxima: ${maxHealth}`);
      if (health.currentValue > maxHealth / 2) {
        return true; // solo recibe daño si >50%
      } else {
        return false;
      }
    },
    knockback: false,
  },
  "lc:dt_scp682": {
    damage: (entity: Entity) => {
      const health = entity.getComponent("health");
      if (!health) return false;
      const maxHealth = health.effectiveMax;
      // debugWarn("entityDamageConfig",`scp682 salud actual: ${health.currentValue}, máxima: ${maxHealth}`);
      if (health.currentValue < 39600) {
        return false; // No recibe daño si < 39600
      } else {
        return true;
      }
    },
    knockback: false,
  },
  "lc:dt_scp096": {
    damage: (entity: Entity) => {
      const health = entity.getComponent("health");
      if (!health) return false;
      const maxHealth = health.effectiveMax;
      // debugWarn("entityDamageConfig",`scp096 salud actual: ${health.currentValue}, máxima: ${maxHealth}`);
      if (health.currentValue < 10000) {
        return false; // No recibe daño si < 10000
      } else {
        return true;
      }
    },
    knockback: false,
  },
};
