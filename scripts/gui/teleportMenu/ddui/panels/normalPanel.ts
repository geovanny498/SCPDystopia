// scripts/gui/teleportMenu/ddui/panels/normalPanel.ts

/**
 * Panel de soldados no especiales DDUI.
 * Mantiene la vista abierta mientras el jugador corrige o repite una acción.
 * Permite seleccionar jerarquías (Básicos, Líderes, Comandantes) e ingresar
 * coordenadas de destino opcionales.
 * Panel de Soldados NO Especiales DDUI.
 * Permite seleccionar jerarquías (Básicos, Líderes, Comandantes),
 * ingresar coordenadas de destino opcionales y ejecutar el teletransporte.
 */

import { system } from "@minecraft/server";
import { CustomForm, ObservableBoolean, ObservableString } from "@minecraft/server-ui";
import { UnitHierarchy, UnitHierarchyId } from "../../../../constants/domains.js";
import {
  CommonTexts,
  NormalSoldiersTexts,
  TELEPORT_PANEL_FEEDBACK_INITIAL,
  TeleportFeedbackMessages,
} from "../../teleport_config.js";
import { getNormalEntitiesByHierarchy, parseTeleportDestination } from "../../core/teleport_utils.js";
import { teleportEntitiesToPlayer } from "../../core/teleport_logic.js";
import { debug } from "../../../../utils/debug.js";
import { stripColorCodes } from "../../../commandMenu/ddui/helpers/formHelpers.js";
import { DDUIFeedbackPresenter } from "../../../shared/dduiFeedback.js";
import { TeleportDDUISession, teleportMenuSessionStore } from "../sessionStore.js";
import { showMainPanel } from "./mainPanel.js";

/**
 * Muestra el panel de soldados no especiales.
 * @param session Sesión activa del jugador.
 * Muestra el panel de soldados no especiales con toggles y coordenadas en DDUI.
 * @param session - Sesión activa del jugador
 */
export function showNormalPanel(session: TeleportDDUISession): void {
  const player = session.player;
  const faction = session.faction;
  session.currentView = "normal";
  session.closeReason = "user";

  let nextPanel: (() => void) | undefined;
  const title = NormalSoldiersTexts.title[faction] ?? "Soldados No especiales";
  const form = new CustomForm(player, title);
  const feedbackPresenter = new DDUIFeedbackPresenter(
    player.id,
    `teleportMenu:normal:${faction}`,
    teleportMenuSessionStore,
    TELEPORT_PANEL_FEEDBACK_INITIAL
  );

  form.spacer();
  form.label(NormalSoldiersTexts.description);
  form.spacer();

  // Recuperar selección previa
  const savedSelection = session.getNormalSelection(faction);
  const basicObs = new ObservableBoolean(savedSelection[0], { clientWritable: true });
  const leaderObs = new ObservableBoolean(savedSelection[1], { clientWritable: true });
  const commanderObs = new ObservableBoolean(savedSelection[2], { clientWritable: true });
  const coordsObs = new ObservableString("", { clientWritable: true });

  // Toggles de jerarquía
  form.toggle(stripColorCodes(NormalSoldiersTexts.toggleBasic), basicObs);
  form.toggle(stripColorCodes(NormalSoldiersTexts.toggleLeader), leaderObs);
  form.toggle(stripColorCodes(NormalSoldiersTexts.toggleCommander), commanderObs);
  // Campo de coordenadas
  form.textField("Coordenadas destino (opcional):\n Ej: 100 64 -200 o ~ ~5 ~\n(vacío = tu posición actual)", coordsObs);
  form.spacer();
  form.label(feedbackPresenter.getObservable());
  form.spacer();

  const saveSelection = (): [boolean, boolean, boolean] => {
    const selection: [boolean, boolean, boolean] = [basicObs.getData(), leaderObs.getData(), commanderObs.getData()];
    session.saveNormalSelection(faction, selection);
    return selection;
  };

  // Botón Submit: Ejecutar teletransporte
  form.button(stripColorCodes(CommonTexts.submitButton), () => {
    // Guardar selección
    const [isBasic, isLeader, isCommander] = saveSelection();
    // Mapear jerarquías seleccionadas
    const selectedHierarchies: UnitHierarchyId[] = [];
    if (isBasic) selectedHierarchies.push(UnitHierarchy.BASIC);
    if (isLeader) selectedHierarchies.push(UnitHierarchy.LEADER);
    if (isCommander) selectedHierarchies.push(UnitHierarchy.COMMANDER);

    if (selectedHierarchies.length === 0) {
      feedbackPresenter.present({
        context: "Teletransporte",
        value: TeleportFeedbackMessages.noSelection,
        status: "error",
      });
      return;
    }

    // Resolver coordenadas
    const coordsStr = coordsObs.getData().trim();
    const targetLocation = parseTeleportDestination(coordsStr, player);
    if (!targetLocation) {
      feedbackPresenter.present({
        context: "Teletransporte",
        value: TeleportFeedbackMessages.invalidCoordinates,
        status: "error",
      });
      return;
    }

    // Filtrar entidades en la dimensión del jugador
    const entities = getNormalEntitiesByHierarchy(faction, selectedHierarchies, player.dimension);
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

  // Botón Volver
  form.button(stripColorCodes(CommonTexts.backButton), () => {
    // Guardar selección actual antes de volver
    saveSelection();
    session.closeReason = "navigation";
    nextPanel = () => showMainPanel(session);
    form.close();
  });

  session.setForm(form);
  form
    .show()
    .then((reason) => {
      session.setForm(undefined);
      if (reason === "ClientClosed") {
        saveSelection();
        debug("teleportMenuDDUI", `Panel Normales cerrado por cliente (§b${player.name}§r)`, {
          level: "debug",
          color: "gray",
        });
      } else if (reason === "UserBusy") {
        debug("teleportMenuDDUI", `Panel Normales cerrado: UserBusy (§b${player.name}§r)`, {
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
      debug("teleportMenuDDUI", `Error en showNormalPanel: ${err}`, { level: "error", color: "red" });
    });
}
