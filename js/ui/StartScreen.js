export class StartScreen {
  constructor(root = document) {
    this.screen = root.querySelector('#start-screen');
    this.appShell = root.querySelector('.app-shell');
    this.startButton = root.querySelector('#start-game-btn');
    this.openModeButton = root.querySelector('#open-mode-btn');
    this.resetButton = root.querySelector('#reset-data-btn');
    this.modeBadge = root.querySelector('#start-mode-badge');
    this.currentMode = root.querySelector('#start-current-mode');
    this.best = root.querySelector('#start-best');
    this.level = root.querySelector('#start-level');
    this.modal = root.querySelector('#mode-modal');
    this.cancelButton = root.querySelector('#mode-cancel-btn');
    this.confirmButton = root.querySelector('#mode-confirm-btn');
    this.inputs = [...root.querySelectorAll('input[name="game-mode"]')];
  }

  bind({ onStart, onReset, onModeSelect, getMode }) {
    this.startButton.addEventListener('click', onStart);
    this.openModeButton.addEventListener('click', () => this.openMode(getMode()));
    this.resetButton.addEventListener('click', onReset);
    this.cancelButton.addEventListener('click', () => this.closeMode());
    this.confirmButton.addEventListener('click', () => {
      const selected = this.inputs.find((input) => input.checked);
      if (selected && onModeSelect(selected.value)) this.closeMode();
    });
    this.modal.addEventListener('pointerdown', (event) => {
      if (event.target === this.modal) this.closeMode();
    });
  }

  render({ modeLabel, bestScore, level }) {
    this.modeBadge.textContent = modeLabel;
    this.currentMode.textContent = modeLabel;
    this.best.textContent = String(bestScore).padStart(3, '0');
    this.level.textContent = String(level);
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
