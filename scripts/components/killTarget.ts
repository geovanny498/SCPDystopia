import { system, ItemComponentHitEntityEvent, CustomComponentParameters, EntityDamageCause } from "@minecraft/server";

function onHitEntity(arg: ItemComponentHitEntityEvent, _params: CustomComponentParameters): void {
  try {
    arg.hitEntity.kill();
  } catch {}
}

system.beforeEvents.startup.subscribe((event) => {
  event.itemComponentRegistry.registerCustomComponent("scpdy:kill_target_on_hit", { onHitEntity });
});
