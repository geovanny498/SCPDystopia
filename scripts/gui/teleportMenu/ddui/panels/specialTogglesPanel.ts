// scripts/gui/teleportMenu/ddui/panels/specialTogglesPanel.ts

/**
 * Panel de Toggles de Soldados Especiales por Bucket DDUI
 * Muestra los nametags específicos de un bucket con observables reactivos,
 * permitiendo seleccionar unidades individuales, ingresar coordenadas y teletransportar.
 */

import { system } from "@minecraft/server";
import { CustomForm, ObservableBoolean, ObservableString } from "@minecraft/server-ui";
import { CommonTexts, ResultMessages } from "../../teleport_config.js";
import { compareNametags } from "../../../../utils/nametagSort.js";
import { getSpecialEntitiesByNametags, parseTeleportDestination } from "../../core/teleport_utils.js";
import { teleportEntitiesToPlayer } from "../../core/teleport_logic.js";
import { debug } from "../../../../utils/debug.js";
import { stripColorCodes } from "../../../commandMenu/ddui/helpers/formHelpers.js";
import { TeleportDDUISession } from "../sessionStore.js";
import { showSpecialBucketsPanel } from "./specialBucketsPanel.js";

/**
 * Muestra el panel con los toggles de nametags de un bucket de especiales
 * @param session - Sesión activa del jugador
 * @param bucketId - ID del bucket (ej: "commander_alpha1")
 * @param bucketData - Datos del bucket con label y nametagCounts
 */
export function showSpecialTogglesPanel(
  session: TeleportDDUISession,
  bucketId: string,
  bucketData: { label: string; nametags: Record<string, number> }
): void {
  const player = session.player;
  const faction = session.faction;
  session.currentView = "special_toggles";
  session.closeReason = "user";

  let nextPanel: (() => void) | undefined = undefined;

  const form = new CustomForm(player, bucketData.label);
  form.spacer();
  form.label("§7Selecciona las unidades a teletransportar:");
  form.spacer();

  // Ordenar los nametags alfabética y numéricamente
  const sortedNametags = Object.keys(bucketData.nametags).sort(compareNametags);

  // Mapa para enlazar cada nametag a su ObservableBoolean
  const toggleMap = new Map<string, ObservableBoolean>();

  for (const nametag of sortedNametags) {
    const count = bucketData.nametags[nametag];
    const isCurrentlySelected = session.isSpecialUnitSelected(faction, nametag);
    const countSuffix = count > 1 ? ` §8x${count}` : "";
    const label = `${nametag}${countSuffix}`;

    const obs = new ObservableBoolean(isCurrentlySelected, { clientWritable: true });
    toggleMap.set(nametag, obs);
    form.toggle(stripColorCodes(label), obs);
  }

  // Campo de coordenadas de destino
  const coordsObs = new ObservableString("", { clientWritable: true });
  form.textField("Coordenadas destino (opcional):\n Ej: 100 64 -200 o ~ ~5 ~\n(vacío = tu posición actual)", coordsObs);

  form.spacer();

  // Helper para guardar el estado del bucket
  const saveCurrentBucketState = (): string[] => {
    const selected: string[] = [];
    for (const [nametag, obs] of toggleMap) {
      if (obs.getData()) {
        selected.push(nametag);
      }
    }
    session.saveSpecialSelection(faction, selected, sortedNametags);
    return selected;
  };

  // Botón Submit: Teletransportar unidades seleccionadas
  form.button(stripColorCodes(CommonTexts.submitButton), () => {
    session.closeReason = "navigation";

    const selectedNametags = saveCurrentBucketState();

    if (selectedNametags.length === 0) {
      player.sendMessage("§c[TELEPORT] Debes seleccionar al menos una unidad.");
      nextPanel = () => showSpecialTogglesPanel(session, bucketId, bucketData);
      form.close();
      return;
    }

    // Resolver coordenadas
    const coordsStr = coordsObs.getData().trim();
    let targetLocation: { x: number; y: number; z: number } | undefined;

    if (coordsStr !== "") {
      const parsed = parseTeleportDestination(coordsStr, player);
      if (!parsed) {
        player.sendMessage("§c[TELEPORT] Coordenadas inválidas. Usa el formato: X Y Z o tildes (~ ~5 ~).");
        nextPanel = () => showSpecialTogglesPanel(session, bucketId, bucketData);
        form.close();
        return;
      }
      targetLocation = parsed;
    }

    // Obtener entidades en la dimensión del jugador
    const entities = getSpecialEntitiesByNametags(faction, selectedNametags, player.dimension);

    if (entities.length === 0) {
      player.sendMessage(ResultMessages.noEntities(faction));
      nextPanel = () => showSpecialBucketsPanel(session);
      form.close();
      return;
    }

    // Ejecutar teletransporte
    const result = teleportEntitiesToPlayer(entities, player, targetLocation);

    if (result.count > 0) {
      player.sendMessage(ResultMessages.success(result.count, faction));
    } else {
      player.sendMessage(ResultMessages.error);
    }

    // Volver al menú de buckets tras ejecutar
    nextPanel = () => showSpecialBucketsPanel(session);
    form.close();
  });

  // Botón Volver al listado de buckets
  form.button(stripColorCodes(CommonTexts.backButton), () => {
    session.closeReason = "navigation";
    saveCurrentBucketState();
    nextPanel = () => showSpecialBucketsPanel(session);
    form.close();
  });

  session.setForm(form);

  form
    .show()
    .then((reason) => {
      session.setForm(undefined);
      if (reason === "ClientClosed") {
        saveCurrentBucketState();
        debug("teleportMenuDDUI", `Panel Toggles Bucket cerrado por cliente (§b${player.name}§r)`, {
          level: "debug",
          color: "gray",
        });
      } else if (reason === "UserBusy") {
        debug("teleportMenuDDUI", `Panel Toggles Bucket cerrado: UserBusy (§b${player.name}§r)`, {
          level: "warn",
          color: "gray",
        });
        player.sendMessage("§e[TELEPORT] La interfaz no pudo abrirse porque estás ocupado.");
      } else if (reason === "ServerClosed") {
        if (session.closeReason === "navigation") {
          system.run(() => {
            nextPanel?.();
          });
        }
      }
    })
    .catch((err) => {
      session.setForm(undefined);
      debug("teleportMenuDDUI", `Error en showSpecialTogglesPanel: ${err}`, {
        level: "error",
        color: "red",
      });
    });
}
