import { system } from "@minecraft/server";
function onHitEntity(arg) {
    var _a;
    try {
        const maxHealth = (_a = arg.hitEntity.getComponent("health")) === null || _a === void 0 ? void 0 : _a.effectiveMax;
        arg.hitEntity.applyDamage(maxHealth !== null && maxHealth !== void 0 ? maxHealth : 99999999, {
            cause: "override"
        });
    }
    catch (_b) { }
}
system.beforeEvents.startup.subscribe(event => {
    event.itemComponentRegistry.registerCustomComponent("scpdy:deal_max_damage_on_hit", { onHitEntity });
});
//# sourceMappingURL=maxDamage.js.map