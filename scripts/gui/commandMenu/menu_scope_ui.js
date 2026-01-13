// scripts/gui/commandMenu/menu_scope_ui.js
import { system } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { debugWarn } from "../../utils/debug.js";
import { loadScope, saveScope, getScopeSummary } from "./menu_scope.js";
import { specialUnits } from "./menu_config.js";

/**
 * Muestra el menú principal de configuración de scope
 * @param {Player} player 
 */
export function showScopeMenu(player) {
    try {
        debugWarn("menuScope", "=== showScopeMenu iniciado ===", "cyan");

        const currentScope = loadScope();
        const summary = getScopeSummary(currentScope);

        const form = new ActionFormData()
            .title("§9Alcance de Aplicación")
            .body(`§7Define §la quién §r§7se aplicarán los cambios en los sistemas:`);

        form.button("§lConfigurar Foundation");
        form.button("§2§lConfigurar Chaos");
        form.button("§8« Volver al menú principal");

        debugWarn("menuScope", "Mostrando ActionForm...", "cyan");

        system.run(() => {
            form.show(player).then(res => {
                debugWarn("menuScope", `ActionForm resultado: canceled=${res?.canceled}, selection=${res?.selection}`, "cyan");

                if (!res || res.canceled) {
                    import("./menu.js").then(module => {
                        system.run(() => {
                            module.buildAndShowMenu(player);
                        });
                    });
                    debugWarn("menuScope", "ActionForm cancelado", "yellow");
                    return;
                }

                if (res.selection === 0) {
                    debugWarn("menuScope", "Seleccionado: Foundation", "green");
                    showFactionScopeMenu(player, "foundation");
                } else if (res.selection === 1) {
                    debugWarn("menuScope", "Seleccionado: Chaos", "green");
                    showFactionScopeMenu(player, "chaos");
                } else if (res.selection === 2) {
                    debugWarn("menuScope", "Volviendo al menú principal", "gray");
                    // Importar dinámicamente para evitar ciclos
                    import("./menu.js").then(module => {
                        system.run(() => {
                            module.buildAndShowMenu(player);
                        });
                    });
                }
            }).catch(err => {
                debugWarn("menuScope", `Error en ActionForm: ${err}`, "red");
            });
        });
    } catch (e) {
        debugWarn("menuScope", `Error en showScopeMenu: ${e}`, "red");
    }
}

/**
 * Muestra el menú de configuración de scope para una facción específica
 * @param {Player} player 
 * @param {string} faction - "foundation" | "chaos"
 */
function showFactionScopeMenu(player, faction) {
    try {
        debugWarn("menuScope", `=== showFactionScopeMenu iniciado (${faction}) ===`, "cyan");

        const currentScope = loadScope();
        const factionScope = currentScope[faction];
        const factionData = specialUnits[faction];

        debugWarn("menuScope", `factionScope: ${JSON.stringify(factionScope)}`, "gray");

        const factionLabel = faction === "foundation" ? "§lFoundation" : "§2§lChaos";

        const form = new ActionFormData()
            .title(`§9Alcance§r - ${factionLabel}`)
            .body("§7Selecciona qué unidades se verán afectadas:");

        // Botón para normales (abre modal simple)
        const normalsStatus = factionScope.includeNormals !== undefined ? factionScope.includeNormals : true;
        form.button(`Normales: ${normalsStatus ? "§aIncluidas" : "§cExcluidas"}`);

        // Botones para cada subgrupo de especiales
        const subgroupIds = Object.keys(factionData.subgroups);
        subgroupIds.forEach(subgroupId => {
            const subgroup = factionData.subgroups[subgroupId];
            const selectedCount = subgroup.units.filter(u => factionScope.specialUnits?.includes(u)).length;
            const totalCount = subgroup.units.length;
            form.button(`${subgroup.label}\n§8${selectedCount}/${totalCount} seleccionadas`);
        });

        // Botón para volver
        form.button("§8« Volver");

        debugWarn("menuScope", `Mostrando ActionForm para ${faction}...`, "cyan");

        system.run(() => {
            form.show(player).then(res => {
                debugWarn("menuScope", `ActionForm resultado: canceled=${res?.canceled}, selection=${res?.selection}`, "cyan");

                if (!res || res.canceled) {
                    debugWarn("menuScope", "ActionForm cancelado, volviendo al menú de scope", "yellow");
                    system.run(() => {
                        showScopeMenu(player);
                    });
                    return;
                }

                const selection = res.selection;

                if (selection === 0) {
                    // Configurar normales
                    debugWarn("menuScope", "Seleccionado: Normales", "green");
                    showNormalsModal(player, faction);
                } else if (selection > 0 && selection <= subgroupIds.length) {
                    // Configurar subgrupo específico
                    const subgroupId = subgroupIds[selection - 1];
                    debugWarn("menuScope", `Seleccionado subgrupo: ${subgroupId}`, "green");
                    showSubgroupModal(player, faction, subgroupId);
                } else {
                    // Volver
                    debugWarn("menuScope", "Volviendo al menú de scope", "gray");
                    system.run(() => {
                        showScopeMenu(player);
                    });
                }
            }).catch(err => {
                debugWarn("menuScope", `Error en ActionForm: ${err}`, "red");
            });
        });
    } catch (e) {
        debugWarn("menuScope", `Error en showFactionScopeMenu: ${e}`, "red");
        debugWarn("menuScope", `Stack: ${e.stack}`, "red");
    }
}

/**
 * Muestra modal para configurar normales
 * @param {Player} player 
 * @param {string} faction 
 */
function showNormalsModal(player, faction) {
    try {
        const currentScope = loadScope();
        const factionScope = currentScope[faction];
        const factionLabel = faction === "foundation" ? "§lFoundation" : "§2§lChaos";

        const normalsDefault = factionScope.includeNormals !== undefined ? factionScope.includeNormals : true;

        const form = new ModalFormData()
            .title(`Normales - ${factionLabel}`)
            .toggle("Incluir unidades normales", { defaultValue: normalsDefault })
            .submitButton("§aGuardar");

        system.run(() => {
            form.show(player).then(res => {
                if (!res || res.canceled) {
                    system.run(() => {
                        showFactionScopeMenu(player, faction);
                    });
                    return;
                }

                const includeNormals = !!res.formValues[0];
                currentScope[faction].includeNormals = includeNormals;
                saveScope(currentScope);

                player.sendMessage(`§a[SCOPE] Normales ${includeNormals ? "incluidas" : "excluidas"}`);
                debugWarn("menuScope", `Normales actualizadas: ${includeNormals}`, "green");

                system.run(() => {
                    showFactionScopeMenu(player, faction);
                });
            }).catch(err => {
                debugWarn("menuScope", `Error en modal normales: ${err}`, "red");
            });
        });
    } catch (e) {
        debugWarn("menuScope", `Error en showNormalsModal: ${e}`, "red");
    }
}

/**
 * Muestra modal para configurar un subgrupo específico
 * @param {Player} player 
 * @param {string} faction 
 * @param {string} subgroupId 
 */
function showSubgroupModal(player, faction, subgroupId) {
    try {
        const currentScope = loadScope();
        const factionScope = currentScope[faction];
        const factionData = specialUnits[faction];
        const subgroup = factionData.subgroups[subgroupId];
        const factionLabel = faction === "foundation" ? "§lFoundation" : "§2§lChaos";

        if (!subgroup) {
            debugWarn("menuScope", `Subgrupo no encontrado: ${subgroupId}`, "red");
            return;
        }

        const form = new ModalFormData()
            .title(`§9${subgroup.label}§r - ${factionLabel}`)
            .label("§7Selecciona las unidades a incluir:");

        // Agregar toggle para cada unidad
        subgroup.units.forEach(unitName => {
            const isSelected = factionScope.specialUnits?.includes(unitName) || false;
            form.toggle(unitName, { defaultValue: isSelected });
        });

        form.submitButton("§aGuardar");

        system.run(() => {
            form.show(player).then(res => {
                if (!res || res.canceled) {
                    system.run(() => {
                        showFactionScopeMenu(player, faction);
                    });
                    return;
                }

                // Obtener unidades actuales sin las del subgrupo actual
                let currentUnits = factionScope.specialUnits || [];
                currentUnits = currentUnits.filter(u => !subgroup.units.includes(u));

                // Agregar las unidades seleccionadas del subgrupo
                const values = res.formValues;
                let idx = 0;

                // Saltar label inicial
                while (idx < values.length && values[idx] === undefined) {
                    idx++;
                }

                // Leer toggles
                subgroup.units.forEach(unitName => {
                    if (idx < values.length && values[idx] === true) {
                        currentUnits.push(unitName);
                    }
                    idx++;
                });

                // Actualizar scope
                currentScope[faction].specialUnits = currentUnits;
                currentScope[faction].includeSpecials = currentUnits.length > 0;
                saveScope(currentScope);

                const selectedCount = subgroup.units.filter(u => currentUnits.includes(u)).length;
                player.sendMessage(`§a[SCOPE] ${subgroup.label}: ${selectedCount}/${subgroup.units.length} seleccionadas`);
                debugWarn("menuScope", `Subgrupo ${subgroupId} actualizado: ${selectedCount} unidades`, "green");

                system.run(() => {
                    showFactionScopeMenu(player, faction);
                });
            }).catch(err => {
                debugWarn("menuScope", `Error en modal subgrupo: ${err}`, "red");
            });
        });
    } catch (e) {
        debugWarn("menuScope", `Error en showSubgroupModal: ${e}`, "red");
    }
}
