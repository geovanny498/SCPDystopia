// scripts/gui/gui.ts
import { world, system, EquipmentSlot, Player, Entity } from "@minecraft/server";
import { ActionFormData, ActionFormResponse, ModalFormData } from "@minecraft/server-ui";
import config, { MenuCategory, EntitySpecificConfig } from "./config.js";
import { debugWarn } from "../utils/debug.js";

// Utilizar la misma configuración que el menú de comandos para detectar
// qué eventos son de taming y mapear cambios de sistema en la entidad
import {
  isAutoTameEvent,
  findSystemStateByEvent,
  getEntitySystemsStatus,
  setEntitySystemState,
  SpecialGroupLabels,
  UnitHierarchyLabels,
} from "./commandMenu/menu_config.js";
import { getEntityFactionInfo } from "./commandMenu/model/menu_faction.js";
import { tryAutoTame } from "./commandMenu/core/menu_apply.js";

interface EntityConfig {
  specific: MenuCategory[];
  global: MenuCategory[];
  merged: MenuCategory[];
}

// Helpers de sistema/ids para filtrado por `config.global_rules`.
function makeSystemId(cat: MenuCategory | null | undefined): string | null {
  if (!cat) return null;
  if (cat.id) return String(cat.id);
  const name = String(cat.category || "").toLowerCase();
  return `auto:${name.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")}`;
}

function isAllowedByRule(sysId: string | null, typeId: string): boolean {
  if (!sysId) return true;
  if (!config.global_rules || !config.global_rules[sysId]) return true;
  const rule = config.global_rules[sysId];
  if (!rule) return true;

  const mode = rule.mode;
  const list = Array.isArray(rule.list) ? rule.list : [];
  const inList = list.indexOf(typeId) !== -1;

  if (mode === "whitelist") return inList;
  if (mode === "blacklist") return !inList;
  return true;
}

function shouldIncludeCategoryForEntity(cat: MenuCategory, typeId: string): boolean {
  const sysId = makeSystemId(cat);
  return isAllowedByRule(sysId, typeId);
}

/**
 * Devuelve las categorías separadas en:
 * - specific: categorías específicas de la entidad
 * - global: categorías globales
 * - merged: orden final según insertAt / replace
 */
function getSpecificConfig(typeId: string): EntitySpecificConfig | undefined {
  if (!config.specific || typeof config.specific !== "object") return undefined;
  if (Object.prototype.hasOwnProperty.call(config.specific, typeId)) {
    return config.specific[typeId];
  }

  for (const spec of Object.values(config.specific)) {
    if (!spec || typeof spec !== "object") continue;
    if (Array.isArray(spec.ids) && spec.ids.includes(typeId)) {
      return spec;
    }
  }

  for (const key of Object.keys(config.specific)) {
    if (!key.includes(",")) continue;
    const ids = key
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item);
    if (ids.includes(typeId)) {
      return config.specific[key];
    }
  }

  return undefined;
}

function getConfigForEntity(typeId: string): EntityConfig | null {
  const globalCats = config.global && Array.isArray(config.global.categories) ? [...config.global.categories] : [];

  // Resolver si la entidad está permitida
  let entVal: boolean | { enabled?: boolean } | undefined = undefined;
  let groupName: string | null = null;

  if (config.entities && typeof config.entities === "object") {
    for (const gName of Object.keys(config.entities)) {
      const group = config.entities[gName];
      if (group && Object.prototype.hasOwnProperty.call(group, typeId)) {
        entVal = group[typeId];
        groupName = gName;
        break;
      }
    }
  }

  if (entVal === undefined) return null;

  let allowed = true;
  if (typeof entVal === "boolean") {
    allowed = entVal;
  } else {
    // En este punto, entVal debe ser un objeto con enabled opcional
    const objVal = entVal as { enabled?: boolean };
    allowed = objVal.enabled !== undefined ? Boolean(objVal.enabled) : true;
  }

  if (!allowed) {
    debugWarn(
      "playerInteractWithEntity",
      `menu blocked by config.entities[${groupName}].${typeId} = ${JSON.stringify(entVal)}`,
      "blue"
    );
    return null;
  }

  const spec: EntitySpecificConfig | undefined = getSpecificConfig(typeId);
  const specificCats = spec && Array.isArray(spec.categories) ? [...spec.categories] : [];

  // Aplicar filtrado a las categorías globales según `global_rules`.
  // Para categorías que apuntan a `submenu`, no bloqueamos la categoría
  // salvo que la categoría principal tenga su propia `id` denegada o
  // todas las categorías del submenu queden filtradas.
  const filteredGlobalCats: MenuCategory[] = [];
  for (const c of globalCats) {
    if (c && c.submenu) {
      // Si la categoría principal tiene id y está denegada, excluirla
      if (c.id && !isAllowedByRule(c.id, typeId)) continue;

      const submenuCfg = config.submenus && config.submenus[c.submenu];
      const submenuCats = submenuCfg && Array.isArray(submenuCfg.categories) ? submenuCfg.categories : [];
      const filteredSub = submenuCats.filter((sc) => shouldIncludeCategoryForEntity(sc, typeId));
      if (!filteredSub.length) continue; // submenu vacío -> ocultar la categoría

      // mantener la categoría (no modificar objeto original)
      filteredGlobalCats.push({ ...c });
    } else {
      if (shouldIncludeCategoryForEntity(c, typeId)) filteredGlobalCats.push({ ...c });
    }
  }

  let merged: MenuCategory[] = [];

  if (spec && spec.replace) {
    merged = [...specificCats];
  } else if (specificCats.length) {
    const insertAt = spec && spec.insertAt === "start" ? "start" : "end";
    merged = insertAt === "start" ? specificCats.concat(filteredGlobalCats) : filteredGlobalCats.concat(specificCats);
  } else {
    merged = [...filteredGlobalCats];
  }

  debugWarn(
    "playerInteractWithEntity",
    `resolved categories for ${typeId}: specific=${specificCats.length}, global=${globalCats.length}, merged=${merged.length}`
  );

  return {
    specific: specificCats,
    global: spec && spec.replace ? [] : filteredGlobalCats,
    merged,
  };
}

const ENTITY_GLOBAL_OVERWRITE_PROPERTY = "scpd_menu_config_allow_global_overwrite";

function itemMatches(mainId: string | null, opener: string): boolean {
  if (!mainId || !opener) return false;
  if (opener.includes(":")) return mainId === opener;

  const parts = mainId.split(":");
  const short = parts.length > 1 ? parts[1] : parts[0];
  return short === opener || mainId === opener || mainId.endsWith(`:${opener}`);
}

function normalizeBooleanDynamicProperty(raw: unknown): boolean | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (raw === true || raw === "true" || raw === 1 || raw === "1") return true;
  if (raw === false || raw === "false" || raw === 0 || raw === "0") return false;
  return undefined;
}

function isTruthyToggleValue(raw: unknown): boolean {
  const normalized = normalizeBooleanDynamicProperty(raw);
  return normalized === undefined ? false : normalized;
}

function isGlobalOverwriteAllowed(entity: Entity): boolean {
  try {
    const raw = entity.getDynamicProperty(ENTITY_GLOBAL_OVERWRITE_PROPERTY);
    const normalized = normalizeBooleanDynamicProperty(raw);
    return normalized === undefined ? true : normalized;
  } catch (e) {
    debugWarn("playerInteractWithEntity", `Error reading overwrite property: ${e}`, "yellow");
    return true;
  }
}

function setGlobalOverwriteAllowed(entity: Entity, value: boolean): void {
  try {
    entity.setDynamicProperty(ENTITY_GLOBAL_OVERWRITE_PROPERTY, value);
  } catch (e) {
    debugWarn("playerInteractWithEntity", `Error setting overwrite property: ${e}`, "red");
  }
}

function buildEntityOverwriteStatus(entity: Entity): string {
  return isGlobalOverwriteAllowed(entity) ? "permitir" : "bloquear";
}

/**
 * Muestra el menú de categorías principal
 */
function showCategoryMenu(
  player: Player,
  entity: Entity,
  cfg: EntityConfig,
  soldierName: string,
  displayName: string,
  typeId: string
): void {
  const catForm = new ActionFormData().title("SCPDystopia | Interacciones").body(`§7Unidad:§r ${soldierName}`);

  const categoryButtonMap: MenuCategory[] = [];

  if (cfg.specific.length && cfg.merged[0] === cfg.specific[0]) {
    catForm.label("§8- Opciones específicas -§r");
    for (const cat of cfg.specific) {
      catForm.button(cat.category);
      categoryButtonMap.push(cat);
    }

    if (cfg.global.length) {
      catForm.divider();
      catForm.label("§7- Opciones globales -§r");
      for (const cat of cfg.global) {
        catForm.button(cat.category);
        categoryButtonMap.push(cat);
      }
    }
  } else {
    if (cfg.global.length) {
      catForm.label("§7- Opciones globales -§r");
      for (const cat of cfg.global) {
        catForm.button(cat.category);
        categoryButtonMap.push(cat);
      }
    }

    if (cfg.specific.length) {
      catForm.divider();
      catForm.label("§8- Opciones específicas -§r");
      for (const cat of cfg.specific) {
        catForm.button(cat.category);
        categoryButtonMap.push(cat);
      }
    }
  }

  catForm.show(player).then((catRes: ActionFormResponse) => {
    // Si el usuario canceló en el menú principal, simplemente cerrar
    if (!catRes || catRes.canceled) return;

    const index = typeof catRes.selection === "number" ? catRes.selection : -1;
    const group = categoryButtonMap[index];
    if (!group) return;

    handleCategorySelection(player, entity, group, cfg, soldierName, displayName, typeId);
  });
}

/**
 * Maneja la selección de una categoría (submenu o entries directas)
 */
function handleCategorySelection(
  player: Player,
  entity: Entity,
  group: MenuCategory,
  cfg: EntityConfig,
  soldierName: string,
  displayName: string,
  typeId: string
): void {
  if (group.submenu) {
    const submenuId = group.submenu;
    const submenuCfg = config.submenus && config.submenus[submenuId];

    if (!submenuCfg || !Array.isArray(submenuCfg.categories) || !submenuCfg.categories.length) {
      debugWarn("playerInteractWithEntity", `submenu ${submenuId} not found or empty`, "blue");
      return;
    }

    const rawSubCats = Array.isArray(submenuCfg.categories) ? submenuCfg.categories : [];
    const filteredSubCats = rawSubCats.filter((sc) => shouldIncludeCategoryForEntity(sc, typeId));

    if (!filteredSubCats.length) {
      debugWarn("playerInteractWithEntity", `submenu ${submenuId} empty after filtering`, "blue");
      return;
    }

    const submenuForm = new ActionFormData().title(group.category).body(`§7Unidad:§r ${soldierName}`);

    const submenuButtonMap: MenuCategory[] = [];
    for (const subCat of filteredSubCats) {
      submenuForm.button(subCat.category);
      submenuButtonMap.push(subCat);
    }

    submenuForm.button("§8« Volver al menú principal");

    submenuForm.show(player).then((subRes: ActionFormResponse) => {
      // Si el usuario canceló, volver al menú principal
      if (!subRes || subRes.canceled) {
        system.run(() => {
          showCategoryMenu(player, entity, cfg, soldierName, displayName, typeId);
        });
        return;
      }

      const subIndex = typeof subRes.selection === "number" ? subRes.selection : -1;

      // Botón de volver
      if (subIndex === submenuButtonMap.length) {
        showCategoryMenu(player, entity, cfg, soldierName, displayName, typeId);
        return;
      }

      const subCategory = submenuButtonMap[subIndex];
      if (!subCategory || !subCategory.entries) return;

      // Pasar información del submenu para poder volver
      showEntryMenu(player, entity, subCategory, soldierName, displayName, cfg, typeId, group);
    });
  } else if (group.entries) {
    // No viene de submenu, pasar null
    showEntryMenu(player, entity, group, soldierName, displayName, cfg, typeId, null);
  }
}

/**
 * Muestra el menú de entries (acciones finales)
 */
function buildSystemCategorySummary(entity: Entity, typeId: string, displayName: string): string[] {
  const factionInfo = getEntityFactionInfo(entity);
  const healthComp = entity.getComponent("health");
  const currentHealth = healthComp?.currentValue;
  const maxHealth = healthComp?.effectiveMax;
  const dynamicProperties = entity.getDynamicPropertyIds?.() ?? [];

  const bodyLines = [`§7Unidad:§r ${displayName}`, `§7Tipo:§r ${factionInfo?.isSpecial ? "Especial" : "Normal"}`];

  if (factionInfo) {
    bodyLines.push(`§7Facción:§r ${factionInfo.faction}`);
    if (factionInfo.isSpecial) {
      const groupId = factionInfo.group ?? "noGroup";
      bodyLines.push(`§7Grupo especial:§r ${SpecialGroupLabels[groupId] || String(groupId)}`);
    } else {
      const hierarchyId = factionInfo.hierarchy ?? "basic";
      bodyLines.push(`§7Jerarquía:§r ${UnitHierarchyLabels[hierarchyId] || String(hierarchyId)}`);
    }
  }

  if (typeof currentHealth === "number" && typeof maxHealth === "number") {
    bodyLines.push(`§7Salud:§r ${currentHealth} / ${maxHealth}`);
  }

  bodyLines.push("\n§rPulsa para ver las opciones configuradas:");
  return bodyLines;
}

function showEntryMenu(
  player: Player,
  entity: Entity,
  category: MenuCategory,
  soldierName: string,
  displayName: string,
  cfg: EntityConfig,
  typeId: string,
  parentSubmenu: MenuCategory | null
): void {
  const isSystemStateCategory = category.id === "entity_system_state";
  const entryForm = new ActionFormData()
    .title(category.category)
    .body(
      isSystemStateCategory
        ? buildSystemCategorySummary(entity, typeId, soldierName).join("\n")
        : `§7Unidad:§r ${soldierName}\n§rSelecciona una acción:`
    );

  if (!category.entries) return;

  if (category.entries.length === 1) {
    const singleEntry = category.entries[0];
    if (singleEntry.action === "toggle_entity_global_overwrite") {
      showEntityGlobalOverwriteToggle(player, entity, cfg, soldierName, displayName, typeId, parentSubmenu);
      return;
    }
  }

  for (const e of category.entries) entryForm.button(e.label);

  entryForm.show(player).then((entryRes: ActionFormResponse) => {
    // Si el usuario canceló, volver al menú anterior
    if (!entryRes || entryRes.canceled) {
      system.run(() => {
        // Si viene de un submenu, volver al submenu
        if (parentSubmenu) {
          handleCategorySelection(player, entity, parentSubmenu, cfg, soldierName, displayName, typeId);
        } else {
          // Si viene directo de una categoría, volver al menú principal
          showCategoryMenu(player, entity, cfg, soldierName, displayName, typeId);
        }
      });
      return;
    }

    const entryIndex = typeof entryRes.selection === "number" ? entryRes.selection : -1;
    if (!category.entries) return;

    const entry = category.entries[entryIndex];
    if (!entry) return;

    if (entry.action === "view_entity_system_state") {
      showEntitySystemStatus(player, entity, cfg, soldierName, displayName, typeId);
      return;
    }

    if (!entry.event) return;

    let triggeredEvent = false;
    try {
      // si el evento está marcado como de taming intentamos domesticar
      if (isAutoTameEvent(entry.event)) {
        tryAutoTame(entity, player);
      }
      entity.triggerEvent(entry.event);
      triggeredEvent = true;
    } catch (e) {
      debugWarn("playerInteractWithEntity", `triggerEvent failed: ${e}`, "red");
    }

    const mapped = findSystemStateByEvent(entry.event);
    if (mapped && triggeredEvent) {
      setEntitySystemState(entity, mapped.systemId, mapped.value);
      world.sendMessage(
        `§8[§aMENU§8] §7${player.name} configuró a ${soldierName} §7-> §e${category.category}§7: §f${entry.label}`
      );
      debugWarn("playerInteractWithEntity", `triggered event ${entry.event}`, "green");
    }
  });
}

function showEntitySystemStatus(
  player: Player,
  entity: Entity,
  cfg: EntityConfig,
  soldierName: string,
  displayName: string,
  typeId: string
): void {
  const { totalSystems, savedSystems, statuses: systemStatuses } = getEntitySystemsStatus(entity);
  const dynamicProperties = entity.getDynamicPropertyIds?.() ?? [];
  const unidadDisplay = !entity.nameTag ? `§b${typeId}` : `${soldierName} (${typeId})`;

  const bodyLines = [
    `§7Unidad:§r ${unidadDisplay}`,
    `§7Tipo de Configuración:§r ${isGlobalOverwriteAllowed(entity) ? "§aGlobal" : "§cLocal"}`,
    `§7Propiedades dinámicas guardadas:§r ${dynamicProperties.length}`,
    `§7Sistemas guardados:§r ${savedSystems}`,
  ];

  if (systemStatuses.length) {
    bodyLines.push("§7Configuración actual guardada en la entidad:");
    for (const status of systemStatuses) {
      bodyLines.push(`§6${status.displayName}§r: ${status.label}`);
    }
  } else {
    bodyLines.push("§7No hay sistemas configurados para esta unidad.");
  }

  const statusForm = new ActionFormData().title("Estado de sistemas").body(bodyLines.join("\n"));

  statusForm.button("§8Volver");
  statusForm.show(player).then(() => {
    showCategoryMenu(player, entity, cfg, soldierName, displayName, typeId);
  });
}

world.beforeEvents.playerInteractWithEntity.subscribe((ev) => {
  try {
    const player = ev.player;
    const entity = ev.target;

    debugWarn(
      "playerInteractWithEntity",
      `handler fired player=${player?.name ?? "?"} target=${entity?.typeId ?? "?"}`
    );

    if (!player || !entity) return;

    // Determinar facción
    let entGroup: string | null = null;
    if (config.entities) {
      for (const gName of Object.keys(config.entities)) {
        const group = config.entities[gName];
        if (group && Object.prototype.hasOwnProperty.call(group, entity.typeId)) {
          entGroup = gName;
          break;
        }
      }
    }

    const openerItem = (entGroup && config.openItem?.[entGroup]) || config.openItem?.default || "lc:dt_commander";

    try {
      const mainhand = player.getComponent("equippable")?.getEquipment(EquipmentSlot.Mainhand);

      const mainId = mainhand?.typeId ?? null;

      debugWarn("playerInteractWithEntity", `player mainhand=${mainId}, opener=${openerItem}`);

      if (!itemMatches(mainId, openerItem)) {
        debugWarn("playerInteractWithEntity", `menu blocked: wrong opener`, "blue");
        return;
      }

      ev.cancel = true;
    } catch (e) {
      debugWarn("playerInteractWithEntity", `error reading mainhand: ${e}`, "red");
      return;
    }

    const typeId = entity.typeId;

    const cfg = getConfigForEntity(typeId);
    if (!cfg) {
      debugWarn("playerInteractWithEntity", `no config for ${typeId}`, "blue");
      return;
    }

    let displayName = typeId;
    try {
      if (entity.nameTag) displayName = entity.nameTag;
    } catch {}

    const soldierName = entity.nameTag ? `${entity.nameTag}§r` : `§b${displayName}§r`;

    system.run(() => {
      showCategoryMenu(player, entity, cfg, soldierName, displayName, typeId);
    });
  } catch (err) {
    debugWarn("playerInteractWithEntity", `GUI error: ${err}`, "red");
  }
});
function showEntityGlobalOverwriteToggle(
  player: Player,
  entity: Entity,
  cfg: EntityConfig,
  soldierName: string,
  displayName: string,
  typeId: string,
  parentSubmenu: MenuCategory | null
): void {
  const currentAllowed = isGlobalOverwriteAllowed(entity);
  const form = new ModalFormData()
    .title("§dControl de Configuración")
    .label(
      "§aActivado: §7La unidad usará la configuración global.\n§cDesactivado: §7La unidad ignora la configuración global (Ajuste local)."
    )
    .toggle("Usar configuración global", { defaultValue: currentAllowed })
    .submitButton("§aGuardar");

  form.show(player).then((res: any) => {
    if (!res || res.canceled) {
      system.run(() => {
        if (parentSubmenu) {
          handleCategorySelection(player, entity, parentSubmenu, cfg, soldierName, displayName, typeId);
        } else {
          showCategoryMenu(player, entity, cfg, soldierName, displayName, typeId);
        }
      });
      return;
    }

    const allowOverwrite = isTruthyToggleValue(res?.formValues?.[1]);
    setGlobalOverwriteAllowed(entity, allowOverwrite);

    player.sendMessage(
      `§a[SCPD] Sobreescritura global ${allowOverwrite ? "permitida" : "bloqueada"} para ${soldierName}§r`
    );

    system.run(() => {
      if (parentSubmenu) {
        handleCategorySelection(player, entity, parentSubmenu, cfg, soldierName, displayName, typeId);
      } else {
        showCategoryMenu(player, entity, cfg, soldierName, displayName, typeId);
      }
    });
  });
}
