import { DEFAULT_DIFFICULTY, DIFFICULTY_SETTINGS, isDifficulty } from '../config/difficultyConfig.js';

export class DifficultySystem {
  constructor(state, storage) {
    this.state = state;
    this.storage = storage;
  }

  get current() {
    return DIFFICULTY_SETTINGS[this.state.mode];
  }

  select(mode) {
    if (!isDifficulty(mode)) return false;
    this.state.mode = mode;
    this.storage.saveMode(mode);
    return true;
  }

  reset() {
    this.state.mode = DEFAULT_DIFFICULTY;
  }
}
