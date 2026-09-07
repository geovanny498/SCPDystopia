export interface ProjectileConfigEntry {
  damage: number;
  knockback: number;
  pierce: number;
  sound?: string;
}

// Ignorar cosas raras en las ids como player_sneak o player_ads, player_uncertain, etc.
// solo guiarse por los comentarios para saber quien los dispara
// Pierce es la cantidad de enemigos que pueden dañar, no atravesar
export const projectileConfig: Record<string, ProjectileConfigEntry> = {
  // Basicos (50-65 de vida)
  "lc:dt_m4a1_bullet": { damage: 5, knockback: 0.02, pierce: 1, sound: "scpdt.m4a1.shot" },
  "lc:dt_m16_bullet": { damage: 4, knockback: 0.02, pierce: 1, sound: "scpdt.m16.shot" },
  "lc:dt_ak47_bullet": { damage: 4, knockback: 0.02, pierce: 1, sound: "scpdt.ak47.shoot" },
  "lc:dt_mp7_bullet": { damage: 4, knockback: 0.02, pierce: 1, sound: "scpdt.mp7.shoot" },
  "lc:dt_mp5a3_bullet": { damage: 4, knockback: 0.02, pierce: 1, sound: "scpdt.mp5a3.shot" },
  "lc:dt_p90_bullet": { damage: 5, knockback: 0.02, pierce: 1, sound: "scpdt.p90.shoot" },
  "lc:dt_dtrifle_bullet": { damage: 90, knockback: 0.02, pierce: 1, sound: "scpdt.dtrifle.shot" },
  "lc:dt_scar_bullet": { damage: 5, knockback: 0.02, pierce: 1, sound: "scpdt.scar.shot" },
  "lc:dt_hk416_bullet": { damage: 5, knockback: 0.02, pierce: 1, sound: "scpdt.hk416.shoot" },

  // Líderes (150-180 de vida)
  "lc:dt_m4a1_bullet_player": { damage: 6, knockback: 0.04, pierce: 2, sound: "scpdt.m4a1.shot" },
  "lc:dt_mp7_bullet_player_normal": { damage: 5, knockback: 0.04, pierce: 2, sound: "scpdt.mp7.shoot" },
  "lc:dt_mp5a3_bullet_player_normal": { damage: 5, knockback: 0.04, pierce: 2, sound: "scpdt.mp5a3.shot" },
  "lc:dt_m16_bullet_player": { damage: 5, knockback: 0.04, pierce: 2, sound: "scpdt.m16.shot" },
  "lc:dt_ak47_bullet_player_normal": { damage: 5, knockback: 0.04, pierce: 2, sound: "scpdt.ak47.shoot" },
  "lc:dt_p90_bullet_player_normal": { damage: 6, knockback: 0.04, pierce: 2, sound: "scpdt.p90.shoot" },
  "lc:dt_scar_bullet_player": { damage: 6, knockback: 0.04, pierce: 2, sound: "scpdt.scar.shot" },
  "lc:dt_hk416_bullet_player_normal": { damage: 6, knockback: 0.04, pierce: 2, sound: "scpdt.hk416.shoot" },

  // Comandantes (al menos 3000+ de vida)
  "lc:dt_hk416_bullet_player_c": { damage: 8, knockback: 0.04, pierce: 3, sound: "scpdt.hk416.shoot" },
  "lc:dt_mp7_bullet_player_ads": { damage: 8, knockback: 0.04, pierce: 3, sound: "scpdt.mp7.shoot" },
  "lc:dt_mp5a3_bullet_player_sneak": { damage: 8, knockback: 0.04, pierce: 3, sound: "scpdt.mp5a3.shot" },
  "lc:dt_ak47_bullet_player_ads": { damage: 8, knockback: 0.04, pierce: 3, sound: "scpdt.ak47.shoot" },
  "lc:dt_m16_bullet_player_sneak": { damage: 8, knockback: 0.04, pierce: 3, sound: "scpdt.m16.shot" },
  "lc:dt_p90_bullet_player_ads": { damage: 9, knockback: 0.04, pierce: 3, sound: "scpdt.p90.shoot" },
  "lc:dt_dtrifle_bullet_player_sneak": { damage: 180, knockback: 0.04, pierce: 3, sound: "scpdt.dtrifle.shot" },
  "lc:dt_suscharger_shot_player_sneak": { damage: 50, knockback: 0.04, pierce: 1, sound: "scpdt.gun.shot_dry" },
  "lc:dt_scar_bullet_player_sneak": { damage: 8, knockback: 0.04, pierce: 3, sound: "scpdt.scar.shot" },
  "lc:dt_m4a1_bullet_player_sneak": { damage: 8, knockback: 0.04, pierce: 3, sound: "scpdt.m4a1.shot" },
  "lc:dt_hk416_bullet_player_ads": { damage: 9, knockback: 0.04, pierce: 3, sound: "scpdt.hk416.shoot" },

  // Jugador (20 de vida) Aplok Guns (ya tienen su propio sonido)
  "lc:dt_mp7_player_bullet": { damage: 8, knockback: 0.04, pierce: 3 },
  "lc:dt_ak47_player_bullet": { damage: 8, knockback: 0.04, pierce: 3 },
  "lc:dt_p90_player_bullet": { damage: 9, knockback: 0.04, pierce: 3 }, // mp5a5
  "lc:dt_dtrifle_player_bullet": { damage: 180, knockback: 0.04, pierce: 3 }, // awp
  "lc:dt_scar_player_bullet": { damage: 8, knockback: 0.04, pierce: 3 }, // m249
  "lc:dt_m4a1_player_bullet": { damage: 8, knockback: 0.04, pierce: 3 },
  "lc:dt_hk416_player_bullet": { damage: 9, knockback: 0.04, pierce: 3 }, // m4a1

  // Sin usar
  "lc:dt_mp5a4_bullet_player_uncertain": { damage: 8, knockback: 0.02, pierce: 1 },
  "lc:dt_m4a1_bullet_player_uncertain": { damage: 6, knockback: 0.02, pierce: 1 },
};
