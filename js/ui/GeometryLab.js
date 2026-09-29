import { MACHINE, PHYSICS } from '../config/gameConfig.js';
import { getPokemonCollider, getPokemonGrabZone, getShapeBounds } from '../utils/pokemonGeometry.js';

// Development-only view. The test machine is the normal Game instance and its
// input, collision, grab, carry, score and chute systems remain in use.
export class GeometryLab {
  constructor(game) {
    this.game = game;
    this.index = 0;
    this.rotation = 0;
    this.pile = false;
    this.visualMode = 'clean';
    this.showGeometry = false;
    this.contacts = new Set();
    this.lastOutcome = 'READY';
  }

  async init() {
    document.body.classList.add('geometry-lab-active');
    this.root = document.createElement('section');
    this.root.className = 'geometry-lab';
    this.root.setAttribute('aria-label', 'Pokémon Geometry Lab');
    this.root.innerHTML = `
      <header><p class="eyebrow">DEVELOPMENT TOOL</p><h1>Pokémon Geometry Lab</h1>
        <p>Chọn Pokémon để thử bằng claw thật. Giữ LEFT/RIGHT rồi bấm GRAB trên máy bên cạnh.</p></header>
      <div class="geometry-legend" aria-label="Chú giải geometry">
        <span class="geometry-red">Collider</span><span class="geometry-green">Grab zone</span>
        <span class="geometry-yellow">Carry anchor</span><span class="geometry-blue">Center of mass</span>
        <span class="geometry-white">Visual bounds</span><span class="geometry-purple">Ground contact</span>
      </div>
      <div class="geometry-visual-modes" role="group" aria-label="Pokémon visual mode">
        <span>VISUAL</span>
        <button type="button" data-visual="asset">ASSET</button>
        <button type="button" data-visual="geometry">GEOMETRY</button>
        <button type="button" data-visual="clean">CLEAN</button>
      </div>
      <div class="geometry-grid" id="geometry-grid"></div>
      <div class="geometry-toolbar" role="group" aria-label="Geometry test controls">
        <button type="button" data-action="previous">← PREVIOUS</button>
        <button type="button" data-action="next">NEXT →</button>
        <button type="button" data-action="reset">RESET</button>
        <button type="button" data-action="pile">PILE TEST</button>
      </div>
      <div class="geometry-toolbar" role="group" aria-label="Rotation and aim">
        <button type="button" data-angle="-0.16">−0.16 rad</button>
        <button type="button" data-angle="0">0 rad</button>
        <button type="button" data-angle="0.16">+0.16 rad</button>
        <button type="button" data-aim="-1">AIM LEFT</button>
        <button type="button" data-aim="0">AIM CENTER</button>
        <button type="button" data-aim="1">AIM RIGHT</button>
      </div>
      <output class="geometry-status" id="geometry-status" aria-live="polite"></output>`;
    document.querySelector('.app-shell').before(this.root);
    this.root.dataset.reviewMode = this.visualMode;
    this.grid = this.root.querySelector('#geometry-grid');
    this.status = this.root.querySelector('#geometry-status');
    this.root.addEventListener('click', (event) => this.handleClick(event));
    await this.game.assetsPromise;
    this.game.startGame();
    this.applyReviewMode();
    this.game.grab.setHooks({
      onClawContact: ({ prize }) => this.contacts.add(prize.name),
      onClawMiss: () => { this.lastOutcome = 'MISS'; },
    });
    await Promise.all([
      ...this.game.characters.map((character) => character.image.decode?.().catch(() => {})),
    ]);
    this.buildGrid();
    this.select(this.game.characters[0].name);
    this.updateStatus();
  }

  buildGrid() {
    this.grid.replaceChildren();
    for (const character of this.game.characters) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'geometry-card';
      card.dataset.pokemon = character.name;
      const canvas = document.createElement('canvas');
      canvas.width = 150;
      canvas.height = 142;
      const label = document.createElement('span');
      label.textContent = character.name;
      card.append(canvas, label);
      this.grid.append(card);
    }
    this.drawGrid();
  }

  drawGrid() {
    for (const card of this.grid.children) {
      const prize = this.game.state.prizes.find((item) => item.name === card.dataset.pokemon);
      if (!prize) continue;
      const canvas = card.querySelector('canvas');
      const context = canvas.getContext('2d');
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = '#a8d9d8';
      context.fillRect(0, 0, canvas.width, canvas.height);
      const view = this.previewPrize(prize, canvas);
      this.game.renderer.drawPokemonSprite(view, context);
      if (this.showGeometry) this.game.renderer.drawPokemonGeometry(view, context);
      card.classList.toggle('selected', !this.pile && card.dataset.pokemon === this.game.characters[this.index].name);
    }
    for (const button of this.root.querySelectorAll('[data-visual]')) {
      button.setAttribute('aria-pressed', String(button.dataset.visual === this.visualMode));
    }
  }

  previewPrize(prize, canvas) {
    const view = Object.create(prize);
    view.x = (canvas.width - prize.width) / 2;
    view.y = (canvas.height - prize.height) / 2;
    view.rotation = this.pile ? prize.rotation : this.rotation;
    view.updateGeometry();
    return view;
  }

  setVisualMode(mode) {
    if (!['asset', 'geometry', 'clean'].includes(mode)) return;
    this.visualMode = mode;
    this.root.dataset.reviewMode = mode;
    this.applyReviewMode();
    this.drawGrid();
    this.game.renderer.render(performance.now(), 0);
  }

  applyReviewMode() {
    this.showGeometry = this.visualMode === 'geometry';
    const visible = this.visualMode === 'geometry';
    this.game.renderer.debugPokemonPhysics = visible;
    this.game.renderer.debugClawColliders = visible;
  }

  select(name) {
    const next = this.game.characters.findIndex((character) => character.name === name);
    if (next < 0) return;
    this.index = next;
    this.pile = false;
    this.contacts.clear();
    this.lastOutcome = 'READY';
    this.game.resetCurrentRun();
    const selected = this.game.state.prizes.find((prize) => prize.name === name);
    this.game.state.prizes.forEach((prize) => { prize.collected = prize !== selected; });
    selected.rotation = this.rotation;
    selected.angularVelocity = 0;
    selected.velocityX = 0;
    selected.velocityY = 0;
    selected.x = MACHINE.width * 0.58 - selected.width / 2;
    selected.y = MACHINE.floorY - selected.height / 2;
    selected.updateGeometry();
    selected.y += MACHINE.floorY - getShapeBounds(getPokemonCollider(selected)).bottom - 1;
    selected.updateGeometry();
    selected.isSleeping = true;
    selected.sleepTimer = PHYSICS.sleepDelay;
    selected.touchingSurface = true;
    this.game.claw.x = getPokemonGrabZone(selected).x;
    this.game.claw.swingAngle = 0;
    this.game.claw.swingVelocity = 0;
    this.game.state.turns = 99;
    this.game.refresh();
    this.game.renderer.render(performance.now(), 0);
    this.drawGrid();
  }

  showPile() {
    this.pile = true;
    this.contacts.clear();
    this.lastOutcome = 'READY';
    this.game.resetCurrentRun();
    this.game.state.turns = 99;
    this.game.refresh();
    this.drawGrid();
  }

  handleClick(event) {
    const button = event.target.closest('button');
    if (!button || !this.root.contains(button)) return;
    if (button.dataset.visual) { this.setVisualMode(button.dataset.visual); return; }
    if (button.dataset.pokemon) { this.select(button.dataset.pokemon); return; }
    if (button.dataset.angle !== undefined) {
      this.rotation = Number(button.dataset.angle);
      if (!this.pile) this.select(this.game.characters[this.index].name);
      else this.drawGrid();
      return;
    }
    if (button.dataset.aim !== undefined) {
      const prize = this.game.state.prizes.find((item) => !item.collected);
      if (!this.pile && prize && this.game.claw.state === 'ready') {
        const zone = getPokemonGrabZone(prize);
        this.game.claw.x = zone.x + Number(button.dataset.aim) * zone.radiusX * 0.75;
      }
      return;
    }
    switch (button.dataset.action) {
      case 'previous': this.select(this.game.characters[(this.index + this.game.characters.length - 1) % this.game.characters.length].name); break;
      case 'next': this.select(this.game.characters[(this.index + 1) % this.game.characters.length].name); break;
      case 'reset': if (this.pile) this.showPile(); else this.select(this.game.characters[this.index].name); break;
      case 'pile': this.showPile(); break;
      default: break;
    }
  }

  updateStatus() {
    const selected = this.pile ? null : this.game.state.prizes.find(
      (prize) => prize.name === this.game.characters[this.index].name);
    const carried = this.game.claw.currentGrab?.pokemon;
    if (carried) this.lastOutcome = `CARRY ${carried.name}`;
    else if (selected?.collected) this.lastOutcome = `CHUTE ${selected.name}`;
    this.status.textContent = `${this.pile ? 'PILE / 15 Pokémon' : selected?.name || 'SINGLE'} · `
      + `rotation ${this.rotation.toFixed(2)} rad · claw ${this.game.claw.state.toUpperCase()} · `
      + `contacts ${[...this.contacts].join(', ') || 'none'} · ${this.lastOutcome}`;
    requestAnimationFrame(() => this.updateStatus());
  }
}
