// scripts/gui/commandMenu/ddui/panels/mainPanel.ts

import { Player, system } from "@minecraft/server";
import { CustomForm, ObservableNumber, ObservableString } from "@minecraft/server-ui";
import { debugWarn, debugMessage } from "../../../../utils/debug.js";
import { PlayerPermissionManager, FactionId, RoleId } from "../../../shared/playerPermissionManager.js";
import { EquipmentDetector } from "../../../shared/equipmentDetector.js";
import {
  PANEL_TITLES,
  PANEL_DESCRIPTIONS,
  MAIN_PANEL_BUTTONS,
  FACTION_DISPLAY_NAMES,
  ROLE_LABELS,
  CATALOG_SYSTEMS,
  CATALOG_CATEGORIES,
  TARGET_FACTION_OPTIONS,
} from "../../../shared/systemCatalog.js";
import { showAdvancedPanel } from "./advancedPanel.js";
import { showGroupsPanel } from "./groupsPanel.js";
import { showHistoryPanel } from "./historyPanel.js";
import { showScopePanel } from "./scopePanel.js";
import {
  commandMenuSessionStore,
  CommandMenuSession,
} from "../sessionStore.js";
import { buildSystemView } from "../builders/systemBuilder.js";
import { stripColorCodes } from "../helpers/formHelpers.js";

export function showMainPanel(player: Player): void {
  try {
    const isAdmin = PlayerPermissionManager.isAdmin(player);
    const helmetFaction = EquipmentDetector.getActiveFaction(player);

    if (!helmetFaction && !isAdmin) {
      player.sendMessage("§c[SCPDystopia] Necesitas llevar el casco de tu facción para acceder al menú.");
      return;
    }

    const faction: FactionId = helmetFaction ?? "foundation";
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
      session = commandMenuSessionStore.create(player.id, player.name, player, isAdmin ? faction : (helmetFaction ?? faction), role);
    }

    const savedTarget = session.formState.targetFaction as string | undefined;
    let selectedFaction: string;
    if (isAdmin) {
      try {
        const adminSaved = player.getDynamicProperty("scpd_admin_target_faction");
        if (typeof adminSaved === "string" && (adminSaved === "foundation" || adminSaved === "chaos")) {
          selectedFaction = adminSaved;
        } else if (savedTarget && (savedTarget === "foundation" || savedTarget === "chaos")) {
          selectedFaction = savedTarget;
        } else {
          selectedFaction = helmetFaction ?? "foundation";
        }
      } catch {
        selectedFaction = savedTarget ?? helmetFaction ?? "foundation";
      }
    } else {
      selectedFaction = helmetFaction ?? faction;
    }

    debugMessage(
      "commandMenuDDUI",
      `Panel Principal para ${player.name}: faction=${faction}, role=${role}, admin=${isAdmin}, selectedFaction=${selectedFaction}`,
      "cyan"
    );

    let closeReason: "navigation" | undefined = undefined;

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
        selectedFaction = TARGET_FACTION_OPTIONS[index]?.value ?? "foundation";
        session.formState.targetFaction = selectedFaction;
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

    const nonAdvancedCategory = CATALOG_CATEGORIES.movement_patrol;
    const combatCategory = CATALOG_CATEGORIES.combat;

    if (nonAdvancedCategory) {
      for (const systemId of nonAdvancedCategory.systemIds) {
        const systemConfig = CATALOG_SYSTEMS[systemId];
        if (!systemConfig) continue;
        form.button(stripColorCodes(systemConfig.displayName), () => {
          closeReason = "navigation";
          form.close();
          system.run(() => buildSystemView({ systemId, player, targetFaction: selectedFaction })());
        });
      }
    }

    if (combatCategory) {
      for (const systemId of combatCategory.systemIds) {
        const systemConfig = CATALOG_SYSTEMS[systemId];
        if (!systemConfig) continue;
        form.button(stripColorCodes(systemConfig.displayName), () => {
          closeReason = "navigation";
          form.close();
          system.run(() => buildSystemView({ systemId, player, targetFaction: selectedFaction })());
        });
      }
    }

    form.button(stripColorCodes(MAIN_PANEL_BUTTONS.advanced), () => {
      closeReason = "navigation";
      form.close();
      system.run(() => showAdvancedPanel(player, selectedFaction));
    });

    form.divider();

    form.button(stripColorCodes(MAIN_PANEL_BUTTONS.groups), () => {
      closeReason = "navigation";
      form.close();
      system.run(() => showGroupsPanel(player, selectedFaction));
    });

    form.button(stripColorCodes(MAIN_PANEL_BUTTONS.history), () => {
      closeReason = "navigation";
      form.close();
      system.run(() => showHistoryPanel(player, selectedFaction));
    });

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
          } else {
            debugWarn("commandMenuDDUI", `Panel Principal cerrado: ServerClosed sin razón (${player.name})`, "yellow");
            commandMenuSessionStore.cleanup(player.id);
          }
        }
        closeReason = undefined;
      })
      .catch((err) => {
        debugWarn("commandMenuDDUI", `Error mostrando Panel Principal: ${err}`, "red");
          commandMenuSessionStore.cleanup(player.id);
      });
  } catch (e) {
    debugWarn("commandMenuDDUI", `Error en showMainPanel: ${e}`, "red");
  }
}
