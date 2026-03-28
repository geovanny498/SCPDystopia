// scripts/gui/teleportMenu/teleport_config.ts

/**
 * Configuración centralizada del menú de teletransporte
 * Este archivo define todos los textos, títulos y mensajes del sistema
 */

import { Factions } from "../commandMenu/menu_config.js";

/**
 * Títulos principales del sistema de teletransporte
 */
export const TeleportTitles = {
  main: "SCPDystopia | Teletransporte",
  foundation: "§lFundación SCP",
  chaos: "§2§lInsurgencia del Caos",
};

/**
 * Textos de botones para el menú principal
 */
export const MainMenuButtons = {
  foundation: "§lFundación SCP",
  foundationDesc: "Unidades de la Fundación",
  chaos: "§2§lInsurgencia del Caos",
  chaosDesc: "Unidades del Caos",
};

/**
 * Textos para el menú de selección de tipo
 */
export const TypeSelectionTexts = {
  normal: "§8Soldados NO especiales",
  normalDesc: "Básicos, Líderes y Comandantes",
  special: "§6Soldados ESPECIALES",
  specialDesc: "MTF especiales y unidades élite",
  all: "§c§lTELETRANSPORTAR TODAS",
  allDesc: "Todas las unidades",
};

/**
 * Textos para el menú de soldados NO especiales
 */
export const NormalSoldiersTexts = {
  title: {
    [Factions.FOUNDATION]: "§lFundación | Soldados No especiales",
    [Factions.CHAOS]: "§2§lChaos | Soldados No especiales",
  },
  description: "§7Selecciona las jerarquías a teletransportar:",
  toggleBasic: "§7Teletransportar Básicos",
  toggleLeader: "§eTeletransportar Líderes",
  toggleCommander: "§6Teletransportar Comandantes",
};

/**
 * Textos para el menú de soldados ESPECIALES
 */
export const SpecialSoldiersTexts = {
  title: {
    [Factions.FOUNDATION]: "§lFundación | Soldados Especiales",
    [Factions.CHAOS]: "§2§lChaos | Soldados Especiales",
  },
  description: "§7Selecciona el grupo de especiales:",
  // Foundation
  delta1: "§9§lMTF Delta-1",
  delta1Desc: "Teletransportar Delta-1",
  alpha1: "§f§lMTF Alpha-1",
  alpha1Desc: "Teletransportar Alpha-1",
  otherMtf: "§6§lOtros MTF",
  otherMtfDesc: "Epsilon-11, Eta-10, Nu-7, Beta-7, Epsilon-6",
  // Chaos
  chaosDelta: "§2§lChaos Delta",
  chaosDeltaDesc: "Teletransportar Chaos Delta",
};

/**
 * Textos comunes para submit buttons y navegación
 */
export const CommonTexts = {
  submitButton: "§aTeletransportar Seleccionadas",
  backButton: "§8« Volver",
  cancelButton: "§cCancelar",
  toggleLabel: "§7Selecciona las unidades a teletransportar:",
};

/**
 * Textos para el menú de confirmación "TODAS"
 */
export const TeleportAllTexts = {
  title: {
    [Factions.FOUNDATION]: "§lFundación | §cTODAS las Unidades",
    [Factions.CHAOS]: "§2§lChaos | §cTODAS las Unidades",
  },
  label: "§7Selecciona todas las unidades a teletransportar:",
};

/**
 * Mensajes de resultado
 */
export const ResultMessages = {
  /** Mensaje cuando se teletransportan entidades exitosamente */
  success: (count: number, faction: string): string => {
    const factionLabel = faction === Factions.FOUNDATION ? "§lFundación" : "§2§lChaos";
    return `§a[TELEPORT] §r${count} entidades de ${factionLabel}§r teletransportadas.`;
  },

  /** Mensaje cuando no se encuentran entidades */
  noEntities: (faction: string): string => {
    const factionLabel = faction === Factions.FOUNDATION ? "§lFundación" : "§2§lChaos";
    return `§c[TELEPORT] §rNo se encontraron entidades de ${factionLabel}§r en esta dimensión.`;
  },

  /** Mensaje cuando se cancela una operación */
  cancelled: "§e[TELEPORT] §rOperación cancelada.",

  /** Mensaje cuando no se selecciona ninguna jerarquía */
  noSelection: "§c[TELEPORT] Debes seleccionar al menos una jerarquía.",

  /** Mensaje de error genérico */
  error: "§c[TELEPORT] §rError al teletransportar entidades. Revisa la consola.",
};

/**
 * Mapeo de subgrupos de especiales por facción
 */
export const SpecialSubgroups = {
  [Factions.FOUNDATION]: {
    delta1: "delta1",
    alpha1: "alpha1",
    other_mtf: "other_mtf",
  },
  [Factions.CHAOS]: {
    chaos_delta: "chaos_delta",
  },
};

/**
 * Obtiene el nombre de un subgrupo para mensajes
 */
export function getSubgroupLabel(faction: string, subgroup: string): string {
  if (faction === Factions.FOUNDATION) {
    switch (subgroup) {
      case "delta1":
        return "§9MTF Delta-1";
      case "alpha1":
        return "§fMTF Alpha-1";
      case "other_mtf":
        return "§6Otros MTF";
    }
  } else if (faction === Factions.CHAOS) {
    switch (subgroup) {
      case "chaos_delta":
        return "§2Chaos Delta";
    }
  }
  return "desconocido";
}

/**
 * Obtiene la etiqueta de una facción
 */
export function getFactionLabel(faction: string): string {
  return faction === Factions.FOUNDATION ? "§lFundación SCP" : "§2§lInsurgencia del Caos";
}
