import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const pages = await fetch('http://127.0.0.1:9417/json').then((response) => response.json());
const page = pages.find((entry) => entry.type === 'page' && entry.url.includes('localhost:8000'));
assert(page, 'Chrome page at localhost:8000 is required');
const socket = new WebSocket(page.webSocketDebuggerUrl);
const pending = new Map();
const errors = [];
const warnings = [];
let nextId = 0;
socket.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data);
  if (message.id && pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); }
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
  if (message.method === 'Runtime.consoleAPICalled') {
    const text = message.params.args.map((item) => item.value || item.description).join(' ');
    if (message.params.type === 'error') errors.push(text);
    if (message.params.type === 'warning') warnings.push(text);
  }
});
await new Promise((resolveOpen, reject) => {
  socket.addEventListener('open', resolveOpen, { once: true });
  socket.addEventListener('error', reject, { once: true });
});
const send = (method, params = {}) => {
  const id = ++nextId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolveResponse) => pending.set(id, resolveResponse));
};
const evaluate = async (expression) => {
  const response = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (response.result?.exceptionDetails) {
    throw new Error(response.result.exceptionDetails.exception?.description || response.result.exceptionDetails.text);
  }
  return response.result?.result?.value;
};
const wait = (ms) => new Promise((done) => setTimeout(done, ms));
const saveScreenshot = async (name, params = {}) => {
  const data = (await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, ...params })).result.data;
  const path = resolve('artifacts/pokemon-asset-review', name);
  await writeFile(path, Buffer.from(data, 'base64'));
  return path;
};
const waitFor = async (expression, timeoutMs = 9000) => {
  const startedAt = Date.now();
  let latest = null;
  while (Date.now() - startedAt < timeoutMs) {
    latest = await evaluate(expression);
    if (latest?.ready) return latest;
    await wait(35);
  }
  throw new Error(`Timed out waiting for gameplay phase: ${JSON.stringify(latest)}`);
};
const machineClip = async () => evaluate(`(() => {
  const rect = document.querySelector('.machine').getBoundingClientRect();
  return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, scale: 1 };
})()`);
const saveMachineFrame = async (name) => saveScreenshot(name, { clip: await machineClip() });

await mkdir('artifacts/pokemon-asset-review', { recursive: true });
await send('Runtime.enable');
await send('Page.enable');
await send('Network.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1100, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: `http://localhost:8000/?geometryLab=1&v=${Date.now()}` });
const loadingGate = await evaluate(`(async () => {
  const { game } = await import('/js/main.js');
  const before = { ready: game.assetsReady, disabled: game.ui.startScreen.startButton.disabled,
    busy: game.ui.startScreen.startButton.getAttribute('aria-busy'), state: game.state.appState,
    startAllowed: game.startGame() };
  await game.assetsPromise;
  return { before, after: { ready: game.assetsReady, disabled: game.ui.startScreen.startButton.disabled,
    state: game.state.appState } };
})()`);
await wait(1700);

const clean = await evaluate(`(async () => {
  const { game } = await import('/js/main.js');
  window.__pokemonMachineGame = game;
  await game.assetsPromise;
  const cards = [...document.querySelectorAll('.geometry-card')];
  const loaded = game.characters.map((character) => ({ name: character.name, path: character.path,
    loaded: character.loaded, width: character.image.naturalWidth, height: character.image.naturalHeight,
    cached: character.image === game.spawn.imageCache.get(encodeURI(character.path))?.image }));
  return { count: cards.length, labelsHidden: cards.every((card) => getComputedStyle(card.querySelector('span')).display === 'none'),
    overlays: game.renderer.debugPokemonPhysics || game.renderer.debugClawColliders || document.querySelector('.geometry-lab').dataset.reviewMode !== 'clean',
    loaded, gameplayReady: game.assetsReady && game.state.appState === 'playing',
    proceduralModuleRequested: performance.getEntriesByType('resource').some((item) => item.name.includes('PokemonVisuals.js')) };
})()`);
const cleanShot = await saveScreenshot('01-assets-clean-desktop.png');

const geometry = await evaluate(`(() => {
  document.querySelector('[data-visual="geometry"]').click();
  const cards = [...document.querySelectorAll('.geometry-card')];
  return { mode: document.querySelector('.geometry-lab').dataset.reviewMode,
    labelsVisible: cards.every((card) => getComputedStyle(card.querySelector('span')).display !== 'none'),
    overlay: window.__pokemonMachineGame.renderer.debugPokemonPhysics
      && window.__pokemonMachineGame.renderer.debugClawColliders };
})()`);
const geometryShot = await saveScreenshot('02-assets-with-geometry-desktop.png');

const asset = await evaluate(`(() => {
  document.querySelector('[data-visual="asset"]').click();
  const cards = [...document.querySelectorAll('.geometry-card')];
  return { mode: document.querySelector('.geometry-lab').dataset.reviewMode,
    labelsVisible: cards.every((card) => getComputedStyle(card.querySelector('span')).display !== 'none'),
    overlay: window.__pokemonMachineGame.renderer.debugPokemonPhysics
      || window.__pokemonMachineGame.renderer.debugClawColliders };
})()`);

const pile = await evaluate(`(() => {
  document.querySelector('[data-action="pile"]').click();
  const { game } = { game: window.__pokemonMachineGame };
  return { count: document.querySelectorAll('.geometry-card').length,
    visible: [...document.querySelectorAll('.geometry-card')].length,
    loadedPrizes: game?.state.prizes.filter((prize) => game.renderer.getPokemonImage(prize)).length ?? null };
})()`);
const pileShot = await saveScreenshot('03-assets-pile-desktop.png');

const grabSetup = await evaluate(`(() => {
  const game = window.__pokemonMachineGame;
  document.querySelector('[data-pokemon="Charmander"]').click();
  window.__assetReviewRandom = Math.random;
  Math.random = () => 0.99;
  return { started: game.attemptGrab(), state: game.claw.state };
})()`);
assert(grabSetup.started, 'Charmander grab should start for visual review');
await waitFor(`(() => { const game = window.__pokemonMachineGame;
  return { ready: game.claw.state === 'descending' && game.claw.y > 220,
    state: game.claw.state, y: game.claw.y }; })()`);
const descendShot = await saveMachineFrame('05-claw-descending.png');
await waitFor(`(() => { const game = window.__pokemonMachineGame;
  return { ready: game.claw.state === 'lifting' && Boolean(game.claw.currentGrab?.pokemon),
    state: game.claw.state, carried: game.claw.currentGrab?.pokemon?.name }; })()`);
const grabbedShot = await saveMachineFrame('06-claw-grabbed.png');
await waitFor(`(() => { const game = window.__pokemonMachineGame;
  return { ready: game.claw.state === 'carrying' && Boolean(game.claw.currentGrab?.pokemon),
    state: game.claw.state, carried: game.claw.currentGrab?.pokemon?.name }; })()`);
const carryShot = await saveMachineFrame('07-pokemon-carry.png');
await evaluate(`(() => {
  const game = window.__pokemonMachineGame;
  game.claw.swingAngle = 0.16;
  game.claw.swingVelocity = 0.1;
  game.grab.updateCarriedPrize(performance.now());
  game.renderer.render(performance.now(), 0);
})()`);
const swingShot = await saveMachineFrame('08-pokemon-swing.png');
const dropPhase = await waitFor(`(() => { const game = window.__pokemonMachineGame;
  const prize = game.state.prizes.find((item) => item.name === 'Charmander');
  return { ready: game.claw.state === 'waiting-for-chute' && Boolean(game.claw.droppingPrize),
    state: game.claw.state, drop: game.claw.droppingPrize?.name || null,
    x: prize?.centerX, y: prize?.centerY, caught: prize?.chuteSensorTriggered || false }; })()`, 12000);
const dropShot = await saveMachineFrame('09-home-release-drop.png');
const completedDrop = await waitFor(`(() => { const game = window.__pokemonMachineGame;
  return { ready: game.state.caughtThisGame === 1 && game.claw.state === 'ready',
    caught: game.state.caughtThisGame, state: game.claw.state }; })()`, 8000);
await evaluate(`(() => { Math.random = window.__assetReviewRandom; })()`);

await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3,
  mobile: true, screenWidth: 390, screenHeight: 844 });
await send('Page.reload', { ignoreCache: true });
await wait(1700);
const mobile = await evaluate(`(async () => {
  const { game } = await import('/js/main.js');
  window.__pokemonMachineGame = game;
  await game.assetsPromise;
  return { cards: document.querySelectorAll('.geometry-card').length,
    labelsHidden: [...document.querySelectorAll('.geometry-card span')].every((item) => getComputedStyle(item).display === 'none'),
    overflow: document.documentElement.scrollWidth > innerWidth + 1,
    loaded: game.characters.filter((character) => character.loaded && game.renderer.getPokemonImage(game.state.prizes.find((item) => item.name === character.name))).length,
    mode: document.querySelector('.geometry-lab')?.dataset.reviewMode };
})()`);
const mobileShot = await saveScreenshot('04-assets-clean-mobile-390.png');

const resourceUrls = await evaluate(`performance.getEntriesByType('resource').map((item) => item.name)
  .filter((name) => name.includes('PokemonVisuals.js') || name.includes('assets/characters/'))`);
const fallback = await evaluate(`(async () => {
  const game = window.__pokemonMachineGame;
  const fixture = { name: 'Missing fixture', path: 'assets/characters/__missing_fixture__.svg' };
  game.characters.push(fixture);
  game.spawn.loadImages();
  await game.spawn.assetsReady;
  game.characters.pop();
  const preview = { character: fixture, name: fixture.name, centerX: 40, centerY: 40,
    width: 50, height: 50, rotation: 0 };
  const context = document.createElement('canvas').getContext('2d');
  const rendered = game.renderer.drawPokemonSprite(preview, context);
  game.renderer.debugAssetPlaceholders = true;
  game.renderer.drawMissingAssetPlaceholder(preview, context);
  return { state: fixture.assetLoadState, rendered, placeholderSupported: Boolean(context) };
})()`);
const valid = !loadingGate.before.ready && loadingGate.before.disabled && loadingGate.before.busy === 'true'
  && loadingGate.before.state === 'menu' && !loadingGate.before.startAllowed
  && loadingGate.after.ready && !loadingGate.after.disabled
  && clean.count === 15 && clean.labelsHidden && !clean.overlays && clean.gameplayReady
  && clean.loaded.length === 15 && clean.loaded.every((item) => item.loaded && item.width > 0 && item.height > 0 && item.cached)
  && !clean.proceduralModuleRequested
  && geometry.mode === 'geometry' && geometry.labelsVisible && geometry.overlay
  && asset.mode === 'asset' && asset.labelsVisible && !asset.overlay
  && pile.count === 15 && pile.loadedPrizes === 15
  && mobile.cards === 15 && mobile.labelsHidden && !mobile.overflow && mobile.loaded === 15 && mobile.mode === 'clean'
  && grabSetup.started && dropPhase.drop === 'Charmander' && completedDrop.caught === 1
  && completedDrop.state === 'ready'
  && resourceUrls.filter((name) => name.includes('assets/characters/')).length === 15
  && fallback.state === 'error' && !fallback.rendered && fallback.placeholderSupported
  && errors.length === 0 && warnings.length === 1 && warnings[0].includes('Missing Pokémon asset: Missing fixture');
console.log(JSON.stringify({ loadingGate, clean, geometry, asset, pile, mobile, fallback, resourceUrls, errors, warnings,
  grabSetup, dropPhase, completedDrop,
  screenshots: { cleanShot, geometryShot, pileShot, descendShot, grabbedShot, carryShot, swingShot, dropShot, mobileShot }, valid }, null, 2));
await send('Page.navigate', { url: 'http://localhost:8000/' });
socket.close();
if (!valid) process.exitCode = 1;
