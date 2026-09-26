import { GAME_CONFIG, RARITY_COLORS } from '../config/gameConfig.js';
import { PokemonState } from '../core/GameState.js';

export class RenderSystem {
  constructor(canvas, state, machine, chute, claw, spawn) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.context.imageSmoothingEnabled = true;
    this.context.imageSmoothingQuality = 'high';
    this.state = state;
    this.machine = machine;
    this.chute = chute;
    this.claw = claw;
    this.spawn = spawn;
  }

  drawBackground() {
    const { context, machine } = this;
    context.fillStyle = '#c7edf2';
    context.fillRect(0, 0, machine.width, machine.floorY);
    context.fillStyle = '#d8f2ea';
    context.fillRect(0, GAME_CONFIG.clawLaneBottom, machine.width, machine.floorY - GAME_CONFIG.clawLaneBottom);
    for (let x = 0; x < machine.width; x += 56) {
      context.fillStyle = x % 112 === 0 ? '#d0eee8' : '#d8f2ea';
      context.fillRect(x, GAME_CONFIG.clawLaneBottom, 28, machine.floorY - GAME_CONFIG.clawLaneBottom);
    }
    context.fillStyle = 'rgba(57, 149, 109, .28)';
    context.fillRect(0, GAME_CONFIG.clawLaneBottom - 2, machine.width, 2);
    context.fillStyle = '#83cb73';
    context.fillRect(0, machine.floorY, machine.width, machine.height - machine.floorY);
    context.fillStyle = '#4a9b5c';
    context.fillRect(0, machine.floorY, machine.width, 10);
    for (let x = 12; x < machine.width; x += 64) {
      context.fillStyle = '#a2d982';
      context.fillRect(x, machine.floorY + 20, 22, 7);
      context.fillRect(x + 30, machine.floorY + 48, 18, 6);
      context.fillStyle = '#67b568';
      context.fillRect(x + 8, machine.floorY + 68, 5, 5);
    }
  }

  drawChute(elapsed) {
    const { context, machine, chute } = this;
    chute.flash = Math.max(0, chute.flash - elapsed / 520);
    const outerY = chute.mouth.y - 8;
    const outerBottom = machine.height - 12;
    const tunnelHeight = chute.tunnel.bottom - chute.tunnel.y;
    context.fillStyle = 'rgba(21, 34, 48, .2)';
    context.fillRect(chute.x - 7, outerY + 8, chute.width + 14, outerBottom - outerY + 3);
    const depth = context.createLinearGradient(0, chute.tunnel.y, 0, chute.tunnel.bottom);
    depth.addColorStop(0, '#0c1725'); depth.addColorStop(0.65, '#172639'); depth.addColorStop(1, '#0a121d');
    context.fillStyle = depth;
    context.fillRect(chute.tunnel.x, chute.tunnel.y, chute.tunnel.width, tunnelHeight);
    context.fillStyle = 'rgba(255, 255, 255, .08)';
    context.fillRect(chute.tunnel.x + 7, chute.tunnel.y + 6, chute.tunnel.width - 14, 3);
    context.fillStyle = '#1b2b3d';
    context.fillRect(chute.x + 6, chute.sensor.y + 9, chute.width - 12, outerBottom - chute.sensor.y - 9);
  }

  drawChuteForeground() {
    const { context, machine, chute } = this;
    const outerY = chute.mouth.y - 8;
    const outerBottom = machine.height - 12;
    context.fillStyle = '#243346';
    context.fillRect(chute.walls.leftLip.x, chute.walls.leftLip.y, chute.walls.leftLip.width, chute.walls.leftLip.height);
    context.fillRect(chute.walls.rightLip.x, chute.walls.rightLip.y, chute.walls.rightLip.width, chute.walls.rightLip.height);
    context.fillStyle = '#e6464d';
    context.fillRect(chute.walls.leftLip.x + 2, chute.walls.leftLip.y + 2, chute.walls.leftLip.width - 2, 4);
    context.fillRect(chute.walls.rightLip.x, chute.walls.rightLip.y + 2, chute.walls.rightLip.width - 2, 4);
    context.fillStyle = '#ffd342';
    context.fillRect(chute.mouth.x, chute.mouth.y - 3, 18, 3);
    context.fillRect(chute.mouth.x + chute.mouth.width - 18, chute.mouth.y - 3, 18, 3);
    context.fillStyle = '#243346';
    context.fillRect(chute.walls.left.x, chute.walls.left.y, chute.walls.left.width, chute.walls.left.height);
    context.fillRect(chute.walls.right.x, chute.walls.right.y, chute.walls.right.width, chute.walls.right.height);
    context.fillRect(chute.x, chute.sensor.y + 7, chute.width, outerBottom - chute.sensor.y - 7);
    context.fillStyle = '#fffcf3';
    context.fillRect(chute.x + 5, outerY + 9, 4, outerBottom - outerY - 18);
    context.fillRect(chute.x + chute.width - 9, outerY + 9, 4, outerBottom - outerY - 18);
    const divider = chute.divider;
    context.fillStyle = 'rgba(184, 235, 238, .3)';
    context.fillRect(divider.x, divider.y, divider.width, divider.height);
    context.fillStyle = '#243346';
    context.fillRect(divider.x, divider.y, 4, divider.height);
    context.fillRect(divider.x + divider.width - 4, divider.y, 4, divider.height);
    context.fillRect(divider.x - 2, divider.y - 5, divider.width + 4, 7);
    context.fillStyle = '#fffcf3';
    context.fillRect(divider.x + 5, divider.y + 7, 2, divider.height - 14);
    context.fillStyle = '#ffd342'; context.font = 'bold 9px monospace'; context.textAlign = 'center';
    context.fillText('PRIZE', chute.centerX, chute.sensor.y + 22);
    context.fillStyle = '#fffcf3'; context.beginPath(); context.arc(chute.centerX, outerBottom - 1, 7, Math.PI, Math.PI * 2); context.fill();
    context.fillStyle = '#e6464d'; context.fillRect(chute.centerX - 7, outerBottom - 1, 14, 2);
    context.fillStyle = '#243346'; context.fillRect(chute.centerX - 1, outerBottom - 3, 2, 5);
    if (chute.flash > 0) {
      context.save(); context.globalAlpha = chute.flash * 0.62; context.fillStyle = '#ffd342';
      context.fillRect(chute.mouth.x, chute.mouth.y - 5, chute.mouth.width, 5); context.restore();
    }
  }

  drawPixelPokeball(prize) {
    const { context } = this;
    const y = Math.round(prize.bottomY - 15 * GAME_CONFIG.prizeScale);
    context.save(); context.translate(Math.round(prize.centerX), y); context.scale(GAME_CONFIG.prizeScale, GAME_CONFIG.prizeScale);
    context.fillStyle = prize.color; context.fillRect(-22, -22, 44, 20);
    context.fillStyle = '#fff9ef'; context.fillRect(-22, -2, 44, 21);
    context.fillStyle = '#243346'; context.fillRect(-25, -5, 50, 6); context.fillRect(-7, -9, 14, 14);
    context.fillStyle = '#fff9ef'; context.fillRect(-3, -5, 6, 6); context.restore();
  }

  drawSparkle(x, y, size, alpha) {
    const { context } = this;
    context.save(); context.globalAlpha = alpha; context.fillStyle = '#fff9d7';
    context.fillRect(Math.round(x + size / 2), Math.round(y), 2, size);
    context.fillRect(Math.round(x), Math.round(y + size / 2), size + 2, 2); context.restore();
  }

  drawPrize(prize, index, time) {
    const { context, machine } = this;
    const isChuteDrop = prize.state === PokemonState.DROPPING_TO_CHUTE || (prize.state === PokemonState.CAUGHT && prize.dropPhase === 'sensor-confirmed');
    if (prize.collected || prize.state === PokemonState.GRABBED) return;
    context.save();
    if (isChuteDrop) context.globalAlpha = prize.dropAlpha;
    else {
      const shadowY = Math.min(prize.bottomY, machine.floorY - 3);
      const rarity = prize.character.rarity || 'common';
      if (rarity !== 'common' || prize.shiny) {
        context.save(); context.globalAlpha = prize.shiny ? 0.2 : rarity === 'legendary' ? 0.15 : 0.1;
        context.fillStyle = prize.shiny ? '#ffd342' : RARITY_COLORS[rarity]; context.beginPath();
        context.ellipse(prize.centerX, prize.centerY, prize.width * 0.48, prize.height * 0.46, 0, 0, Math.PI * 2); context.fill(); context.restore();
      }
      context.fillStyle = 'rgba(36, 51, 70, .14)'; context.fillRect(prize.centerX - prize.width * 0.28, shadowY, prize.width * 0.56, 3);
    }
    const scale = isChuteDrop ? prize.dropScale : 1;
    if (prize.character.loaded) {
      const dimensions = this.spawn.getSpriteDimensions(prize.character);
      context.save(); context.translate(prize.centerX, prize.centerY); context.rotate(prize.rotation || 0);
      context.drawImage(
        prize.character.image,
        -dimensions.width * scale / 2,
        -dimensions.height * scale / 2,
        dimensions.width * scale,
        dimensions.height * scale,
      );
      context.restore();
    } else this.drawPixelPokeball(prize);
    if (!isChuteDrop && prize.shiny) {
      const phase = time / 450 + index * 1.73;
      this.drawSparkle(prize.centerX - 27 + Math.sin(phase) * 18, prize.centerY + Math.cos(phase * 0.9) * 16, 6, 0.55);
      this.drawSparkle(prize.centerX + 15 + Math.cos(phase * 0.8) * 18, prize.centerY + Math.sin(phase) * 20, 4, 0.38);
    }
    context.restore();
  }

  drawClaw(time) {
    const { context, claw } = this;
    const anchorX = Math.round(claw.x);
    const headX = claw.headX;
    const y = claw.headY;
    context.save();
    context.strokeStyle = '#243346'; context.lineWidth = 6; context.lineCap = 'butt';
    context.beginPath(); context.moveTo(anchorX, 0); context.lineTo(headX, Math.max(0, y - 7)); context.stroke();
    context.fillStyle = '#243346'; context.fillRect(anchorX - 10, 0, 20, 7);
    context.restore();
    context.save(); context.translate(headX, y); context.rotate(claw.swingAngle * 0.16); context.scale(GAME_CONFIG.clawScale, GAME_CONFIG.clawScale);
    context.fillStyle = '#243346'; context.fillRect(-34, -8, 68, 23);
    context.fillStyle = '#e6464d'; context.fillRect(-28, -4, 56, 14);
    context.fillStyle = '#ffd342'; context.fillRect(-5, -2, 10, 9);
    const spread = 6 + claw.openAmount * 9;
    context.fillStyle = '#243346'; context.fillRect(-14 - spread, 10, 8, 24); context.fillRect(6 + spread, 10, 8, 24);
    context.fillRect(-20 - spread, 30, 15, 8); context.fillRect(5 + spread, 30, 15, 8);
    if (claw.caught) {
      context.fillStyle = '#243346'; context.fillRect(-2, 35, 5, Math.max(8, claw.caught.y - claw.y - 35));
    }
    context.restore();
    if (claw.caught) {
      const prize = claw.caught;
      if (prize.character.loaded) {
        context.save(); context.translate(prize.centerX, prize.centerY); context.rotate(prize.rotation || 0);
        context.drawImage(prize.character.image, -prize.width / 2, -prize.height / 2, prize.width, prize.height); context.restore();
      } else this.drawPixelPokeball(prize);
    }
  }

  spawnCatchParticles(prize) {
    const rarity = prize.character.rarity || 'common';
    const color = prize.shiny ? '#ffd342' : RARITY_COLORS[rarity] || RARITY_COLORS.common;
    const count = prize.shiny ? 12 : rarity === 'common' ? 5 : 8;
    for (let index = 0; index < count; index += 1) {
      const angle = Math.PI * 2 * index / count + Math.random() * 0.35;
      const speed = 1.1 + Math.random() * 1.7;
      this.state.particles.push({ x: prize.centerX, y: prize.centerY, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 0.5, size: 2 + Math.floor(Math.random() * 3), color, life: 420 + Math.random() * 300, maxLife: 720 });
    }
  }

  renderParticles(elapsed) {
    const { context } = this;
    this.state.particles = this.state.particles.filter((particle) => particle.life > 0);
    this.state.particles.forEach((particle) => {
      particle.life -= elapsed; particle.x += particle.vx * elapsed / 16; particle.y += particle.vy * elapsed / 16; particle.vy += 0.035 * elapsed / 16;
      context.save(); context.globalAlpha = Math.max(0, particle.life / particle.maxLife); context.fillStyle = particle.color;
      context.fillRect(Math.round(particle.x), Math.round(particle.y), particle.size, particle.size); context.restore();
    });
  }

  render(time, elapsed) {
    this.context.clearRect(0, 0, this.machine.width, this.machine.height);
    this.drawBackground(); this.drawChute(elapsed);
    this.state.prizes.forEach((prize, index) => this.drawPrize(prize, index, time));
    this.drawChuteForeground(); this.drawClaw(time); this.renderParticles(elapsed);
  }
}
