import { GAME_CONFIG, MACHINE } from '../config/gameConfig.js';
import { POKEMON_DATA } from '../config/pokemonData.js';
import { Claw } from '../entities/Claw.js';
import { PrizeChute } from '../entities/PrizeChute.js';
import { KeyboardInput } from '../input/KeyboardInput.js';
import { TouchInput } from '../input/TouchInput.js';
import { StorageService } from '../storage/StorageService.js';
import { ComboSystem } from '../systems/ComboSystem.js';
import { DifficultySystem } from '../systems/DifficultySystem.js';
import { GrabSystem } from '../systems/GrabSystem.js';
import { MissionSystem } from '../systems/MissionSystem.js';
import { PhysicsSystem } from '../systems/PhysicsSystem.js';
import { RenderSystem } from '../systems/RenderSystem.js';
import { ScoreSystem } from '../systems/ScoreSystem.js';
import { SpawnSystem } from '../systems/SpawnSystem.js';
import { UIManager } from '../ui/UIManager.js';
import { AppState, ClawState, GameState } from './GameState.js';
import { GameLoop } from './GameLoop.js';

export class Game {
  init() {
    if (this.initialized) return;
    this.initialized = true;
    this.storage = new StorageService();
    this.state = new GameState(this.storage.loadProfile(POKEMON_DATA));
    this.chute = new PrizeChute(MACHINE);
    this.claw = new Claw(this.chute.centerX);
    this.prizeBounds = {
      left: GAME_CONFIG.prizeAreaPadding,
      right: MACHINE.width - GAME_CONFIG.prizeAreaPadding,
      top: GAME_CONFIG.clawLaneBottom + GAME_CONFIG.prizeAreaPadding,
      bottom: MACHINE.floorY - GAME_CONFIG.prizeAreaPadding,
    };
    this.ui = new UIManager(() => this.claw.state === ClawState.READY);
    this.ui.canvasFrame.style.setProperty('--claw-lane-height', `${GAME_CONFIG.clawLaneBottom / MACHINE.height * 100}%`);
    this.difficulty = new DifficultySystem(this.state, this.storage);
    this.combo = new ComboSystem(this.state);
    this.missions = new MissionSystem(this.state, POKEMON_DATA);
    this.score = new ScoreSystem(this.state, this.storage, this.combo, this.missions);
    this.physics = new PhysicsSystem(this.state, MACHINE, this.chute, this.prizeBounds);
    this.spawn = new SpawnSystem(this.state, POKEMON_DATA, MACHINE, this.chute, this.prizeBounds, this.physics);
    this.characters = this.spawn.loadImages();
    this.state.selectedCharacter = this.characters[0];
    this.missions.characters = this.characters;
    this.renderer = new RenderSystem(this.ui.canvas, this.state, MACHINE, this.chute, this.claw, this.spawn);
    this.grab = new GrabSystem({
      state: this.state,
      claw: this.claw,
      chute: this.chute,
      physics: this.physics,
      difficulty: this.difficulty,
      combo: this.combo,
      score: this.score,
      ui: this.ui,
      renderer: this.renderer,
      refresh: (options) => this.refresh(options),
      finishGame: () => this.finishGame(),
      onTurnReady: () => this.resetTurnTimer(),
    });
    this.bindUI();
    this.bindInput();
    this.ui.pokedex.build(this.characters, (character) => {
      this.state.selectedCharacter = character;
      this.ui.pokedex.renderDetail(character, this.state.pokedexCounts);
    });
    this.resetCurrentRun();
    this.state.appState = AppState.MENU;
    this.ui.startScreen.show();
    this.ui.setBackVisible(false);
    this.refreshStartScreen();
    this.loop = new GameLoop((time) => this.update(time));
  }

  bindUI() {
    this.ui.startScreen.bind({
      onStart: () => this.startGame(),
      onReset: () => this.resetAllSavedData(),
      onModeSelect: (mode) => {
        const selected = this.difficulty.select(mode);
        if (selected) {
          this.resetTurnTimer();
          this.refreshStartScreen();
        }
        return selected;
      },
      getMode: () => this.state.mode,
    });
    this.ui.backButton.addEventListener('click', () => this.requestReturnToMenu());
    this.ui.backConfirm.bind({
      onStay: () => this.cancelReturnToMenu(),
      onLeave: () => this.returnToMenu(),
    });
    this.ui.newGameButton.addEventListener('click', () => this.resetCurrentRun());
    this.ui.gameOver.bind(() => {
      this.state.appState = AppState.PLAYING;
      this.resetCurrentRun();
      this.resumeGame();
      this.ui.grabButton.focus({ preventScroll: true });
    });
    document.addEventListener('visibilitychange', () => {
      this.stopMoving();
      this.state.lastTime = 0;
    });
  }

  bindInput() {
    const api = {
      canMove: () => this.canMove(),
      isGameplayActive: () => this.state.appState === AppState.PLAYING,
      startMoving: (direction) => this.startMoving(direction),
      stopMoving: (direction) => this.stopMoving(direction),
      setMovementInput: (direction, active) => this.setMovementInput(direction, active),
      stepMove: (direction) => this.stepMove(direction),
      attemptGrab: () => this.attemptGrab(),
    };
    this.touchInput = new TouchInput(this.ui, api);
    this.keyboardInput = new KeyboardInput(this.ui, api);
    this.touchInput.bind();
    this.keyboardInput.bind();
  }

  canMove() {
    return this.state.appState === AppState.PLAYING && this.claw.state === ClawState.READY && this.state.turns > 0;
  }

  startMoving(direction) {
    this.setMovementInput(direction, true);
  }

  setMovementInput(direction, active) {
    const side = direction < 0 ? 'left' : 'right';
    if (active && !this.canMove()) return false;
    this.state.movementInput[side] = Boolean(active);
    return true;
  }

  stopMoving(direction = 0) {
    if (direction < 0) {
      this.state.movementInput.left = false;
      this.ui.setPressed(this.ui.leftButton, false);
    } else if (direction > 0) {
      this.state.movementInput.right = false;
      this.ui.setPressed(this.ui.rightButton, false);
    } else {
      this.state.movementInput.left = false;
      this.state.movementInput.right = false;
      this.ui.setPressed(this.ui.leftButton, false);
      this.ui.setPressed(this.ui.rightButton, false);
    }
  }

  stepMove(direction) {
    if (!this.canMove()) return;
    this.claw.nudge(direction);
  }

  attemptGrab({ automatic = false } = {}) {
    if (!this.canMove()) return false;
    this.state.autoGrabTriggered = true;
    this.stopMoving();
    const started = this.grab.attempt({ status: automatic ? 'AUTO GRAB!' : 'GRABBING...' });
    if (!started) this.state.autoGrabTriggered = false;
    return started;
  }

  resetTurnTimer() {
    this.state.turnTimeMax = this.difficulty.current.turnTime;
    this.state.turnTimeRemaining = this.state.turnTimeMax;
    this.state.autoGrabTriggered = false;
    this.ui?.hud.renderTimer(this.state.turnTimeRemaining);
  }

  updateTurnTimer(step) {
    if (document.hidden || this.claw.state !== ClawState.READY || this.state.autoGrabTriggered) return;
    this.state.turnTimeRemaining = Math.max(0, this.state.turnTimeRemaining - step);
    this.ui.hud.renderTimer(this.state.turnTimeRemaining);
    if (this.state.turnTimeRemaining > 0) return;
    this.state.autoGrabTriggered = true;
    this.stopMoving();
    this.attemptGrab({ automatic: true });
  }

  startGame() {
    this.state.appState = AppState.PLAYING;
    this.ui.startScreen.hide();
    this.ui.setBackVisible(true);
    this.resetCurrentRun();
    this.resumeGame();
    this.ui.grabButton.focus({ preventScroll: true });
  }

  enterGame() { this.startGame(); }

  requestReturnToMenu() {
    if (this.state.appState === AppState.MENU) return;
    if (this.state.appState === AppState.GAME_OVER) {
      this.returnToMenu();
      return;
    }
    const hasProgress = this.state.score > 0 || this.state.turns < GAME_CONFIG.initialTurns;
    if (!hasProgress) {
      this.returnToMenu();
      return;
    }
    this.pauseGame();
    this.ui.setGameInteractive(false);
    this.ui.backConfirm.show();
  }

  pauseGame() {
    this.stopMoving();
    this.state.appState = AppState.PAUSED;
    this.state.lastTime = 0;
    this.loop?.stop();
    this.ui.clearPressed();
  }

  resumeGame() {
    this.state.appState = AppState.PLAYING;
    this.state.lastTime = 0;
    this.ui.setGameInteractive(true);
    this.loop.start();
  }

  cancelReturnToMenu() {
    if (this.state.appState !== AppState.PAUSED) return;
    this.ui.backConfirm.hide();
    this.resumeGame();
    this.ui.backButton.focus({ preventScroll: true });
  }

  cancelCurrentRound() {
    this.stopMoving();
    this.claw.reset();
    this.chute.reset();
    this.state.particles = [];
    this.state.lastTime = 0;
    this.resetTurnTimer();
    this.ui.message.reset();
    this.ui.clearPressed();
    this.ui.setGrabbing(false);
    this.ui.setGameOver(false);
    this.ui.gameOver.hide();
  }

  returnToMenu() {
    this.pauseGame();
    this.cancelCurrentRound();
    this.state.appState = AppState.MENU;
    this.ui.backConfirm.hide();
    this.ui.setBackVisible(false);
    this.ui.startScreen.show();
    this.refreshStartScreen();
    this.ui.startScreen.startButton.focus({ preventScroll: true });
  }

  resetAllSavedData() {
    if (!window.confirm('Bạn có chắc muốn reset toàn bộ dữ liệu không?')) return;
    this.storage.clearAll();
    this.state.bestScore = 0;
    this.state.trainerXp = 0;
    this.difficulty.reset();
    Object.keys(this.state.pokedexCounts).forEach((name) => { this.state.pokedexCounts[name] = 0; });
    this.resetCurrentRun();
    this.refreshStartScreen();
  }

  resetCurrentRun() {
    this.ui.message.reset();
    this.state.resetRun();
    this.characters.forEach((character) => { character.newThisGame = false; });
    this.claw.reset();
    this.chute.reset();
    this.ui.setGameOver(false);
    this.ui.gameOver.hide();
    this.ui.clearPressed();
    this.ui.hud.resetEffects();
    this.ui.setGrabbing(false);
    this.resetTurnTimer();
    this.spawn.createPrizes();
    this.missions.start();
    this.refresh({ pokedex: true });
    this.ui.message.showStatus('READY');
  }

  resetGame() { this.resetCurrentRun(); }

  finishGame() {
    this.stopMoving();
    this.ui.message.hide(true);
    this.claw.state = ClawState.GAME_OVER;
    this.state.appState = AppState.GAME_OVER;
    this.claw.openAmount = 1;
    this.ui.setGrabbing(false);
    this.ui.setPressed(this.ui.grabButton, false);
    this.ui.setGameOver(true);
    this.ui.message.showStatus('GAME COMPLETE', 1800);
    this.ui.gameOver.show(this.state);
  }

  refresh(options = {}) {
    this.missions.updateProgress();
    this.ui.hud.render(this.state, this.score.trainerLevel(), this.score.experienceToNextLevel());
    this.ui.hud.renderMission(this.state.mission);
    if (options.pokedex) this.ui.pokedex.render(this.characters, this.state.pokedexCounts, this.state.selectedCharacter);
    if (options.animateCombo) this.ui.hud.animateCombo(this.state.currentCombo);
    if (options.animateScore) this.ui.hud.animateScore();
    this.refreshStartScreen();
  }

  refreshStartScreen() {
    if (!this.ui) return;
    this.ui.startScreen.setCurrentMode(this.state.mode);
    this.ui.startScreen.render({ modeLabel: this.difficulty.current.label, bestScore: this.state.bestScore, level: this.score.trainerLevel() });
  }

  update(time) {
    if (this.state.appState !== AppState.PLAYING || document.hidden) {
      this.state.lastTime = 0;
      return;
    }
    const elapsed = this.state.lastTime ? Math.min(time - this.state.lastTime, 50) : 0;
    this.state.lastTime = time;
    const step = elapsed / 1000;
    if (this.claw.state === ClawState.READY) {
      this.updateTurnTimer(step);
      const direction = Number(this.state.movementInput.right) - Number(this.state.movementInput.left);
      if (this.claw.state === ClawState.READY) this.claw.updatePlayerMovement(direction, step);
    }
    this.claw.updateSwing(step);
    this.grab.update(time, elapsed);
    this.grab.updateCarriedPrize(time);
    this.physics.update(elapsed);
    this.renderer.render(time, elapsed);
  }

  getSnapshot() {
    return {
      score: this.state.score,
      turns: this.state.turns,
      combo: this.state.currentCombo,
      bestCombo: this.state.bestCombo,
      caught: this.state.caughtThisGame,
      mode: this.state.mode,
      appState: this.state.appState,
      clawState: this.claw.state,
      clawX: this.claw.x,
      clawHeadX: this.claw.headX,
      clawVelocityX: this.claw.velocityX,
      clawSwingAngle: this.claw.swingAngle,
      turnTimeRemaining: this.state.turnTimeRemaining,
      turnTimeMax: this.state.turnTimeMax,
      autoGrabTriggered: this.state.autoGrabTriggered,
      prizeCount: this.state.prizes.length,
      mission: this.state.mission ? { ...this.state.mission } : null,
    };
  }
}
