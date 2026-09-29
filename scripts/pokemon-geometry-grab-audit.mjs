import assert from 'node:assert/strict';

const pages = await fetch('http://127.0.0.1:9417/json').then((response) => response.json());
const page = pages.find((entry) => entry.type === 'page' && entry.url.includes('localhost:8000'));
assert(page, 'Chrome page at localhost:8000 is required');
const socket = new WebSocket(page.webSocketDebuggerUrl);
const pending = new Map();
const errors = [];
let nextId = 0;
socket.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data);
  if (message.id && pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); }
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
  if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') errors.push(message.params.args.map((item) => item.value || item.description).join(' '));
});
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});
const send = (method, params = {}) => {
  const id = ++nextId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve) => pending.set(id, resolve));
};
const evaluate = async (expression) => {
  const response = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (response.result?.exceptionDetails) throw new Error(response.result.exceptionDetails.exception?.description || response.result.exceptionDetails.text);
  return response.result?.result?.value;
};
await send('Runtime.enable');
await send('Page.enable');
await send('Network.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: `http://localhost:8000/?geometryLab=1&v=${Date.now()}` });
await new Promise((resolve) => setTimeout(resolve, 1300));

const results = await evaluate(`(async () => {
  const { game } = await import('/js/main.js');
  const { getPokemonCollider, getPokemonGrabZone } = await import('/js/utils/pokemonGeometry.js');
  await game.assetsPromise;
  game.loop.stop();
  const actualRandom = Math.random;
  const run = (name, { angle = 0, aimOffset = 0, edgeSign = 0 } = {}) => {
    document.querySelector('[data-pokemon="' + name + '"]').click();
    game.loop.stop();
    const target = game.state.prizes.find((prize) => prize.name === name);
    if (edgeSign) aimOffset = edgeSign * getPokemonGrabZone(target).radiusX * 0.75;
    game.claw.x = getPokemonGrabZone(target).x + aimOffset;
    game.claw.swingAngle = angle;
    game.claw.swingVelocity = 0;
    Math.random = () => 0.99;
    const originalSelect = game.grab.selectPrizeFromClosedClaw;
    let selected = null;
    let quality = null;
    let selectedCount = 0;
    let firstCarried = null;
    let belowHead = null;
    let maxAnchorError = 0;
    let carrySwingSeen = false;
    let homeTime = null;
    let releaseTime = null;
    let swingInjected = false;
    const transitions = [];
    game.grab.selectPrizeFromClosedClaw = function (...args) {
      const candidate = originalSelect.apply(this, args);
      if (this.claw.state === 'closing') {
        selected = candidate?.prize || null;
        quality = candidate?.evaluation.grabQuality ?? null;
        if (candidate) selectedCount += 1;
      }
      return candidate;
    };
    const started = game.attemptGrab();
    const startTime = performance.now();
    let priorState = game.claw.state;
    for (let frame = 1; frame <= 900; frame += 1) {
      const time = startTime + frame * 1000 / 60;
      if (angle && ['descending', 'closing'].includes(game.claw.state)) game.claw.swingAngle = angle;
      else game.claw.updateSwing(1 / 60);
      if (!swingInjected && game.claw.state === 'carrying') {
        game.claw.swingAngle = angle || 0.12;
        swingInjected = true;
      }
      game.grab.update(time, 1000 / 60);
      game.grab.updateCarriedPrize(time);
      game.physics.update(1000 / 60);
      if (game.claw.state !== priorState) { transitions.push(game.claw.state); priorState = game.claw.state; }
      const carried = game.claw.currentGrab?.pokemon;
      if (carried) {
        if (!firstCarried) {
          firstCarried = carried;
          belowHead = getPokemonCollider(carried).y > game.claw.headY;
        }
        const point = game.claw.getCarryAttachmentPoint();
        const anchor = carried.getGrabAnchorOffset();
        maxAnchorError = Math.max(maxAnchorError, Math.hypot(
          carried.centerX + anchor.x - point.x, carried.centerY + anchor.y - point.y));
        carrySwingSeen ||= Math.abs(game.claw.swingAngle) > 0.04 && game.claw.state === 'carrying';
        if (carried === target && game.claw.currentGrab.homeReleaseElapsed !== null && homeTime === null) homeTime = time;
      }
      if (!carried && firstCarried && releaseTime === null) releaseTime = time;
      if (game.claw.state === 'ready' && frame > 1) break;
    }
    Math.random = actualRandom;
    game.grab.selectPrizeFromClosedClaw = originalSelect;
    return { name, angle, aimOffset, quality, started, candidateCount: selectedCount,
      physicalContactCount: game.claw.contactHistory.size, selected: selected?.name || null,
      carried: firstCarried?.name || null, sameObject: firstCarried === target && selected === target,
      belowHead,
      caught: game.state.caughtThisGame, collected: target.collected, maxAnchorError,
      carrySwingSeen, homeDelay: homeTime && releaseTime ? releaseTime - homeTime : null,
      transitions, clawState: game.claw.state };
  };
  const species = game.characters.map((character) => character.name);
  const center = species.map((name) => run(name));
  const rotation = species.flatMap((name) => [run(name, { angle: 0.16 }), run(name, { angle: -0.16 })]);
  const edge = species.flatMap((name) => [run(name, { edgeSign: -1 }), run(name, { edgeSign: 1 })]);
  const outside = species.map((name) => run(name, { aimOffset: 180 }));
  const bodyOnly = [30, 35, 40, 45, 50].map((aimOffset) => run('Pikachu', { aimOffset }));
  const assetBacked = game.characters.length === 15
    && game.characters.every((character) => character.loaded && character.image.naturalWidth > 0
      && character.path.startsWith('assets/characters/'))
    && game.state.prizes.every((prize) => game.renderer.getPokemonImage(prize) === prize.character.image);
  return { center, rotation, edge, outside, bodyOnly,
    assetCount: game.characters.filter((character) => character.loaded).length,
    assetBacked };
})()`);
const validCenter = results.center.every((item) => item.started && item.candidateCount >= 1
  && item.sameObject && item.belowHead && item.caught === 1 && item.collected && item.maxAnchorError < 0.001
  && item.carrySwingSeen && item.homeDelay >= 150 && item.homeDelay <= 300);
const validRotation = results.rotation.every((item) => item.sameObject && item.caught === 1 && item.maxAnchorError < 0.001);
const centerQuality = results.center.reduce((sum, item) => sum + item.quality, 0) / results.center.length;
const edgeQuality = results.edge.filter((item) => item.quality !== null)
  .reduce((sum, item) => sum + item.quality, 0) / results.edge.filter((item) => item.quality !== null).length;
const validEdge = results.edge.every((item) => item.selected === null || item.selected === item.name)
  && edgeQuality < centerQuality;
const validOutside = results.outside.every((item) => item.candidateCount === 0 && item.caught === 0);
const validBodyOnly = results.bodyOnly.some((item) => item.physicalContactCount > 0
  && item.candidateCount === 0 && item.caught === 0);
const validVisual = results.assetCount === 15 && results.assetBacked;
console.log(JSON.stringify({ ...results, errors, centerQuality, edgeQuality,
  validCenter, validRotation, validEdge, validOutside, validBodyOnly, validVisual }, null, 2));
await send('Page.navigate', { url: 'http://localhost:8000/' });
socket.close();
if (!validCenter || !validRotation || !validEdge || !validOutside || !validBodyOnly || !validVisual || errors.length) process.exitCode = 1;
