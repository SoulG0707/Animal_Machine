import { GAME_CONFIG } from '../config/gameConfig.js';
import { formatPoints } from '../utils/math.js';

export class ScoreSystem {
  constructor(state, storage, combo, missions, eventBus = null) {
    this.state = state;
    this.storage = storage;
    this.combo = combo;
    this.missions = missions;
    this.eventBus = eventBus;
  }

  trainerLevel(experience = this.state.trainerXp) {
    return Math.floor(experience / GAME_CONFIG.experiencePerLevel) + 1;
  }

  experienceToNextLevel() {
    return GAME_CONFIG.experiencePerLevel - (this.state.trainerXp % GAME_CONFIG.experiencePerLevel);
  }

  processCatch(grab) {
    const prize = grab.pokemon;
    const character = prize.character;
    this.combo.registerCatch();
    this.state.caughtThisGame += 1;
    this.state.sessionCaughtSpecies.add(character.name);

    const catchPoints = Math.round(
      grab.basePoints * (grab.basePoints > 0 ? grab.comboMultiplier : 1) * (prize.shiny ? 2 : 1),
    );
    const perfectBonus = grab.perfect ? 20 : 0;
    const pointsEarned = catchPoints + perfectBonus;
    this.state.score += pointsEarned;

    const oldLevel = this.trainerLevel();
    this.state.trainerXp += Math.max(0, pointsEarned);
    this.storage.saveTrainerXp(this.state.trainerXp);
    const leveledUp = this.trainerLevel() > oldLevel;
    if (this.state.score > this.state.bestScore) {
      this.state.bestScore = this.state.score;
      this.state.newBestThisGame = true;
      this.storage.saveBestScore(this.state.bestScore);
    }
    const missionCompleted = this.missions.checkCompletion();
    const catchPayload = { pokemon: prize, grab, pointsEarned, missionCompleted };
    this.eventBus?.emit('pokemon:caught', catchPayload);
    if (grab.perfect) this.eventBus?.emit('pokemon:perfect', catchPayload);
    if (prize.shiny || prize.variant === 'shiny') this.eventBus?.emit('pokemon:shinyCaught', catchPayload);
    this.eventBus?.emit('player:progressChanged', { kind: 'score', total: this.state.score });
    if (missionCompleted) return '+1 TURN';
    if (leveledUp) return `LEVEL UP! LV ${this.trainerLevel()}`;
    if (grab.perfect) return 'PERFECT +20';
    if (prize.shiny) return 'SHINY! x2';
    if (character.rarity !== 'common') return 'RARE CATCH!';
    return pointsEarned < 0 ? `PENALTY ${pointsEarned}` : `${formatPoints(pointsEarned)} POINTS`;
  }
}
