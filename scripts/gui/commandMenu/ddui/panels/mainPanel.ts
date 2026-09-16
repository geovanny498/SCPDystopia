// scripts/gui/commandMenu/ddui/panels/mainPanel.ts

import { Player, system } from "@minecraft/server";
import { CustomForm, ObservableNumber, ObservableString } from "@minecraft/server-ui";
import { debugWarn, debugMessage } from "../../../../utils/debug.js";
import { Factions, TargetFaction } from "../../../../constants/domains.js";
import { PlayerPermissionManager, FactionId, RoleId } from "../../../shared/playerPermissionManager.js";
import { EquipmentDetector } from "../../../shared/equipmentDetector.js";
import {
  PANEL_TITLES,
  PANEL_DESCRIPTIONS,
  MAIN_PANEL_BUTTONS,
  FACTION_DISPLAY_NAMES,
  ROLE_LABELS,
  CATALOG_CATEGORIES,
  CATALOG_SYSTEMS,
  MENU_CONFIG,
  CategoryIds,
  TARGET_FACTION_OPTIONS,
  ERROR_MESSAGES,
  isSystemVisibleForRole,
  isMenuFeatureVisible,
} from "../../../shared/systemCatalog.js";
import { showAdvancedPanel } from "./advancedPanel.js";
import { showGroupsPanel } from "./groupsPanel.js";
import { showHistoryPanel } from "./historyPanel.js";
import { showScopePanel } from "./scopePanel.js";
import { commandMenuSessionStore, CommandMenuSession } from "../sessionStore.js";
import { buildSystemView } from "../builders/systemBuilder.js";
import { stripColorCodes } from "../helpers/formHelpers.js";

export function showMainPanel(player: Player, rememberedTargetFaction?: TargetFaction): void {
  try {
    const isAdmin = PlayerPermissionManager.isAdmin(player);
    const helmetFaction = EquipmentDetector.getActiveFaction(player);

    if (!helmetFaction && !isAdmin) {
      player.sendMessage(ERROR_MESSAGES.NEED_FACTION_HELMET);
      return;
    }

    const faction: FactionId = helmetFaction ?? Factions.FOUNDATION;
    const role: RoleId = isAdmin ? "admin" : PlayerPermissionManager.getPlayerRole(player, faction);

    const existingSession = commandMenuSessionStore.get(player.id);
    let session: CommandMenuSession;
    if (existingSession) {
      session = existingSession;
      session.role = role;
      if (!isAdmin) {
        session.faction = helmetFaction ?? faction;
      }
    } else {
      session = commandMenuSessionStore.create(
        player.id,
        player.name,
        player,
        isAdmin ? faction : (helmetFaction ?? faction),
        role
      );
    }

    const savedTarget = session.getTargetFaction();
    let selectedFaction: TargetFaction;
    if (isAdmin) {
      try {
        const adminSaved = player.getDynamicProperty("scpd_admin_target_faction");
        const validTargets: TargetFaction[] = [Factions.FOUNDATION, Factions.CHAOS, "both"];
        if (typeof adminSaved === "string" && (validTargets as string[]).includes(adminSaved)) {
          selectedFaction = adminSaved as TargetFaction;
        } else if (savedTarget && (validTargets as string[]).includes(savedTarget)) {
          selectedFaction = savedTarget;
        } else if (rememberedTargetFaction && (validTargets as string[]).includes(rememberedTargetFaction)) {
          selectedFaction = rememberedTargetFaction;
        } else {
          selectedFaction = (helmetFaction ?? Factions.FOUNDATION) as TargetFaction;
        }
      } catch {
        selectedFaction = savedTarget ?? ((helmetFaction ?? Factions.FOUNDATION) as TargetFaction);
      }
    } else {
      selectedFaction = (helmetFaction ?? Factions.FOUNDATION) as TargetFaction;
    }

    const effectiveRole: RoleId = isAdmin
      ? "admin"
      : PlayerPermissionManager.getPlayerRole(player, selectedFaction as FactionId);

    debugMessage(
      "commandMenuDDUI",
      `Panel Principal para ${player.name}: faction=${faction}, role=${role}, admin=${isAdmin}, selectedFaction=${selectedFaction}`,
      "cyan"
    );

    let closeReason: "navigation" | undefined = undefined;
    let nextPanel: (() => void) | undefined = undefined;

    const form = new CustomForm(player, PANEL_TITLES.main);

    const factionLabelText = new ObservableString(`§7Facción: §f${FACTION_DISPLAY_NAMES[selectedFaction]}`);
    form.spacer();
    form.label(factionLabelText);
    form.spacer();
    form.label(`§6Rol: §f${ROLE_LABELS[role]}`);

    if (isAdmin) {
      const initialIndex = TARGET_FACTION_OPTIONS.findIndex((opt) => opt.value === selectedFaction);
      const factionObs = new ObservableNumber(initialIndex >= 0 ? initialIndex : 0, { clientWritable: true });
      form.spacer();
      form.dropdown(
        stripColorCodes("§7Facción objetivo:"),
        factionObs,
        TARGET_FACTION_OPTIONS.map((opt, idx) => ({ label: stripColorCodes(opt.label), value: idx }))
      );
      factionObs.subscribe((index) => {
        selectedFaction = (TARGET_FACTION_OPTIONS[index]?.value ?? Factions.FOUNDATION) as TargetFaction;
        session.setTargetFaction(selectedFaction);
        factionLabelText.setData(`§7Facción: §f${FACTION_DISPLAY_NAMES[selectedFaction]}`);
        try {
          player.setDynamicProperty("scpd_admin_target_faction", selectedFaction);
        } catch {
          // DP no disponible
        }
      });
    }

    // session.startHelmetWatch((currentFaction) => {
    //   if (!isAdmin && currentFaction) {
    //     session.stopHelmetWatch();
    //     try {
    //       form.close();
    //     } catch {
    //       // ya cerrado
    //     }
    //     system.run(() => showMainPanel(player));
    //   }
    // });

    form.spacer();

    // Categorías "inline" del panel principal: deriva el orden y el conjunto
    // de categorías de MENU_CONFIG.categoryOrder (fuente única de verdad).
    // Excluye ADVANCED: en DDUI es un sub-panel (abre `advancedPanel`), no
    // botones de sistema inline. Añadir/reordenar una categoría "inline-capable"
    // en el catálogo se refleja aquí sin tocar este builder.
    const inlineCategoryIds = MENU_CONFIG.categoryOrder.filter((id) => id !== CategoryIds.ADVANCED);

    for (const catId of inlineCategoryIds) {
      const category = CATALOG_CATEGORIES[catId];
      if (!category) continue;
      for (const systemId of category.systemIds) {
        const systemConfig = CATALOG_SYSTEMS[systemId];
        if (!systemConfig) continue;
        if (!isSystemVisibleForRole(systemConfig, effectiveRole)) continue;
        form.button(stripColorCodes(systemConfig.displayName), () => {
          closeReason = "navigation";
          nextPanel = () => buildSystemView({ systemId, player, targetFaction: selectedFaction })();
          form.close();
        });
      }
    }

    // `divider` separa los sistemas inline (movement/fire/armamento) de los
    // botones de navegacion a sub-panel (advanced/groups/history). Fijo: los
    // sistemas inline siempre estan presentes (minRole: member).
    form.divider();

    form.button(stripColorCodes(MAIN_PANEL_BUTTONS.advanced), () => {
      closeReason = "navigation";
      nextPanel = () => showAdvancedPanel(player, selectedFaction);
      form.close();
    });

    form.button(stripColorCodes(MAIN_PANEL_BUTTONS.groups), () => {
      closeReason = "navigation";
      nextPanel = () => showGroupsPanel(player, selectedFaction);
      form.close();
    });

    if (isMenuFeatureVisible("history", effectiveRole, isAdmin, selectedFaction)) {
      form.button(stripColorCodes(MAIN_PANEL_BUTTONS.history), () => {
        closeReason = "navigation";
        nextPanel = () => showHistoryPanel(player, selectedFaction);
        form.close();
      });
    }

    form
      .show()
      .then((reason) => {
        if (reason === "ClientClosed") {
          debugMessage("commandMenuDDUI", `Panel Principal cerrado: X del cliente (${player.name})`, "gray");
          commandMenuSessionStore.cleanup(player.id);
        } else if (reason === "UserBusy") {
          debugWarn("commandMenuDDUI", `Panel Principal cerrado: UserBusy (${player.name})`, "yellow");
          commandMenuSessionStore.cleanup(player.id);
        } else if (reason === "ServerClosed") {
          if (closeReason === "navigation") {
            debugMessage("commandMenuDDUI", `Panel Principal cerrado: navegación (${player.name})`, "gray");
            session.stopHelmetWatch();
            nextPanel?.();
          } else {
            debugWarn("commandMenuDDUI", `Panel Principal cerrado: ServerClosed sin razón (${player.name})`, "yellow");
            commandMenuSessionStore.cleanup(player.id);
          }
        }
        closeReason = undefined;
        nextPanel = undefined;
      })
      .catch((err) => {
        debugWarn("commandMenuDDUI", `Error mostrando Panel Principal: ${err}`, "red");
        commandMenuSessionStore.cleanup(player.id);
      });
  } catch (e) {
    debugWarn("commandMenuDDUI", `Error en showMainPanel: ${e}`, "red");
  }
}
