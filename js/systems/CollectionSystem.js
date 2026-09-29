import { emptyCollectionEntry } from '../storage/PlayerProfile.js';

export class CollectionSystem {
  constructor(state, storage, eventBus, characters, { now = () => new Date() } = {}) {
    Object.assign(this, { state, storage, eventBus, characters, now });
    this.characterByName = new Map(characters.map((character) => [character.name, character]));
    this.unsubscribe = eventBus.on('pokemon:caught', (payload) => this.recordCatch(payload));
  }

  recordCatch({ pokemon, grab } = {}) {
    const name = pokemon?.character?.name || pokemon?.name;
    if (!name) return null;
    const profile = this.state.profile;
    const entry = profile.collection[name] || emptyCollectionEntry();
    const isFirstCatch = entry.caughtCount === 0;
    entry.discovered = true;
    entry.caughtCount += 1;
    if (pokemon.shiny || pokemon.variant === 'shiny') entry.shinyCaughtCount += 1;
    if (!entry.firstCaughtAt) entry.firstCaughtAt = this.now().toISOString();
    entry.bestGrabQuality = Math.max(entry.bestGrabQuality, Math.min(1, Math.max(0, Number(grab?.grabQuality) || 0)));
    profile.collection[name] = entry;
    const character = this.characterByName.get(name);
    if (isFirstCatch && character) {
      character.newThisGame = true;
      if (!this.state.newUnlocksThisGame.includes(name)) this.state.newUnlocksThisGame.push(name);
    }
    this.storage.savePlayerProfile(profile);
    this.eventBus.emit('collection:changed', { name, entry: { ...entry }, isFirstCatch });
    return entry;
  }

  getEntry(name) {
    return this.state.profile.collection[name] || emptyCollectionEntry();
  }

  getDiscoveredCount() {
    return Object.values(this.state.profile.collection).filter((entry) => entry.discovered).length;
  }
}
