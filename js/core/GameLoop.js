export class GameLoop {
  constructor(update) {
    this.update = update;
    this.frame = this.frame.bind(this);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.frameId = requestAnimationFrame(this.frame);
  }

  frame(time) {
    if (!this.running) return;
    this.update(time);
    this.frameId = requestAnimationFrame(this.frame);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.frameId);
  }
}
