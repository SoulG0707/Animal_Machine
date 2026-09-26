import { DEFAULT_DIFFICULTY } from '../config/difficultyConfig.js';
import { GAME_CONFIG } from '../config/gameConfig.js';

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
  constructor({ bestScore = 0, trainerXp = 0, mode = DEFAULT_DIFFICULTY, pokedexCounts = {} } = {}) {
    this.bestScore = bestScore;
    this.trainerXp = trainerXp;
    this.mode = mode;
    this.pokedexCounts = pokedexCounts;
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
  }
}
