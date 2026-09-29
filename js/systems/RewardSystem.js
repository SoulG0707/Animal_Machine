import { PROGRESSION_CONFIG } from '../config/progressionConfig.js';

export class RewardSystem {
  constructor(config = PROGRESSION_CONFIG) {
    this.config = config;
  }

  rarityBase(rarity = 'common') {
    return this.config.rarityRewards[rarity] ?? this.config.rarityRewards.common;
  }

  calculateCatchReward({ rarity = 'common', shiny = false, comboMultiplier = 1, fever = false } = {}) {
    const base = this.rarityBase(rarity);
    const shinyMultiplier = shiny ? this.config.shinyRewardMultiplier : 1;
    const safeComboMultiplier = Math.max(1, Number(comboMultiplier) || 1);
    const feverMultiplier = fever ? this.config.feverRewardMultiplier : 1;
    return {
      base,
      shinyMultiplier,
      comboMultiplier: safeComboMultiplier,
      feverMultiplier,
      total: Math.max(0, Math.round(base * shinyMultiplier * safeComboMultiplier * feverMultiplier)),
    };
  }
}
