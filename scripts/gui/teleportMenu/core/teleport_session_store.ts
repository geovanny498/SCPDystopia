/**
 * Almacén de sesión para el sistema de teletransporte
 * Guarda las selecciones de los jugadores en memoria durante la sesión actual.
 * Se reinicia cuando el servidor se recarga (al salir del mundo).
 */

// Estructura de datos para un jugador
interface PlayerSessionData {
  // Estado para Menú Soldados Normales
  // Key: faction, Value: boolean[] (basic, leader, commander)
  normalSelection: Map<string, boolean[]>;

  // Estado para Menú Soldados Especiales
  // Key: faction_subgroup, Value: string[] (nombres de unidades seleccionadas)
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
 * Guarda la selección de un subgrupo de especiales
 */
export function saveSpecialSelection(playerName: string, faction: string, subgroupId: string, selectedUnits: string[]) {
  const key = `${faction}:${subgroupId}`;
  const session = getPlayerSession(playerName);
  session.specialSelection.set(key, selectedUnits);
}

/**
 * Obtiene si una unidad específica estaba seleccionada en su subgrupo
 */
export function isSpecialUnitSelected(
  playerName: string,
  faction: string,
  subgroupId: string,
  unitName: string
): boolean {
  const key = `${faction}:${subgroupId}`;
  const session = getPlayerSession(playerName);
  const selection = session.specialSelection.get(key);
  if (!selection) return false;
  return selection.includes(unitName);
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
