export class GameEventBus {
  constructor() {
    this.listeners = new Map();
  }

  on(eventName, handler) {
    if (typeof handler !== 'function') throw new TypeError('Event listener must be a function');
    if (!this.listeners.has(eventName)) this.listeners.set(eventName, new Set());
    this.listeners.get(eventName).add(handler);
    return () => this.off(eventName, handler);
  }

  off(eventName, handler) {
    const handlers = this.listeners.get(eventName);
    if (!handlers) return false;
    const removed = handlers.delete(handler);
    if (!handlers.size) this.listeners.delete(eventName);
    return removed;
  }

  emit(eventName, payload = {}) {
    for (const handler of [...(this.listeners.get(eventName) || [])]) handler(payload);
  }

  clear() {
    this.listeners.clear();
  }
}
