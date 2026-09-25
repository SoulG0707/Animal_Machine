export class GameOverModal {
  constructor(root = document) {
    this.overlay = root.querySelector('#game-complete-overlay');
    this.finalScore = root.querySelector('#final-score');
    this.bestScore = root.querySelector('#modal-best-score');
    this.caught = root.querySelector('#modal-caught');
    this.combo = root.querySelector('#modal-combo');
    this.newPokemon = root.querySelector('#modal-new-pokemon');
    this.newBest = root.querySelector('#new-best-badge');
    this.playAgain = root.querySelector('#play-again-btn');
  }

  bind(onPlayAgain) { this.playAgain.addEventListener('click', onPlayAgain); }

  show(state) {
    this.finalScore.textContent = String(state.score).padStart(3, '0');
    this.bestScore.textContent = String(state.bestScore).padStart(3, '0');
    this.caught.textContent = String(state.caughtThisGame);
    this.combo.textContent = `×${state.bestCombo}`;
    this.newPokemon.textContent = state.newUnlocksThisGame.length ? state.newUnlocksThisGame.join(', ') : 'None this run';
    this.newBest.hidden = !state.newBestThisGame;
    this.overlay.hidden = false;
    this.overlay.setAttribute('aria-hidden', 'false');
    this.playAgain.focus({ preventScroll: true });
  }

  hide() {
    this.overlay.hidden = true;
    this.overlay.setAttribute('aria-hidden', 'true');
  }
}
