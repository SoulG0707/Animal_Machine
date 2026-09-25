import { PokemonState } from '../core/GameState.js';

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
  }

  updateGeometry() {
    this.centerX = this.x + this.width / 2;
    this.centerY = this.y + this.height / 2;
    this.bottomY = this.y + this.height;
  }
}
