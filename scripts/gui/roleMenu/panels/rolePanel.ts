// scripts/gui/roleMenu/panels/rolePanel.ts

import { Player, system, world } from "@minecraft/server";
import { CustomForm, ObservableNumber, ObservableBoolean, ObservableString } from "@minecraft/server-ui";
import { debugWarn, debugMessage } from "../../../utils/debug.js";
import {
  PlayerPermissionManager,
  ROLE_DP_KEY_FOUNDATION,
  ROLE_DP_KEY_CHAOS,
  RoleId,
} from "../../shared/playerPermissionManager.js";
import { EquipmentDetector } from "../../shared/equipmentDetector.js";

const ROLE_OPTIONS: RoleId[] = ["member", "commander"];

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

    const buildForm = (selectedIndex: number): CustomForm => {
      const target = players[selectedIndex];
      const faction = EquipmentDetector.getActiveFaction(target);
      const foundationRole = PlayerPermissionManager.getPlayerRole(target, "foundation");
      const chaosRole = PlayerPermissionManager.getPlayerRole(target, "chaos");
      const isTargetAdmin = PlayerPermissionManager.isAdmin(target);

      const form = new CustomForm(admin, "§l§6GESTIÓN DE ROLES");

      form.spacer();
      playerObs = new ObservableNumber(selectedIndex, { clientWritable: true });
      form.dropdown(
        new ObservableString("Seleccionar jugador"),
        playerObs,
        playerNames.map((name, idx) => ({ label: name, value: idx }))
      );

      adminObs = new ObservableBoolean(isTargetAdmin, { clientWritable: true });
      form.toggle(new ObservableString("Administrador"), adminObs);

      factionLabel = new ObservableString(
        `§7Facción detectada: §f${faction ?? "Ninguna"} §7Casco: ${EquipmentDetector.getHelmetDisplayName(target)}`
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
        ROLE_OPTIONS.map((r, i) => ({ label: r, value: i }))
      );

      chaosObs = new ObservableNumber(ROLE_OPTIONS.indexOf(chaosRole) >= 0 ? ROLE_OPTIONS.indexOf(chaosRole) : 0, {
        clientWritable: true,
      });
      form.dropdown(
        new ObservableString("Rol Chaos"),
        chaosObs,
        ROLE_OPTIONS.map((r, i) => ({ label: r, value: i }))
      );
      form.spacer();

      playerObs.subscribe((newIndex: number) => {
        if (newIndex < 0 || newIndex >= players.length) return;
        const t = players[newIndex];
        const f = EquipmentDetector.getActiveFaction(t);
        const fRole = PlayerPermissionManager.getPlayerRole(t, "foundation");
        const cRole = PlayerPermissionManager.getPlayerRole(t, "chaos");
        const aRole = PlayerPermissionManager.isAdmin(t);

        factionLabel.setData(`§7Facción detectada: §f${f ?? "Ninguna"} (${EquipmentDetector.getHelmetDisplayName(t)})`);
        foundationObs.setData(ROLE_OPTIONS.indexOf(fRole) >= 0 ? ROLE_OPTIONS.indexOf(fRole) : 0);
        chaosObs.setData(ROLE_OPTIONS.indexOf(cRole) >= 0 ? ROLE_OPTIONS.indexOf(cRole) : 0);
        adminObs.setData(aRole);
      });

      form.button("Guardar", () => {
        const selectedPlayerIndex = playerObs.getData();
        if (selectedPlayerIndex < 0 || selectedPlayerIndex >= players.length) {
          debugWarn("roleMenu", "Índice de jugador inválido", "red");
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

        admin.sendMessage(`§a[SCPDystopia] Roles actualizados para §f${selectedPlayer.name}§a.`);
        debugMessage(
          "roleMenu",
          `Roles aplicados a ${selectedPlayer.name}: Foundation=${newFoundationRole}, Chaos=${newChaosRole}, admin=${newAdmin}`,
          "green"
        );
      });

      form.button("Cancelar", () => {
        form.close();
      });

      return form;
    };

    const initialIndex = 0;
    const form = buildForm(initialIndex);

    form
      .show()
      .then((reason) => {
        debugMessage("roleMenu", `Panel de roles cerrado: ${reason}`, "gray");
      })
      .catch((err) => {
        debugWarn("roleMenu", `Error en form.show() rolePanel: ${err}`, "red");
      });
  } catch (e) {
    debugWarn("roleMenu", `Error mostrando panel de roles: ${e}`, "red");
    admin.sendMessage("§c[SCPDystopia] Error abriendo el panel de roles.");
  }
}
