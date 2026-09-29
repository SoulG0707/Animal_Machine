import { DEFAULT_DIFFICULTY, isDifficulty } from '../config/difficultyConfig.js';
import { PROFILE_VERSION, PROGRESSION_CONFIG } from '../config/progressionConfig.js';
import { PlayerProfile, emptyCollectionEntry } from './PlayerProfile.js';

const KEYS = Object.freeze({
  bestScore: 'animal-machine-best',
  collection: 'pokemon-machine-pokedex',
  trainerXp: 'pokemon-machine-trainer-xp',
  mode: 'pokemon-machine-mode',
  profile: 'pokemon-machine-player-profile',
});

function nonNegativeInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : fallback;
}

function collectionEntryCount(value) {
  if (!value || typeof value !== 'object') return nonNegativeInteger(value);
  return nonNegativeInteger(value.caughtCount ?? value.count ?? value.caught);
}

export class StorageService {
  constructor({ temporary = false } = {}) {
    this.temporary = temporary;
    this.memory = new Map();
    this.profile = null;
    this.characters = [];
  }

  read(key) {
    if (this.temporary) return this.memory.get(key) ?? null;
    try { return localStorage.getItem(key); } catch { return null; }
  }

  write(key, value) {
    if (this.temporary) { this.memory.set(key, value); return; }
    try { localStorage.setItem(key, value); } catch { /* Storage may be disabled. */ }
  }

  readNumber(key, fallback = 0) {
    const stored = this.read(key);
    if (stored === null || stored.trim() === '') return fallback;
    return nonNegativeInteger(stored, fallback);
  }

  readJson(key) {
    try {
      const raw = this.read(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  loadProfile(characters = []) {
    this.characters = characters;
    const saved = this.readJson(KEYS.profile);
    const legacyCounts = this.loadCollection(characters);
    const legacyBest = this.readNumber(KEYS.bestScore);
    const legacyXp = this.readNumber(KEYS.trainerXp);
    const legacyMode = this.loadMode();
    const collection = { ...(saved?.collection || {}) };

    // Keep the higher count if both the old keys and the versioned profile
    // exist. This prevents migration from ever erasing an earlier Pokédex.
    for (const character of characters) {
      const name = character.name;
      const existing = collection[name] && typeof collection[name] === 'object'
        ? collection[name]
        : emptyCollectionEntry();
      const oldCount = legacyCounts[name] || 0;
      const caughtCount = Math.max(collectionEntryCount(existing), oldCount);
      collection[name] = {
        ...emptyCollectionEntry(),
        ...existing,
        caughtCount,
        discovered: Boolean(existing.discovered) || caughtCount > 0,
      };
    }

    const profile = new PlayerProfile({
      ...(saved || {}),
      bestScore: Math.max(nonNegativeInteger(saved?.bestScore), legacyBest),
      trainerXp: Math.max(nonNegativeInteger(saved?.trainerXp), legacyXp),
      mode: isDifficulty(saved?.mode) ? saved.mode : legacyMode || DEFAULT_DIFFICULTY,
      collection,
      coins: saved?.coins === undefined ? PROGRESSION_CONFIG.startingCoins : saved.coins,
    }, characters);
    const migrated = saved?.version !== PROFILE_VERSION;
    this.profile = profile;

    if (migrated || !this.read(KEYS.profile)) this.savePlayerProfile(profile);
    return {
      playerProfile: profile,
      bestScore: profile.bestScore,
      trainerXp: profile.trainerXp,
      mode: profile.mode,
      pokedexCounts: Object.fromEntries(characters.map(({ name }) => [name, profile.collection[name]?.caughtCount || 0])),
    };
  }

  loadMode() {
    const mode = this.read(KEYS.mode);
    return isDifficulty(mode) ? mode : DEFAULT_DIFFICULTY;
  }

  loadCollection(characters = this.characters) {
    const stored = this.readJson(KEYS.collection) || {};
    return Object.fromEntries(characters.map((character) => {
      const raw = stored?.[character.name];
      return [character.name, collectionEntryCount(raw)];
    }));
  }

  savePlayerProfile(profile = this.profile) {
    if (!profile) return;
    this.profile = profile;
    this.write(KEYS.profile, JSON.stringify(profile));
    // Retain legacy mirrors so older builds can still read score, XP, mode,
    // and caught counts if the player rolls back to a previous version.
    if (profile.bestScore > 0) this.write(KEYS.bestScore, String(profile.bestScore));
    if (profile.trainerXp > 0) this.write(KEYS.trainerXp, String(profile.trainerXp));
    if (profile.mode !== DEFAULT_DIFFICULTY && isDifficulty(profile.mode)) this.write(KEYS.mode, profile.mode);
    const counts = Object.fromEntries(Object.entries(profile.collection || {}).map(([name, entry]) => [name, entry.caughtCount || 0]));
    this.write(KEYS.collection, JSON.stringify(counts));
  }

  saveBestScore(value) {
    if (this.profile) this.profile.bestScore = nonNegativeInteger(value);
    this.write(KEYS.bestScore, String(nonNegativeInteger(value)));
    if (this.profile) this.write(KEYS.profile, JSON.stringify(this.profile));
  }

  saveTrainerXp(value) {
    if (this.profile) this.profile.trainerXp = nonNegativeInteger(value);
    this.write(KEYS.trainerXp, String(nonNegativeInteger(value)));
    if (this.profile) this.write(KEYS.profile, JSON.stringify(this.profile));
  }

  saveMode(value) {
    if (isDifficulty(value) && this.profile) this.profile.mode = value;
    this.write(KEYS.mode, value);
    if (this.profile) this.write(KEYS.profile, JSON.stringify(this.profile));
  }

  saveCollection(value) {
    if (this.profile && value && typeof value === 'object') {
      Object.entries(value).forEach(([name, caughtCount]) => {
        const entry = this.profile.collection[name] || emptyCollectionEntry();
        entry.caughtCount = nonNegativeInteger(caughtCount);
        entry.discovered = entry.discovered || entry.caughtCount > 0;
        this.profile.collection[name] = entry;
      });
      this.write(KEYS.profile, JSON.stringify(this.profile));
    }
    this.write(KEYS.collection, JSON.stringify(value || {}));
  }

  clearAll() {
    this.profile = null;
    if (this.temporary) { this.memory.clear(); return; }
    try { localStorage.clear(); } catch { /* Storage may be disabled. */ }
  }
}
