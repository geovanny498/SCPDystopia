// scripts/gui/commandMenu/menu_builder.js
import { ModalFormData } from "@minecraft/server-ui";
import { debugWarn } from "../../../utils/debug.js";
import {
  ControlType,
  Factions,
  UnitHierarchy,
  UnitHierarchyLabels,
  SpecialGroups,
  SpecialGroupLabels,
  menuConfig,
  getGroupsOrderForSystems,
} from "../menu_config.js";

/**
 * Construye el formulario para uno o más sistemas
 * Soporta jerarquías (Básicos/Líderes/Comandantes) y grupos de especiales (A-D + Sin grupo)
 *
 * @param {Array} systems - Lista de sistemas a mostrar
 * @param {Object} loadedStates - Estados cargados desde world DP
 * @param {string|null} selectedFaction - Facción seleccionada o null para ambas
 * @param {Array<string>|null} activeHierarchies - Jerarquías con entidades activas (solo informativo)
 * @param {Object|null} activeFamilyTags - Familias MTF con entidades activas { tagId: {label, unitCount} } (solo informativo)
 * @param {Array|null} scannedEntities - Entidades escaneadas completas
 * @param {Array<string>|null} activeGroups - IDs de grupos con unidades activas (para sincronizar con parseSystemFormValues)
 */
export function buildSystemForm(
  systems,
  loadedStates,
  selectedFaction = null,
  activeHierarchies = null,
  activeFamilyTags = null,
  scannedEntities = null,
  activeGroups = null
) {
  let title = menuConfig.title;
  if (systems.length === 1) {
    title = systems[0].displayName;
  }

  const form = new ModalFormData().title(title);

  const factions = selectedFaction ? [selectedFaction] : [Factions.FOUNDATION, Factions.CHAOS];

  systems.forEach((system, index) => {
    if (systems.length > 1) {
      form.label(system.displayName);
    }

    factions.forEach((faction) => {
      const factionConfig = system.factions[faction];
      if (!factionConfig) return;

      form.label(factionConfig.label);

      const state = loadedStates[system.id]?.[faction] || system.defaults[faction];

      // ── Sección: No Especiales (Jerarquías) ─────────────────────────────
      // SIEMPRE mostrar las 3 jerarquías (basic / leader / commander).
      // activeHierarchies NO se usa para ocultar dropdowns, solo informativo.
      if (system.supportsHierarchy) {
        form.label("§7── No Especiales ──");

        const allHierarchies = Object.values(UnitHierarchy);

        for (const hierarchy of allHierarchies) {
          const hierarchyLabel = UnitHierarchyLabels[hierarchy];
          const currentValue = state[hierarchy];

          const isFirstHierarchy = hierarchy === UnitHierarchy.BASIC;
          const tooltipOptions = isFirstHierarchy && system.tooltip ? { tooltip: system.tooltip } : {};

          if (system.controlType === ControlType.TOGGLE) {
            const value = currentValue ?? false;
            form.toggle(hierarchyLabel, { defaultValue: !!value, ...tooltipOptions });
          } else if (system.controlType === ControlType.DROPDOWN) {
            const labels = system.options.map((opt) => opt.label);
            // Buscar el índice del valor guardado; si no está, usar el índice del default de este sistema
            var currentIndex = system.options.findIndex((opt) => opt.value === currentValue);
            if (currentIndex < 0) {
              const defaultVal = system.defaults?.[faction]?.[hierarchy];
              currentIndex = system.options.findIndex((opt) => opt.value === defaultVal);
            }
            form.dropdown(hierarchyLabel, labels, {
              defaultValueIndex: currentIndex >= 0 ? currentIndex : 0,
              ...tooltipOptions,
            });
          }
        }
      }

      // ── Sección: Especiales (Grupos A-D + Sin grupo — unidades activas por grupo) ──
      // Orden SIEMPRE fijo A-D + Sin grupo.
      // activeGroups viene de getActiveGroups() y sincroniza con parseSystemFormValues.
      if (system.supportsGroups) {
        form.label("§e── Especiales ──");

        // Usar activeGroups de entrada para contar y mostrar solo grupos activos
        var activeGroupsForFaction = activeGroups || getGroupsOrderForSystems();

        var activeEntities = scannedEntities || [];

        // ── Generar dropdowns por grupo (mismo orden que el parser)
        debugWarn(
          "menuBuilder",
          `[buildSystemForm] faction=${faction} activeGroupsForFaction=${JSON.stringify(activeGroupsForFaction)} scannedEntities.length=${activeEntities.length}`,
          "cyan"
        );
        var hasAnyGroup = false;
        for (var gi = 0; gi < activeGroupsForFaction.length; gi++) {
          var _gid = activeGroupsForFaction[gi];
          var _groupInfo = { unitCount: 0, nametags: {} };
          var seenThisGroup = Object.create(null); // ← Set LOCAL por grupo (no propagado)

          for (var si2 = 0; si2 < activeEntities.length; si2++) {
            var _scanned2 = activeEntities[si2];
            if (!_scanned2.isSpecial) continue;
            if (_scanned2.faction !== faction) continue;
            var _grpId2 = _scanned2.group || SpecialGroups.NO_GROUP;
            if (_grpId2 !== _gid) continue;

            var _nt = (_scanned2.nametag || "").trim();
            if (_nt && !seenThisGroup[_nt]) {
              _groupInfo.nametags[_nt] = 1;
              seenThisGroup[_nt] = true;
            }
            _groupInfo.unitCount++;
          }

          debugWarn(
            "menuBuilder",
            `  group=${_gid} unitCount=${_groupInfo.unitCount} nametags=${JSON.stringify(Object.keys(_groupInfo.nametags))}`,
            "dark_gray"
          );

          // Mostrar solo grupos con unidades
          if (_groupInfo.unitCount <= 0) continue;
          hasAnyGroup = true;

          var _baseLabel = SpecialGroupLabels[_gid];
          var _groupLabel = _baseLabel + " §8(" + _groupInfo.unitCount + ")";
          var stateKey = _gid;
          var currentValue = state[stateKey];

          // Tooltip: nametags únicos en el grupo (cada nametag aparece una sola vez)
          var tooltip;
          var _uniqueNtNames = Object.keys(_groupInfo.nametags).sort();
          if (_uniqueNtNames.length > 0) {
            var _ntLines2 = [];
            for (var ni2 = 0; ni2 < _uniqueNtNames.length; ni2++) {
              var _nt2 = _uniqueNtNames[ni2];
              _ntLines2.push(_nt2);
            }
            tooltip = "§7Unidades en " + SpecialGroupLabels[_gid] + ":\n§r" + _ntLines2.join("\n§r");
          } else {
            tooltip = SpecialGroupLabels[_gid] + " no tiene unidades activas";
          }

          if (system.controlType === ControlType.TOGGLE) {
            var value = currentValue !== undefined ? !!currentValue : false;
            form.toggle(_groupLabel, { defaultValue: value, tooltip: tooltip });
          } else if (system.controlType === ControlType.DROPDOWN) {
            var labels = system.options.map(function (opt) {
              return opt.label;
            });
            // Buscar el índice del valor guardado; si no está, usar el índice del default de este sistema
            var _currentIdx = system.options.findIndex(function (opt) {
              return opt.value === currentValue;
            });
            if (_currentIdx < 0) {
              var _defaultVal = system.defaults?.[faction]?.[stateKey];
              _currentIdx = system.options.findIndex(function (opt) {
                return opt.value === _defaultVal;
              });
            }
            form.dropdown(_groupLabel, labels, {
              defaultValueIndex: _currentIdx >= 0 ? _currentIdx : 0,
              tooltip: tooltip,
            });
          }
        }

        if (!hasAnyGroup) {
          form.label("§8No hay unidades especiales activas en esta facción.");
        }
      }
    });

    if (menuConfig.useDividers && index < systems.length - 1) {
      form.divider();
    }
  });

  form.submitButton("§aGuardar");

  return form;
}

/**
 * Parsea los valores del formulario para uno o más sistemas
 * @param {Array} systems
 * @param {Array} formValues — valores devueltos por el formulario
 * @param {string|null} selectedFaction
 * @param {Array|null} activeGroups — IDs de grupos que se mostraron en el formulario (para sincronizar índices)
 */
export function parseSystemFormValues(systems, formValues, selectedFaction = null, activeGroups = null) {
  const filtered = formValues.filter((v) => v !== null && v !== undefined);
  const parsedStates = {};
  let valueIndex = 0;

  const nextValue = () => {
    const v = filtered[valueIndex];
    valueIndex += 1;
    return v;
  };

  const factions = selectedFaction ? [selectedFaction] : [Factions.FOUNDATION, Factions.CHAOS];

  systems.forEach((system) => {
    const systemState = {};

    for (const f of [Factions.FOUNDATION, Factions.CHAOS]) {
      systemState[f] = {};
    }

    factions.forEach((faction) => {
      if (system.supportsHierarchy) {
        for (const hierarchy of Object.values(UnitHierarchy)) {
          if (system.controlType === ControlType.TOGGLE) {
            systemState[faction][hierarchy] = !!nextValue();
          } else if (system.controlType === ControlType.DROPDOWN) {
            const index = nextValue();
            systemState[faction][hierarchy] =
              typeof index === "number" ? system.options[index]?.value : system.defaults[faction][hierarchy];
          }
        }
      }

      if (system.supportsGroups) {
        // Usar activeGroups si se proporciona (mismos grupos que buildSystemForm mostró)
        // Si no, recorrer todos los grupos (fallback)
        const groupsToParse = activeGroups || getGroupsOrderForSystems();

        for (var gi = 0; gi < groupsToParse.length; gi++) {
          var groupId = groupsToParse[gi];
          if (system.controlType === ControlType.TOGGLE) {
            systemState[faction][groupId] = !!nextValue();
          } else if (system.controlType === ControlType.DROPDOWN) {
            const index = nextValue();
            systemState[faction][groupId] =
              typeof index === "number" ? system.options[index]?.value : system.defaults[faction][groupId];
          }
        }
      }
    });

    if (selectedFaction) {
      const otherFaction = selectedFaction === Factions.FOUNDATION ? Factions.CHAOS : Factions.FOUNDATION;
      const existingState = parsedStates[system.id]?.[otherFaction];
      if (!existingState) {
        systemState[otherFaction] = { ...system.defaults[otherFaction] };
      }
    }

    parsedStates[system.id] = systemState;
  });

  return parsedStates;
}

/**
 * Genera el mensaje de confirmación según los sistemas configurados
 */
export function getConfirmationMessage(playerName, systems, isAllCategory = false) {
  if (isAllCategory) {
    return menuConfig.messages.allSystems.replace("{player}", playerName);
  }

  const systemNames = systems.map((sys) => `${sys.displayName}§r`).join(", ");
  return menuConfig.messages.specificSystems.replace("{player}", playerName).replace("{systems}", systemNames);
}
