export class KeyboardInput {
  constructor(ui, api) {
    this.ui = ui;
    this.api = api;
    this.cleanups = [];
  }

  on(target, eventName, handler) {
    target.addEventListener(eventName, handler);
    this.cleanups.push(() => target.removeEventListener(eventName, handler));
  }

  isEditableTarget(target) {
    return target instanceof Element && target.closest('input, textarea, select, [contenteditable="true"]');
  }

  bind() {
    this.on(document, 'keydown', (event) => {
      if (!this.ui.startScreen.modal.hidden) {
        if (event.key === 'Escape') { event.preventDefault(); this.ui.startScreen.closeMode(); }
        return;
      }
      if (this.api.isStartScreenActive()) return;
      if (!this.ui.gameOver.overlay.hidden) {
        if (event.key === 'Tab' || event.key === 'Escape') { event.preventDefault(); this.ui.gameOver.playAgain.focus(); }
        return;
      }
      if (this.isEditableTarget(event.target) || !this.api.canMove()) return;
      const key = event.key.toLowerCase();
      if (event.key === 'ArrowLeft' || key === 'a') {
        event.preventDefault(); this.ui.setPressed(this.ui.leftButton, true); this.api.startMoving(-1);
      }
      if (event.key === 'ArrowRight' || key === 'd') {
        event.preventDefault(); this.ui.setPressed(this.ui.rightButton, true); this.api.startMoving(1);
      }
      const focusedControl = event.target instanceof Element && event.target.closest('button, a');
      if (event.code === 'Space' && !event.repeat && (!focusedControl || this.ui.grabButton.contains(event.target))) {
        event.preventDefault(); this.ui.setPressed(this.ui.grabButton, true); this.api.attemptGrab();
      }
    });
    this.on(this.ui.grabButton, 'keydown', (event) => {
      if (event.key !== 'Enter' || event.repeat) return;
      event.preventDefault(); this.ui.setPressed(this.ui.grabButton, true); this.api.attemptGrab();
    });
    this.on(document, 'keyup', (event) => {
      const key = event.key.toLowerCase();
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || key === 'a' || key === 'd') this.api.stopMoving();
      if (event.code === 'Space') this.ui.setPressed(this.ui.grabButton, false);
    });
    this.on(window, 'blur', () => { this.api.stopMoving(); this.ui.setPressed(this.ui.grabButton, false); });
  }

  destroy() { this.cleanups.splice(0).forEach((cleanup) => cleanup()); }
}
