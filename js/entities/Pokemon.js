import { PokemonState } from '../core/GameState.js';
import { POKEMON_GRAB_ANCHOR } from '../config/gameConfig.js';
import { createPokemonGeometry } from '../utils/pokemonGeometry.js';

function normalizedAnchor(value, fallback) {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;
}

export class Pokemon {
  constructor(character, index, dimensions, position, options) {
    const { color, velocityX, velocityY, rotation, angularVelocity, radius, mass, restitution, friction, shiny } = options;
    Object.assign(this, {
      character,
      x: position.x,
      y: position.y,
      width: dimensions.width,
      height: dimensions.height,
      centerX: position.centerX,
      centerY: position.centerY,
      bottomY: position.y + dimensions.height,
      color,
      name: character.name,
      collected: false,
      state: PokemonState.IDLE,
      velocityX,
      velocityY,
      rotation,
      angularVelocity,
      bodyRadius: radius,
      weight: character.weight ?? 1,
      grip: character.grip ?? 0.8,
      centerOfMassX: character.centerOfMassX ?? 0.5,
      centerOfMassY: character.centerOfMassY ?? 0.5,
      grabAnchorX: normalizedAnchor(character.grabAnchorX, POKEMON_GRAB_ANCHOR.x),
      grabAnchorY: normalizedAnchor(character.grabAnchorY, POKEMON_GRAB_ANCHOR.y),
      mass,
      inverseMass: 1 / mass,
      restitution,
      friction,
      isSleeping: false,
      sleepTimer: 0,
      touchingSurface: false,
      bounceCount: 0,
      shiny,
      spawnIndex: index,
    });
    this.geometry = createPokemonGeometry(character, this.width, this.height);
    this.centerOfMassX = 0.5 + this.geometry.centerOfMass.x / this.width;
    this.centerOfMassY = 0.5 + this.geometry.centerOfMass.y / this.height;
    this.grabAnchorX = 0.5 + this.geometry.carryAnchor.x / this.width;
    this.grabAnchorY = 0.5 + this.geometry.carryAnchor.y / this.height;
    this.updateGeometry();
  }

  getCenterOfMassOffset(rotation = this.rotation) {
    const localX = (this.centerOfMassX - 0.5) * this.width;
    const localY = (this.centerOfMassY - 0.5) * this.height;
    const cosine = Math.cos(rotation);
    const sine = Math.sin(rotation);
    return {
      x: localX * cosine - localY * sine,
      y: localX * sine + localY * cosine,
    };
  }

  getGrabAnchorOffset(rotation = this.rotation) {
    const localX = (this.grabAnchorX - 0.5) * this.width;
    const localY = (this.grabAnchorY - 0.5) * this.height;
    const cosine = Math.cos(rotation);
    const sine = Math.sin(rotation);
    return {
      x: localX * cosine - localY * sine,
      y: localX * sine + localY * cosine,
    };
  }

  updateGeometry() {
    this.centerX = this.x + this.width / 2;
    this.centerY = this.y + this.height / 2;
    this.bottomY = this.y + this.height;
    const centerOfMassOffset = this.getCenterOfMassOffset();
    this.worldCenterOfMassX = this.centerX + centerOfMassOffset.x;
    this.worldCenterOfMassY = this.centerY + centerOfMassOffset.y;
  }
}
