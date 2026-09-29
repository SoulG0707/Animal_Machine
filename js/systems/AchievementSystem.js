import { PROGRESSION_CONFIG } from '../config/progressionConfig.js';

const simple = (id, name, description, reward, metric, goal) => ({
  id, name, description, reward,
  progress: (profile) => ({ value: profile.stats[metric] || 0, goal }),
});

export const ACHIEVEMENTS = Object.freeze([
  simple('first-catch', 'FIRST CATCH', 'Catch your first Pokémon', 50, 'totalCatches', 1),
  simple('claw-rookie', 'CLAW ROOKIE', 'Catch 10 Pokémon', 100, 'totalCatches', 10),
  simple('claw-master', 'CLAW MASTER', 'Catch 100 Pokémon', 500, 'totalCatches', 100),
  simple('first-perfect', 'PERFECT!', 'Get your first PERFECT grab', 50, 'totalPerfects', 1),
  simple('perfectionist', 'PERFECTIONIST', 'Get 10 PERFECT grabs', 200, 'totalPerfects', 10),
  simple('combo-starter', 'COMBO STARTER', 'Reach combo 3', 50, 'highestCombo', 3),
  simple('on-fire', 'ON FIRE', 'Reach combo 5 and trigger Fever', 150, 'highestCombo', 5),
  {
    id: 'collector', name: 'COLLECTOR', description: 'Discover 5 species', reward: 100,
    progress: (profile) => ({ value: Object.values(profile.collection).filter((entry) => entry.discovered).length, goal: 5 }),
  },
  {
    id: 'pokedex-master', name: 'POKÉDEX MASTER', description: 'Discover all 15 Pokémon', reward: 500,
    progress: (profile) => ({ value: Object.values(profile.collection).filter((entry) => entry.discovered).length, goal: 15 }),
  },
  simple('lucky-find', 'LUCKY FIND', 'Catch your first Shiny Pokémon', 100, 'shinyCaught', 1),
  simple('shiny-hunter', 'SHINY HUNTER', 'Catch 5 Shiny Pokémon', 500, 'shinyCaught', 5),
  {
    id: 'rich-player', name: 'RICH PLAYER', description: 'Hold 1,000 coins or earn 2,000 coins in total', reward: 300,
    progress: (profile) => ({
      value: Math.max(profile.coins / PROGRESSION_CONFIG.richPlayerCoinsHeld,
        profile.stats.totalCoinsEarned / PROGRESSION_CONFIG.richPlayerLifetimeEarnings),
      goal: 1,
    }),
  },
]);

export class AchievementSystem {
  constructor(profile, storage, eventBus, { definitions = ACHIEVEMENTS, now = () => new Date() } = {}) {
    Object.assign(this, { profile, storage, eventBus, definitions, now });
    this.evaluating = false;
    this.unsubscribe = [
      'pokemon:caught', 'pokemon:missed', 'pokemon:perfect', 'pokemon:shinyCaught',
      'combo:changed', 'collection:changed', 'player:coinsChanged', 'player:progressChanged',
    ].map((eventName) => eventBus.on(eventName, () => this.evaluate()));
    this.evaluate();
  }

  evaluate() {
    if (this.evaluating) return [];
    this.evaluating = true;
    const unlocked = [];
    try {
      for (const achievement of this.definitions) {
        if (this.profile.achievements[achievement.id]) continue;
        const { value, goal } = achievement.progress(this.profile);
        if (value < goal) continue;
        const record = { ...achievement, unlockedAt: this.now().toISOString() };
        this.profile.achievements[achievement.id] = record.unlockedAt;
        this.storage.savePlayerProfile(this.profile);
        unlocked.push(record);
        this.eventBus.emit('achievement:unlocked', { achievement: record });
      }
    } finally {
      this.evaluating = false;
    }
    return unlocked;
  }

  getItems() {
    return this.definitions.map((achievement) => {
      const { value, goal } = achievement.progress(this.profile);
      const progress = Math.min(goal, value);
      return {
        ...achievement,
        progress,
        goal,
        unlocked: Boolean(this.profile.achievements[achievement.id]),
        unlockedAt: this.profile.achievements[achievement.id] || null,
      };
    });
  }
}
