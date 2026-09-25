import { BackConfirmModal } from './BackConfirmModal.js';
import { GameHUD } from './GameHUD.js';
import { GameOverModal } from './GameOverModal.js';
import { MessageBanner } from './MessageBanner.js';
import { PokedexUI } from './PokedexUI.js';
import { StartScreen } from './StartScreen.js';

export class UIManager {
  constructor(getIsReady, root = document) {
    this.canvas = root.querySelector('#game-canvas');
    this.canvasFrame = root.querySelector('.canvas-frame');
    this.machine = root.querySelector('.machine');
    this.controls = root.querySelector('.control-actions');
    this.leftButton = root.querySelector('#left-btn');
    this.rightButton = root.querySelector('#right-btn');
    this.grabButton = root.querySelector('#drop-btn');
    this.newGameButton = root.querySelector('#reset-btn');
    this.backButton = root.querySelector('#back-to-menu-btn');
    this.appShell = root.querySelector('.app-shell');
    this.hud = new GameHUD(root);
    this.pokedex = new PokedexUI(root);
    this.startScreen = new StartScreen(root);
    this.backConfirm = new BackConfirmModal(root);
    this.gameOver = new GameOverModal(root);
    this.message = new MessageBanner(root.querySelector('#machine-message'), root.querySelector('#status-text'), getIsReady);
  }

  setGrabbing(active) { this.machine.classList.toggle('is-grabbing', active); }
  setGameOver(active) { this.canvasFrame.classList.toggle('is-game-over', active); }
  setBackVisible(visible) { this.backButton.hidden = !visible; }
  setGameInteractive(interactive) { this.appShell.inert = !interactive; }
  setPressed(button, active) { button?.classList.toggle('is-pressed', active); }
  clearPressed() {
    [this.leftButton, this.rightButton, this.grabButton].forEach((button) => button.classList.remove('is-pressed'));
  }
}
