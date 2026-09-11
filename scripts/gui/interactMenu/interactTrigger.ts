// scripts/gui/interactMenu/interactTrigger.ts
import { world, system, EquipmentSlot, Player, Entity } from "@minecraft/server";
import config, { INTERACT_MAX_DISTANCE } from "./config.js";
import { debugWarn, debugMessage } from "../../utils/debug.js";
import { showInteractDDUI } from "./ddui/interact_ddui_form.js";
import { interactMenuSessionStore } from "./ddui/interact_ddui_shared.js";
import { getEntityFactionInfo } from "../commandMenu/model/menu_faction.js";
import { PlayerPermissionManager } from "../shared/playerPermissionManager.js";
import { EquipmentDetector } from "../shared/equipmentDetector.js";
import { itemMatches, getConfigForEntity } from "./gui.js";

/**
 * Resuelve el grupo de facción de una entidad desde `config.entities`.
 * @param typeId typeId de la entidad objetivo.
 * @returns Nombre del grupo (ej: `"foundation"`, `"chaos"`) o `null` si no está registrada.
 */
function getEntityFactionGroup(typeId: string): string | null {
  if (!config.entities) return null;
  for (const gName of Object.keys(config.entities)) {
    const group = config.entities[gName];
    if (group && Object.prototype.hasOwnProperty.call(group, typeId)) {
      return gName;
    }
  }
  return null;
}

/**
 * Resuelve el item abridor para un grupo de facción específico.
 *
 * Usa `config.openItem[group]` → `config.openItem.default` → primer valor
 * disponible en `config.openItem`. Sin hardcoding de literales en lógica.
 *
 * @param entGroup Grupo de facción (ej: `"foundation"`) o `null`.
 * @returns typeId del item abridor, o `""` si no hay opener configurado.
 */
function getOpenerForGroup(entGroup: string | null): string {
  if (entGroup && config.openItem?.[entGroup]) {
    return config.openItem[entGroup];
  }
  if (config.openItem?.default) {
    return config.openItem.default;
  }
  const firstOpener = Object.values(config.openItem || {}).find((v) => v);
  return firstOpener ?? "";
}

/**
 * Verifica si el item usado coincide con algún opener configurado
 * (cualquier facción o el default). Se usa para filtrar el gatillo `itemUse`
 * antes de hacer el raycast.
 * @param itemTypeId typeId del item en mano.
 * @returns `true` si el item coincide con algún opener conocido.
 */
function isOpenerItem(itemTypeId: string | null): boolean {
  if (!itemTypeId || !config.openItem) return false;
  for (const opener of Object.values(config.openItem)) {
    if (opener && itemMatches(itemTypeId, opener)) return true;
  }
  return false;
}

/**
 * Verifica si el item usado coincide con el opener de la facción de la entidad.
 * Se usa en el gatillo `playerInteractWithEntity` para decidir si cancelar la
 * interacción vanilla (ej: apertura de inventario).
 *
 * Aprovecha `ev.itemStack` de `PlayerInteractWithEntityBeforeEvent`, evitando
 * un acceso manual al equippable del jugador.
 *
 * @param itemTypeId typeId del item usado (de `ev.itemStack`).
 * @param typeId typeId de la entidad objetivo.
 * @returns `true` si el item coincide con el opener de la facción de la entidad.
 */
function isOpenerForEntity(itemTypeId: string | null, typeId: string): boolean {
  const entGroup = getEntityFactionGroup(typeId);
  if (!entGroup) return false;
  const openerItem = getOpenerForGroup(entGroup);
  return itemMatches(itemTypeId, openerItem);
}

/**
 * Abre el menú DDUI de interacción para una entidad objetivo.
 *
 * Reúne toda la lógica de negocio: detección de facción/grupo,
 * verificación de item abridor en mainhand, checks de permisos, resolución
 * de config y llamada a `showInteractDDUI`.
 *
 * @param player  Jugador que inicia la interacción.
 * @param targetEntity  Entidad objetivo detectada (via interacción o raycast).
 */
export function openInteractMenuForEntity(player: Player, targetEntity: Entity): void {
  try {
    if (!player || !targetEntity) return;

    // Guard: prevent race condition — dual triggers (playerInteractWithEntity
    // + itemUse) may both call this synchronously before system.run creates
    // the session. The session.get guard alone is insufficient because the
    // session is created inside system.run (next tick).
    if (interactMenuSessionStore.isOpening(player.id)) {
      debugMessage("interactTrigger", `Apertura en curso para ${player.name}, ignorando`, "blue");
      return;
    }

    debugWarn(
      "interactTrigger",
      `openInteractMenuForEntity player=${player?.name ?? "?"} target=${targetEntity?.typeId ?? "?"}`
    );

    if (!player || !targetEntity) return;

    const entity = targetEntity;

    const entGroup = getEntityFactionGroup(entity.typeId);
    const openerItem = getOpenerForGroup(entGroup);

    try {
      const mainhand = player.getComponent("equippable")?.getEquipment(EquipmentSlot.Mainhand);
      const mainId = mainhand?.typeId ?? null;

      debugWarn("interactTrigger", `player mainhand=${mainId}, opener=${openerItem}`);

      const isDDUIOpener = itemMatches(mainId, openerItem);

      if (!isDDUIOpener) {
        debugWarn("interactTrigger", `menu blocked: wrong opener`, "blue");
        return;
      }
    } catch (e) {
      debugWarn("interactTrigger", `error reading mainhand: ${e}`, "red");
      return;
    }

    const isAdmin = PlayerPermissionManager.isAdmin(player);

    if (!isAdmin) {
      const helmetFaction = EquipmentDetector.getActiveFaction(player);
      const entityFactionInfo = getEntityFactionInfo(entity);

      if (!helmetFaction) {
        player.sendMessage("§c[SCPDystopia] Necesitas llevar el casco de tu facción.");
        return;
      }

      if (!entityFactionInfo) {
        return;
      }

      if (helmetFaction !== entityFactionInfo.faction) {
        const entityFactionName = entityFactionInfo.faction === "foundation" ? "Foundation" : "Chaos";
        const playerFactionName = helmetFaction === "foundation" ? "Foundation" : "Chaos";
        player.sendMessage(
          `§c[SCPDystopia] No puedes modificar unidades de ${entityFactionName} si eres del bando ${playerFactionName}.`
        );
        return;
      }
    }

    const typeId = entity.typeId;

    const cfg = getConfigForEntity(typeId, entity);
    if (!cfg) {
      debugWarn("interactTrigger", `no config for ${typeId}`, "blue");
      return;
    }

    let displayName = typeId;
    try {
      if (entity.nameTag) displayName = entity.nameTag;
    } catch {}

    const soldierName = entity.nameTag ? `${entity.nameTag}§r` : `§b${displayName}§r`;

    // Marcar apertura en curso para prevenir race condition con itemUse
    interactMenuSessionStore.setOpening(player.id);

    system.run(() => {
      try {
        showInteractDDUI(player, entity, cfg, soldierName, displayName, typeId);
      } finally {
        interactMenuSessionStore.clearOpening(player.id);
      }
    });
  } catch (err) {
    debugWarn("interactTrigger", `GUI error: ${err}`, "red");
    interactMenuSessionStore.clearOpening(player.id);
  }
}

/**
 * Gatillo `playerInteractWithEntity`: cancela la interacción vanilla de las
 * unidades (ej: apertura de `minecraft:inventory`) cuando el jugador sostiene
 * el item abridor, y abre el menú DDUI a corta distancia.
 *
 * A corta distancia, el click derecho sobre una unidad con `minecraft:inventory`
 * abre su inventario vanilla. Este suscriptor:
 * 1. Cancela la interacción vanilla (`ev.cancel = true`) usando `ev.itemStack`
 *    (propiedad nativa del evento, sin leer equippable).
 * 2. Abre el menú vía `openInteractMenuForEntity` (tenemos `ev.target` gratis).
 *
 * El guard de sesión previene aperturas duplicadas si `itemUse` también dispara.
 */
world.beforeEvents.playerInteractWithEntity.subscribe((ev) => {
  const player = ev.player;
  const entity = ev.target;
  if (!player || !entity) return;

  const itemTypeId = ev.itemStack?.typeId ?? null;
  if (!isOpenerForEntity(itemTypeId, entity.typeId)) return;

  debugMessage("interactTrigger", `Cancelando interacción vanilla para ${entity.typeId}`, "gray");

  // Prevenir inventario vanilla / otras interacciones nativas
  ev.cancel = true;

  // Guard: si ya hay un menú abierto (puede haberse abierto desde itemUse),
  // no abrir otro
  if (interactMenuSessionStore.get(player.id)) {
    debugMessage("interactTrigger", `Menú ya abierto para ${player.name}, ignorando playerInteractWithEntity`, "blue");
    return;
  }

  openInteractMenuForEntity(player, entity);
});

/**
 * Gatillo `itemUse`: abre el menú DDUI de interacción a distancia mediante
 * raycast desde la vista del jugador.
 *
 * Se suscribe una sola vez a `world.beforeEvents.itemUse`. El evento se
 * dispara al iniciar el uso del item (presionar clic derecho). No se
 * suscribe dentro de builders de formulario (anti-patrón AGENTS.md).
 *
 * - Verifica que el item usado es un opener.
 * - Cancela el uso vanilla del item (`ev.cancel = true`).
 * - Realiza raycast con `maxDistance` configurable y `ignoreBlockCollision: false`
 *   (requiere línea de visión directa).
 * - Toma `hits[0]` (entidad más cercana) como objetivo.
 * - Reutiliza `openInteractMenuForEntity` para toda la lógica de permisos/config.
 */
world.beforeEvents.itemUse.subscribe((ev) => {
  const player = ev.source;
  if (!player) return;

  // Guard: si ya hay un menú abierto para este jugador, no abrir otro
  if (interactMenuSessionStore.get(player.id)) {
    debugMessage("interactTrigger", `Menú ya abierto para ${player.name}, ignorando itemUse`, "blue");
    return;
  }

  const itemTypeId = ev.itemStack?.typeId ?? null;
  if (!isOpenerItem(itemTypeId)) return;

  debugWarn("interactTrigger", `itemUse opener detectado: ${itemTypeId} por ${player.name}`, "green");

  // Cancelar el uso vanilla del item abridor
  ev.cancel = true;

  // Raycast: entidad más cercana que el jugador está mirando
  // - maxDistance: constante tipada en config.ts
  // - ignoreBlockCollision: false → línea de visión directa requerida (bloques bloquean)
  const hits = player.getEntitiesFromViewDirection({
    maxDistance: INTERACT_MAX_DISTANCE,
    ignoreBlockCollision: false,
  });

  const target = hits[0]?.entity;
  if (!target) {
    debugWarn("interactTrigger", `No se encontró entidad objetivo en el raycast`, "blue");
    return;
  }

  debugMessage("interactTrigger", `Raycast: target=${target.typeId} distancia=${hits[0].distance}`, "cyan");

  openInteractMenuForEntity(player, target);
});
