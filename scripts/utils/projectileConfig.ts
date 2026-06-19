// scripts\utils\projectileConfig.js

// Ignorar cosas raras en las ids como player_sneak o player_ads, player_uncertain, etc.
// solo guiarse por los comentarios para saber quien los dispara
// Pierce es la cantidad de enemigos que pueden dañar, no atravesar
export const projectileConfig = {
  // Basicos (50-65 de vida)
  "lc:dt_m4a1_bullet": { damage: 13, knockback: 0.02, pierce: 1 },
  "lc:dt_m16_bullet": { damage: 12, knockback: 0.02, pierce: 1 },
  "lc:dt_ak47_bullet": { damage: 12, knockback: 0.02, pierce: 1 },
  "lc:dt_mp7_bullet": { damage: 12, knockback: 0.02, pierce: 1 },
  "lc:dt_p90_bullet": { damage: 14, knockback: 0.02, pierce: 1 },
  "lc:dt_scar_bullet": { damage: 13, knockback: 0.02, pierce: 1 },

  // Líderes (150-180 de vida)
  "lc:dt_m4a1_bullet_player": { damage: 18, knockback: 0.04, pierce: 2 },
  "lc:dt_mp7_bullet_player_normal": { damage: 17, knockback: 0.04, pierce: 2 },
  "lc:dt_m16_bullet_player": { damage: 17, knockback: 0.04, pierce: 2 },
  "lc:dt_p90_bullet_player_normal": { damage: 19, knockback: 0.04, pierce: 2 },
  "lc:dt_scar_bullet_player": { damage: 18, knockback: 0.04, pierce: 2 },

  // Comandantes (al menos 3000+ de vida)
  "lc:dt_hk416_bullet_player_c": { damage: 20, knockback: 0.04, pierce: 3 },
  "lc:dt_mp7_bullet_player_ads": { damage: 18, knockback: 0.04, pierce: 3 },
  "lc:dt_ak47_bullet_player_ads": { damage: 18, knockback: 0.04, pierce: 3 },
  "lc:dt_p90_bullet_player_ads": { damage: 21, knockback: 0.04, pierce: 3 },
  "lc:dt_scar_bullet_player_sneak": { damage: 20, knockback: 0.04, pierce: 3 },
  "lc:dt_m4a1_bullet_player_sneak": { damage: 20, knockback: 0.04, pierce: 3 },
  "lc:dt_hk416_bullet_player_ads": { damage: 21, knockback: 0.04, pierce: 3 },

  // Jugador (20 de vida) Aplok Guns
  "lc:dt_mp7_player_bullet": { damage: 18, knockback: 0.04, pierce: 3 },
  "lc:dt_ak47_player_bullet": { damage: 18, knockback: 0.04, pierce: 3 },
  "lc:dt_p90_player_bullet": { damage: 21, knockback: 0.04, pierce: 3 },
  "lc:dt_dtrifle_player_bullet": { damage: 120, knockback: 0.04, pierce: 3 }, // awp
  "lc:dt_scar_player_bullet": { damage: 20, knockback: 0.04, pierce: 3 }, // m249
  "lc:dt_m4a1_player_bullet": { damage: 20, knockback: 0.04, pierce: 3 },
  "lc:dt_hk416_player_bullet": { damage: 21, knockback: 0.04, pierce: 3 }, // m4a1

  // Sin usar
  "lc:dt_suscharger_shot_player_sneak": { damage: 13, knockback: 0.02, pierce: 1 },
  "lc:dt_dtrifle_bullet_player_sneak": { damage: 120, knockback: 0.02, pierce: 1 },
  "lc:dt_mp5a4_bullet_player_uncertain": { damage: 8, knockback: 0.02, pierce: 1 },
  "lc:dt_m4a1_bullet_player_uncertain": { damage: 18, knockback: 0.02, pierce: 1 },
};
