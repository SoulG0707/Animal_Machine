import { FALLBACK_COLORS, GAME_CONFIG, PHYSICS, SPRITE_ASPECT_RATIOS } from '../config/gameConfig.js';
import { PokemonState } from '../core/GameState.js';
import { Pokemon } from '../entities/Pokemon.js';
import {
  createPokemonGeometry, ellipseIntersectsRect, getPokemonCollider, shapeRadiusAlong,
} from '../utils/pokemonGeometry.js';
import { randomBetween, shuffled } from '../utils/random.js';

export class SpawnSystem {
  constructor(state, characters, machine, chute, prizeBounds, physics) {
    this.state = state;
    this.characters = characters.map((character) => ({ ...character }));
    this.machine = machine;
    this.chute = chute;
    this.prizeBounds = prizeBounds;
    this.physics = physics;
    this.imageCache = new Map();
    this.assetFailures = [];
  }

  loadImages() {
    const pending = this.characters.map((character) => {
      const path = encodeURI(character.path);
      let cached = this.imageCache.get(path);
      if (!cached) {
        const image = new Image();
        cached = {
          image,
          promise: new Promise((resolve) => {
            image.onload = () => resolve({ loaded: image.naturalWidth > 0 && image.naturalHeight > 0 });
            image.onerror = () => resolve({ loaded: false });
            image.src = path;
          }),
        };
        this.imageCache.set(path, cached);
      }
      character.image = cached.image;
      character.loaded = false;
      character.assetLoadState = 'loading';
      return cached.promise.then(({ loaded }) => {
        character.loaded = loaded;
        character.assetLoadState = loaded ? 'loaded' : 'error';
        if (!loaded) {
          this.assetFailures.push({ name: character.name, path: character.path });
          console.warn(`Missing Pokémon asset: ${character.name} (${character.path})`);
        }
        return { character, loaded };
      });
    });
    // Each image load resolves on either load or error, so a missing file cannot
    // leave the start screen waiting indefinitely.
    this.assetsReady = Promise.all(pending);
    return this.characters;
  }

  getSpriteDimensions(character) {
    const spriteSize = 96 * GAME_CONFIG.prizeScale;
    // Physics/entity dimensions come from static game config. Loaded image
    // dimensions are presentation-only and never affect collider scaling.
    const aspectRatio = SPRITE_ASPECT_RATIOS[character.name]
      || character.width / character.height
      || 1;
    return aspectRatio > 1
      ? { width: spriteSize, height: spriteSize / aspectRatio }
      : { width: spriteSize * aspectRatio, height: spriteSize };
  }

  findPosition(dimensions, geometry, placed) {
    const minimumY = this.machine.floorY - 218;
    const maximumY = this.machine.floorY - dimensions.height - 6;
    for (let attempt = 0; attempt < 1200; attempt += 1) {
      const x = randomBetween(this.prizeBounds.left + 4, this.prizeBounds.right - dimensions.width - 4);
      const y = randomBetween(minimumY, maximumY);
      const centerX = x + dimensions.width / 2;
      const centerY = y + dimensions.height / 2;
      const collider = getPokemonCollider({ centerX, centerY, rotation: 0, geometry });
      if (ellipseIntersectsRect(collider, {
        x: this.chute.exclusion.x - 8, y: this.chute.exclusion.y - 8,
        width: this.chute.exclusion.width + 16, height: this.chute.exclusion.height + 16,
      })) continue;
      const overlapsPrize = placed.some((other) => {
        const otherCollider = getPokemonCollider(other);
        const deltaX = otherCollider.x - collider.x;
        const deltaY = otherCollider.y - collider.y;
        const distance = Math.hypot(deltaX, deltaY) || 0.001;
        const directionX = deltaX / distance;
        const directionY = deltaY / distance;
        return distance < (shapeRadiusAlong(collider, directionX, directionY)
          + shapeRadiusAlong(otherCollider, -directionX, -directionY)) * 0.9;
      });
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
      const geometry = createPokemonGeometry(character, dimensions.width, dimensions.height);
      const radius = Math.max(22, Math.max(dimensions.width, dimensions.height) * 0.42);
      const position = this.findPosition(dimensions, geometry, placed);
      const mass = character.weight ?? 1;
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
