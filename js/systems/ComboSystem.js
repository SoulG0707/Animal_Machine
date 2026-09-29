import { PROGRESSION_CONFIG } from '../config/progressionConfig.js';

export class ComboSystem {
  constructor(state, eventBus = null, config = PROGRESSION_CONFIG) {
    this.state = state;
    this.eventBus = eventBus;
    this.config = config;
  }

  registerCatch() {
    this.state.currentCombo += 1;
    this.state.bestCombo = Math.max(this.state.bestCombo, this.state.currentCombo);
    const multiplier = this.multiplierFor(this.state.currentCombo);
    this.eventBus?.emit('combo:changed', {
      current: this.state.currentCombo,
      best: this.state.bestCombo,
      multiplier,
    });
    return this.state.currentCombo;
  }

  reset() {
    const changed = this.state.currentCombo !== 0;
    this.state.currentCombo = 0;
    if (changed) this.eventBus?.emit('combo:changed', { current: 0, best: this.state.bestCombo, multiplier: 1, reset: true });
  }

  nextMultiplier() {
    return this.multiplierFor(this.state.currentCombo + 1);
  }

  multiplierFor(combo) {
    const index = Math.max(0, Math.min(this.config.comboMultipliers.length - 1, Math.floor(combo) - 1));
    return this.config.comboMultipliers[index] || 1;
  }
}
