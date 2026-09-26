import { ANIMATION, CLAW_COLLISION, PHYSICS } from '../config/gameConfig.js';
import { PokemonState } from '../core/GameState.js';
import { clamp } from '../utils/math.js';

function closestPointOnSegment(pointX, pointY, startX, startY, endX, endY, output) {
  const segmentX = endX - startX;
  const segmentY = endY - startY;
  const lengthSquared = segmentX * segmentX + segmentY * segmentY;
  const progress = lengthSquared > 0
    ? clamp(((pointX - startX) * segmentX + (pointY - startY) * segmentY) / lengthSquared, 0, 1)
    : 0;
  output.x = startX + segmentX * progress;
  output.y = startY + segmentY * progress;
  return output;
}

export class PhysicsSystem {
  constructor(state, machine, chute, prizeBounds) {
    this.state = state;
    this.machine = machine;
    this.chute = chute;
    this.prizeBounds = prizeBounds;
    this.clawContactPoint = { x: 0, y: 0 };
  }

  updateGeometry(prize) {
    prize.updateGeometry?.();
    if (typeof prize.updateGeometry !== 'function') {
      prize.centerX = prize.x + prize.width / 2;
      prize.centerY = prize.y + prize.height / 2;
      prize.bottomY = prize.y + prize.height;
    }
  }

  isPhysicsPrize(prize) {
    return !prize.collected && [PokemonState.IDLE, PokemonState.SLIPPING, PokemonState.FALLING, PokemonState.SETTLING].includes(prize.state);
  }

  wake(prize) {
    prize.isSleeping = false;
    prize.sleepTimer = 0;
  }

  getClawDescentLimit(claw, desiredY) {
    const bounds = claw.getColliderBounds();
    const bottomOffset = bounds.bottom - claw.headY;
    let limit = Math.min(desiredY, this.machine.floorY - bottomOffset - CLAW_COLLISION.floorClearance);
    const obstacles = [
      this.chute.divider,
      this.chute.walls.left,
      this.chute.walls.right,
      this.chute.walls.leftLip,
      this.chute.walls.rightLip,
    ];
    obstacles.forEach((obstacle) => {
      const overlapsHorizontally = bounds.right > obstacle.x && bounds.left < obstacle.x + obstacle.width;
      if (!overlapsHorizontally || obstacle.y <= claw.homeY) return;
      limit = Math.min(limit, obstacle.y - bottomOffset - CLAW_COLLISION.obstacleClearance);
    });
    return Math.max(claw.homeY, limit);
  }

  resolveClawContact(prize, collider, motion) {
    const closest = collider.type === 'circle'
      ? collider
      : closestPointOnSegment(
        prize.centerX, prize.centerY,
        collider.ax, collider.ay, collider.bx, collider.by,
        this.clawContactPoint,
      );
    let deltaX = prize.centerX - closest.x;
    let deltaY = prize.centerY - closest.y;
    let distance = Math.hypot(deltaX, deltaY);
    const minimumDistance = prize.bodyRadius + collider.radius;
    if (distance >= minimumDistance) return null;

    if (distance < 0.001) {
      if (collider.id === 'left-prong') deltaX = prize.centerX >= motion.headX ? 1 : -1;
      else if (collider.id === 'right-prong') deltaX = prize.centerX <= motion.headX ? -1 : 1;
      else deltaY = 1;
      distance = 1;
    }
    const normalX = deltaX / distance;
    const normalY = deltaY / distance;
    const penetration = minimumDistance - distance;
    const weightResistance = 1 / Math.sqrt(prize.weight);
    const correction = Math.min(
      penetration * 0.48,
      CLAW_COLLISION.maxPositionCorrection * weightResistance,
    );

    this.wake(prize);
    prize.x += normalX * correction;
    prize.y += normalY * correction;

    let kinematicX = 0;
    if (motion.phase === 'closing') {
      if (collider.id === 'left-prong') kinematicX = motion.closingSpeed;
      if (collider.id === 'right-prong') kinematicX = -motion.closingSpeed;
    }
    const approachSpeed = Math.max(0, kinematicX * normalX + motion.velocityY * normalY);
    const phaseFactor = motion.phase === 'closing'
      ? CLAW_COLLISION.closingImpactFactor
      : CLAW_COLLISION.descentImpactFactor;
    const glancingImpulse = Math.abs(motion.velocityY)
      * CLAW_COLLISION.glancingImpactFactor * Math.abs(normalX);
    const impulse = clamp(
      (approachSpeed * phaseFactor + glancingImpulse) / prize.weight,
      0,
      CLAW_COLLISION.maxPushImpulse,
    );
    prize.velocityX = clamp(
      prize.velocityX + normalX * impulse,
      -CLAW_COLLISION.maxPushVelocity,
      CLAW_COLLISION.maxPushVelocity,
    );
    prize.velocityY = clamp(
      prize.velocityY + normalY * impulse,
      -CLAW_COLLISION.maxPushVelocity,
      CLAW_COLLISION.maxPushVelocity * 1.35,
    );
    const leverX = closest.x - prize.centerX;
    const leverY = closest.y - prize.centerY;
    const tangentX = -normalY;
    const tangentY = normalX;
    const tangentialSpeed = kinematicX * tangentX + motion.velocityY * tangentY;
    const torque = ((leverX * normalY - leverY * normalX)
      * impulse * CLAW_COLLISION.angularImpactFactor
      + tangentialSpeed * CLAW_COLLISION.angularFrictionFactor) / prize.weight;
    prize.angularVelocity = clamp(
      prize.angularVelocity + torque,
      -PHYSICS.maxAngularVelocity,
      PHYSICS.maxAngularVelocity,
    );
    this.updateGeometry(prize);
    this.resolveWorldBounds(prize);
    this.resolveChuteWalls(prize);
    return { prize, colliderId: collider.id, penetration, impulse };
  }

  resolveClawCollisions(claw, motion = {}) {
    const colliders = claw.getPhysicalColliders();
    const contacts = [];
    const resolvedMotion = {
      phase: motion.phase || 'descending',
      velocityY: motion.velocityY || 0,
      closingSpeed: motion.closingSpeed || 0,
      headX: claw.headX,
    };
    for (const prize of this.state.prizes) {
      if (!this.isPhysicsPrize(prize)) continue;
      for (const collider of colliders) {
        const contact = this.resolveClawContact(prize, collider, resolvedMotion);
        if (contact) contacts.push(contact);
      }
    }
    return contacts;
  }

  resolveWorldBounds(prize) {
    const minimumX = this.prizeBounds.left;
    const maximumX = this.prizeBounds.right - prize.width;
    let collided = false;
    if (prize.x < minimumX) {
      prize.x = minimumX;
      prize.velocityX = Math.abs(prize.velocityX) * PHYSICS.wallRestitution;
      prize.angularVelocity += Math.min(0.28, Math.abs(prize.velocityY) * 0.0007);
      collided = true;
    } else if (prize.x > maximumX) {
      prize.x = maximumX;
      prize.velocityX = -Math.abs(prize.velocityX) * PHYSICS.wallRestitution;
      prize.angularVelocity -= Math.min(0.28, Math.abs(prize.velocityY) * 0.0007);
      collided = true;
    }
    if (prize.y + prize.height >= this.machine.floorY) {
      prize.y = this.machine.floorY - prize.height;
      prize.velocityY = prize.velocityY > 24 ? -prize.velocityY * prize.restitution : 0;
      prize.velocityX *= prize.friction;
      prize.angularVelocity *= 0.72;
      prize.touchingSurface = true;
      collided = true;
    }
    if (prize.y < -prize.height * 1.5) {
      prize.y = -prize.height * 1.5;
      prize.velocityY = Math.max(0, prize.velocityY);
    }
    this.updateGeometry(prize);
    return collided;
  }

  resolveStaticRectCollision(prize, rectangle) {
    const closestX = Math.max(rectangle.x, Math.min(prize.centerX, rectangle.x + rectangle.width));
    const closestY = Math.max(rectangle.y, Math.min(prize.centerY, rectangle.y + rectangle.height));
    let deltaX = prize.centerX - closestX;
    let deltaY = prize.centerY - closestY;
    let distance = Math.hypot(deltaX, deltaY);
    let penetration = prize.bodyRadius - distance;
    if (distance === 0) {
      const distances = [
        { value: prize.centerX - rectangle.x, normalX: -1, normalY: 0 },
        { value: rectangle.x + rectangle.width - prize.centerX, normalX: 1, normalY: 0 },
        { value: prize.centerY - rectangle.y, normalX: 0, normalY: -1 },
        { value: rectangle.y + rectangle.height - prize.centerY, normalX: 0, normalY: 1 },
      ].sort((first, second) => first.value - second.value);
      deltaX = distances[0].normalX;
      deltaY = distances[0].normalY;
      distance = 1;
      penetration = prize.bodyRadius + distances[0].value;
    }
    if (penetration <= 0) return false;
    const normalX = deltaX / distance;
    const normalY = deltaY / distance;
    prize.x += normalX * penetration;
    prize.y += normalY * penetration;
    const velocityAlongNormal = prize.velocityX * normalX + prize.velocityY * normalY;
    if (velocityAlongNormal < 0) {
      prize.velocityX -= (1 + prize.restitution) * velocityAlongNormal * normalX;
      prize.velocityY -= (1 + prize.restitution) * velocityAlongNormal * normalY;
      const tangentX = -normalY;
      const tangentY = normalX;
      const tangentVelocity = prize.velocityX * tangentX + prize.velocityY * tangentY;
      prize.velocityX -= tangentVelocity * 0.18 * tangentX;
      prize.velocityY -= tangentVelocity * 0.18 * tangentY;
      prize.angularVelocity += tangentVelocity * 0.0007;
    }
    prize.touchingSurface = true;
    this.updateGeometry(prize);
    return true;
  }

  resolveChuteWalls(prize) {
    const hitLeftWall = this.resolveStaticRectCollision(prize, this.chute.walls.left);
    const hitRightWall = this.resolveStaticRectCollision(prize, this.chute.walls.right);
    const hitLeftLip = this.resolveStaticRectCollision(prize, this.chute.walls.leftLip);
    const hitRightLip = this.resolveStaticRectCollision(prize, this.chute.walls.rightLip);
    const hitDivider = this.resolveStaticRectCollision(prize, this.chute.divider);
    return hitLeftWall || hitRightWall || hitLeftLip || hitRightLip || hitDivider;
  }

  resolvePrizeCollision(first, second) {
    const deltaX = second.centerX - first.centerX;
    const deltaY = second.centerY - first.centerY;
    const minimumDistance = first.bodyRadius + second.bodyRadius;
    const distanceSquared = deltaX * deltaX + deltaY * deltaY;
    if (distanceSquared >= minimumDistance * minimumDistance) return false;
    const distance = Math.sqrt(distanceSquared) || 0.001;
    const normalX = distance > 0.001 ? deltaX / distance : (first.centerX <= second.centerX ? 1 : -1);
    const normalY = distance > 0.001 ? deltaY / distance : 0;
    const overlap = minimumDistance - distance;
    const firstWeight = first.isSleeping ? 0 : first.inverseMass;
    const secondWeight = second.isSleeping ? 0 : second.inverseMass;
    const movableWeight = firstWeight + secondWeight;
    if (movableWeight > 0) {
      const correction = Math.max(0, overlap - 0.35) / movableWeight * 0.72;
      if (!first.isSleeping) {
        first.x -= normalX * correction * firstWeight;
        first.y -= normalY * correction * firstWeight;
        this.updateGeometry(first);
      }
      if (!second.isSleeping) {
        second.x += normalX * correction * secondWeight;
        second.y += normalY * correction * secondWeight;
        this.updateGeometry(second);
      }
    }
    const relativeX = second.velocityX - first.velocityX;
    const relativeY = second.velocityY - first.velocityY;
    const velocityAlongNormal = relativeX * normalX + relativeY * normalY;
    if (velocityAlongNormal < 0) {
      if (Math.abs(velocityAlongNormal) > 10) {
        this.wake(first);
        this.wake(second);
      }
      const firstImpulseMass = first.isSleeping ? 0 : first.inverseMass;
      const secondImpulseMass = second.isSleeping ? 0 : second.inverseMass;
      const inverseMassSum = firstImpulseMass + secondImpulseMass;
      if (inverseMassSum <= 0) return true;
      const restitution = Math.min(first.restitution, second.restitution);
      const impulse = -(1 + restitution) * velocityAlongNormal / inverseMassSum;
      const impulseX = impulse * normalX;
      const impulseY = impulse * normalY;
      first.velocityX -= impulseX * firstImpulseMass;
      first.velocityY -= impulseY * firstImpulseMass;
      second.velocityX += impulseX * secondImpulseMass;
      second.velocityY += impulseY * secondImpulseMass;
      const tangentX = -normalY;
      const tangentY = normalX;
      const tangentSpeed = relativeX * tangentX + relativeY * tangentY;
      const frictionImpulse = Math.max(-impulse * 0.22, Math.min(impulse * 0.22, -tangentSpeed / inverseMassSum));
      first.velocityX -= frictionImpulse * tangentX * firstImpulseMass;
      first.velocityY -= frictionImpulse * tangentY * firstImpulseMass;
      second.velocityX += frictionImpulse * tangentX * secondImpulseMass;
      second.velocityY += frictionImpulse * tangentY * secondImpulseMass;
      const spin = frictionImpulse * 0.0008;
      first.angularVelocity -= spin;
      second.angularVelocity += spin;
      if (Math.abs(impulse) > 45) {
        this.wake(first);
        this.wake(second);
      }
    }
    first.touchingSurface = true;
    second.touchingSurface = true;
    return true;
  }

  integrate(prize, step) {
    if (prize.isSleeping) return;
    prize.velocityY += PHYSICS.gravity * step;
    prize.velocityX *= Math.pow(PHYSICS.airFriction, step * 60);
    prize.angularVelocity *= Math.pow(PHYSICS.angularDamping, step * 60);
    prize.angularVelocity = Math.max(-PHYSICS.maxAngularVelocity, Math.min(PHYSICS.maxAngularVelocity, prize.angularVelocity));
    prize.x += prize.velocityX * step;
    prize.y += prize.velocityY * step;
    prize.rotation += prize.angularVelocity * step;
    this.updateGeometry(prize);
  }

  updateSleeping(prize, elapsed) {
    if (!this.isPhysicsPrize(prize) || prize.isSleeping) return;
    if (prize.touchingSurface) {
      prize.velocityX *= Math.pow(0.94, elapsed / 16.667);
      prize.angularVelocity *= Math.pow(0.82, elapsed / 16.667);
    }
    const speed = Math.hypot(prize.velocityX, prize.velocityY);
    if (prize.touchingSurface && speed < PHYSICS.sleepSpeed && Math.abs(prize.angularVelocity) < PHYSICS.sleepAngularSpeed) {
      prize.sleepTimer += elapsed;
      if (prize.sleepTimer >= PHYSICS.sleepDelay) {
        prize.isSleeping = true;
        prize.velocityX = 0;
        prize.velocityY = 0;
        prize.angularVelocity = 0;
        if (prize.state !== PokemonState.IDLE) prize.state = PokemonState.IDLE;
      }
    } else prize.sleepTimer = 0;
  }

  update(elapsed) {
    const safeElapsed = Math.min(Math.max(elapsed, 0), 50);
    if (safeElapsed <= 0) return;
    const dynamicPrizes = this.state.prizes.filter((prize) => this.isPhysicsPrize(prize));
    const totalSeconds = safeElapsed / 1000;
    const substeps = Math.max(1, Math.min(5, Math.ceil(totalSeconds / PHYSICS.maxStep)));
    const step = totalSeconds / substeps;
    dynamicPrizes.forEach((prize) => { prize.touchingSurface = false; });
    for (let substep = 0; substep < substeps; substep += 1) {
      dynamicPrizes.forEach((prize) => {
        this.integrate(prize, step);
        this.resolveWorldBounds(prize);
        this.resolveChuteWalls(prize);
      });
      for (let iteration = 0; iteration < PHYSICS.solverIterations; iteration += 1) {
        for (let firstIndex = 0; firstIndex < dynamicPrizes.length; firstIndex += 1) {
          for (let secondIndex = firstIndex + 1; secondIndex < dynamicPrizes.length; secondIndex += 1) {
            this.resolvePrizeCollision(dynamicPrizes[firstIndex], dynamicPrizes[secondIndex]);
          }
        }
        dynamicPrizes.forEach((prize) => {
          this.resolveWorldBounds(prize);
          this.resolveChuteWalls(prize);
        });
      }
    }
    dynamicPrizes.forEach((prize) => this.updateSleeping(prize, safeElapsed));
  }

  updateChuteDrop(prize, elapsed) {
    const safeElapsed = Math.min(elapsed, 50);
    const totalSeconds = safeElapsed / 1000;
    const substeps = Math.max(1, Math.min(5, Math.ceil(totalSeconds / PHYSICS.maxStep)));
    const step = totalSeconds / substeps;
    const result = { sensorTriggered: false, complete: false };
    prize.dropElapsed += safeElapsed;
    for (let substep = 0; substep < substeps; substep += 1) {
      prize.velocityY += PHYSICS.gravity * step;
      prize.x += prize.velocityX * step;
      prize.y += prize.velocityY * step;
      prize.rotation += prize.angularVelocity * step;
      this.updateGeometry(prize);
      this.resolveChuteWalls(prize);
      const sensor = this.chute.sensor;
      const insideSensorX = prize.centerX >= sensor.x && prize.centerX <= sensor.x + sensor.width;
      if (!prize.chuteSensorTriggered && insideSensorX && prize.bottomY >= sensor.y) {
        prize.chuteSensorTriggered = true;
        prize.state = PokemonState.CAUGHT;
        prize.dropPhase = 'sensor-confirmed';
        prize.dropElapsed = 0;
        this.chute.flash = 1;
        result.sensorTriggered = true;
        break;
      }
    }
    if (prize.dropPhase === 'sensor-confirmed') {
      const progress = Math.min(prize.dropElapsed / ANIMATION.chuteFadeDuration, 1);
      prize.dropScale = 1 - progress * 0.08;
      prize.dropAlpha = 1 - progress;
      if (progress >= 1) result.complete = true;
    }
    this.updateGeometry(prize);
    return result;
  }
}
