// scripts/gui/teleportMenu/ddui/panels/normalPanel.ts

/**
 * Panel de Soldados NO Especiales DDUI
 * Permite seleccionar jerarquías (Básicos, Líderes, Comandantes),
 * ingresar coordenadas de destino opcionales y ejecutar el teletransporte.
 */

import { system } from "@minecraft/server";
import { CustomForm, ObservableBoolean, ObservableString } from "@minecraft/server-ui";
import { NormalSoldiersTexts, CommonTexts, ResultMessages } from "../../teleport_config.js";
import { UnitHierarchy } from "../../../../constants/domains.js";
import { getNormalEntitiesByHierarchy, parseTeleportDestination } from "../../core/teleport_utils.js";
import { teleportEntitiesToPlayer } from "../../core/teleport_logic.js";
import { debug } from "../../../../utils/debug.js";
import { stripColorCodes } from "../../../commandMenu/ddui/helpers/formHelpers.js";
import { TeleportDDUISession } from "../sessionStore.js";
import { showTypePanel } from "./typePanel.js";

/**
 * Muestra el panel de soldados no especiales con toggles y coordenadas en DDUI
 * @param session - Sesión activa del jugador
 */
export function showNormalPanel(session: TeleportDDUISession): void {
  const player = session.player;
  const faction = session.faction;
  session.currentView = "normal";
  session.closeReason = "user";

  let nextPanel: (() => void) | undefined = undefined;

  const title = (NormalSoldiersTexts.title as Record<string, string>)[faction] ?? "Soldados No especiales";
  const form = new CustomForm(player, title);

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

  // Botón Submit: Ejecutar teletransporte
  form.button(stripColorCodes(CommonTexts.submitButton), () => {
    session.closeReason = "navigation";

    const isBasic = basicObs.getData();
    const isLeader = leaderObs.getData();
    const isCommander = commanderObs.getData();

    // Guardar selección
    session.saveNormalSelection(faction, [isBasic, isLeader, isCommander]);

    // Mapear jerarquías seleccionadas
    const selectedHierarchies: string[] = [];
    if (isBasic) selectedHierarchies.push(UnitHierarchy.BASIC);
    if (isLeader) selectedHierarchies.push(UnitHierarchy.LEADER);
    if (isCommander) selectedHierarchies.push(UnitHierarchy.COMMANDER);

    if (selectedHierarchies.length === 0) {
      player.sendMessage(ResultMessages.noSelection);
      nextPanel = () => showNormalPanel(session);
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
        nextPanel = () => showNormalPanel(session);
        form.close();
        return;
      }
      targetLocation = parsed;
    }

    // Filtrar entidades en la dimensión del jugador
    const entities = getNormalEntitiesByHierarchy(faction, selectedHierarchies, player.dimension);

    if (entities.length === 0) {
      player.sendMessage(ResultMessages.noEntities(faction));
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
    form.close();
  });

  // Botón Volver
  form.button(stripColorCodes(CommonTexts.backButton), () => {
    session.closeReason = "navigation";
    // Guardar selección actual antes de volver
    session.saveNormalSelection(faction, [basicObs.getData(), leaderObs.getData(), commanderObs.getData()]);
    nextPanel = () => showTypePanel(session);
    form.close();
  });

  session.setForm(form);

  form
    .show()
    .then((reason) => {
      session.setForm(undefined);
      if (reason === "ClientClosed") {
        session.saveNormalSelection(faction, [basicObs.getData(), leaderObs.getData(), commanderObs.getData()]);
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
      debug("teleportMenuDDUI", `Error en showNormalPanel: ${err}`, { level: "error", color: "red" });
    });
}
