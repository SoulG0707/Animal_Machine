export const PROFILE_VERSION = 2;

export const PROGRESSION_CONFIG = Object.freeze({
  startingCoins: 500,
  playCost: 20,
  dailyLoginBonus: 100,
  shinyChance: 0.01,
  shinyRewardMultiplier: 3,
  rarityRewards: Object.freeze({
    common: 20,
    uncommon: 35,
    rare: 60,
    epic: 100,
    legendary: 200,
  }),
  comboMultipliers: Object.freeze([1, 1.2, 1.5, 1.75, 2]),
  feverThreshold: 5,
  feverDurationSeconds: 10,
  feverRewardMultiplier: 2,
  dailyMissionRewards: Object.freeze([100, 150, 200]),
  dailyMissionCompletionBonus: 300,
  richPlayerCoinsHeld: 1000,
  richPlayerLifetimeEarnings: 2000,
});

export const RARITY_ORDER = Object.freeze(['common', 'uncommon', 'rare', 'epic', 'legendary']);

export function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
