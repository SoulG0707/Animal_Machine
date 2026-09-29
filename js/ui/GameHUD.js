import { PROGRESSION_CONFIG } from '../config/progressionConfig.js';

export class GameHUD {
  constructor(root = document) {
    this.score = root.querySelector('#score');
    this.turns = root.querySelector('#turns');
    this.timer = root.querySelector('#turn-timer');
    this.timerBlock = root.querySelector('.timer-block');
    this.best = root.querySelector('#best-score');
    this.turnPips = root.querySelector('#turn-pips');
    this.combo = root.querySelector('#combo-display');
    this.trainerLevel = root.querySelector('#trainer-level');
    this.missionCard = root.querySelector('.mission-card');
    this.missionCopy = root.querySelector('#mission-copy');
    this.missionProgress = root.querySelector('#mission-progress');
    this.missionState = root.querySelector('#mission-state');
    this.missionFill = root.querySelector('#mission-fill');
    this.coins = root.querySelector('#coin-balance');
    this.dailyCompleteCount = root.querySelector('#daily-complete-count');
    this.feverIndicator = root.querySelector('#fever-indicator');
    this.feverTime = root.querySelector('#fever-time');
  }

  render(state, level, experienceToNext) {
    this.score.textContent = String(state.score).padStart(3, '0');
    this.turns.textContent = String(state.turns).padStart(2, '0');
    this.renderTimer(state.turnTimeRemaining);
    this.best.textContent = String(state.bestScore).padStart(3, '0');
    this.turnPips.querySelectorAll('i').forEach((pip, index) => pip.classList.toggle('empty', index >= state.turns));
    this.combo.hidden = state.currentCombo < 2;
    if (state.currentCombo >= 2) {
      const multiplier = PROGRESSION_CONFIG.comboMultipliers[Math.min(state.currentCombo, PROGRESSION_CONFIG.comboMultipliers.length) - 1] || 1;
      this.combo.textContent = `COMBO ×${Number.isInteger(multiplier) ? multiplier : multiplier.toFixed(2).replace(/0$/, '')}`;
    }
    this.trainerLevel.textContent = `LV ${level}`;
    this.trainerLevel.title = `${state.trainerXp} XP · ${experienceToNext} XP to next level`;
    if (this.coins) this.coins.textContent = String(state.profile.coins);
    this.renderFever(state.fever);
  }

  renderFever(fever = { active: false, remaining: 0 }) {
    if (!this.feverIndicator) return;
    this.feverIndicator.hidden = !fever?.active;
    this.feverTime.textContent = String(Math.ceil(fever?.remaining || 0));
    document.body.classList.toggle('fever-mode', Boolean(fever?.active));
  }

  renderDailyMissions(missions = []) {
    if (!this.dailyCompleteCount) return;
    const completed = missions.filter((mission) => mission.completed).length;
    this.dailyCompleteCount.textContent = `${completed}/${missions.length}`;
    this.dailyCompleteCount.closest('button')?.classList.toggle('has-complete', completed > 0);
  }

  renderTimer(secondsRemaining) {
    const seconds = Math.max(0, Math.ceil(secondsRemaining));
    const text = String(seconds).padStart(2, '0');
    if (this.timer.textContent !== text) this.timer.textContent = text;
    this.timerBlock.classList.toggle('is-urgent', seconds > 0 && seconds <= 5);
  }

  renderMission(mission) {
    if (!mission) return;
    const progress = Math.min(mission.progress, mission.goal);
    const unit = mission.type === 'score' ? ' PTS' : '';
    this.missionCopy.textContent = mission.copy;
    this.missionProgress.textContent = `${progress} / ${mission.goal}${unit}`;
    this.missionFill.style.width = `${Math.round((progress / mission.goal) * 100)}%`;
    this.missionCard.classList.toggle('is-complete', mission.completed);
    this.missionState.textContent = mission.completed ? 'COMPLETE' : 'IN PROGRESS';
  }

  animateCombo(currentCombo) {
    if (currentCombo < 2) return;
    this.combo.classList.remove('combo-pop');
    void this.combo.offsetWidth;
    this.combo.classList.add('combo-pop');
  }

  animateScore() {
    this.score.classList.remove('score-pop');
    void this.score.offsetWidth;
    this.score.classList.add('score-pop');
  }

  resetEffects() {
    this.combo.classList.remove('combo-pop');
    this.timerBlock.classList.remove('is-urgent');
  }
}
