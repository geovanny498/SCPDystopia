// scripts\gui\gui.js
import { world, system, EquipmentSlot } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import config from "./config.js";
import { debugWarn } from "../utils/debug.js";
// Helpers de sistema/ids para filtrado por `config.global_rules`.
function makeSystemId(cat) {
    if (!cat)
        return null;
    if (cat.id)
        return String(cat.id);
    const name = String(cat.category || "").toLowerCase();
    return `auto:${name.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")}`;
}
function isAllowedByRule(sysId, typeId) {
    if (!sysId)
        return true;
    if (!config.global_rules || !config.global_rules[sysId])
        return true;
    const rule = config.global_rules[sysId] || {};
    const mode = rule.mode;
    const list = Array.isArray(rule.list) ? rule.list : [];
    const inList = list.includes(typeId);
    if (mode === "whitelist")
        return inList;
    if (mode === "blacklist")
        return !inList;
    return true;
}
function shouldIncludeCategoryForEntity(cat, typeId) {
    const sysId = makeSystemId(cat);
    return isAllowedByRule(sysId, typeId);
}
/**
 * Devuelve las categorías separadas en:
 * - specific: categorías específicas de la entidad
 * - global: categorías globales
 * - merged: orden final según insertAt / replace
 */
function getConfigForEntity(typeId) {
    const globalCats = config.global && Array.isArray(config.global.categories)
        ? [...config.global.categories]
        : [];
    // Resolver si la entidad está permitida
    let entVal = undefined;
    let groupName = null;
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
    if (entVal === undefined)
        return null;
    let allowed = true;
    if (typeof entVal === "object" && entVal !== null) {
        allowed = entVal.enabled !== undefined ? Boolean(entVal.enabled) : true;
    }
    else {
        allowed = Boolean(entVal);
    }
    if (!allowed) {
        debugWarn("playerInteractWithEntity", `menu blocked by config.entities[${groupName}].${typeId} = ${JSON.stringify(entVal)}`, "blue");
        return null;
    }
    const spec = config.specific && config.specific[typeId];
    const specificCats = spec && Array.isArray(spec.categories)
        ? [...spec.categories]
        : [];
    // Aplicar filtrado a las categorías globales según `global_rules`.
    // Para categorías que apuntan a `submenu`, no bloqueamos la categoría
    // salvo que la categoría principal tenga su propia `id` denegada o
    // todas las categorías del submenu queden filtradas.
    const filteredGlobalCats = [];
    for (const c of globalCats) {
        if (c && c.submenu) {
            // Si la categoría principal tiene id y está denegada, excluirla
            if (c.id && !isAllowedByRule(c.id, typeId))
                continue;
            const submenuCfg = config.submenus && config.submenus[c.submenu];
            const submenuCats = (submenuCfg && Array.isArray(submenuCfg.categories)) ? submenuCfg.categories : [];
            const filteredSub = submenuCats.filter((sc) => shouldIncludeCategoryForEntity(sc, typeId));
            if (!filteredSub.length)
                continue; // submenu vacío -> ocultar la categoría
            // mantener la categoría (no modificar objeto original)
            filteredGlobalCats.push(Object.assign({}, c));
        }
        else {
            if (shouldIncludeCategoryForEntity(c, typeId))
                filteredGlobalCats.push(Object.assign({}, c));
        }
    }
    let merged = [];
    if (spec && spec.replace) {
        merged = [...specificCats];
    }
    else if (specificCats.length) {
        const insertAt = spec.insertAt === "start" ? "start" : "end";
        merged =
            insertAt === "start"
                ? specificCats.concat(filteredGlobalCats)
                : filteredGlobalCats.concat(specificCats);
    }
    else {
        merged = [...filteredGlobalCats];
    }
    debugWarn("playerInteractWithEntity", `resolved categories for ${typeId}: specific=${specificCats.length}, global=${globalCats.length}, merged=${merged.length}`);
    return {
        specific: specificCats,
        global: spec && spec.replace ? [] : filteredGlobalCats,
        merged
    };
}
function itemMatches(mainId, opener) {
    if (!mainId || !opener)
        return false;
    if (opener.includes(":"))
        return mainId === opener;
    const parts = mainId.split(":");
    const short = parts.length > 1 ? parts[1] : parts[0];
    return short === opener || mainId === opener || mainId.endsWith(`:${opener}`);
}
/**
 * Muestra el menú de categorías principal
 * @param {Player} player
 * @param {Entity} entity
 * @param {Object} cfg
 * @param {string} soldierName
 * @param {string} displayName
 * @param {string} typeId
 */
function showCategoryMenu(player, entity, cfg, soldierName, displayName, typeId) {
    const catForm = new ActionFormData()
        .title("SCPDystopia | Interacciones")
        .body(`§7Unidad:§r ${soldierName}`);
    const categoryButtonMap = [];
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
    }
    else {
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
    catForm.show(player).then((catRes) => {
        // Si el usuario canceló en el menú principal, simplemente cerrar
        if (!catRes || catRes.canceled)
            return;
        const index = typeof catRes.selection === "number" ? catRes.selection : -1;
        const group = categoryButtonMap[index];
        if (!group)
            return;
        handleCategorySelection(player, entity, group, cfg, soldierName, displayName, typeId);
    });
}
/**
 * Maneja la selección de una categoría (submenu o entries directas)
 * @param {Player} player
 * @param {Entity} entity
 * @param {Object} group
 * @param {Object} cfg
 * @param {string} soldierName
 * @param {string} displayName
 * @param {string} typeId
 */
function handleCategorySelection(player, entity, group, cfg, soldierName, displayName, typeId) {
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
        const submenuForm = new ActionFormData()
            .title(group.category)
            .body(`§7Unidad:§r ${soldierName}`);
        const submenuButtonMap = [];
        for (const subCat of filteredSubCats) {
            submenuForm.button(subCat.category);
            submenuButtonMap.push(subCat);
        }
        submenuForm.button("§8« Volver al menú principal");
        submenuForm.show(player).then((subRes) => {
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
            if (!subCategory || !subCategory.entries)
                return;
            // Pasar información del submenu para poder volver
            showEntryMenu(player, entity, subCategory, soldierName, displayName, cfg, typeId, group);
        });
    }
    else if (group.entries) {
        // No viene de submenu, pasar null
        showEntryMenu(player, entity, group, soldierName, displayName, cfg, typeId, null);
    }
}
/**
 * Muestra el menú de entries (acciones finales)
 * @param {Player} player
 * @param {Entity} entity
 * @param {Object} category
 * @param {string} soldierName
 * @param {string} displayName
 * @param {Object} cfg - Configuración completa para poder volver
 * @param {string} typeId - TypeId de la entidad
 * @param {Object} parentSubmenu - Grupo del submenu padre (si viene de un submenu), null si viene directo
 */
function showEntryMenu(player, entity, category, soldierName, displayName, cfg, typeId, parentSubmenu) {
    const entryForm = new ActionFormData()
        .title(category.category)
        .body(`§7Unidad:§r ${soldierName}\n§rSelecciona una acción:`);
    for (const e of category.entries)
        entryForm.button(e.label);
    entryForm.show(player).then((entryRes) => {
        // Si el usuario canceló, volver al menú anterior
        if (!entryRes || entryRes.canceled) {
            system.run(() => {
                // Si viene de un submenu, volver al submenu
                if (parentSubmenu) {
                    handleCategorySelection(player, entity, parentSubmenu, cfg, soldierName, displayName, typeId);
                }
                else {
                    // Si viene directo de una categoría, volver al menú principal
                    showCategoryMenu(player, entity, cfg, soldierName, displayName, typeId);
                }
            });
            return;
        }
        const entryIndex = typeof entryRes.selection === "number" ? entryRes.selection : -1;
        const entry = category.entries[entryIndex];
        if (!entry || !entry.event)
            return;
        try {
            entity.triggerEvent(entry.event);
            world.sendMessage(`§8[§aMENU§8] §7${player.name} configuró a ${soldierName} §7-> §e${category.category}§7: §f${entry.label}`);
            debugWarn("playerInteractWithEntity", `triggered event ${entry.event}`, "green");
        }
        catch (e) {
            debugWarn("playerInteractWithEntity", `triggerEvent failed: ${e}`, "red");
        }
    });
}
world.beforeEvents.playerInteractWithEntity.subscribe((ev) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
    try {
        const player = ev.player;
        const entity = ev.target;
        debugWarn("playerInteractWithEntity", `handler fired player=${(_a = player === null || player === void 0 ? void 0 : player.name) !== null && _a !== void 0 ? _a : "?"} target=${(_b = entity === null || entity === void 0 ? void 0 : entity.typeId) !== null && _b !== void 0 ? _b : "?"}`);
        if (!player || !entity)
            return;
        // Determinar facción
        let entGroup = null;
        if (config.entities) {
            for (const gName of Object.keys(config.entities)) {
                const group = config.entities[gName];
                if (group &&
                    Object.prototype.hasOwnProperty.call(group, (_d = (_c = entity.typeId) !== null && _c !== void 0 ? _c : entity.id) !== null && _d !== void 0 ? _d : entity.__identifier__)) {
                    entGroup = gName;
                    break;
                }
            }
        }
        const openerItem = (entGroup && ((_e = config.openItem) === null || _e === void 0 ? void 0 : _e[entGroup])) ||
            ((_f = config.openItem) === null || _f === void 0 ? void 0 : _f.default) ||
            "lc:dt_commander";
        try {
            const mainhand = (_g = player
                .getComponent("equippable")) === null || _g === void 0 ? void 0 : _g.getEquipment(EquipmentSlot.Mainhand);
            const mainId = (_j = (_h = mainhand === null || mainhand === void 0 ? void 0 : mainhand.typeId) !== null && _h !== void 0 ? _h : mainhand === null || mainhand === void 0 ? void 0 : mainhand.id) !== null && _j !== void 0 ? _j : null;
            debugWarn("playerInteractWithEntity", `player mainhand=${mainId}, opener=${openerItem}`);
            if (!itemMatches(mainId, openerItem)) {
                debugWarn("playerInteractWithEntity", `menu blocked: wrong opener`, "blue");
                return;
            }
            ev.cancel = true;
        }
        catch (e) {
            debugWarn("playerInteractWithEntity", `error reading mainhand: ${e}`, "red");
            return;
        }
        const typeId = (_m = (_l = (_k = entity.typeId) !== null && _k !== void 0 ? _k : entity.id) !== null && _l !== void 0 ? _l : entity.__identifier__) !== null && _m !== void 0 ? _m : null;
        const cfg = getConfigForEntity(typeId);
        if (!cfg) {
            debugWarn("playerInteractWithEntity", `no config for ${typeId}`, "blue");
            return;
        }
        let displayName = typeId;
        try {
            if (entity.nameTag)
                displayName = entity.nameTag;
            else if (entity.name)
                displayName = entity.name;
        }
        catch (_o) { }
        const soldierName = entity.nameTag
            ? `${entity.nameTag}§r`
            : `§b${displayName}§r`;
        system.run(() => {
            showCategoryMenu(player, entity, cfg, soldierName, displayName, typeId);
        });
    }
    catch (err) {
        debugWarn("playerInteractWithEntity", `GUI error: ${err}`, "red");
    }
});
//# sourceMappingURL=gui.js.map