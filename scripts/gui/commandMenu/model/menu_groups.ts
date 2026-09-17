// scripts/gui/commandMenu/model/menu_groups.ts
/**
 * Shim de re-export — consume `shared/entityGroups.ts` como fuente de verdad.
 * Preserva la API pública para legacy (menu_groups_ui.ts, interactMenu/gui.ts)
 * y model/core imports que aún no se migraron a shared/.
 *
 * Nueva funciones: importar directamente desde `shared/entityGroups.ts`.
 */

export { ENTITY_GROUP_DP, getUnitGroup, setUnitGroup, clearUnitGroup } from "../../shared/entityGroups.js";
