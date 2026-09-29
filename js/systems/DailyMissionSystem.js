import { PROGRESSION_CONFIG, RARITY_ORDER, localDateKey } from '../config/progressionConfig.js';

export const DAILY_MISSION_POOL = Object.freeze([
  { id: 'catch-3', type: 'catch-count', goal: 3, copy: 'Catch 3 Pokémon', weight: 1 },
  { id: 'perfect-2', type: 'perfect-count', goal: 2, copy: 'Get 2 PERFECT grabs', weight: 1 },
  { id: 'combo-3', type: 'combo', goal: 3, copy: 'Reach combo 3', weight: 1 },
  { id: 'species', type: 'species', goal: 1, copy: 'Catch {species}', weight: 0.9 },
  { id: 'rare-1', type: 'rarity', goal: 1, rarity: 'rare', copy: 'Catch a Rare or better Pokémon', weight: 0.75 },
  { id: 'shiny-1', type: 'shiny', goal: 1, copy: 'Catch a Shiny Pokémon', weight: 0.035 },
]);

function seededRandom(seedText) {
  let seed = 2166136261;
  for (const character of seedText) seed = Math.imul(seed ^ character.charCodeAt(0), 16777619);
  return () => {
    seed += 0x6D2B79F5;
    let value = seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export class DailyMissionSystem {
  constructor(profile, storage, eventBus, characters, {
    now = () => new Date(), rng = null, definitions = DAILY_MISSION_POOL,
    config = PROGRESSION_CONFIG,
  } = {}) {
    Object.assign(this, { profile, storage, eventBus, characters, now, rng, definitions, config });
    this.ensureCurrentDay();
    this.unsubscribe = [
      eventBus.on('pokemon:caught', (payload) => this.onCatch(payload)),
      eventBus.on('pokemon:perfect', (payload) => this.onPerfect(payload)),
      eventBus.on('pokemon:shinyCaught', (payload) => this.onShiny(payload)),
      eventBus.on('combo:changed', (payload) => this.onCombo(payload)),
    ];
  }

  get missions() { return this.profile.dailyMissions.missions; }

  getDateKey() {
    const date = this.now();
    return typeof date === 'string' ? date : localDateKey(date);
  }

  generate(dateKey = this.getDateKey()) {
    const random = this.rng || seededRandom(dateKey);
    const remaining = this.definitions.map((definition) => ({ ...definition }));
    const selected = [];
    while (remaining.length && selected.length < this.config.dailyMissionRewards.length) {
      const weightTotal = remaining.reduce((sum, item) => sum + Math.max(0, item.weight ?? 1), 0);
      let roll = Math.max(0, Math.min(0.999999999, random())) * weightTotal;
      let index = remaining.findIndex((item) => (roll -= Math.max(0, item.weight ?? 1)) < 0);
      if (index < 0) index = remaining.length - 1;
      const [definition] = remaining.splice(index, 1);
      let species = null;
      if (definition.type === 'species') {
        const targetable = this.characters;
        species = targetable[Math.floor(random() * targetable.length)]?.name || 'Pikachu';
      }
      const copy = definition.copy.replace('{species}', species || 'Pokémon');
      selected.push({
        id: `${definition.id}-${dateKey}`,
        definitionId: definition.id,
        type: definition.type,
        goal: definition.goal,
        progress: 0,
        copy,
        species,
        rarity: definition.rarity || null,
        reward: this.config.dailyMissionRewards[selected.length],
        completed: false,
      });
    }
    return selected;
  }

  ensureCurrentDay() {
    const today = this.getDateKey();
    const daily = this.profile.dailyMissions;
    if (daily.date === today && Array.isArray(daily.missions) && daily.missions.length === this.config.dailyMissionRewards.length) return false;
    this.profile.dailyMissions = { date: today, missions: this.generate(today), allBonusClaimed: false };
    this.profile.lastDailyReset = today;
    this.storage.savePlayerProfile(this.profile);
    return true;
  }

  update(kind, payload = {}) {
    let changed = false;
    this.missions.forEach((mission, index) => {
      if (mission.completed) return;
      const definition = this.definitions.find((item) => item.id === mission.definitionId);
      if (!definition) return;
      if (kind === 'catch' && definition.type === 'catch-count') {
        mission.progress += 1; changed = true;
      }
      if (kind === 'catch' && definition.type === 'species' && payload.name === mission.species) {
        mission.progress += 1; changed = true;
      }
      if (kind === 'catch' && definition.type === 'rarity') {
        const caughtRarity = RARITY_ORDER.indexOf(payload.rarity || 'common');
        const requiredRarity = RARITY_ORDER.indexOf(mission.rarity || 'rare');
        if (caughtRarity >= requiredRarity) { mission.progress += 1; changed = true; }
      }
      if (kind === 'perfect' && definition.type === 'perfect-count') {
        mission.progress += 1; changed = true;
      }
      if (kind === 'shiny' && definition.type === 'shiny') {
        mission.progress += 1; changed = true;
      }
      if (kind === 'combo' && definition.type === 'combo' && payload.current >= mission.goal) {
        mission.progress = mission.goal; changed = true;
      }
      mission.progress = Math.min(mission.goal, mission.progress);
      if (mission.progress >= mission.goal) {
        mission.completed = true;
        this.storage.savePlayerProfile(this.profile);
        this.eventBus.emit('mission:completed', { mission: { ...mission }, index, reward: mission.reward });
      }
    });
    if (!changed) return;
    const daily = this.profile.dailyMissions;
    if (daily.missions.every((mission) => mission.completed) && !daily.allBonusClaimed) {
      daily.allBonusClaimed = true;
      this.storage.savePlayerProfile(this.profile);
      this.eventBus.emit('daily:allCompleted', { reward: this.config.dailyMissionCompletionBonus });
    } else this.storage.savePlayerProfile(this.profile);
    this.eventBus.emit('daily:progress', { missions: this.missions.map((mission) => ({ ...mission })) });
  }

  onCatch({ pokemon } = {}) {
    const character = pokemon?.character || {};
    this.update('catch', {
      name: character.name || pokemon?.name,
      rarity: character.rarity || 'common',
      shiny: Boolean(pokemon?.shiny),
    });
  }

  onPerfect(payload = {}) { this.update('perfect', payload); }
  onShiny(payload = {}) { this.update('shiny', payload); }
  onCombo(payload = {}) { this.update('combo', payload); }
}
