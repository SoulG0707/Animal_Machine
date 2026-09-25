import { GAME_CONFIG } from '../config/gameConfig.js';
import { formatPoints } from '../utils/math.js';

export class ScoreSystem {
  constructor(state, storage, combo, missions) {
    this.state = state;
    this.storage = storage;
    this.combo = combo;
    this.missions = missions;
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

    const previousCount = this.state.pokedexCounts[character.name] || 0;
    this.state.pokedexCounts[character.name] = previousCount + 1;
    if (previousCount === 0) {
      character.newThisGame = true;
      this.state.newUnlocksThisGame.push(character.name);
    }
    this.storage.saveCollection(this.state.pokedexCounts);

    const catchPoints = grab.basePoints * (grab.basePoints > 0 ? grab.comboMultiplier : 1) * (prize.shiny ? 2 : 1);
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
    if (missionCompleted) return '+1 TURN';
    if (leveledUp) return `LEVEL UP! LV ${this.trainerLevel()}`;
    if (grab.perfect) return 'PERFECT +20';
    if (prize.shiny) return 'SHINY! x2';
    if (character.rarity !== 'common') return 'RARE CATCH!';
    return pointsEarned < 0 ? `PENALTY ${pointsEarned}` : `${formatPoints(pointsEarned)} POINTS`;
  }
}
