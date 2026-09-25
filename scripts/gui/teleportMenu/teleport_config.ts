// scripts/gui/teleportMenu/teleport_config.ts

/**
 * Configuración centralizada del menú de teletransporte
 * Este archivo define todos los textos, títulos y mensajes del sistema
 */

import { FactionId, Factions } from "../../constants/domains.js";

/**
 * Títulos principales del sistema de teletransporte
 */
export const TeleportTitles = {
  main: "§b§lSCPDystopia | Teletransporte",
  foundation: "§lFundación SCP",
  chaos: "§2§lInsurgencia del Caos",
};

/**
 * Opción de facción disponible en el hub de teleportMenu.
 */
export interface TeleportFactionOption {
  /** Texto visible para la facción. */
  label: string;
  /** Identificador canónico usado por la sesión y las consultas. */
  value: FactionId;
}

/**
 * Opciones explícitas del dropdown del hub. No incluye el modo combinado.
 */
export const TELEPORT_FACTION_OPTIONS: TeleportFactionOption[] = [
  { label: "§lFundación SCP", value: Factions.FOUNDATION },
  { label: "§2§lInsurgencia del Caos", value: Factions.CHAOS },
];

/**
 * Textos de navegación del hub de teleportMenu.
 */
export const TeleportHubTexts = {
  description: "§7Selecciona la facción y la categoría de unidades:",
  normal: "§8No especiales",
  special: "§6Especiales",
  all: "§c§lTODAS",
};

/**
 * Textos para el menú de soldados NO especiales
 */
export const NormalSoldiersTexts = {
  title: {
    [Factions.FOUNDATION]: "§lFundación SCP §8| §7No especiales",
    [Factions.CHAOS]: "§2§lInsurgencia del Caos §8| §7No especiales",
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
    [Factions.FOUNDATION]: "§lFundación SCP §8| §6Especiales",
    [Factions.CHAOS]: "§2§lInsurgencia del Caos §8| §6Especiales",
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
    [Factions.FOUNDATION]: "§lFundación SCP §8| §dTODAS las Unidades",
    [Factions.CHAOS]: "§2§lInsurgencia del Caos §8| §dTODAS las Unidades",
  },
  label: "§7Selecciona todas las unidades a teletransportar:",
};

/**
 * Texto visible antes de que exista un resultado de teletransporte.
 */
export const TELEPORT_PANEL_FEEDBACK_INITIAL = "§7Teletransporte: §fN/A";

/**
 * Mensajes breves para el presenter DDUI de las vistas de ejecución.
 */
export const TeleportFeedbackMessages = {
  noSelection: "Selecciona al menos una jerarquía/unidad.",
  invalidCoordinates: "Coordenadas inválidas. Usa X Y Z o ~ ~5 ~.",
  noEntities: "No hay entidades válidas disponibles.",
  success: (count: number): string => `${count} entidades teletransportadas.`,
  partial: (count: number, errors: number): string => `${count} teletransportadas; ${errors} con error.`,
  error: "No se pudo teletransportar la selección.",
};

/**
 * Obtiene el nombre de un subgrupo para mensajes
 * @deprecated Esta función se mantiene por compatibilidad pero ya no se usa en el nuevo flujo de buckets
 */
export function getSubgroupLabel(_faction: string, _subgroup: string): string {
  return "desconocido";
}

/**
 * Obtiene la etiqueta de una facción
 */
export function getFactionLabel(faction: FactionId): string {
  return faction === Factions.FOUNDATION ? "§lFundación SCP" : "§2§lInsurgencia del Caos";
}
