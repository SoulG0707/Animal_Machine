import { ClawState } from '../core/GameState.js';

export class Claw {
  constructor(homeX, homeY = 76) {
    this.homeX = homeX;
    this.homeY = homeY;
    this.width = 58;
    this.height = 28;
    this.reset();
  }

  reset() {
    this.x = this.homeX;
    this.y = this.homeY;
    this.targetY = this.homeY;
    this.state = ClawState.READY;
    this.caught = null;
    this.currentGrab = null;
    this.openAmount = 1;
    this.phaseElapsed = 0;
    this.carryOffsetX = 0;
    this.grabOffsetX = 0;
    this.carryOffsetY = 0;
    this.grabStartedAt = 0;
    this.droppingPrize = null;
    this.dropGrab = null;
    this.slipPhase = null;
  }
}
