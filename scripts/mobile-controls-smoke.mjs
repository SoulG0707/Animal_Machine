const pages = await fetch('http://127.0.0.1:9417/json').then((response) => response.json());
const page = pages.find((entry) => entry.type === 'page' && entry.url.includes('localhost:8000'));
if (!page) throw new Error('Game page not found');
const socket = new WebSocket(page.webSocketDebuggerUrl);
const pending = new Map();
const errors = [];
let nextId = 0;
socket.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data);
  if (message.id && pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); }
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
  if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') errors.push(message.params.args.map((arg) => arg.value || arg.description).join(' '));
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
const touch = async (point, duration = 40) => {
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: point.x, y: point.y, radiusX: 4, radiusY: 4, force: 1 }] });
  await wait(duration);
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
};

await send('Runtime.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true, screenWidth: 390, screenHeight: 844 });
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
await send('Page.reload', { ignoreCache: true });
await wait(1000);
await evaluate(`document.querySelector('#start-game-btn').click()`);
await wait(150);
const points = await evaluate(`Object.fromEntries(['left-btn','drop-btn','right-btn'].map(id => {
  const rect = document.getElementById(id).getBoundingClientRect();
  return [id, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }];
}))`);
const initialX = await evaluate(`(async () => (await import('/js/main.js')).game.claw.x)()`);
await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...points['left-btn'], radiusX: 4, radiusY: 4, force: 1 }] });
await wait(2000);
await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
const afterLeft = await evaluate(`(async () => (await import('/js/main.js')).game.claw.x)()`);
await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...points['right-btn'], radiusX: 4, radiusY: 4, force: 1 }] });
await wait(2000);
await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
const afterRight = await evaluate(`(async () => (await import('/js/main.js')).game.claw.x)()`);
for (let index = 0; index < 6; index += 1) await touch(index % 2 ? points['right-btn'] : points['left-btn'], 25);
const beforeGrab = await evaluate(`(async () => (await import('/js/main.js')).game.state.turns)()`);
await touch(points['drop-btn'], 35);
await wait(80);
const result = await evaluate(`(() => {
  const game = window.__unused;
  const controls = getComputedStyle(document.querySelector('.control-actions'));
  const left = getComputedStyle(document.querySelector('#left-btn'));
  const grab = getComputedStyle(document.querySelector('#drop-btn'));
  return {
    turns: document.querySelector('#turns').textContent,
    selection: String(getSelection()),
    controlsUserSelect: controls.userSelect,
    controlsWebkitUserSelect: controls.webkitUserSelect,
    leftTouchAction: left.touchAction,
    grabTouchAction: grab.touchAction,
    pageScrollWidth: document.documentElement.scrollWidth,
    viewportWidth: innerWidth,
  };
})()`);
const afterGrab = Number(result.turns);
console.log(JSON.stringify({ initialX, afterLeft, afterRight, beforeGrab, afterGrab, result, errors }, null, 2));
socket.close();
const valid = afterLeft < initialX
  && afterRight > afterLeft
  && afterGrab === beforeGrab - 1
  && result.selection === ''
  && result.controlsUserSelect === 'none'
  && result.leftTouchAction === 'none'
  && result.grabTouchAction === 'manipulation'
  && result.pageScrollWidth <= result.viewportWidth
  && errors.length === 0;
if (!valid) process.exitCode = 1;
