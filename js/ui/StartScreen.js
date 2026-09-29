export class StartScreen {
  constructor(root = document) {
    this.screen = root.querySelector('#start-screen');
    this.appShell = root.querySelector('.app-shell');
    this.startButton = root.querySelector('#start-game-btn');
    this.startButtonLabel = this.startButton.querySelector('.start-button-label');
    this.playCost = root.querySelector('#start-play-cost');
    this.openModeButton = root.querySelector('#open-mode-btn');
    this.resetButton = root.querySelector('#reset-data-btn');
    this.modeBadge = root.querySelector('#start-mode-badge');
    this.currentMode = root.querySelector('#start-current-mode');
    this.best = root.querySelector('#start-best');
    this.level = root.querySelector('#start-level');
    this.coins = root.querySelector('#start-coins');
    this.profileButton = root.querySelector('#start-profile-btn');
    this.modal = root.querySelector('#mode-modal');
    this.cancelButton = root.querySelector('#mode-cancel-btn');
    this.confirmButton = root.querySelector('#mode-confirm-btn');
    this.inputs = [...root.querySelectorAll('input[name="game-mode"]')];
    this.loading = false;
    this.canPlay = true;
  }

  bind({ onStart, onReset, onModeSelect, getMode, onProfile }) {
    this.startButton.addEventListener('click', onStart);
    this.openModeButton.addEventListener('click', () => this.openMode(getMode()));
    this.resetButton.addEventListener('click', onReset);
    this.profileButton?.addEventListener('click', (event) => onProfile?.('daily', event.currentTarget));
    this.cancelButton.addEventListener('click', () => this.closeMode());
    this.confirmButton.addEventListener('click', () => {
      const selected = this.inputs.find((input) => input.checked);
      if (selected && onModeSelect(selected.value)) this.closeMode();
    });
    this.modal.addEventListener('pointerdown', (event) => {
      if (event.target === this.modal) this.closeMode();
    });
  }

  render({ modeLabel, bestScore, level, coins = 0, playCost = 0 }) {
    this.modeBadge.textContent = modeLabel;
    this.currentMode.textContent = modeLabel;
    this.best.textContent = String(bestScore).padStart(3, '0');
    this.level.textContent = String(level);
    this.coins.textContent = String(coins);
    this.canPlay = coins >= playCost;
    this.startButton.disabled = this.loading || !this.canPlay;
    this.startButtonLabel.textContent = this.canPlay ? 'BẮT ĐẦU' : 'NOT ENOUGH COINS';
    this.playCost.textContent = `${playCost} COINS / PLAY`;
    this.startButton.setAttribute('aria-label', coins < playCost ? 'Not enough coins to start a game' : `Bắt đầu một lượt chơi với giá ${playCost} coins`);
    this.startButton.title = coins < playCost ? 'NOT ENOUGH COINS · Open Trainer Profile for daily missions' : `${playCost} COINS PER PLAY`;
  }

  setLoading(loading) {
    this.loading = loading;
    this.startButton.disabled = loading || !this.canPlay;
    this.startButton.setAttribute('aria-busy', String(loading));
    this.startButtonLabel.textContent = loading ? 'ĐANG TẢI POKÉMON…' : (this.canPlay ? 'BẮT ĐẦU' : 'NOT ENOUGH COINS');
  }

  openMode(currentMode) {
    const selected = this.inputs.find((input) => input.value === currentMode)
      || this.inputs.find((input) => input.checked)
      || this.inputs[1];
    selected.checked = true;
    this.modal.hidden = false;
    this.modal.setAttribute('aria-hidden', 'false');
    selected.focus({ preventScroll: true });
  }

  setCurrentMode(mode) {
    const input = this.inputs.find((item) => item.value === mode);
    if (input) input.checked = true;
  }

  closeMode() {
    this.modal.hidden = true;
    this.modal.setAttribute('aria-hidden', 'true');
    this.openModeButton.focus({ preventScroll: true });
  }

  show() {
    this.screen.hidden = false;
    this.screen.setAttribute('aria-hidden', 'false');
    this.appShell.inert = true;
    this.appShell.setAttribute('inert', '');
    this.appShell.setAttribute('aria-hidden', 'true');
    document.body.classList.add('start-screen-open');
  }

  hide() {
    this.screen.hidden = true;
    this.screen.setAttribute('aria-hidden', 'true');
    this.appShell.inert = false;
    this.appShell.removeAttribute('inert');
    this.appShell.setAttribute('aria-hidden', 'false');
    document.body.classList.remove('start-screen-open');
  }
}
