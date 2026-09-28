import { CLAW_COLLISION, CLAW_MOVEMENT, GAME_CONFIG, GRAB_PHYSICS } from '../config/gameConfig.js';
import { ClawState } from '../core/GameState.js';

function moveTowards(current, target, maxStep) {
  if (Math.abs(target - current) <= maxStep) return target;
  return current + Math.sign(target - current) * maxStep;
}

export class Claw {
  constructor(homeX, homeY = 76) {
    this.homeX = homeX;
    this.homeY = homeY;
    this.width = 58;
    this.height = 28;
    this.maxSpeed = CLAW_MOVEMENT.maxSpeed;
    this.acceleration = CLAW_MOVEMENT.acceleration;
    this.deceleration = CLAW_MOVEMENT.deceleration;
    this.colliders = {
      head: { id: 'head', type: 'circle', x: 0, y: 0, radius: 0 },
      leftProng: { id: 'left-prong', type: 'capsule', ax: 0, ay: 0, bx: 0, by: 0, radius: 0 },
      rightProng: { id: 'right-prong', type: 'capsule', ax: 0, ay: 0, bx: 0, by: 0, radius: 0 },
      grabZone: {
        id: 'grab-zone', type: 'box', x: 0, y: 0,
        axisX: 1, axisY: 0, halfWidth: 0, halfHeight: 0,
      },
    };
    this.activeColliders = [this.colliders.head, this.colliders.leftProng, this.colliders.rightProng];
    this.reset();
  }

  get cableLength() {
    return Math.max(0, this.pivotY);
  }

  get carriageX() {
    return this.x;
  }

  get cableX() {
    return this.carriageX;
  }

  get pivotX() {
    return this.carriageX;
  }

  get pivotY() {
    return Math.max(0, this.y - CLAW_MOVEMENT.swing.pivotToAssemblyOrigin);
  }

  get headOffsetX() {
    return Math.sin(this.swingAngle) * CLAW_MOVEMENT.swing.centerOfMassOffset;
  }

  get headX() {
    return this.pivotX + this.headOffsetX;
  }

  get headY() {
    return this.pivotY + Math.cos(this.swingAngle) * CLAW_MOVEMENT.swing.centerOfMassOffset;
  }

  getCarryAttachmentPoint(output = {}) {
    return this.localToWorld(0, GRAB_PHYSICS.gripPointOffsetY, output);
  }

  get bodyAngle() {
    // Positive physics angles mean the claw assembly swings to the right.
    // Canvas uses a downward Y axis, so its rotation sign is inverted.
    return -this.swingAngle;
  }

  localToWorld(localX, localY, output = {}) {
    const scaledX = localX * GAME_CONFIG.clawScale;
    const scaledY = CLAW_MOVEMENT.swing.pivotToAssemblyOrigin + localY * GAME_CONFIG.clawScale;
    const cosine = Math.cos(this.bodyAngle);
    const sine = Math.sin(this.bodyAngle);
    output.x = this.pivotX + scaledX * cosine - scaledY * sine;
    output.y = this.pivotY + scaledX * sine + scaledY * cosine;
    return output;
  }

  worldToLocal(worldX, worldY, output = {}) {
    const deltaX = worldX - this.pivotX;
    const deltaY = worldY - this.pivotY;
    const cosine = Math.cos(this.bodyAngle);
    const sine = Math.sin(this.bodyAngle);
    output.x = (deltaX * cosine + deltaY * sine) / GAME_CONFIG.clawScale;
    output.y = (-deltaX * sine + deltaY * cosine - CLAW_MOVEMENT.swing.pivotToAssemblyOrigin) / GAME_CONFIG.clawScale;
    return output;
  }

  updateColliderGeometry() {
    const collision = CLAW_COLLISION;
    const scale = GAME_CONFIG.clawScale;
    const spread = collision.spreadBase + this.openAmount * collision.spreadRange;
    const head = this.colliders.head;
    this.localToWorld(0, collision.headCenterY, head);
    head.radius = collision.headRadius * scale;

    const left = this.colliders.leftProng;
    const right = this.colliders.rightProng;
    this.localToWorld(-collision.prongBaseX - spread, collision.prongTopY, left);
    left.ax = left.x; left.ay = left.y;
    this.localToWorld(-collision.prongBaseX - spread - collision.prongFootX, collision.prongBottomY, left);
    left.bx = left.x; left.by = left.y; left.radius = collision.prongRadius * scale;
    this.localToWorld(collision.prongBaseX + spread, collision.prongTopY, right);
    right.ax = right.x; right.ay = right.y;
    this.localToWorld(collision.prongBaseX + spread + collision.prongFootX, collision.prongBottomY, right);
    right.bx = right.x; right.by = right.y; right.radius = collision.prongRadius * scale;

    const zone = this.colliders.grabZone;
    this.localToWorld(0, collision.grabZoneCenterY, zone);
    zone.axisX = Math.cos(this.bodyAngle);
    zone.axisY = Math.sin(this.bodyAngle);
    zone.halfWidth = (collision.grabZoneBaseHalfWidth + spread) * scale;
    zone.halfHeight = collision.grabZoneHalfHeight * scale;
    return this.colliders;
  }

  getPhysicalColliders() {
    this.updateColliderGeometry();
    return this.activeColliders;
  }

  getGrabZone() {
    this.updateColliderGeometry();
    return this.colliders.grabZone;
  }

  getColliderBounds() {
    this.updateColliderGeometry();
    const { head, leftProng, rightProng } = this.colliders;
    return {
      left: Math.min(head.x - head.radius, leftProng.ax - leftProng.radius, leftProng.bx - leftProng.radius, rightProng.ax - rightProng.radius, rightProng.bx - rightProng.radius),
      right: Math.max(head.x + head.radius, leftProng.ax + leftProng.radius, leftProng.bx + leftProng.radius, rightProng.ax + rightProng.radius, rightProng.bx + rightProng.radius),
      top: Math.min(head.y - head.radius, leftProng.ay - leftProng.radius, rightProng.ay - rightProng.radius),
      bottom: Math.max(head.y + head.radius, leftProng.by + leftProng.radius, rightProng.by + rightProng.radius),
    };
  }

  clampToRail() {
    if (this.x <= CLAW_MOVEMENT.leftBound) {
      this.x = CLAW_MOVEMENT.leftBound;
      if (this.velocityX < 0) {
        const previousVelocity = this.velocityX;
        this.velocityX = 0;
        this.transferMomentumFromVelocityChange(previousVelocity, this.velocityX);
      }
    } else if (this.x >= CLAW_MOVEMENT.rightBound) {
      this.x = CLAW_MOVEMENT.rightBound;
      if (this.velocityX > 0) {
        const previousVelocity = this.velocityX;
        this.velocityX = 0;
        this.transferMomentumFromVelocityChange(previousVelocity, this.velocityX);
      }
    }
  }

  updatePlayerMovement(direction, deltaSeconds) {
    if (deltaSeconds <= 0) return;
    if (direction === 0 && this.velocityX !== 0) {
      this.lockHorizontalMotion();
      return;
    }
    const previousVelocity = this.velocityX;
    if (direction !== 0) {
      const pushingAgainstRail = (this.x <= CLAW_MOVEMENT.leftBound && direction < 0)
        || (this.x >= CLAW_MOVEMENT.rightBound && direction > 0);
      const targetVelocity = pushingAgainstRail ? 0 : Math.sign(direction) * CLAW_MOVEMENT.maxSpeed;
      const reversing = this.velocityX !== 0 && Math.sign(this.velocityX) !== Math.sign(direction);
      const rate = reversing ? CLAW_MOVEMENT.reverseAcceleration : CLAW_MOVEMENT.acceleration;
      this.velocityX = moveTowards(this.velocityX, targetVelocity, rate * deltaSeconds);
    }
    this.transferMomentumFromVelocityChange(previousVelocity, this.velocityX);
    this.accelerationX = (this.velocityX - previousVelocity) / deltaSeconds;
    this.x += this.velocityX * deltaSeconds;
    this.clampToRail();
  }

  nudge(direction) {
    const previousVelocity = this.velocityX;
    this.velocityX = Math.max(
      -CLAW_MOVEMENT.maxSpeed,
      Math.min(CLAW_MOVEMENT.maxSpeed, this.velocityX + Math.sign(direction) * CLAW_MOVEMENT.tapImpulse),
    );
    this.transferMomentumFromVelocityChange(previousVelocity, this.velocityX);
    this.accelerationX = (this.velocityX - previousVelocity) / (1 / 60);
  }

  transferMomentumFromVelocityChange(previousVelocity, currentVelocity, { automatic = false } = {}) {
    const deltaVelocity = previousVelocity - currentVelocity;
    if (deltaVelocity === 0) return 0;
    const swing = CLAW_MOVEMENT.swing;
    const weight = this.currentGrab?.pokemon?.weight || 0;
    const loadMultiplier = weight > 0
      ? 1 / (1 + Math.max(0, weight - 0.7) * (1 / swing.loadedMomentumMultiplier - 1))
      : 1;
    const movementMultiplier = automatic ? swing.automaticMomentumMultiplier : 1;
    const transferredVelocity = deltaVelocity
      * swing.releaseMomentumTransfer
      / swing.centerOfMassOffset
      * movementMultiplier
      * loadMultiplier;
    this.swingVelocity = Math.max(
      -swing.maxReleaseAngularVelocity,
      Math.min(
        swing.maxReleaseAngularVelocity,
        transferredVelocity + this.swingVelocity,
      ),
    );
    return transferredVelocity;
  }

  lockHorizontalMotion({ applyCoast = true, transferMomentum = true } = {}) {
    if (this.velocityX === 0) return 0;
    const releaseVelocity = this.velocityX;
    const previousX = this.x;
    if (applyCoast) {
      const coastDistance = Math.max(
        -CLAW_MOVEMENT.releaseCoastMax,
        Math.min(CLAW_MOVEMENT.releaseCoastMax, releaseVelocity * CLAW_MOVEMENT.releaseCoastTime),
      );
      this.x = Math.max(
        CLAW_MOVEMENT.leftBound,
        Math.min(CLAW_MOVEMENT.rightBound, this.x + coastDistance),
      );
    }
    this.velocityX = 0;
    this.accelerationX = 0;
    if (transferMomentum) this.transferMomentumFromVelocityChange(releaseVelocity, 0);
    return this.x - previousX;
  }

  updateAutomaticMovement(targetX, deltaSeconds, profileName = 'return', speedMultiplier = 1) {
    if (deltaSeconds <= 0) return Math.abs(targetX - this.x) < 0.001;
    const profile = CLAW_MOVEMENT[profileName];
    const distance = targetX - this.x;
    const previousVelocity = this.velocityX;

    if (Math.abs(distance) < 0.25 && Math.abs(this.velocityX) < 6) {
      this.x = targetX;
      this.velocityX = 0;
      this.transferMomentumFromVelocityChange(previousVelocity, this.velocityX, { automatic: true });
      this.accelerationX = (this.velocityX - previousVelocity) / deltaSeconds;
      return true;
    }

    const direction = Math.sign(distance);
    const brakingSpeed = Math.sqrt(Math.max(0, 2 * profile.deceleration * Math.abs(distance)));
    const arrivalScale = Math.min(1, Math.abs(distance) / profile.arrivalRadius + 0.18);
    const adjustedMaxSpeed = profile.maxSpeed * speedMultiplier;
    const adjustedAcceleration = profile.acceleration * Math.max(0.9, speedMultiplier);
    const targetSpeed = direction * Math.min(adjustedMaxSpeed * arrivalScale, brakingSpeed);
    const mustBrake = this.velocityX !== 0
      && (Math.sign(this.velocityX) !== direction || Math.abs(this.velocityX) > Math.abs(targetSpeed));
    const rate = mustBrake ? profile.deceleration : adjustedAcceleration;
    this.velocityX = moveTowards(this.velocityX, targetSpeed, rate * deltaSeconds);
    this.transferMomentumFromVelocityChange(previousVelocity, this.velocityX, { automatic: true });
    const nextX = this.x + this.velocityX * deltaSeconds;
    const passedTarget = direction !== 0 && Math.sign(targetX - nextX) !== direction;
    this.x = passedTarget ? targetX : nextX;
    if (passedTarget) {
      const crossedVelocity = this.velocityX;
      this.velocityX = 0;
      this.transferMomentumFromVelocityChange(crossedVelocity, this.velocityX, { automatic: true });
    }
    this.clampToRail();
    this.accelerationX = (this.velocityX - previousVelocity) / deltaSeconds;
    return this.x === targetX && this.velocityX === 0;
  }

  updateSwing(deltaSeconds) {
    if (deltaSeconds <= 0) return;
    const swing = CLAW_MOVEMENT.swing;
    const weight = this.currentGrab?.pokemon?.weight || 0;
    let damping = swing.damping + Math.max(0, weight - 0.7) * swing.loadedDampingPerWeight;
    if ([ClawState.DESCENDING, ClawState.CLOSING, ClawState.LIFTING, ClawState.SLIPPING].includes(this.state)) {
      damping = swing.descendingDamping + Math.max(0, weight - 0.7) * swing.loadedDampingPerWeight;
    } else if ([ClawState.CARRYING, ClawState.RETURNING, ClawState.RELEASING, ClawState.WAITING_FOR_CHUTE].includes(this.state)) {
      damping = swing.automaticDamping + Math.max(0, weight - 0.7) * swing.loadedDampingPerWeight;
    }

    const count = Math.max(1, Math.ceil(deltaSeconds / swing.integrationStep));
    const step = deltaSeconds / count;
    const loadFactor = weight > 0
      ? 1 / (1 + Math.max(0, weight - 0.7) * 0.16)
      : 1;
    for (let index = 0; index < count; index += 1) {
      const angularAcceleration = -this.swingAngle * swing.spring * loadFactor
        - this.swingVelocity * damping;
      this.swingVelocity += angularAcceleration * step;
      this.swingAngle += this.swingVelocity * step;

      if (Math.abs(this.swingAngle) > swing.maxAngle) {
        this.swingAngle = Math.sign(this.swingAngle) * swing.maxAngle;
        if (Math.sign(this.swingVelocity) === Math.sign(this.swingAngle)) this.swingVelocity *= -0.12;
      }
    }
    if (Math.abs(this.swingAngle) < 1e-8) this.swingAngle = 0;
    this.accelerationX = 0;
  }

  reset() {
    this.x = this.homeX;
    this.y = this.homeY;
    this.velocityX = 0;
    this.accelerationX = 0;
    this.swingAngle = 0;
    this.swingVelocity = 0;
    this.targetY = this.homeY;
    this.state = ClawState.READY;
    this.caught = null;
    this.currentGrab = null;
    this.openAmount = CLAW_COLLISION.readyOpenAmount;
    this.phaseElapsed = 0;
    this.grabOffsetX = 0;
    this.grabStartedAt = 0;
    this.droppingPrize = null;
    this.dropGrab = null;
    this.slipPhase = null;
    this.contactCandidates = new Set();
    this.contactHistory = new Map();
    this.contactFrame = 0;
    this.contactHooksFired = new Set();
    this.updateColliderGeometry();
  }
}
