// scripts/utils/nametagSort.ts
export function normalizeNametag(nametag: string): string {
  // Elimina códigos de color de Minecraft y espacios innecesarios
  return nametag.replace(/§./g, "").trim();
}

// El comparador .sort() con sus parámetros normales por alguna razón en Minecraft Bedrock no ordena correctamente los nametags con números, por ejemplo "Soldier 2" aparecería después de "Soldier 10". Esta función se pasa como parámetro .sort() para ordenar de forma natural, es decir, considerando los números dentro de los nametags como valores numéricos y no como texto.
export function compareNametags(a: string, b: string): number {
  const normA = normalizeNametag(a);
  const normB = normalizeNametag(b);

  // Expresión regular para separar bloques de letras y bloques de números
  const tokensA = normA.match(/\d+|\D+/g) || [];
  const tokensB = normB.match(/\d+|\D+/g) || [];

  const maxLength = Math.max(tokensA.length, tokensB.length);

  for (let i = 0; i < maxLength; i++) {
    const tokenA = tokensA[i];
    const tokenB = tokensB[i];

    // Si uno de los arrays se quedó sin partes, el más corto va primero
    if (tokenA === undefined) return -1;
    if (tokenB === undefined) return 1;

    // Intentamos parsear ambos tokens como números
    const numA = parseInt(tokenA, 10);
    const numB = parseInt(tokenB, 10);

    const isNumA = !isNaN(numA);
    const isNumB = !isNaN(numB);

    // Caso 1: Ambos tokens son numéricos -> Comparación matemática pura
    if (isNumA && isNumB) {
      if (numA !== numB) return numA - numB;
      continue;
    }

    // Caso 2: Uno es número y el otro es texto -> El NÚMERO va primero
    if (isNumA) return -1; // <-- Cambiado a -1 (manda el número arriba)
    if (isNumB) return 1; // <-- Cambiado a 1 (manda el texto abajo)

    // Caso 3: Ambos son texto -> Comparación alfabética estándar en minúsculas
    const strA = tokenA.toLowerCase();
    const strB = tokenB.toLowerCase();
    if (strA !== strB) {
      return strA < strB ? -1 : 1;
    }
  }

  return 0;
}
