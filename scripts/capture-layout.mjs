import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const pages = await fetch('http://127.0.0.1:9417/json').then((response) => response.json());
const page = pages.find((entry) => entry.type === 'page' && entry.url.includes('localhost:8000'));
if (!page) throw new Error('Game page not found');
const socket = new WebSocket(page.webSocketDebuggerUrl);
const pending = new Map();
let nextId = 0;
socket.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data);
  if (message.id && pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); }
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
const evaluate = (expression) => send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
await send('Page.enable');

for (const viewport of [
  { name: 'desktop', width: 1440, height: 900, mobile: false, scale: 1 },
  { name: 'mobile', width: 390, height: 844, mobile: true, scale: 3 },
]) {
  await send('Emulation.setDeviceMetricsOverride', { width: viewport.width, height: viewport.height, deviceScaleFactor: viewport.scale, mobile: viewport.mobile });
  await send('Page.reload', { ignoreCache: true });
  await wait(800);
  await evaluate(`document.querySelector('#start-game-btn').click()`);
  await wait(350);
  const capture = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, fromSurface: true });
  const path = join(tmpdir(), `pokemon-machine-${viewport.name}.png`);
  await writeFile(path, Buffer.from(capture.result.data, 'base64'));
  console.log(path);
}
socket.close();
