import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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
await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1100, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: `http://localhost:8000/?geometryLab=1&v=${Date.now()}` });
await new Promise((resolve) => setTimeout(resolve, 2500));
const desktop = await evaluate(`(async () => {
  const { game } = await import('/js/main.js');
  const { getPokemonCollider, getPokemonGrabZone, pointInEllipse } = await import('/js/utils/pokemonGeometry.js');
  window.__geometryStorageSnapshot = JSON.stringify({ ...localStorage });
  const silhouette = game.state.prizes.map((prize) => {
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(prize.width);
    canvas.height = Math.ceil(prize.height);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(prize.character.image, 0, 0, prize.width, prize.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const view = Object.create(prize);
    view.x = 0; view.y = 0; view.rotation = 0; view.updateGeometry();
    const body = getPokemonCollider(view);
    const grab = getPokemonGrabZone(view);
    const counts = { body: 0, bodyOpaque: 0, grab: 0, grabOpaque: 0 };
    for (let y = 0; y < canvas.height; y += 1) for (let x = 0; x < canvas.width; x += 1) {
      const opaque = pixels[(y * canvas.width + x) * 4 + 3] > 32;
      if (pointInEllipse(x + 0.5, y + 0.5, body)) { counts.body += 1; if (opaque) counts.bodyOpaque += 1; }
      if (pointInEllipse(x + 0.5, y + 0.5, grab)) { counts.grab += 1; if (opaque) counts.grabOpaque += 1; }
    }
    return { name: prize.name, bodyFill: +(counts.bodyOpaque / counts.body).toFixed(2),
      grabFill: +(counts.grabOpaque / counts.grab).toFixed(2) };
  });
  return ({
  cards: document.querySelectorAll('.geometry-card').length,
  labels: [...document.querySelectorAll('.geometry-card span')].map((item) => item.textContent),
  selected: document.querySelector('.geometry-card.selected')?.dataset.pokemon,
  gameActive: document.querySelector('.app-shell').getAttribute('aria-hidden') === 'false',
  realControls: ['left-btn', 'right-btn', 'drop-btn'].every((id) => Boolean(document.getElementById(id))),
  brokenImages: game.characters.filter((character) => !character.loaded
    || character.image.naturalWidth <= 0 || character.image.naturalHeight <= 0).length,
  labFlag: game.geometryLabActive,
  silhouette,
  });
})()`);
const desktopShot = join(tmpdir(), 'pokemon-geometry-lab-desktop.png');
await writeFile(desktopShot, Buffer.from((await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })).result.data, 'base64'));
const kinglerRect = await evaluate(`(() => {
  const rect = document.querySelector('[data-pokemon="Kingler"] canvas').getBoundingClientRect();
  return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, scale: 3 };
})()`);
const kinglerShot = join(tmpdir(), 'pokemon-geometry-kingler.png');
await writeFile(kinglerShot, Buffer.from((await send('Page.captureScreenshot', { format: 'png', clip: kinglerRect })).result.data, 'base64'));
const interactions = await evaluate(`(async () => {
  const { game } = await import('/js/main.js');
  document.querySelector('[data-pokemon="Charmander"]').click();
  const single = [...document.querySelectorAll('.geometry-card.selected')].map((item) => item.dataset.pokemon);
  const visible = game.state.prizes.filter((item) => !item.collected).map((item) => item.name);
  document.querySelector('[data-angle="0.16"]').click();
  const rotation = game.state.prizes.find((item) => item.name === 'Charmander').rotation;
  document.querySelector('[data-action="pile"]').click();
  return { single, visible, rotation,
    pile: document.querySelectorAll('.geometry-card.selected').length === 0,
    pileCount: game.state.prizes.filter((item) => !item.collected).length,
    storageUnchanged: JSON.stringify({ ...localStorage }) === window.__geometryStorageSnapshot };
})()`);
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true, screenWidth: 390, screenHeight: 844 });
await send('Page.reload', { ignoreCache: true });
await new Promise((resolve) => setTimeout(resolve, 1400));
const mobile = await evaluate(`(() => ({ cards: document.querySelectorAll('.geometry-card').length,
  overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
  controls: ['left-btn', 'right-btn', 'drop-btn'].every((id) => Boolean(document.getElementById(id))) }))()`);
const mobileShot = join(tmpdir(), 'pokemon-geometry-lab-mobile.png');
await writeFile(mobileShot, Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).result.data, 'base64'));
const valid = desktop.cards === 15 && desktop.gameActive && desktop.realControls && desktop.brokenImages === 0
  && interactions.single[0] === 'Charmander' && interactions.visible.length === 1
  && Math.abs(interactions.rotation - 0.16) < 1e-8 && interactions.pile && interactions.pileCount === 15
  && interactions.storageUnchanged
  && mobile.cards === 15 && !mobile.overflow && errors.length === 0;
console.log(JSON.stringify({ desktop, interactions, mobile, errors, desktopShot, mobileShot, kinglerShot, valid }, null, 2));
await send('Page.navigate', { url: 'http://localhost:8000/' });
socket.close();
if (!valid) process.exitCode = 1;
