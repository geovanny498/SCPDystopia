// scripts/gui/commandMenu/menu_builder.js
import { ModalFormData } from "@minecraft/server-ui";
import {
  ControlType,
  Factions,
  UnitHierarchy,
  UnitHierarchyLabels,
  SpecialGroups,
  SpecialGroupLabels,
  menuConfig,
} from "./menu_config.js";
import { loadGroups, getGroupsSummary, getUnitsInGroup } from "./menu_groups.js";

/**
 * Construye el formulario para uno o más sistemas
 * NUEVO: Soporta jerarquías (Básicos/Líderes/Comandantes) y grupos de especiales (A-D + Sin grupo)
 */
export function buildSystemForm(systems, loadedStates, selectedFaction = null) {
  // Determinar el título
  let title = menuConfig.title;
  if (systems.length === 1) {
    title = systems[0].displayName;
  }

  const form = new ModalFormData().title(title);

  // Si no hay facción seleccionada, mostrar selector de facción primero
  // (esto se maneja en menu_system.js, aquí asumimos que ya se seleccionó)
  const factions = selectedFaction ? [selectedFaction] : [Factions.FOUNDATION, Factions.CHAOS];

  // Cargar resumen de grupos para cada facción (forzar recarga para datos actualizados)
  loadGroups(true); // Forzar recarga antes de obtener el resumen
  const groupsSummaryByFaction = {};
  for (const faction of factions) {
    groupsSummaryByFaction[faction] = getGroupsSummary(faction);
  }

  systems.forEach((system, index) => {
    // Título del sistema (solo si hay múltiples sistemas)
    if (systems.length > 1) {
      form.label(system.displayName);
    }

    factions.forEach((faction) => {
      const factionConfig = system.factions[faction];
      if (!factionConfig) return;

      // Label del bando
      form.label(factionConfig.label);

      // Estado cargado o default
      const state = loadedStates[system.id]?.[faction] || system.defaults[faction];

      // Sección: No Especiales (Jerarquías)
      if (system.supportsHierarchy) {
        form.label("§7── No Especiales ──");

        for (const hierarchy of Object.values(UnitHierarchy)) {
          const hierarchyLabel = UnitHierarchyLabels[hierarchy];
          const currentValue = state[hierarchy];

          // Agregar tooltip del sistema solo al primer dropdown (Básicos)
          const isFirstHierarchy = hierarchy === UnitHierarchy.BASIC;
          const tooltipOptions = isFirstHierarchy && system.tooltip ? { tooltip: system.tooltip } : {};

          if (system.controlType === ControlType.TOGGLE) {
            const value = currentValue ?? false;
            form.toggle(hierarchyLabel, { defaultValue: !!value, ...tooltipOptions });
          } else if (system.controlType === ControlType.DROPDOWN) {
            const labels = system.options.map((opt) => opt.label);
            const currentIndex = system.options.findIndex((opt) => opt.value === currentValue);
            form.dropdown(hierarchyLabel, labels, {
              defaultValueIndex: Math.max(0, currentIndex),
              ...tooltipOptions,
            });
          }
        }
      }

      // Sección: Especiales (Grupos)
      if (system.supportsGroups) {
        form.label("§e── Especiales ──");

        const groupsSummary = groupsSummaryByFaction[faction] || {};

        for (const groupId of Object.values(SpecialGroups)) {
          const baseLabel = SpecialGroupLabels[groupId];
          const unitCount = groupsSummary[groupId] || 0;
          // Agregar cantidad de unidades al label
          const groupLabel = `${baseLabel}§r §8(${unitCount})`;
          const currentValue = state[groupId];

          // Crear tooltip con las unidades del grupo
          const unitsInGroup = getUnitsInGroup(faction, groupId);
          const tooltip =
            unitsInGroup.length > 0
              ? `Unidades en ${baseLabel}:\n§r${unitsInGroup.join("\n§r")}`
              : `${baseLabel} está vacío`;

          if (system.controlType === ControlType.TOGGLE) {
            const value = currentValue ?? false;
            form.toggle(groupLabel, { defaultValue: !!value, tooltip: tooltip });
          } else if (system.controlType === ControlType.DROPDOWN) {
            const labels = system.options.map((opt) => opt.label);
            const currentIndex = system.options.findIndex((opt) => opt.value === currentValue);
            form.dropdown(groupLabel, labels, {
              defaultValueIndex: Math.max(0, currentIndex),
              tooltip: tooltip,
            });
          }
        }
      }
    });

    // Divisor entre sistemas
    if (menuConfig.useDividers && index < systems.length - 1) {
      form.divider();
    }
  });

  form.submitButton("§aGuardar");

  return form;
}

/**
 * Parsea los valores del formulario para uno o más sistemas
 * NUEVO: Soporta jerarquías y grupos
 */
export function parseSystemFormValues(systems, formValues, selectedFaction = null) {
  // Filtrar valores nulos/undefined (labels y dividers)
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

    // Inicializar estados para ambas facciones
    for (const f of [Factions.FOUNDATION, Factions.CHAOS]) {
      systemState[f] = {};
    }

    factions.forEach((faction) => {
      // Leer jerarquías (no especiales)
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

      // Leer grupos (especiales)
      if (system.supportsGroups) {
        for (const groupId of Object.values(SpecialGroups)) {
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

    // Si solo se configuró una facción, copiar defaults para la otra
    if (selectedFaction) {
      const otherFaction = selectedFaction === Factions.FOUNDATION ? Factions.CHAOS : Factions.FOUNDATION;
      // Mantener el estado anterior de la otra facción si existe
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
