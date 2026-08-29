// scripts/gui/commandMenu/ddui/panels/mainPanel.ts

import { Player, system } from "@minecraft/server";
import { CustomForm, ObservableNumber, ObservableString } from "@minecraft/server-ui";
import { debugWarn, debugMessage } from "../../../../utils/debug.js";
import { getRoleInfo } from "../helpers/roleHelpers.js";
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
  cleanupSession,
  pauseSession,
  createSession,
  commandMenuSessionStore,
  CommandMenuSession,
} from "../sessionStore.js";
import { buildSystemView } from "../builders/systemBuilder.js";
import { stripColorCodes } from "../helpers/formHelpers.js";

export function showMainPanel(player: Player): void {
  try {
    const roleInfo = getRoleInfo(player);
    if (!roleInfo) {
      player.sendMessage("§c[SCPDystopia] No se pudo determinar tu rol.");
      return;
    }

    const { faction, role } = roleInfo;
    const isAdmin = true;

    const existingSession = commandMenuSessionStore.get(player.id);
    let session: CommandMenuSession;
    if (existingSession) {
      session = existingSession;
      session.role = role;
      if (!isAdmin) {
        session.faction = faction;
      }
    } else {
      session = createSession(player.id, player.name, faction, role);
    }

    const savedTarget = session.formState.targetFaction as string | undefined;
    let selectedFaction: string;
    if (isAdmin) {
      selectedFaction = savedTarget ?? "foundation";
    } else {
      selectedFaction = faction;
    }

    debugMessage(
      "commandMenuDDUI",
      `Panel Principal para ${player.name}: faction=${faction}, role=${role}, admin=true, selectedFaction=${selectedFaction}`,
      "cyan"
    );

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
      });
    }

    form.spacer();

    const nonAdvancedCategory = CATALOG_CATEGORIES.movement_patrol;
    const combatCategory = CATALOG_CATEGORIES.combat;

    if (nonAdvancedCategory) {
      for (const systemId of nonAdvancedCategory.systemIds) {
        const systemConfig = CATALOG_SYSTEMS[systemId];
        if (!systemConfig) continue;
        form.button(stripColorCodes(systemConfig.displayName), () => {
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
          form.close();
          system.run(() => buildSystemView({ systemId, player, targetFaction: selectedFaction })());
        });
      }
    }

    form.button(stripColorCodes(MAIN_PANEL_BUTTONS.advanced), () => {
      form.close();
      system.run(() => showAdvancedPanel(player, selectedFaction));
    });

    form.divider();

    form.button(stripColorCodes(MAIN_PANEL_BUTTONS.groups), () => {
      form.close();
      system.run(() => showGroupsPanel(player, selectedFaction));
    });

    form.button(stripColorCodes(MAIN_PANEL_BUTTONS.history), () => {
      form.close();
      system.run(() => showHistoryPanel(player, selectedFaction));
    });

    form
      .show()
      .then((reason) => {
        debugMessage("commandMenuDDUI", `Panel Principal cerrado: ${reason}`, "gray");
        if (reason === "ClientClosed") {
          pauseSession(player.id);
        }
      })
      .catch((err) => {
        debugWarn("commandMenuDDUI", `Error mostrando Panel Principal: ${err}`, "red");
        cleanupSession(player.id);
      });
  } catch (e) {
    debugWarn("commandMenuDDUI", `Error en showMainPanel: ${e}`, "red");
  }
}
