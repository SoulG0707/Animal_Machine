import { DEFAULT_DIFFICULTY, isDifficulty } from '../config/difficultyConfig.js';
import { PROFILE_VERSION, PROGRESSION_CONFIG } from '../config/progressionConfig.js';

const STAT_KEYS = Object.freeze([
  'totalPlays', 'totalCatches', 'totalMisses', 'totalPerfects', 'highestCombo',
  'totalCoinsEarned', 'shinyCaught',
]);

function count(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0;
}

function quality(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : 0;
}

export function emptyCollectionEntry() {
  return {
    discovered: false,
    caughtCount: 0,
    shinyCaughtCount: 0,
    firstCaughtAt: null,
    bestGrabQuality: 0,
  };
}

export class PlayerProfile {
  constructor(data = {}, characters = []) {
    this.version = PROFILE_VERSION;
    this.coins = data.coins === undefined ? PROGRESSION_CONFIG.startingCoins : count(data.coins);
    this.bestScore = count(data.bestScore);
    this.trainerXp = count(data.trainerXp);
    this.mode = isDifficulty(data.mode) ? data.mode : DEFAULT_DIFFICULTY;
    this.stats = Object.fromEntries(STAT_KEYS.map((key) => [key, count(data.stats?.[key])]));
    this.collection = {};
    for (const [name, saved] of Object.entries(data.collection || {})) {
      const entry = saved && typeof saved === 'object' ? saved : { caughtCount: saved };
      const caughtCount = count(entry.caughtCount ?? entry.count ?? entry.caught);
      const shinyCaughtCount = Math.min(caughtCount, count(entry.shinyCaughtCount));
      this.collection[name] = {
        discovered: Boolean(entry.discovered) || caughtCount > 0,
        caughtCount,
        shinyCaughtCount,
        firstCaughtAt: typeof entry.firstCaughtAt === 'string' ? entry.firstCaughtAt : null,
        bestGrabQuality: quality(entry.bestGrabQuality),
      };
    }
    for (const character of characters) this.collection[character.name] ||= emptyCollectionEntry();
    this.achievements = {};
    for (const [id, unlocked] of Object.entries(data.achievements || {})) {
      if (unlocked) this.achievements[id] = typeof unlocked === 'string' ? unlocked : 'unlocked';
    }
    this.dailyMissions = data.dailyMissions && typeof data.dailyMissions === 'object'
      ? data.dailyMissions
      : { date: null, missions: [], allBonusClaimed: false };
    this.lastDailyReset = typeof data.lastDailyReset === 'string' ? data.lastDailyReset : null;
    this.lastLoginBonusDate = typeof data.lastLoginBonusDate === 'string' ? data.lastLoginBonusDate : null;
  }

  reset(characters = []) {
    const fresh = new PlayerProfile({}, characters);
    Object.keys(this).forEach((key) => { this[key] = fresh[key]; });
    return this;
  }

  toJSON() {
    return {
      version: this.version,
      coins: this.coins,
      bestScore: this.bestScore,
      trainerXp: this.trainerXp,
      mode: this.mode,
      stats: { ...this.stats },
      collection: Object.fromEntries(Object.entries(this.collection).map(([name, entry]) => [name, { ...entry }])),
      achievements: { ...this.achievements },
      dailyMissions: {
        ...this.dailyMissions,
        missions: Array.isArray(this.dailyMissions.missions)
          ? this.dailyMissions.missions.map((mission) => ({ ...mission }))
          : [],
      },
      lastDailyReset: this.lastDailyReset,
      lastLoginBonusDate: this.lastLoginBonusDate,
    };
  }
}
