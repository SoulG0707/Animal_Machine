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
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const point = (id) => evaluate(`(() => {
  const button = document.getElementById(${JSON.stringify(id)});
  button.scrollIntoView({ block: 'center' });
  const rect = button.getBoundingClientRect();
  const rawX = rect.left + rect.width / 2; const rawY = rect.top + rect.height / 2;
  const scale = visualViewport.scale;
  return { x: (rawX - visualViewport.offsetLeft) * scale,
    y: (rawY - visualViewport.offsetTop) * scale, rawX, rawY, scale };
})()`);
const touch = async (id, duration) => {
  const position = await point(id);
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...position, radiusX: 4, radiusY: 4, force: 1 }] });
  await wait(duration);
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
};
await send('Runtime.enable');
await send('Page.enable');
await send('Network.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3,
  mobile: true, screenWidth: 390, screenHeight: 844 });
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
await send('Page.navigate', { url: `http://localhost:8000/?geometryLab=1&v=${Date.now()}` });
await wait(1500);
const initial = await evaluate(`(async () => {
  const { game } = await import('/js/main.js');
  await game.assetsPromise;
  document.querySelector('[data-pokemon="Charmander"]').click();
  game.claw.x = 350;
  return { x: game.claw.x, active: game.state.appState,
    reviewMode: document.querySelector('.geometry-lab')?.dataset.reviewMode,
    visible: game.state.prizes.filter((prize) => !prize.collected).length };
})()`);
const leftPoint = await touch('left-btn', 400);
const afterLeft = await evaluate(`(async () => (await import('/js/main.js')).game.claw.x)()`);
const rightPoint = await touch('right-btn', 400);
const afterRight = await evaluate(`(async () => (await import('/js/main.js')).game.claw.x)()`);
await evaluate(`(async () => {
  const { game } = await import('/js/main.js');
  document.querySelector('[data-aim="0"]').click();
  window.__labRandom = Math.random;
  Math.random = () => 0.99;
  return game.claw.x;
})()`);
await touch('drop-btn', 35);
const result = await evaluate(`(async () => {
  const { game } = await import('/js/main.js');
  let carried = null;
  const started = performance.now();
  while (performance.now() - started < 10000) {
    carried ||= game.claw.currentGrab?.pokemon?.name || null;
    if (game.claw.state === 'ready' && game.state.grabAttemptId > 0) break;
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  Math.random = window.__labRandom;
  return { carried, caught: game.state.caughtThisGame, state: game.claw.state,
    attemptId: game.state.grabAttemptId, overflow: document.documentElement.scrollWidth > innerWidth + 1,
    selection: String(getSelection()) };
})()`);
const valid = initial.active === 'playing' && initial.reviewMode === 'clean'
  && initial.visible === 1 && afterLeft < initial.x
  && afterRight > afterLeft && result.attemptId === 1 && result.carried === 'Charmander'
  && result.caught === 1 && result.state === 'ready' && !result.overflow
  && result.selection === '' && errors.length === 0;
console.log(JSON.stringify({ initial, leftPoint, afterLeft, rightPoint, afterRight, result, errors, valid }, null, 2));
await send('Page.navigate', { url: 'http://localhost:8000/' });
socket.close();
if (!valid) process.exitCode = 1;
