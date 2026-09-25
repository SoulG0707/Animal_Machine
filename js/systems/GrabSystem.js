import { ANIMATION, ENCOURAGING_MESSAGES, MACHINE, TEASING_MESSAGES } from '../config/gameConfig.js';
import { TEASING_MESSAGE_CHANCE } from '../config/difficultyConfig.js';
import { ClawState, PokemonState } from '../core/GameState.js';
import { easeInOut, moveTowards } from '../utils/math.js';
import { randomBetween } from '../utils/random.js';

export class GrabSystem {
  constructor({ state, claw, chute, physics, difficulty, combo, score, ui, renderer, refresh, finishGame }) {
    Object.assign(this, { state, claw, chute, physics, difficulty, combo, score, ui, renderer, refresh, finishGame });
  }

  chooseSlipMessage(name) {
    const tone = Math.random() < TEASING_MESSAGE_CHANCE ? 'tease' : 'encourage';
    const messages = tone === 'encourage' ? ENCOURAGING_MESSAGES : TEASING_MESSAGES;
    return { text: messages[Math.floor(Math.random() * messages.length)].replaceAll('{name}', name), tone };
  }

  findPrizeAtClaw() {
    const clawTop = this.claw.y + 10;
    const clawBottom = this.claw.y + 38;
    return this.state.prizes
      .filter((prize) => this.physics.isPhysicsPrize(prize)
        && Math.abs(prize.centerX - this.claw.x) < prize.bodyRadius + 24
        && clawBottom >= prize.y && clawTop <= prize.bottomY)
      .sort((first, second) => Math.abs(first.centerX - this.claw.x) - Math.abs(second.centerX - this.claw.x) || first.centerY - second.centerY)[0];
  }

  nudgePile(grabbedPrize = null) {
    const contactY = this.claw.y + 34;
    this.state.prizes.forEach((prize) => {
      if (prize === grabbedPrize || !this.physics.isPhysicsPrize(prize)) return;
      const deltaX = prize.centerX - this.claw.x;
      const deltaY = prize.centerY - contactY;
      if (Math.abs(deltaX) > prize.bodyRadius + 42 || Math.abs(deltaY) > prize.bodyRadius + 36) return;
      if (prize.lastClawPushAttempt === this.state.grabAttemptId) return;
      prize.lastClawPushAttempt = this.state.grabAttemptId;
      const direction = deltaX === 0 ? (Math.random() < 0.5 ? -1 : 1) : Math.sign(deltaX);
      this.physics.wake(prize);
      prize.velocityX += direction * randomBetween(28, 52);
      prize.velocityY += randomBetween(8, 24);
      prize.angularVelocity += direction * randomBetween(0.12, 0.28);
    });
  }

  attempt() {
    if (this.state.startScreenActive || this.claw.state !== ClawState.READY || this.state.turns <= 0) return false;
    this.state.heldDirection = 0;
    this.state.grabAttemptId += 1;
    this.state.turns -= 1;
    this.claw.state = ClawState.DESCENDING;
    this.claw.targetY = MACHINE.floorY - 75;
    this.claw.currentGrab = null;
    this.claw.caught = null;
    this.claw.phaseElapsed = 0;
    this.claw.slipPhase = null;
    this.claw.openAmount = 1;
    this.claw.grabOffsetX = 0;
    this.claw.carryOffsetX = 0;
    this.claw.carryOffsetY = 0;
    this.ui.setGrabbing(true);
    this.ui.setPressed(this.ui.grabButton, true);
    this.ui.message.showStatus('GRABBING...');
    this.refresh();
    return true;
  }

  updateCarriedPrize(time) {
    const prize = this.claw.currentGrab?.pokemon;
    if (!prize || prize.state !== PokemonState.GRABBED) return;
    const sway = Math.sin((time - this.claw.grabStartedAt) * 0.008) * 2.5;
    prize.x = this.claw.x + this.claw.carryOffsetX + sway - prize.width / 2;
    prize.y = this.claw.y + this.claw.carryOffsetY;
    this.physics.updateGeometry(prize);
  }

  beginPrizeDrop() {
    const prize = this.claw.currentGrab?.pokemon;
    if (!prize || Math.abs(this.claw.x - this.claw.homeX) > 0.001
      || Math.abs(this.claw.x - this.chute.centerX) >= 2
      || Math.abs(this.claw.x + this.claw.carryOffsetX - this.chute.centerX) >= 2) return false;
    this.claw.x = this.claw.homeX;
    this.claw.state = ClawState.RELEASING;
    this.claw.phaseElapsed = 0;
    this.claw.openAmount = 0;
    this.ui.message.showStatus('RELEASING...', 900);
    return true;
  }

  releaseGrabbedPrize(time) {
    const grab = this.claw.currentGrab;
    if (!grab?.pokemon) return false;
    const prize = grab.pokemon;
    prize.rotation = Math.sin((time - this.claw.grabStartedAt) * 0.007) * 0.035;
    this.physics.updateGeometry(prize);
    Object.assign(prize, {
      state: PokemonState.DROPPING_TO_CHUTE,
      dropPhase: 'falling', dropElapsed: 0, dropAlpha: 1, dropScale: 1,
      velocityX: 0, velocityY: 0, angularVelocity: randomBetween(-0.025, 0.025),
      chuteSensorTriggered: false, releaseX: prize.x, releaseY: prize.y,
      isSleeping: false, sleepTimer: 0,
    });
    this.claw.dropGrab = grab;
    this.claw.droppingPrize = prize;
    this.claw.currentGrab = null;
    this.claw.caught = null;
    this.claw.phaseElapsed = 0;
    this.claw.state = ClawState.WAITING_FOR_CHUTE;
    this.ui.message.showStatus('DROPPING...', 1000);
    return true;
  }

  beginGripSlip() {
    if (!this.claw.currentGrab) return;
    this.claw.state = ClawState.SLIPPING;
    this.claw.slipPhase = 'loosening';
    this.claw.phaseElapsed = 0;
  }

  releaseSlippedPrize() {
    const grab = this.claw.currentGrab;
    if (!grab) return;
    const prize = grab.pokemon;
    Object.assign(prize, {
      state: PokemonState.SLIPPING,
      velocityX: randomBetween(-28, 28), velocityY: randomBetween(0, 18),
      angularVelocity: randomBetween(-0.72, 0.72), isSleeping: false, sleepTimer: 0, bounceCount: 0,
    });
    this.claw.currentGrab = null;
    this.claw.caught = null;
    this.claw.slipPhase = 'retracting';
    this.claw.openAmount = 0.58;
    this.combo.reset();
    this.ui.hud.resetEffects();
    this.refresh();
    const feedback = this.chooseSlipMessage(prize.name);
    this.ui.message.showStatus('MISSED!', 1400);
    this.ui.message.show(feedback.text, { duration: 3200, tone: feedback.tone });
    this.ui.message.queueReady();
  }

  update(time, elapsed) {
    const step = elapsed / 1000;
    switch (this.claw.state) {
      case ClawState.DESCENDING: {
        this.claw.y = Math.min(this.claw.targetY, this.claw.y + ANIMATION.descendSpeed * step);
        const prize = this.findPrizeAtClaw();
        if (prize) {
          this.nudgePile(prize);
          const perfect = Math.abs(prize.centerX - this.claw.x) <= 14;
          const settings = this.difficulty.current;
          const willSlip = Math.random() < randomBetween(settings.gripMissMin, settings.gripMissMax) * (perfect ? 0.6 : 1);
          const slipDuringCarry = willSlip && Math.random() < 0.3;
          const slipProgress = willSlip ? randomBetween(0.25, 0.65) : null;
          const grabY = this.claw.y;
          this.claw.carryOffsetX = prize.centerX - this.claw.x;
          this.claw.grabOffsetX = this.claw.carryOffsetX;
          this.claw.carryOffsetY = prize.y - this.claw.y;
          this.claw.grabStartedAt = time;
          this.claw.currentGrab = {
            pokemon: prize, perfect, basePoints: prize.character.score,
            comboMultiplier: this.combo.nextMultiplier(), willSlip, grabY, slipProgress,
            slipY: willSlip ? grabY + (this.claw.homeY - grabY) * slipProgress : null,
            slipDuringCarry, carrySlipDistance: slipDuringCarry ? randomBetween(24, 72) : 0,
          };
          this.claw.caught = prize;
          prize.perfect = perfect;
          Object.assign(prize, { state: PokemonState.GRABBED, velocityX: 0, velocityY: 0, angularVelocity: 0, isSleeping: false, sleepTimer: 0 });
          this.claw.openAmount = 1;
          this.claw.phaseElapsed = 0;
          this.claw.state = ClawState.CLOSING;
          this.ui.message.showStatus('GOTCHA!');
        } else {
          this.nudgePile();
          if (this.claw.y >= this.claw.targetY) this.claw.state = ClawState.LIFTING;
        }
        break;
      }
      case ClawState.CLOSING: {
        this.claw.phaseElapsed += elapsed;
        const progress = Math.min(this.claw.phaseElapsed / ANIMATION.closeDuration, 1);
        this.claw.openAmount = 1 - easeInOut(progress);
        this.claw.carryOffsetX = this.claw.grabOffsetX * (1 - easeInOut(progress));
        if (progress >= 1) {
          this.claw.openAmount = 0; this.claw.carryOffsetX = 0; this.claw.phaseElapsed = 0; this.claw.state = ClawState.LIFTING;
        }
        break;
      }
      case ClawState.LIFTING: {
        const grab = this.claw.currentGrab;
        this.claw.y = Math.max(this.claw.homeY, this.claw.y - ANIMATION.liftSpeed * step);
        if (grab?.willSlip && !grab.slipDuringCarry && this.claw.y <= grab.slipY) { this.beginGripSlip(); break; }
        if (this.claw.y <= this.claw.homeY) {
          this.claw.y = this.claw.homeY;
          if (grab) {
            if (grab.willSlip && grab.slipDuringCarry) {
              grab.carryStartX = this.claw.x;
              grab.carrySlipDistance = Math.min(grab.carrySlipDistance, Math.abs(this.claw.homeX - this.claw.x) * 0.7);
            }
            this.claw.state = ClawState.CARRYING;
            this.claw.phaseElapsed = 0;
          } else {
            this.combo.reset(); this.ui.hud.resetEffects(); this.refresh();
            this.claw.openAmount = 1; this.claw.state = ClawState.RETURNING;
            this.ui.message.showStatus('MISSED!');
            const feedback = this.chooseSlipMessage('Pokémon');
            this.ui.message.show(feedback.text, { duration: 3200, tone: feedback.tone });
            this.ui.message.queueReady();
          }
        }
        break;
      }
      case ClawState.CARRYING: {
        const grab = this.claw.currentGrab;
        this.claw.x = moveTowards(this.claw.x, this.claw.homeX, ANIMATION.carrySpeed * step);
        if (grab?.willSlip && grab.slipDuringCarry && Math.abs(this.claw.x - grab.carryStartX) >= grab.carrySlipDistance) { this.beginGripSlip(); break; }
        if (this.claw.x === this.claw.homeX) this.beginPrizeDrop();
        break;
      }
      case ClawState.SLIPPING:
        if (this.claw.slipPhase === 'loosening') {
          this.claw.phaseElapsed += elapsed;
          const progress = Math.min(this.claw.phaseElapsed / ANIMATION.slipLoosenDuration, 1);
          this.claw.openAmount = 0.58 * easeInOut(progress);
          if (progress >= 1) this.releaseSlippedPrize();
        } else {
          this.claw.y = moveTowards(this.claw.y, this.claw.homeY, ANIMATION.liftSpeed * step);
          if (this.claw.y === this.claw.homeY) this.claw.state = ClawState.RETURNING;
        }
        break;
      case ClawState.RELEASING: {
        this.claw.phaseElapsed += elapsed;
        const progress = Math.min(this.claw.phaseElapsed / ANIMATION.dropOpenDuration, 1);
        this.claw.openAmount = easeInOut(progress);
        if (progress >= 1 && !this.releaseGrabbedPrize(time)) this.claw.state = ClawState.RETURNING;
        break;
      }
      case ClawState.WAITING_FOR_CHUTE: {
        const prize = this.claw.droppingPrize;
        const grab = this.claw.dropGrab;
        if (!prize || !grab) {
          this.claw.droppingPrize = null; this.claw.dropGrab = null; this.claw.state = ClawState.RETURNING; break;
        }
        const dropResult = this.physics.updateChuteDrop(prize, elapsed);
        if (dropResult.sensorTriggered && !grab.rewardResolved) {
          grab.rewardResolved = true;
          const rewardStatus = this.score.processCatch(grab);
          this.renderer.spawnCatchParticles(prize);
          this.refresh({ animateScore: true, animateCombo: true, pokedex: true });
          this.ui.message.showStatus(`CAUGHT! · ${rewardStatus}`, 1800);
        }
        if (dropResult.complete) {
          prize.collected = true; this.claw.droppingPrize = null; this.claw.dropGrab = null;
          this.claw.phaseElapsed = 0; this.claw.state = ClawState.RETURNING;
        }
        break;
      }
      case ClawState.RETURNING:
        this.claw.x = moveTowards(this.claw.x, this.claw.homeX, ANIMATION.returnSpeed * step);
        this.claw.y = moveTowards(this.claw.y, this.claw.homeY, ANIMATION.returnSpeed * 0.7 * step);
        this.claw.openAmount = moveTowards(this.claw.openAmount, 1, step * 4);
        if (this.claw.x === this.claw.homeX && this.claw.y === this.claw.homeY && this.claw.openAmount === 1) {
          this.ui.setGrabbing(false); this.ui.setPressed(this.ui.grabButton, false);
          if (this.state.turns <= 0) this.finishGame();
          else {
            this.claw.state = ClawState.READY;
            if (this.ui.message.statusElement.textContent) this.ui.message.queueReady();
            else this.ui.message.showStatus('READY');
          }
        }
        break;
      default: break;
    }
    this.updateCarriedPrize(time);
  }
}
