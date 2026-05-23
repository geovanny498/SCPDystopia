/**
 * Almacén de sesión para el sistema de teletransporte
 * Guarda las selecciones de los jugadores en memoria durante la sesión actual.
 * Se reinicia cuando el servidor se recarga (al salir del mundo).
 */

import { world } from "@minecraft/server";

// Estructura de datos para un jugador
interface PlayerSessionData {
  // Estado para Menú Soldados Normales
  // Key: faction, Value: boolean[] (basic, leader, commander)
  normalSelection: Map<string, boolean[]>;

  // Estado para Menú Soldados Especiales
  // Key: faction, Value: string[] (nametags seleccionados)
  // Guardamos por nametag global sin bucketId para evitar bugs cuando
  // las entidades cambian de bucket por overflow o entrada/salida de simulación
  specialSelection: Map<string, string[]>;

  // Estado para Menú TODAS
  // Key: faction, Value: objeto con estado completo
  allMenuSelection: Map<
    string,
    {
      hierarchies: boolean[]; // [basic, leader, commander]
      specialUnits: string[]; // Nombres de unidades seleccionadas
    }
  >;
}

// Almacén global
const sessionStore = new Map<string, PlayerSessionData>();

/**
 * Obtiene (o inicializa) los datos de sesión de un jugador
 */
function getPlayerSession(playerName: string): PlayerSessionData {
  if (!sessionStore.has(playerName)) {
    sessionStore.set(playerName, {
      normalSelection: new Map(),
      specialSelection: new Map(),
      allMenuSelection: new Map(),
    });
  }
  return sessionStore.get(playerName)!;
}

// ===== API PÚBLICA =====

/**
 * Guarda la selección del menú normal
 */
export function saveNormalSelection(playerName: string, faction: string, selection: boolean[]) {
  const session = getPlayerSession(playerName);
  session.normalSelection.set(faction, selection);
}

/**
 * Obtiene la selección del menú normal (o default false)
 */
export function getNormalSelection(playerName: string, faction: string): boolean[] {
  const session = getPlayerSession(playerName);
  return session.normalSelection.get(faction) || [false, false, false];
}

/**
 * Guarda la selección de especiales para un bucket específico
 * @param playerName - Nombre del jugador
 * @param faction - Facción seleccionada
 * @param bucketId - ID del bucket (para identificar qué bucket se está guardando)
 * @param selectedNametags - Array de nametags seleccionados en este bucket
 * @param allNametagsInBucket - Array de todos los nametags disponibles en este bucket
 *
 * Nota: Fusiona la selección del bucket actual con las selecciones de otros buckets
 * para evitar sobrescribir cuando el usuario navega entre buckets
 */
export function saveSpecialSelection(
  playerName: string,
  faction: string,
  bucketId: string,
  selectedNametags: string[],
  allNametagsInBucket: string[]
) {
  const session = getPlayerSession(playerName);
  const currentSelection = session.specialSelection.get(faction) || [];

  // Remover nametags de este bucket que ya no están seleccionados
  const filteredSelection = currentSelection.filter((nt) => !allNametagsInBucket.includes(nt));

  // Agregar nametags seleccionados de este bucket
  const mergedSelection = [...filteredSelection, ...selectedNametags];

  session.specialSelection.set(faction, mergedSelection);
}

/**
 * Obtiene si un nametag específico estaba seleccionado
 * @param playerName - Nombre del jugador
 * @param faction - Facción seleccionada
 * @param nametag - Nametag de la unidad
 *
 * Nota: Buscamos por facción sin bucketId para que la selección persista
 * incluso si el nametag cambia de bucket
 */
export function isSpecialUnitSelected(playerName: string, faction: string, nametag: string): boolean {
  const session = getPlayerSession(playerName);
  const selection = session.specialSelection.get(faction);
  if (!selection) return false;
  return selection.includes(nametag);
}

/**
 * Guarda la selección del menú TODAS
 */
export function saveAllMenuSelection(
  playerName: string,
  faction: string,
  hierarchies: boolean[],
  specialUnits: string[]
) {
  const session = getPlayerSession(playerName);
  session.allMenuSelection.set(faction, { hierarchies, specialUnits });
}

/**
 * Obtiene la selección del menú TODAS
 * Devuelve null si no hay datos guardados
 */
export function getAllMenuSelection(playerName: string, faction: string) {
  const session = getPlayerSession(playerName);
  return session.allMenuSelection.get(faction) || null;
}

world.beforeEvents.playerLeave.subscribe((event) => {
  const playerName = event.player.name;
  if (sessionStore.has(playerName)) {
    sessionStore.delete(playerName);
  }
});
