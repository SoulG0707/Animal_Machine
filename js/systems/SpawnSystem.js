import { FALLBACK_COLORS, GAME_CONFIG, PHYSICS, SPRITE_ASPECT_RATIOS } from '../config/gameConfig.js';
import { PokemonState } from '../core/GameState.js';
import { Pokemon } from '../entities/Pokemon.js';
import { circleIntersectsRect } from '../utils/collision.js';
import { randomBetween, shuffled } from '../utils/random.js';

export class SpawnSystem {
  constructor(state, characters, machine, chute, prizeBounds, physics) {
    this.state = state;
    this.characters = characters.map((character) => ({ ...character }));
    this.machine = machine;
    this.chute = chute;
    this.prizeBounds = prizeBounds;
    this.physics = physics;
  }

  loadImages() {
    this.characters.forEach((character) => {
      character.image = new Image();
      character.image.onload = () => { character.loaded = true; };
      character.image.src = encodeURI(character.path);
    });
    return this.characters;
  }

  getSpriteDimensions(character) {
    const spriteSize = 96 * GAME_CONFIG.prizeScale;
    const image = character.image;
    const aspectRatio = image?.naturalWidth && image?.naturalHeight
      ? image.naturalWidth / image.naturalHeight
      : SPRITE_ASPECT_RATIOS[character.name] || 1;
    return aspectRatio > 1
      ? { width: spriteSize, height: spriteSize / aspectRatio }
      : { width: spriteSize * aspectRatio, height: spriteSize };
  }

  findPosition(dimensions, radius, placed) {
    const minimumY = this.machine.floorY - 218;
    const maximumY = this.machine.floorY - dimensions.height - 6;
    for (let attempt = 0; attempt < 1200; attempt += 1) {
      const x = randomBetween(this.prizeBounds.left + 4, this.prizeBounds.right - dimensions.width - 4);
      const y = randomBetween(minimumY, maximumY);
      const centerX = x + dimensions.width / 2;
      const centerY = y + dimensions.height / 2;
      if (circleIntersectsRect(centerX, centerY, radius, this.chute.exclusion, 8)) continue;
      const overlapsPrize = placed.some((other) => Math.hypot(centerX - other.centerX, centerY - other.centerY) < (radius + other.bodyRadius) * 0.9);
      if (!overlapsPrize) return { x, y, centerX, centerY };
    }
    const safeLeft = this.chute.exclusion.x + this.chute.exclusion.width + 8;
    const usableWidth = this.prizeBounds.right - safeLeft;
    const column = placed.length % 7;
    const row = Math.floor(placed.length / 7);
    const x = Math.min(this.prizeBounds.right - dimensions.width, safeLeft + 8 + column * (usableWidth - dimensions.width) / 6);
    const y = this.machine.floorY - dimensions.height - 12 - row * 68;
    return { x, y, centerX: x + dimensions.width / 2, centerY: y + dimensions.height / 2 };
  }

  createPrizes() {
    const placed = [];
    this.state.prizes = shuffled(this.characters).map((character, index) => {
      const dimensions = this.getSpriteDimensions(character);
      const radius = Math.max(22, Math.max(dimensions.width, dimensions.height) * 0.42);
      const position = this.findPosition(dimensions, radius, placed);
      const mass = Math.max(0.7, dimensions.width * dimensions.height / 4200);
      const prize = new Pokemon(character, index, dimensions, position, {
        color: FALLBACK_COLORS[index % FALLBACK_COLORS.length],
        velocityX: randomBetween(-8, 8),
        velocityY: randomBetween(-3, 5),
        rotation: randomBetween(-0.3, 0.3),
        angularVelocity: randomBetween(-0.18, 0.18),
        radius,
        mass,
        restitution: PHYSICS.restitution + randomBetween(-0.02, 0.025),
        friction: PHYSICS.floorFriction + randomBetween(-0.025, 0.025),
        shiny: Math.random() < GAME_CONFIG.shinyChance,
      });
      placed.push(prize);
      return prize;
    });
    this.settleInitialPrizes();
    return this.state.prizes;
  }

  settleInitialPrizes() {
    for (let frame = 0; frame < 480; frame += 1) {
      this.physics.update(16);
      if (frame > 120 && this.state.prizes.every((prize) => prize.isSleeping)) break;
    }
    this.state.prizes.forEach((prize) => {
      prize.velocityX = 0;
      prize.velocityY = 0;
      prize.angularVelocity = 0;
      prize.sleepTimer = PHYSICS.sleepDelay;
      prize.isSleeping = true;
      prize.state = PokemonState.IDLE;
    });
  }
}
