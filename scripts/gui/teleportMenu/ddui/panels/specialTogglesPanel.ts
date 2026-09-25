// scripts/gui/teleportMenu/ddui/panels/specialTogglesPanel.ts

/**
 * Panel de selección de nametags por bucket.
 * La ejecución permanece en el bucket actual para permitir acciones sucesivas.
 * Muestra los nametags específicos de un bucket con observables reactivos,
 * permitiendo seleccionar unidades, ingresar coordenadas y teletransportar.
 * Panel de Toggles de Soldados Especiales por Bucket DDUI.
 */

import { system } from "@minecraft/server";
import { CustomForm, ObservableBoolean, ObservableString } from "@minecraft/server-ui";
import {
  CommonTexts,
  TELEPORT_PANEL_FEEDBACK_INITIAL,
  TeleportFeedbackMessages,
} from "../../teleport_config.js";
import { compareNametags } from "../../../../utils/nametagSort.js";
import { getSpecialEntitiesByNametags, parseTeleportDestination } from "../../core/teleport_utils.js";
import { teleportEntitiesToPlayer } from "../../core/teleport_logic.js";
import { debug } from "../../../../utils/debug.js";
import { stripColorCodes } from "../../../commandMenu/ddui/helpers/formHelpers.js";
import { DDUIFeedbackPresenter } from "../../../shared/dduiFeedback.js";
import { TeleportDDUISession, teleportMenuSessionStore } from "../sessionStore.js";
import { showSpecialBucketsPanel } from "./specialBucketsPanel.js";

/**
 * Muestra los toggles de nametags de un bucket de especiales.
 * @param session Sesión activa del jugador.
 * @param bucketId Identificador del bucket actual.
 * @param bucketData Datos descubiertos por el scanner para el bucket.
 * Muestra el panel con los toggles de nametags de un bucket de especiales.
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
  session.activeBucketId = bucketId;
  session.closeReason = "user";

  let nextPanel: (() => void) | undefined;
  const form = new CustomForm(player, bucketData.label);
  const feedbackPresenter = new DDUIFeedbackPresenter(
    player.id,
    `teleportMenu:special:${faction}:${bucketId}`,
    teleportMenuSessionStore,
    TELEPORT_PANEL_FEEDBACK_INITIAL
  );

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
    const obs = new ObservableBoolean(isCurrentlySelected, { clientWritable: true });
    toggleMap.set(nametag, obs);
    form.toggle(stripColorCodes(`${nametag}${countSuffix}`), obs);
  }

  // Campo de coordenadas de destino
  const coordsObs = new ObservableString("", { clientWritable: true });
  form.textField("Coordenadas destino (opcional):\n Ej: 100 64 -200 o ~ ~5 ~\n(vacío = tu posición actual)", coordsObs);
  form.spacer();
  form.label(feedbackPresenter.getObservable());
  form.spacer();

  // Helper para guardar el estado del bucket
  const saveCurrentBucketState = (): string[] => {
    const selected: string[] = [];
    for (const [nametag, obs] of toggleMap) {
      if (obs.getData()) selected.push(nametag);
    }
    session.saveSpecialSelection(faction, selected, sortedNametags);
    return selected;
  };

  // Botón Submit: Teletransportar unidades seleccionadas
  form.button(stripColorCodes(CommonTexts.submitButton), () => {
    const selectedNametags = saveCurrentBucketState();
    if (selectedNametags.length === 0) {
      feedbackPresenter.present({
        context: "Teletransporte",
        value: TeleportFeedbackMessages.noSelection,
        status: "error",
      });
      return;
    }

    // Resolver coordenadas
    const targetLocation = parseTeleportDestination(coordsObs.getData().trim(), player);
    if (!targetLocation) {
      feedbackPresenter.present({
        context: "Teletransporte",
        value: TeleportFeedbackMessages.invalidCoordinates,
        status: "error",
      });
      return;
    }

    // Obtener entidades en la dimensión del jugador
    const entities = getSpecialEntitiesByNametags(faction, selectedNametags, player.dimension);
    if (entities.length === 0) {
      feedbackPresenter.present({
        context: "Teletransporte",
        value: TeleportFeedbackMessages.noEntities,
        status: "warn",
      });
      return;
    }

    // Ejecutar teletransporte
    const result = teleportEntitiesToPlayer(entities, player, targetLocation);
    // Volver al menú de buckets tras ejecutar: la navegación ahora es explícita.
    const errorCount = result.errors?.length ?? 0;
    feedbackPresenter.present({
      context: "Teletransporte",
      value:
        result.count > 0 && result.hasErrors
          ? TeleportFeedbackMessages.partial(result.count, errorCount)
          : result.count > 0
            ? TeleportFeedbackMessages.success(result.count)
            : TeleportFeedbackMessages.error,
      status: result.count > 0 && result.hasErrors ? "warn" : result.count > 0 ? "ok" : "error",
    });
  });

  // Botón Volver al listado de buckets
  form.button(stripColorCodes(CommonTexts.backButton), () => {
    saveCurrentBucketState();
    session.closeReason = "navigation";
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
      } else if (reason === "ServerClosed" && session.closeReason === "navigation") {
        system.run(() => nextPanel?.());
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
