import {
  ANIMATION, CLAW_COLLISION, DEBUG_GRAB_PHYSICS, ENCOURAGING_MESSAGES,
  GAME_CONFIG, GRAB_PHYSICS, MACHINE, TEASING_MESSAGES,
} from '../config/gameConfig.js';
import { TEASING_MESSAGE_CHANCE } from '../config/difficultyConfig.js';
import { AppState, ClawState, PokemonState } from '../core/GameState.js';
import { clamp, easeInOut, moveTowards } from '../utils/math.js';
import { randomBetween } from '../utils/random.js';

export class GrabSystem {
  constructor({ state, claw, chute, physics, difficulty, combo, score, ui, renderer, refresh, finishGame, onTurnReady }) {
    Object.assign(this, {
      state, claw, chute, physics, difficulty, combo, score, ui, renderer, refresh, finishGame, onTurnReady,
    });
    this.hooks = {};
  }

  setHooks(hooks = {}) {
    this.hooks = { ...this.hooks, ...hooks };
  }

  emitHook(name, payload) {
    this.hooks[name]?.(payload);
  }

  chooseSlipMessage(name) {
    const tone = Math.random() < TEASING_MESSAGE_CHANCE ? 'tease' : 'encourage';
    const messages = tone === 'encourage' ? ENCOURAGING_MESSAGES : TEASING_MESSAGES;
    return { text: messages[Math.floor(Math.random() * messages.length)].replaceAll('{name}', name), tone };
  }

  getGripPoint() {
    return { x: this.claw.headX, y: this.claw.headY + GRAB_PHYSICS.gripPointOffsetY };
  }

  evaluateGrab(prize) {
    const gripPoint = this.getGripPoint();
    const grabOffsetX = gripPoint.x - prize.worldCenterOfMassX;
    const grabOffsetY = gripPoint.y - prize.worldCenterOfMassY;
    const horizontalReach = prize.bodyRadius + GRAB_PHYSICS.horizontalReachPadding;
    const verticalReach = prize.bodyRadius + GRAB_PHYSICS.verticalReachPadding;
    const normalizedDistance = Math.hypot(grabOffsetX / horizontalReach, grabOffsetY / verticalReach);
    const grabQuality = clamp(1 - normalizedDistance, 0, 1);
    const perfect = grabQuality >= GRAB_PHYSICS.perfectQuality;
    const targetTilt = clamp(
      -grabOffsetX / horizontalReach * GRAB_PHYSICS.maxOffsetTilt,
      -GRAB_PHYSICS.maxOffsetTilt,
      GRAB_PHYSICS.maxOffsetTilt,
    );
    return {
      gripPoint,
      grabOffsetX,
      grabOffsetY,
      horizontalReach,
      verticalReach,
      normalizedDistance,
      grabQuality,
      perfect,
      targetTilt,
    };
  }

  calculateGrip(prize, evaluation, settings = this.difficulty.current) {
    const weightModifier = 1 / (0.92 + Math.max(0, prize.weight - 1) * 0.18);
    const qualityModifier = 0.55 + evaluation.grabQuality * 0.45;
    const effectiveGrip = clamp(settings.gripStrength * prize.grip * qualityModifier * weightModifier, 0, 1);
    const weightPenalty = Math.max(0, prize.weight - 0.8) * GRAB_PHYSICS.weightPenalty;
    const badGrabPenalty = Math.pow(1 - evaluation.grabQuality, 1.4) * GRAB_PHYSICS.badGrabPenalty;
    const lowGripPenalty = (1 - prize.grip) * GRAB_PHYSICS.lowGripPenalty;
    const instabilityPenalty = (1 - effectiveGrip) * GRAB_PHYSICS.instabilityPenalty;
    let slipChance = settings.baseSlip + weightPenalty + badGrabPenalty + lowGripPenalty + instabilityPenalty;
    if (evaluation.perfect) slipChance *= GRAB_PHYSICS.perfectSlipMultiplier;
    slipChance = clamp(slipChance, settings.minSlip, settings.maxSlip);
    return { effectiveGrip, slipChance, weightModifier, qualityModifier };
  }

  getMotionProfile(prize, grabQuality) {
    const liftSpeedMultiplier = clamp(1.06 - (prize.weight - 0.7) * 0.18, 0.88, 1.05);
    const carrySpeedMultiplier = clamp(1.04 - (prize.weight - 0.7) * 0.17, 0.88, 1.04);
    const swingMultiplier = clamp(1 + (prize.weight - 1) * 0.3 + (1 - grabQuality) * 0.35, 0.88, 1.38);
    return { liftSpeedMultiplier, carrySpeedMultiplier, swingMultiplier };
  }

  recordClawContacts(contacts) {
    contacts.forEach((contact) => {
      const prize = contact.prize;
      this.claw.contactCandidates.add(prize);
      const contactKey = `${prize.spawnIndex}:${contact.colliderId}`;
      if (this.claw.contactHooksFired.has(contactKey)) return;
      this.claw.contactHooksFired.add(contactKey);
      this.emitHook('onClawContact', contact);
    });
  }

  selectPrizeFromClosedClaw() {
    const zone = this.claw.getGrabZone();
    return this.state.prizes
      .filter((prize) => this.physics.isPhysicsPrize(prize))
      .map((prize) => {
        const deltaX = prize.worldCenterOfMassX - zone.x;
        const deltaY = prize.worldCenterOfMassY - zone.y;
        const localX = deltaX * zone.axisX + deltaY * zone.axisY;
        const localY = -deltaX * zone.axisY + deltaY * zone.axisX;
        const betweenProngs = Math.abs(localX) <= zone.halfWidth + prize.bodyRadius * 0.42
          && Math.abs(localY) <= zone.halfHeight + prize.bodyRadius * 0.55;
        const contacted = this.claw.contactCandidates.has(prize);
        const evaluation = this.evaluateGrab(prize);
        return { prize, betweenProngs, contacted, evaluation };
      })
      .filter((candidate) => candidate.betweenProngs)
      .sort((first, second) => Number(second.contacted) - Number(first.contacted)
        || second.evaluation.grabQuality - first.evaluation.grabQuality
        || first.prize.worldCenterOfMassY - second.prize.worldCenterOfMassY
        || first.prize.spawnIndex - second.prize.spawnIndex)[0];
  }

  securePrize(candidate, time) {
    if (!candidate) return false;
    const { prize, evaluation } = candidate;
    const settings = this.difficulty.current;
    const gripResult = this.calculateGrip(prize, evaluation, settings);
    const motion = this.getMotionProfile(prize, evaluation.grabQuality);
    const willSlip = Math.random() < gripResult.slipChance;
    const slipDuringCarry = willSlip && Math.random() < 0.3 + evaluation.grabQuality * 0.5;
    const slipProgress = willSlip && !slipDuringCarry
      ? clamp(0.24 + evaluation.grabQuality * 0.4 + randomBetween(-0.04, 0.08), 0.22, 0.76)
      : null;
    const grabY = this.claw.y;
    const centerOfMassOffset = prize.getCenterOfMassOffset(prize.rotation);
    const initialCarryOffsetX = prize.centerX - this.claw.headX + centerOfMassOffset.x;
    this.claw.carryOffsetX = initialCarryOffsetX;
    this.claw.grabOffsetX = evaluation.grabOffsetX;
    this.claw.carryOffsetY = prize.centerY - this.claw.y;
    this.claw.grabStartedAt = time;
    this.claw.currentGrab = {
      pokemon: prize, perfect: evaluation.perfect, basePoints: prize.character.score,
      comboMultiplier: this.combo.nextMultiplier(), willSlip, grabY, slipProgress,
      slipY: slipProgress === null ? null : grabY + (this.claw.homeY - grabY) * slipProgress,
      slipDuringCarry,
      carrySlipDistance: slipDuringCarry ? randomBetween(22, 52) + evaluation.grabQuality * 55 : 0,
      ...evaluation,
      ...gripResult,
      ...motion,
      initialCarryOffsetX,
      secureElapsed: 0,
      dynamicTiltAmplitude: GRAB_PHYSICS.dynamicTilt
        * (0.35 + (1 - evaluation.grabQuality) * 0.65)
        * clamp(prize.weight, 0.8, 1.3),
      lastPoseTime: time,
    };
    if (DEBUG_GRAB_PHYSICS) {
      console.table({
        pokemon: prize.name,
        weight: prize.weight,
        grip: prize.grip,
        grabQuality: evaluation.grabQuality,
        grabOffsetX: evaluation.grabOffsetX,
        effectiveGrip: gripResult.effectiveGrip,
        slipChance: gripResult.slipChance,
        willSlip,
      });
    }
    this.claw.caught = prize;
    prize.perfect = evaluation.perfect;
    Object.assign(prize, {
      state: PokemonState.GRABBED,
      velocityX: 0,
      velocityY: 0,
      angularVelocity: 0,
      isSleeping: false,
      sleepTimer: 0,
    });
    this.ui.message.showStatus('GOTCHA!');
    return true;
  }

  attempt({ status = 'GRABBING...' } = {}) {
    if (this.state.appState !== AppState.PLAYING || this.claw.state !== ClawState.READY || this.state.turns <= 0) return false;
    this.state.movementInput.left = false;
    this.state.movementInput.right = false;
    this.claw.lockHorizontalMotion();
    this.state.grabAttemptId += 1;
    this.state.turns -= 1;
    this.claw.state = ClawState.DESCENDING;
    this.claw.openAmount = 1;
    this.claw.targetY = this.physics.getClawDescentLimit(this.claw, MACHINE.floorY - 75);
    this.claw.currentGrab = null;
    this.claw.caught = null;
    this.claw.phaseElapsed = 0;
    this.claw.slipPhase = null;
    this.claw.grabOffsetX = 0;
    this.claw.carryOffsetX = 0;
    this.claw.carryOffsetY = 0;
    this.claw.contactCandidates.clear();
    this.claw.contactHooksFired.clear();
    this.ui.setGrabbing(true);
    this.ui.setPressed(this.ui.grabButton, true);
    this.ui.message.showStatus(status);
    this.refresh();
    return true;
  }

  updateCarriedPrize(time) {
    const grab = this.claw.currentGrab;
    const prize = grab?.pokemon;
    if (!prize || prize.state !== PokemonState.GRABBED) return;
    const elapsedSeconds = clamp((time - grab.lastPoseTime) / 1000, 0, 0.05);
    const dynamicSwing = Math.sin((time - this.claw.grabStartedAt) * 0.007)
      * grab.dynamicTiltAmplitude;
    const targetRotation = clamp(
      grab.targetTilt + this.claw.swingAngle * 0.55 * grab.swingMultiplier + dynamicSwing,
      -GRAB_PHYSICS.maxTotalRotation,
      GRAB_PHYSICS.maxTotalRotation,
    );
    const previousRotation = prize.rotation;
    const smoothing = elapsedSeconds > 0 ? 1 - Math.exp(-elapsedSeconds * 10) : 0;
    prize.rotation += (targetRotation - prize.rotation) * smoothing;
    if (elapsedSeconds > 0) prize.angularVelocity = (prize.rotation - previousRotation) / elapsedSeconds;
    grab.lastPoseTime = time;

    const sway = Math.sin((time - this.claw.grabStartedAt) * 0.008) * 0.7 * grab.swingMultiplier;
    const centerOfMassOffset = prize.getCenterOfMassOffset(prize.rotation);
    const targetCenterX = this.claw.headX + this.claw.carryOffsetX + sway - centerOfMassOffset.x;
    const targetCenterY = this.claw.y + this.claw.carryOffsetY;
    prize.x = targetCenterX - prize.width / 2;
    prize.y = targetCenterY - prize.height / 2;
    this.physics.updateGeometry(prize);
  }

  beginPrizeDrop() {
    const prize = this.claw.currentGrab?.pokemon;
    if (!prize || Math.abs(this.claw.x - this.claw.homeX) > 0.001
      || Math.abs(this.claw.velocityX) > 0.001
      || Math.abs(this.claw.headX - this.chute.centerX) >= 1.5
      || Math.abs(this.claw.headX + this.claw.carryOffsetX - this.chute.centerX) >= 1.5) return false;
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
    this.physics.updateGeometry(prize);
    Object.assign(prize, {
      state: PokemonState.DROPPING_TO_CHUTE,
      dropPhase: 'falling', dropElapsed: 0, dropAlpha: 1, dropScale: 1,
      velocityX: 0, velocityY: 0,
      angularVelocity: clamp(prize.angularVelocity * 0.28 + randomBetween(-0.025, 0.025), -0.28, 0.28),
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
    const instability = 1 + (1 - grab.grabQuality) * 0.5;
    const dropWeight = clamp(0.85 + (prize.weight - 0.7) * 0.35, 0.85, 1.15);
    const retainedAngularVelocity = clamp(
      (prize.angularVelocity || 0) + randomBetween(-0.16, 0.16) * instability,
      -1.35,
      1.35,
    );
    Object.assign(prize, {
      state: PokemonState.SLIPPING,
      velocityX: this.claw.velocityX * 0.55 + randomBetween(-20, 20) * instability,
      velocityY: randomBetween(5, 16) * dropWeight,
      angularVelocity: retainedAngularVelocity,
      isSleeping: false, sleepTimer: 0, bounceCount: 0,
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
        const previousY = this.claw.y;
        this.claw.targetY = this.physics.getClawDescentLimit(this.claw, MACHINE.floorY - 75);
        this.claw.y = Math.min(this.claw.targetY, this.claw.y + ANIMATION.descendSpeed * step);
        const velocityY = step > 0 ? (this.claw.y - previousY) / step : 0;
        const contacts = this.physics.resolveClawCollisions(this.claw, {
          phase: 'descending',
          velocityY,
        });
        this.recordClawContacts(contacts);
        if (this.claw.y >= this.claw.targetY) {
          this.claw.phaseElapsed = 0;
          this.claw.state = ClawState.CLOSING;
          this.emitHook('onClawClose', { x: this.claw.headX, y: this.claw.headY });
        }
        break;
      }
      case ClawState.CLOSING: {
        const previousOpenAmount = this.claw.openAmount;
        this.claw.phaseElapsed += elapsed;
        const progress = Math.min(this.claw.phaseElapsed / ANIMATION.closeDuration, 1);
        this.claw.openAmount = 1 - easeInOut(progress);
        const closingSpeed = step > 0
          ? (previousOpenAmount - this.claw.openAmount)
            * CLAW_COLLISION.spreadRange * GAME_CONFIG.clawScale / step
          : 0;
        const contacts = this.physics.resolveClawCollisions(this.claw, {
          phase: 'closing',
          closingSpeed,
          velocityY: 0,
        });
        this.recordClawContacts(contacts);
        if (progress >= 1) {
          this.claw.openAmount = 0;
          const candidate = this.selectPrizeFromClosedClaw();
          const secured = this.securePrize(candidate, time);
          if (!secured) this.emitHook('onClawMiss', { x: this.claw.headX, y: this.claw.headY });
          this.claw.phaseElapsed = 0;
          this.claw.state = ClawState.LIFTING;
        }
        break;
      }
      case ClawState.LIFTING: {
        const grab = this.claw.currentGrab;
        if (grab) {
          grab.secureElapsed += elapsed;
          const secureProgress = Math.min(grab.secureElapsed / ANIMATION.closeDuration, 1);
          this.claw.carryOffsetX = grab.initialCarryOffsetX * (1 - easeInOut(secureProgress));
        }
        const liftSpeed = ANIMATION.liftSpeed * (grab?.liftSpeedMultiplier || 1);
        this.claw.y = Math.max(this.claw.homeY, this.claw.y - liftSpeed * step);
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
        const arrived = this.claw.updateAutomaticMovement(
          this.claw.homeX,
          step,
          'carry',
          grab?.carrySpeedMultiplier || 1,
        );
        if (grab?.willSlip && grab.slipDuringCarry && Math.abs(this.claw.x - grab.carryStartX) >= grab.carrySlipDistance) { this.beginGripSlip(); break; }
        if (arrived) this.beginPrizeDrop();
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
      case ClawState.RETURNING: {
        const horizontalArrived = this.claw.updateAutomaticMovement(this.claw.homeX, step, 'return');
        this.claw.y = moveTowards(this.claw.y, this.claw.homeY, ANIMATION.returnSpeed * 0.7 * step);
        this.claw.openAmount = moveTowards(this.claw.openAmount, CLAW_COLLISION.readyOpenAmount, step * 4);
        if (horizontalArrived && this.claw.y === this.claw.homeY
          && this.claw.openAmount === CLAW_COLLISION.readyOpenAmount) {
          this.ui.setGrabbing(false); this.ui.setPressed(this.ui.grabButton, false);
          if (this.state.turns <= 0) this.finishGame();
          else {
            this.claw.state = ClawState.READY;
            this.onTurnReady?.();
            if (this.ui.message.statusElement.textContent) this.ui.message.queueReady();
            else this.ui.message.showStatus('READY');
          }
        }
        break;
      }
      default: break;
    }
  }
}
