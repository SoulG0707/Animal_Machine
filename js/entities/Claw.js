import { CLAW_COLLISION, CLAW_MOVEMENT, GAME_CONFIG } from '../config/gameConfig.js';
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
    return Math.max(0, this.y - 7);
  }

  get headOffsetX() {
    const rawOffset = Math.sin(this.swingAngle) * this.cableLength;
    return Math.max(-CLAW_MOVEMENT.swing.maxHeadOffset, Math.min(CLAW_MOVEMENT.swing.maxHeadOffset, rawOffset));
  }

  get headX() {
    return this.x + this.headOffsetX;
  }

  get headY() {
    return this.y;
  }

  get bodyAngle() {
    return this.swingAngle * 0.16;
  }

  localToWorld(localX, localY, output = {}) {
    const scaledX = localX * GAME_CONFIG.clawScale;
    const scaledY = localY * GAME_CONFIG.clawScale;
    const cosine = Math.cos(this.bodyAngle);
    const sine = Math.sin(this.bodyAngle);
    output.x = this.headX + scaledX * cosine - scaledY * sine;
    output.y = this.headY + scaledX * sine + scaledY * cosine;
    return output;
  }

  worldToLocal(worldX, worldY, output = {}) {
    const deltaX = worldX - this.headX;
    const deltaY = worldY - this.headY;
    const cosine = Math.cos(this.bodyAngle);
    const sine = Math.sin(this.bodyAngle);
    output.x = (deltaX * cosine + deltaY * sine) / GAME_CONFIG.clawScale;
    output.y = (-deltaX * sine + deltaY * cosine) / GAME_CONFIG.clawScale;
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
      if (this.velocityX < 0) this.velocityX = 0;
    } else if (this.x >= CLAW_MOVEMENT.rightBound) {
      this.x = CLAW_MOVEMENT.rightBound;
      if (this.velocityX > 0) this.velocityX = 0;
    }
  }

  updatePlayerMovement(direction, deltaSeconds) {
    if (deltaSeconds <= 0) return;
    const previousVelocity = this.velocityX;
    if (direction !== 0) {
      const targetVelocity = Math.sign(direction) * CLAW_MOVEMENT.maxSpeed;
      const reversing = this.velocityX !== 0 && Math.sign(this.velocityX) !== Math.sign(direction);
      const rate = reversing ? CLAW_MOVEMENT.reverseAcceleration : CLAW_MOVEMENT.acceleration;
      this.velocityX = moveTowards(this.velocityX, targetVelocity, rate * deltaSeconds);
    } else {
      this.velocityX = moveTowards(this.velocityX, 0, CLAW_MOVEMENT.deceleration * deltaSeconds);
    }
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
    this.accelerationX = (this.velocityX - previousVelocity) / (1 / 60);
  }

  lockHorizontalMotion() {
    if (this.velocityX === 0) return;
    const previousVelocity = this.velocityX;
    this.velocityX = 0;
    this.accelerationX = -previousVelocity / CLAW_MOVEMENT.grabBrakeDuration;
  }

  updateAutomaticMovement(targetX, deltaSeconds, profileName = 'return', speedMultiplier = 1) {
    if (deltaSeconds <= 0) return Math.abs(targetX - this.x) < 0.001;
    const profile = CLAW_MOVEMENT[profileName];
    const distance = targetX - this.x;
    const previousVelocity = this.velocityX;

    if (Math.abs(distance) < 0.25 && Math.abs(this.velocityX) < 6) {
      this.x = targetX;
      this.velocityX = 0;
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
    const nextX = this.x + this.velocityX * deltaSeconds;
    const passedTarget = direction !== 0 && Math.sign(targetX - nextX) !== direction;
    this.x = passedTarget ? targetX : nextX;
    if (passedTarget) this.velocityX = 0;
    this.clampToRail();
    this.accelerationX = (this.velocityX - previousVelocity) / deltaSeconds;
    return this.x === targetX && this.velocityX === 0;
  }

  updateSwing(deltaSeconds) {
    if (deltaSeconds <= 0) return;
    const swing = CLAW_MOVEMENT.swing;
    let damping = swing.damping;
    if ([ClawState.DESCENDING, ClawState.CLOSING, ClawState.LIFTING, ClawState.SLIPPING].includes(this.state)) {
      damping = swing.descendingDamping;
    } else if ([ClawState.CARRYING, ClawState.RETURNING, ClawState.RELEASING, ClawState.WAITING_FOR_CHUTE].includes(this.state)) {
      damping = swing.automaticDamping;
    }

    const carrySwingMultiplier = this.currentGrab?.swingMultiplier || 1;
    const angularAcceleration = -this.swingAngle * swing.spring
      - this.swingVelocity * damping
      - this.accelerationX * swing.accelerationForce * carrySwingMultiplier;
    this.swingVelocity += angularAcceleration * deltaSeconds;
    this.swingAngle += this.swingVelocity * deltaSeconds;

    if (Math.abs(this.swingAngle) > swing.maxAngle) {
      this.swingAngle = Math.sign(this.swingAngle) * swing.maxAngle;
      if (Math.sign(this.swingVelocity) === Math.sign(this.swingAngle)) this.swingVelocity *= -0.12;
    }
    if (Math.abs(this.swingAngle) < swing.settleAngle && Math.abs(this.swingVelocity) < swing.settleVelocity && this.accelerationX === 0) {
      this.swingAngle = 0;
      this.swingVelocity = 0;
    }
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
    this.carryOffsetX = 0;
    this.grabOffsetX = 0;
    this.carryOffsetY = 0;
    this.grabStartedAt = 0;
    this.droppingPrize = null;
    this.dropGrab = null;
    this.slipPhase = null;
    this.contactCandidates = new Set();
    this.contactHooksFired = new Set();
    this.updateColliderGeometry();
  }
}
