// scripts/gui/teleportMenu/ddui/panels/allPanel.ts

/**
 * Panel de Teletransporte "TODAS" DDUI
 * Despliega en una sola vista:
 * - Toggles para todas las jerarquías normales (Básico, Líder, Comandante)
 * - Toggles individuales para cada nametag de cada bucket especial no vacío activo
 * - Campo de texto para coordenadas de destino
 * - Botón de submit para teletransportar todas las unidades seleccionadas
 */

import { Entity, system } from "@minecraft/server";
import { CustomForm, ObservableBoolean, ObservableString } from "@minecraft/server-ui";
import { TeleportAllTexts, CommonTexts, ResultMessages, getFactionLabel } from "../../teleport_config.js";
import { UnitHierarchy } from "../../../../constants/domains.js";
import { scanActiveUnits } from "../../../commandMenu/menu_config.js";
import { compareNametags } from "../../../../utils/nametagSort.js";
import {
  getNormalEntitiesByHierarchy,
  getSpecialEntitiesByNametags,
  parseTeleportDestination,
} from "../../core/teleport_utils.js";
import { teleportEntitiesToPlayer } from "../../core/teleport_logic.js";
import { debug } from "../../../../utils/debug.js";
import { stripColorCodes } from "../../../commandMenu/ddui/helpers/formHelpers.js";
import { TeleportDDUISession } from "../sessionStore.js";
import { showTypePanel } from "./typePanel.js";

/**
 * Muestra el panel "TODAS" con todos los toggles de la facción seleccionada
 * @param session - Sesión activa del jugador
 */
export function showAllPanel(session: TeleportDDUISession): void {
  const player = session.player;
  const faction = session.faction;
  session.currentView = "all";
  session.closeReason = "user";

  let nextPanel: (() => void) | undefined = undefined;

  const factionTitle = (TeleportAllTexts.title as Record<string, string>)[faction] ?? "TODAS las Unidades";
  const factionLabel = getFactionLabel(faction);
  const form = new CustomForm(player, factionTitle);

  form.spacer();
  form.label(`§7Selecciona TODAS las unidades a teletransportar de ${factionLabel}§r:`);
  form.spacer();

  // Recuperar selección guardada de este menú si existe
  const savedAll = session.getAllMenuSelection(faction);

  // ===== SECCIÓN 1: Jerarquías Normales =====
  form.label("§7── Soldados NO Especiales ──");
  form.spacer();
  const basicDefault = savedAll?.hierarchies[0] ?? true;
  const leaderDefault = savedAll?.hierarchies[1] ?? true;
  const commanderDefault = savedAll?.hierarchies[2] ?? true;

  const basicObs = new ObservableBoolean(basicDefault, { clientWritable: true });
  const leaderObs = new ObservableBoolean(leaderDefault, { clientWritable: true });
  const commanderObs = new ObservableBoolean(commanderDefault, { clientWritable: true });

  form.toggle(stripColorCodes("§7Básicos"), basicObs);
  form.toggle(stripColorCodes("§eLíderes"), leaderObs);
  form.toggle(stripColorCodes("§6Comandantes"), commanderObs);

  // ===== SECCIÓN 2: Soldados Especiales por Buckets Activos =====
  const scanResult = scanActiveUnits(player.dimension, faction);
  const buckets = scanResult.buckets;

  const bucketOrder = [
    "commander_alpha1",
    "commander_delta1",
    "commander_other",
    "leader_any",
    "basic_any",
    "other_units",
  ];

  const nonEmptyBuckets = bucketOrder
    .filter((bId) => buckets[bId] && buckets[bId].unitCount > 0)
    .map((bId) => ({ id: bId, data: buckets[bId] }));

  // Mapa de nametag -> ObservableBoolean para especiales
  const specialToggleMap = new Map<string, ObservableBoolean>();

  if (nonEmptyBuckets.length > 0) {
    form.spacer();
    form.label("§e── Soldados Especiales ──");

    for (const bucket of nonEmptyBuckets) {
      form.spacer();
      form.label(`§e${bucket.data.label}:`);
      form.spacer();

      const sortedNametags = Object.keys(bucket.data.nametags).sort(compareNametags);
      for (const nametag of sortedNametags) {
        const count = bucket.data.nametags[nametag];
        const isSelected = savedAll ? savedAll.specialUnits.includes(nametag) : true;
        const countSuffix = count > 1 ? ` §8x${count}` : "";
        const label = `§7${nametag}${countSuffix}`;

        const obs = new ObservableBoolean(isSelected, { clientWritable: true });
        specialToggleMap.set(nametag, obs);
        form.toggle(stripColorCodes(label), obs);
      }
    }
  }

  // Campo de coordenadas de destino
  const coordsObs = new ObservableString("", { clientWritable: true });
  form.textField("Coordenadas destino (opcional):\n Ej: 100 64 -200 o ~ ~5 ~\n(vacío = tu posición actual)", coordsObs);

  form.spacer();

  // Helper para guardar el estado del formulario "TODAS"
  const saveAllState = (): {
    hierarchies: [boolean, boolean, boolean];
    selectedHierarchies: string[];
    selectedSpecialNametags: string[];
  } => {
    const isBasic = basicObs.getData();
    const isLeader = leaderObs.getData();
    const isCommander = commanderObs.getData();

    const selectedHierarchies: string[] = [];
    if (isBasic) selectedHierarchies.push(UnitHierarchy.BASIC);
    if (isLeader) selectedHierarchies.push(UnitHierarchy.LEADER);
    if (isCommander) selectedHierarchies.push(UnitHierarchy.COMMANDER);

    const selectedSpecialNametags: string[] = [];
    for (const [nametag, obs] of specialToggleMap) {
      if (obs.getData()) {
        selectedSpecialNametags.push(nametag);
      }
    }

    session.saveAllMenuSelection(faction, [isBasic, isLeader, isCommander], selectedSpecialNametags);

    return {
      hierarchies: [isBasic, isLeader, isCommander],
      selectedHierarchies,
      selectedSpecialNametags,
    };
  };

  // Botón Submit: Teletransportar TODAS las seleccionadas
  form.button(stripColorCodes(CommonTexts.submitButton), () => {
    session.closeReason = "navigation";

    const { selectedHierarchies, selectedSpecialNametags } = saveAllState();

    if (selectedHierarchies.length === 0 && selectedSpecialNametags.length === 0) {
      player.sendMessage("§c[TELEPORT] Debes seleccionar al menos una jerarquía o unidad especial.");
      nextPanel = () => showAllPanel(session);
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
        nextPanel = () => showAllPanel(session);
        form.close();
        return;
      }
      targetLocation = parsed;
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
      player.sendMessage(ResultMessages.noEntities(faction));
      form.close();
      return;
    }

    // Ejecutar teletransporte
    const result = teleportEntitiesToPlayer(allEntities, player, targetLocation);

    if (result.count > 0) {
      player.sendMessage(ResultMessages.success(result.count, faction));
      if (result.hasErrors && result.errors) {
        for (const errorMsg of result.errors) {
          player.sendMessage(`§c[TELEPORT] ${errorMsg}`);
        }
      }
    } else {
      player.sendMessage(ResultMessages.error);
    }
    form.close();
  });

  // Botón Volver
  form.button(stripColorCodes(CommonTexts.backButton), () => {
    session.closeReason = "navigation";
    saveAllState();
    nextPanel = () => showTypePanel(session);
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
      debug("teleportMenuDDUI", `Error en showAllPanel: ${err}`, {
        level: "error",
        color: "red",
      });
    });
}
