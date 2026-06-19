// scripts\utils\entityConfig.js

// Aquí defines entidades y si reciben daño/knockback
// La configuración definida aquí no cambia el daño o knockback definido en los json de las entidades

// true = recibe daño y knockback
// false = es inmune

// Si no está definido, se asume que recibe ambos del script
// Debido a que no se puede leer knockback_resistance, se usa esta configuración para forzar inmunidad
import type { Entity } from "@minecraft/server";
import { EntityComponentTypes } from "@minecraft/server";
import { debugWarn } from "./debug";

export type EntityDamageDecision = boolean | ((entity: Entity) => boolean);
export type EntityDamageRule = {
  damage: EntityDamageDecision;
  knockback: EntityDamageDecision;
};

// Se dejo vacia porque por ahora no hay entidades que necesiten una configuración personalizada, pero se deja la estructura en caso de ser necesaria
export const entityDamageConfig: Record<string, EntityDamageRule> = {};
