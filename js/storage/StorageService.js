import { DEFAULT_DIFFICULTY, isDifficulty } from '../config/difficultyConfig.js';

const KEYS = Object.freeze({
  bestScore: 'animal-machine-best',
  collection: 'pokemon-machine-pokedex',
  trainerXp: 'pokemon-machine-trainer-xp',
  mode: 'pokemon-machine-mode',
});

export class StorageService {
  constructor({ temporary = false } = {}) {
    this.temporary = temporary;
    this.memory = new Map();
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
    const value = Number(stored);
    return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : fallback;
  }

  loadProfile(characters) {
    return {
      bestScore: this.readNumber(KEYS.bestScore),
      trainerXp: this.readNumber(KEYS.trainerXp),
      mode: this.loadMode(),
      pokedexCounts: this.loadCollection(characters),
    };
  }

  loadMode() {
    const mode = this.read(KEYS.mode);
    return isDifficulty(mode) ? mode : DEFAULT_DIFFICULTY;
  }

  loadCollection(characters) {
    let stored = {};
    try {
      const raw = this.read(KEYS.collection);
      stored = raw ? JSON.parse(raw) : {};
    } catch {
      stored = {};
    }
    return Object.fromEntries(characters.map((character) => {
      const value = Number(stored?.[character.name]);
      return [character.name, Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0];
    }));
  }

  saveBestScore(value) { this.write(KEYS.bestScore, String(value)); }
  saveTrainerXp(value) { this.write(KEYS.trainerXp, String(value)); }
  saveMode(value) { this.write(KEYS.mode, value); }
  saveCollection(value) { this.write(KEYS.collection, JSON.stringify(value)); }

  clearAll() {
    if (this.temporary) { this.memory.clear(); return; }
    try { localStorage.clear(); } catch { /* Storage may be disabled. */ }
  }
}
