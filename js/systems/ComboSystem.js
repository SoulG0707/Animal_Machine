export class ComboSystem {
  constructor(state) {
    this.state = state;
  }

  registerCatch() {
    this.state.currentCombo += 1;
    this.state.bestCombo = Math.max(this.state.bestCombo, this.state.currentCombo);
    return Math.min(this.state.currentCombo, 3);
  }

  reset() {
    this.state.currentCombo = 0;
  }

  nextMultiplier() {
    return Math.min(this.state.currentCombo + 1, 3);
  }
}
