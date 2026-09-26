export class TouchInput {
  constructor(ui, api) {
    this.ui = ui;
    this.api = api;
    this.cleanups = [];
  }

  on(target, eventName, handler, options) {
    target.addEventListener(eventName, handler, options);
    this.cleanups.push(() => target.removeEventListener(eventName, handler, options));
  }

  bind() {
    [this.ui.leftButton, this.ui.rightButton].forEach((button, index) => {
      const direction = index === 0 ? -1 : 1;
      this.on(button, 'pointerdown', (event) => {
        event.preventDefault();
        if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0) || !this.api.canMove()) return;
        this.ui.setPressed(button, true);
        this.api.setMovementInput(direction, true);
        button.setPointerCapture?.(event.pointerId);
      });
      for (const eventName of ['pointerup', 'pointercancel', 'lostpointercapture']) {
        this.on(button, eventName, () => this.api.stopMoving(direction));
      }
      this.on(button, 'pointerleave', (event) => {
        if (!button.hasPointerCapture?.(event.pointerId)) this.api.stopMoving(direction);
      });
      this.on(button, 'click', (event) => {
        if (event.detail === 0) this.api.stepMove(direction);
      });
    });
    this.on(this.ui.grabButton, 'pointerdown', (event) => {
      event.preventDefault();
      if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
      this.ui.setPressed(this.ui.grabButton, true);
      this.api.attemptGrab();
    });
    this.on(this.ui.grabButton, 'pointerup', () => this.ui.setPressed(this.ui.grabButton, false));
    this.on(this.ui.grabButton, 'pointercancel', () => this.ui.setPressed(this.ui.grabButton, false));
    for (const eventName of ['contextmenu', 'dragstart', 'selectstart']) {
      this.on(this.ui.controls, eventName, (event) => event.preventDefault());
    }
  }

  destroy() { this.cleanups.splice(0).forEach((cleanup) => cleanup()); }
}
