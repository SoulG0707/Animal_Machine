export class MessageBanner {
  constructor(element, statusElement, getIsReady) {
    this.element = element;
    this.statusElement = statusElement;
    this.getIsReady = getIsReady;
    this.readyPending = false;
  }

  showStatus(message, duration = 1500) {
    clearTimeout(this.statusTimer);
    this.readyPending = false;
    this.statusElement.classList.remove('status-pop');
    this.statusElement.textContent = message;
    if (!message) return;
    void this.statusElement.offsetWidth;
    this.statusElement.classList.add('status-pop');
    this.statusTimer = setTimeout(() => {
      this.statusElement.textContent = '';
      this.statusElement.classList.remove('status-pop');
      if (this.readyPending && this.getIsReady()) {
        this.readyPending = false;
        this.showStatus('READY', 900);
      }
    }, duration);
  }

  queueReady() { this.readyPending = true; }

  hide(immediate = false) {
    clearTimeout(this.messageTimer);
    clearTimeout(this.clearTimer);
    this.element.classList.remove('is-visible');
    this.element.setAttribute('aria-hidden', 'true');
    if (immediate) {
      this.element.textContent = '';
      delete this.element.dataset.tone;
      return;
    }
    this.clearTimer = setTimeout(() => {
      if (this.element.classList.contains('is-visible')) return;
      this.element.textContent = '';
      delete this.element.dataset.tone;
    }, 350);
  }

  show(message, options = {}) {
    if (!message) return this.hide();
    const duration = Math.max(2500, Math.min(Number(options.duration) || 3200, 4000));
    const tone = options.tone === 'tease' ? 'tease' : 'encourage';
    clearTimeout(this.messageTimer);
    clearTimeout(this.clearTimer);
    this.element.classList.remove('is-visible');
    this.element.textContent = message;
    this.element.dataset.tone = tone;
    this.element.setAttribute('aria-hidden', 'false');
    void this.element.offsetWidth;
    this.element.classList.add('is-visible');
    this.messageTimer = setTimeout(() => this.hide(), duration);
  }

  reset() {
    clearTimeout(this.statusTimer);
    this.readyPending = false;
    this.hide(true);
  }
}
