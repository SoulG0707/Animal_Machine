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
      weight: character.weight ?? 1,
      grip: character.grip ?? 0.8,
      centerOfMassX: character.centerOfMassX ?? 0.5,
      centerOfMassY: character.centerOfMassY ?? 0.5,
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

  updateGeometry() {
    this.centerX = this.x + this.width / 2;
    this.centerY = this.y + this.height / 2;
    this.bottomY = this.y + this.height;
    const centerOfMassOffset = this.getCenterOfMassOffset();
    this.worldCenterOfMassX = this.centerX + centerOfMassOffset.x;
    this.worldCenterOfMassY = this.centerY + centerOfMassOffset.y;
  }
}
