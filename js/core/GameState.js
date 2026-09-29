import { DEFAULT_DIFFICULTY } from '../config/difficultyConfig.js';
import { GAME_CONFIG } from '../config/gameConfig.js';
import { PlayerProfile } from '../storage/PlayerProfile.js';

export const ClawState = Object.freeze({
  READY: 'ready',
  DESCENDING: 'descending',
  CLOSING: 'closing',
  LIFTING: 'lifting',
  CARRYING: 'carrying',
  RELEASING: 'releasing',
  WAITING_FOR_CHUTE: 'waiting-for-chute',
  SLIPPING: 'slipping',
  RETURNING: 'returning',
  GAME_OVER: 'game-over',
});

export const AppState = Object.freeze({
  MENU: 'menu',
  PLAYING: 'playing',
  PAUSED: 'paused',
  GAME_OVER: 'game-over',
});

export const PokemonState = Object.freeze({
  IDLE: 'idle',
  GRABBED: 'grabbed',
  SLIPPING: 'slipping',
  FALLING: 'falling',
  SETTLING: 'settling',
  DROPPING_TO_CHUTE: 'dropping-to-chute',
  CAUGHT: 'caught',
});

export class GameState {
  constructor(profileData = {}) {
    const legacyCounts = profileData.pokedexCounts || {};
    const profileSource = profileData.playerProfile || {
      ...profileData,
      collection: profileData.collection || Object.fromEntries(Object.entries(legacyCounts).map(([name, caughtCount]) => [
        name, { discovered: Number(caughtCount) > 0, caughtCount, shinyCaughtCount: 0 },
      ])),
    };
    this.profile = profileSource instanceof PlayerProfile
      ? profileSource
      : new PlayerProfile(profileSource, Object.keys(legacyCounts).map((name) => ({ name })));
    Object.defineProperties(this, {
      bestScore: { enumerable: true, get: () => this.profile.bestScore, set: (value) => { this.profile.bestScore = Math.max(0, Math.floor(Number(value) || 0)); } },
      trainerXp: { enumerable: true, get: () => this.profile.trainerXp, set: (value) => { this.profile.trainerXp = Math.max(0, Math.floor(Number(value) || 0)); } },
      mode: { enumerable: true, get: () => this.profile.mode, set: (value) => { this.profile.mode = value || DEFAULT_DIFFICULTY; } },
    });
    this.pokedexCounts = this.createLegacyCollectionView();
    this.appState = AppState.MENU;
    this.prizes = [];
    this.particles = [];
    this.lastTime = 0;
    this.movementInput = { left: false, right: false };
    this.turnTimeMax = 0;
    this.turnTimeRemaining = 0;
    this.autoGrabTriggered = false;
    this.selectedCharacter = null;
    this.mission = null;
    this.resetRun();
  }

  resetRun() {
    this.score = 0;
    this.turns = GAME_CONFIG.initialTurns;
    this.movementInput.left = false;
    this.movementInput.right = false;
    this.newBestThisGame = false;
    this.currentCombo = 0;
    this.bestCombo = 0;
    this.caughtThisGame = 0;
    this.newUnlocksThisGame = [];
    this.sessionCaughtSpecies = new Set();
    this.particles = [];
    this.grabAttemptId = 0;
    this.turnTimeRemaining = this.turnTimeMax;
    this.autoGrabTriggered = false;
    this.fever ||= { active: false, remaining: 0 };
  }

  createLegacyCollectionView() {
    const state = this;
    return new Proxy({}, {
      get(_target, key) {
        if (key === Symbol.toStringTag) return 'Object';
        if (key === 'toJSON') return () => Object.fromEntries(Object.entries(state.profile.collection).map(([name, entry]) => [name, entry.caughtCount]));
        if (typeof key !== 'string') return undefined;
        return state.profile.collection[key]?.caughtCount || 0;
      },
      set(_target, key, value) {
        if (typeof key !== 'string') return false;
        const caughtCount = Math.max(0, Math.floor(Number(value) || 0));
        const entry = state.profile.collection[key] || { discovered: false, caughtCount: 0, shinyCaughtCount: 0, firstCaughtAt: null, bestGrabQuality: 0 };
        entry.caughtCount = caughtCount;
        entry.discovered = entry.discovered || caughtCount > 0;
        entry.shinyCaughtCount = Math.min(entry.shinyCaughtCount || 0, caughtCount);
        state.profile.collection[key] = entry;
        return true;
      },
      ownKeys() { return Reflect.ownKeys(state.profile.collection); },
      has(_target, key) { return Object.hasOwn(state.profile.collection, key); },
      getOwnPropertyDescriptor(_target, key) {
        if (!Object.hasOwn(state.profile.collection, key)) return undefined;
        return { enumerable: true, configurable: true, writable: true, value: state.profile.collection[key].caughtCount };
      },
    });
  }
}
