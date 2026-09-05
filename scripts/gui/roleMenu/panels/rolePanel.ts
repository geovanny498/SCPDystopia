// scripts/gui/roleMenu/panels/rolePanel.ts

import { Player, world } from "@minecraft/server";
import {
  CustomForm,
  ObservableNumber,
  ObservableBoolean,
  ObservableString,
  DataDrivenScreenClosedReason,
} from "@minecraft/server-ui";
import {
  PANEL_TITLES,
  ROLE_LABELS,
  BACK_BUTTON_LABEL,
  FACTION_DISPLAY_NAMES,
  ERROR_MESSAGES,
} from "../../shared/systemCatalog.js";
import { DDUIFeedbackPresenter } from "../../shared/dduiFeedback.js";
import { stripColorCodes } from "../../commandMenu/ddui/helpers/formHelpers.js";
import { debugWarn, debugMessage } from "../../../utils/debug.js";
import {
  PlayerPermissionManager,
  ROLE_DP_KEY_FOUNDATION,
  ROLE_DP_KEY_CHAOS,
  RoleId,
} from "../../shared/playerPermissionManager.js";
import { EquipmentDetector } from "../../shared/equipmentDetector.js";

const ROLE_OPTIONS: RoleId[] = ["member", "commander"];

const ROLE_DESCRIPTIONS: Record<RoleId, string> = {
  member: "§7Acceso sólo a configuracion básica de algunas unidades de su facción",
  commander: "§6Acceso completo a la configuración de unidades de su facción",
  admin: "§7Acceso completo a todos los menús del addon, sin importar facción ni roles asignados",
};

export function showRolePanel(admin: Player): void {
  try {
    const players = world.getPlayers();
    if (players.length === 0) {
      admin.sendMessage("§c[SCPDystopia] No hay jugadores online.");
      return;
    }

    const playerNames = players.map((p) => p.name);

    let playerObs: ObservableNumber;
    let foundationObs: ObservableNumber;
    let chaosObs: ObservableNumber;
    let adminObs: ObservableBoolean;
    let factionLabel: ObservableString;

    const feedbackPresenter = new DDUIFeedbackPresenter(admin.id, "roleMenu:panel", null, "§7Vista: §rN/A");

    const buildForm = (selectedIndex: number): CustomForm => {
      const target = players[selectedIndex];
      const faction = EquipmentDetector.getActiveFaction(target);
      const foundationRole = PlayerPermissionManager.getPlayerRole(target, "foundation");
      const chaosRole = PlayerPermissionManager.getPlayerRole(target, "chaos");
      const isTargetAdmin = PlayerPermissionManager.isAdmin(target);

      const form = new CustomForm(admin, PANEL_TITLES.roleMenu);

      form.spacer();
      playerObs = new ObservableNumber(selectedIndex, { clientWritable: true });
      form.dropdown(
        new ObservableString("Seleccionar jugador"),
        playerObs,
        playerNames.map((name, idx) => ({ label: name, value: idx }))
      );

      adminObs = new ObservableBoolean(isTargetAdmin, { clientWritable: true });
      form.toggle(new ObservableString("Administrador"), adminObs, {
        description: stripColorCodes(ROLE_DESCRIPTIONS.admin),
      });

      factionLabel = new ObservableString(
        `§7Facción: §r${FACTION_DISPLAY_NAMES[faction ?? ""] ?? "§8Ninguna"}§r\n§7Casco: §r${EquipmentDetector.getHelmetDisplayLabel(target)}`
      );
      form.spacer();
      form.label(factionLabel);
      form.spacer();

      foundationObs = new ObservableNumber(
        ROLE_OPTIONS.indexOf(foundationRole) >= 0 ? ROLE_OPTIONS.indexOf(foundationRole) : 0,
        { clientWritable: true }
      );
      form.dropdown(
        new ObservableString("Rol Foundation"),
        foundationObs,
        ROLE_OPTIONS.map((r, i) => ({
          label: stripColorCodes(ROLE_LABELS[r] ?? r),
          value: i,
          description: stripColorCodes(ROLE_DESCRIPTIONS[r]),
        }))
      );

      chaosObs = new ObservableNumber(ROLE_OPTIONS.indexOf(chaosRole) >= 0 ? ROLE_OPTIONS.indexOf(chaosRole) : 0, {
        clientWritable: true,
      });
      form.dropdown(
        new ObservableString("Rol Chaos"),
        chaosObs,
        ROLE_OPTIONS.map((r, i) => ({
          label: stripColorCodes(ROLE_LABELS[r] ?? r),
          value: i,
          description: stripColorCodes(ROLE_DESCRIPTIONS[r]),
        }))
      );
      form.spacer();

      form.label(feedbackPresenter.getObservable());
      form.spacer();

      playerObs.subscribe((newIndex: number) => {
        if (newIndex < 0 || newIndex >= players.length) return;
        const t = players[newIndex];
        const f = EquipmentDetector.getActiveFaction(t);
        const fRole = PlayerPermissionManager.getPlayerRole(t, "foundation");
        const cRole = PlayerPermissionManager.getPlayerRole(t, "chaos");
        const aRole = PlayerPermissionManager.isAdmin(t);

        factionLabel.setData(
          `§lFacción: §r${FACTION_DISPLAY_NAMES[f ?? ""] ?? "§8Ninguna"}§r\n§lCasco: §r${EquipmentDetector.getHelmetDisplayLabel(t)}`
        );
        foundationObs.setData(ROLE_OPTIONS.indexOf(fRole) >= 0 ? ROLE_OPTIONS.indexOf(fRole) : 0);
        chaosObs.setData(ROLE_OPTIONS.indexOf(cRole) >= 0 ? ROLE_OPTIONS.indexOf(cRole) : 0);
        adminObs.setData(aRole);
      });

      form.button("Guardar", () => {
        const selectedPlayerIndex = playerObs.getData();
        if (selectedPlayerIndex < 0 || selectedPlayerIndex >= players.length) {
          debugWarn("roleMenu", "Índice de jugador inválido", "red");
          feedbackPresenter.present({
            context: "Guardar",
            value: "§c[SCPDystopia] Error: índice de jugador inválido.",
            status: "error",
          });
          return;
        }

        const selectedPlayer = players[selectedPlayerIndex];
        const newFoundationRole = ROLE_OPTIONS[foundationObs.getData()] ?? "member";
        const newChaosRole = ROLE_OPTIONS[chaosObs.getData()] ?? "member";
        const newAdmin = adminObs.getData();

        PlayerPermissionManager.setRolesBatch(selectedPlayer, {
          [ROLE_DP_KEY_FOUNDATION]: newFoundationRole,
          [ROLE_DP_KEY_CHAOS]: newChaosRole,
          scpd_role_admin: newAdmin ? true : null,
        });

        feedbackPresenter.present({
          context: `§a${selectedPlayer.name}§r`,
          value: `\nFoundation: §${newFoundationRole === "commander" ? "6" : "7"}${ROLE_LABELS[newFoundationRole]} \n§2Chaos: §${newChaosRole === "commander" ? "6" : "7"}${ROLE_LABELS[newChaosRole]} \n§cAdmin: §${newAdmin ? "c" : "7"}${newAdmin ? "Sí" : "No"}§r`,
          status: "ok",
        });

        admin.sendMessage(`§a[SCPDystopia] Roles actualizados para §f${selectedPlayer.name}§a.`);
        debugMessage(
          "roleMenu",
          `Roles aplicados a ${selectedPlayer.name}: Foundation=${newFoundationRole}, Chaos=${newChaosRole}, admin=${newAdmin}`,
          "green"
        );
      });

      form.button(stripColorCodes(BACK_BUTTON_LABEL), () => {
        form.close();
      });

      return form;
    };

    const initialIndex = 0;
    const form = buildForm(initialIndex);

    form
      .show()
      .then((reason: DataDrivenScreenClosedReason) => {
        if (reason === "UserBusy") {
          debugWarn("roleMenu", `Panel de roles: UserBusy (${admin.name})`, "yellow");
        } else if (reason === "ClientClosed") {
          debugMessage("roleMenu", `Panel de roles cerrado por el cliente (${admin.name})`, "gray");
        } else if (reason === "ServerClosed") {
          debugMessage("roleMenu", `Panel de roles cerrado por el servidor (${admin.name})`, "gray");
        }
        feedbackPresenter.reset();
      })
      .catch((err) => {
        debugWarn("roleMenu", `Error mostrando panel de roles: ${err}`, "red");
        feedbackPresenter.reset();
      });
  } catch (e) {
    debugWarn("roleMenu", `Error mostrando panel de roles: ${e}`, "red");
    admin.sendMessage("§c[SCPDystopia] Error abriendo el panel de roles.");
  }
}
