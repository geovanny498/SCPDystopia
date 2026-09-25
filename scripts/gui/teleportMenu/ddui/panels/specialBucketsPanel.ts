// scripts/gui/teleportMenu/ddui/panels/specialBucketsPanel.ts

/**
 * Panel de Buckets de Soldados Especiales DDUI
 * Escanea las unidades activas en la dimensión y muestra los buckets no vacíos
 * con la cantidad de nametags disponibles.
 */

import { system } from "@minecraft/server";
import { CustomForm } from "@minecraft/server-ui";
import { SpecialSoldiersTexts, CommonTexts } from "../../teleport_config.js";
import { FINAL_BUCKET_ORDER, scanActiveUnits } from "../../../commandMenu/menu_config.js";
import { debug } from "../../../../utils/debug.js";
import { stripColorCodes } from "../../../commandMenu/ddui/helpers/formHelpers.js";
import { TeleportDDUISession } from "../sessionStore.js";
import { showMainPanel } from "./mainPanel.js";
import { showSpecialTogglesPanel } from "./specialTogglesPanel.js";

/**
 * Muestra el panel de buckets de unidades especiales
 * @param session - Sesión activa del jugador
 */
export function showSpecialBucketsPanel(session: TeleportDDUISession): void {
  const player = session.player;
  const faction = session.faction;
  session.currentView = "special_buckets";
  session.closeReason = "user";

  let nextPanel: (() => void) | undefined = undefined;

  const title = (SpecialSoldiersTexts.title as Record<string, string>)[faction] ?? "Soldados Especiales";
  const form = new CustomForm(player, title);

  // Escanear entidades activas en la dimensión del jugador
  const scanResult = scanActiveUnits(player.dimension, faction);
  const buckets = scanResult.buckets;

  // Orden fijo de buckets según arquitectura legacy
  // Filtrar buckets que tengan al menos una unidad activa
  const nonEmptyBuckets = FINAL_BUCKET_ORDER
    .filter((bId) => buckets[bId] && buckets[bId].unitCount > 0)
    .map((bId) => ({ id: bId, data: buckets[bId] }));

  if (nonEmptyBuckets.length === 0) {
    // Si no hay especiales activas, mostrar mensaje informativo y botón de volver
    form.spacer();
    form.label(
      "§c§lNo hay unidades especiales activas en esta facción\n\n§7No se encontraron unidades con nametag en esta dimensión."
    );
    form.spacer();

    form.button(stripColorCodes(CommonTexts.backButton), () => {
      session.closeReason = "navigation";
      nextPanel = () => showMainPanel(session);
      form.close();
    });

    session.setForm(form);
    form
      .show()
      .then((reason) => {
        session.setForm(undefined);
        if (reason === "ServerClosed" && session.closeReason === "navigation") {
          system.run(() => {
            nextPanel?.();
          });
        }
      })
      .catch((err) => {
        session.setForm(undefined);
        debug("teleportMenuDDUI", `Error en showSpecialBucketsPanel (empty): ${err}`, {
          level: "error",
          color: "red",
        });
      });
    return;
  }

  form.spacer();
  form.label(SpecialSoldiersTexts.description);
  form.spacer();

  // Generar botones para cada bucket disponible
  for (const bucket of nonEmptyBuckets) {
    const label = `${bucket.data.label} §8(${bucket.data.unitCount} nametags)`;
    form.button(stripColorCodes(label), () => {
      session.closeReason = "navigation";
      session.activeBucketId = bucket.id;
      nextPanel = () => showSpecialTogglesPanel(session, bucket.id, bucket.data);
      form.close();
    });
  }

  // Botón Volver al menú de tipo
  form.button(stripColorCodes(CommonTexts.backButton), () => {
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
        debug("teleportMenuDDUI", `Panel Buckets cerrado por cliente (§b${player.name}§r)`, {
          level: "debug",
          color: "gray",
        });
      } else if (reason === "UserBusy") {
        debug("teleportMenuDDUI", `Panel Buckets cerrado: UserBusy (§b${player.name}§r)`, {
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
      debug("teleportMenuDDUI", `Error en showSpecialBucketsPanel: ${err}`, {
        level: "error",
        color: "red",
      });
    });
}
