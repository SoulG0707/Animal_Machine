export class PrizeChute {
  constructor(machine) {
    this.x = 38;
    this.width = 148;
    this.mouth = { x: 52, y: machine.floorY - 16, width: 120, height: 16 };
    this.tunnel = { x: 52, y: machine.floorY - 16, width: 120, bottom: machine.height - 38 };
    this.sensor = { x: 64, y: machine.height - 54, width: 96, height: 10 };
    this.walls = {
      left: { x: 38, y: machine.floorY - 24, width: 14, height: machine.height - machine.floorY + 12 },
      right: { x: 172, y: machine.floorY - 24, width: 14, height: machine.height - machine.floorY + 12 },
      leftLip: { x: 30, y: machine.floorY - 24, width: 22, height: 10 },
      rightLip: { x: 172, y: machine.floorY - 24, width: 22, height: 10 },
    };
    this.divider = { x: 186, y: machine.floorY - 160, width: 18, height: 160 };
    this.exclusion = { x: 18, y: machine.floorY - 160, width: 186, height: 172 };
    this.flash = 0;
  }

  get centerX() {
    return this.mouth.x + this.mouth.width / 2;
  }

  reset() {
    this.flash = 0;
  }
}
