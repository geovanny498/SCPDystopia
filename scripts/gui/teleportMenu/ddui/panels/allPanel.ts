// scripts/gui/teleportMenu/ddui/panels/allPanel.ts

/**
 * Panel de Teletransporte "TODAS" DDUI.
 * Agrupa jerarquías normales y nametags especiales en una sola vista persistente.
 * Despliega en una sola vista toggles normales, especiales, coordenadas y submit.
 * Despliega en una sola vista:
 * - Toggles para todas las jerarquías normales (Básico, Líder, Comandante)
 * - Toggles individuales para cada nametag de cada bucket especial no vacío activo
 * - Campo de texto para coordenadas de destino
 * - Botón de submit para teletransportar todas las unidades seleccionadas
 */

import { Entity, system } from "@minecraft/server";
import { CustomForm, ObservableBoolean, ObservableString } from "@minecraft/server-ui";
import { FactionId, UnitHierarchy, UnitHierarchyId } from "../../../../constants/domains.js";
import {
  CommonTexts,
  TELEPORT_PANEL_FEEDBACK_INITIAL,
  TeleportAllTexts,
  TeleportFeedbackMessages,
  getFactionLabel,
} from "../../teleport_config.js";
import { FINAL_BUCKET_ORDER, scanActiveUnits } from "../../../commandMenu/menu_config.js";
import { compareNametags } from "../../../../utils/nametagSort.js";
import {
  getNormalEntitiesByHierarchy,
  getSpecialEntitiesByNametags,
  parseTeleportDestination,
} from "../../core/teleport_utils.js";
import { teleportEntitiesToPlayer } from "../../core/teleport_logic.js";
import { debug } from "../../../../utils/debug.js";
import { stripColorCodes } from "../../../commandMenu/ddui/helpers/formHelpers.js";
import { DDUIFeedbackPresenter } from "../../../shared/dduiFeedback.js";
import { TeleportDDUISession, teleportMenuSessionStore } from "../sessionStore.js";
import { showMainPanel } from "./mainPanel.js";

/**
 * Muestra la vista agregada de unidades normales y especiales.
 * @param session Sesión activa del jugador.
 * Muestra el panel "TODAS" con todos los toggles de la facción seleccionada.
 * @param session - Sesión activa del jugador
 */
export function showAllPanel(session: TeleportDDUISession): void {
  const player = session.player;
  const faction: FactionId = session.faction;
  session.currentView = "all";
  session.closeReason = "user";

  let nextPanel: (() => void) | undefined;
  const factionTitle = TeleportAllTexts.title[faction] ?? "TODAS las Unidades";
  const factionLabel = getFactionLabel(faction);
  const form = new CustomForm(player, factionTitle);
  const feedbackPresenter = new DDUIFeedbackPresenter(
    player.id,
    `teleportMenu:all:${faction}`,
    teleportMenuSessionStore,
    TELEPORT_PANEL_FEEDBACK_INITIAL
  );

  form.spacer();
  form.label(`§7Selecciona TODAS las unidades a teletransportar de ${factionLabel}§r:`);
  form.spacer();

  // Recuperar selección guardada de este menú si existe
  const savedAll = session.getAllMenuSelection(faction);
  // ===== SECCIÓN 1: Jerarquías Normales =====
  form.header("§7-Soldados NO Especiales-");
  form.spacer();
  const basicObs = new ObservableBoolean(savedAll?.hierarchies[0] ?? true, { clientWritable: true });
  const leaderObs = new ObservableBoolean(savedAll?.hierarchies[1] ?? true, { clientWritable: true });
  const commanderObs = new ObservableBoolean(savedAll?.hierarchies[2] ?? true, { clientWritable: true });

  form.toggle(stripColorCodes("§7Básicos"), basicObs);
  form.toggle(stripColorCodes("§eLíderes"), leaderObs);
  form.toggle(stripColorCodes("§6Comandantes"), commanderObs);

  // ===== SECCIÓN 2: Soldados Especiales por Buckets Activos =====
  const scanResult = scanActiveUnits(player.dimension, faction);
  const buckets = scanResult.buckets;
  const nonEmptyBuckets = FINAL_BUCKET_ORDER.filter(
    (bucketId) => buckets[bucketId] && buckets[bucketId].unitCount > 0
  ).map((bucketId) => ({ id: bucketId, data: buckets[bucketId] }));
  // Mapa de nametag -> ObservableBoolean para especiales
  const specialToggleMap = new Map<string, ObservableBoolean>();

  if (nonEmptyBuckets.length > 0) {
    form.spacer();
    form.header("§6-Soldados Especiales-");
    for (const bucket of nonEmptyBuckets) {
      form.spacer();
      form.header(`§e${bucket.data.label}:`);
      form.spacer();
      const sortedNametags = Object.keys(bucket.data.nametags).sort(compareNametags);
      for (const nametag of sortedNametags) {
        const count = bucket.data.nametags[nametag];
        const isSelected = savedAll ? savedAll.specialUnits.includes(nametag) : true;
        const obs = new ObservableBoolean(isSelected, { clientWritable: true });
        specialToggleMap.set(nametag, obs);
        form.toggle(stripColorCodes(`§7${nametag}${count > 1 ? ` §8x${count}` : ""}`), obs);
      }
    }
  }

  // Campo de coordenadas de destino
  const coordsObs = new ObservableString("", { clientWritable: true });
  form.textField("Coordenadas destino (opcional):\n Ej: 100 64 -200 o ~ ~5 ~\n(vacío = tu posición actual)", coordsObs);
  form.spacer();
  form.label(feedbackPresenter.getObservable());
  form.spacer();

  // Helper para guardar el estado del formulario "TODAS"
  const saveAllState = (): {
    hierarchies: [boolean, boolean, boolean];
    selectedHierarchies: UnitHierarchyId[];
    selectedSpecialNametags: string[];
  } => {
    const hierarchies: [boolean, boolean, boolean] = [basicObs.getData(), leaderObs.getData(), commanderObs.getData()];
    const selectedHierarchies: UnitHierarchyId[] = [];
    if (hierarchies[0]) selectedHierarchies.push(UnitHierarchy.BASIC);
    if (hierarchies[1]) selectedHierarchies.push(UnitHierarchy.LEADER);
    if (hierarchies[2]) selectedHierarchies.push(UnitHierarchy.COMMANDER);

    const selectedSpecialNametags: string[] = [];
    for (const [nametag, obs] of specialToggleMap) {
      if (obs.getData()) selectedSpecialNametags.push(nametag);
    }
    session.saveAllMenuSelection(faction, hierarchies, selectedSpecialNametags);
    return { hierarchies, selectedHierarchies, selectedSpecialNametags };
  };

  // Botón Submit: Teletransportar TODAS las seleccionadas
  form.button(stripColorCodes(CommonTexts.submitButton), () => {
    const { selectedHierarchies, selectedSpecialNametags } = saveAllState();
    if (selectedHierarchies.length === 0 && selectedSpecialNametags.length === 0) {
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

    // Obtener entidades normales
    let normalEntities: Entity[] = [];
    if (selectedHierarchies.length > 0) {
      normalEntities = getNormalEntitiesByHierarchy(faction, selectedHierarchies, player.dimension);
    }
    // Obtener entidades especiales
    let specialEntities: Entity[] = [];
    if (selectedSpecialNametags.length > 0) {
      specialEntities = getSpecialEntitiesByNametags(faction, selectedSpecialNametags, player.dimension);
    }
    // Unir sin duplicados
    const allEntities = [...normalEntities, ...specialEntities];

    if (allEntities.length === 0) {
      feedbackPresenter.present({
        context: "Teletransporte",
        value: TeleportFeedbackMessages.noEntities,
        status: "warn",
      });
      return;
    }

    // Ejecutar teletransporte
    const result = teleportEntitiesToPlayer(allEntities, player, targetLocation);
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
    saveAllState();
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
        saveAllState();
        debug("teleportMenuDDUI", `Panel TODAS cerrado por cliente (§b${player.name}§r)`, {
          level: "debug",
          color: "gray",
        });
      } else if (reason === "UserBusy") {
        debug("teleportMenuDDUI", `Panel TODAS cerrado: UserBusy (§b${player.name}§r)`, {
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
      debug("teleportMenuDDUI", `Error en showAllPanel: ${err}`, {
        level: "error",
        color: "red",
      });
    });
}
