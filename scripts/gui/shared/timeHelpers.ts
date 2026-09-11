// scripts/gui/shared/timeHelpers.ts

// UTC-3 hardcodeado porque no hay forma de obtener la hora local del cliente en este contexto.
export const HISTORY_LOCAL_TIME_OFFSET_HOURS = -3;

export function formatLocalTime(timestamp: number): string {
  const offsetMs = HISTORY_LOCAL_TIME_OFFSET_HOURS * 3600000;
  const localDate = new Date(timestamp + offsetMs);

  const hours = localDate.getUTCHours().toString().padStart(2, "0");
  const minutes = localDate.getUTCMinutes().toString().padStart(2, "0");
  const seconds = localDate.getUTCSeconds().toString().padStart(2, "0");

  return `${hours}:${minutes}:${seconds}`;
}

export function formatLocalTimeShort(timestamp: number): string {
  const offsetMs = HISTORY_LOCAL_TIME_OFFSET_HOURS * 3600000;
  const localDate = new Date(timestamp + offsetMs);

  const hours = localDate.getUTCHours().toString().padStart(2, "0");
  const minutes = localDate.getUTCMinutes().toString().padStart(2, "0");

  return `${hours}:${minutes}`;
}
