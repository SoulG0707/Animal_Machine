import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const pages = await fetch('http://127.0.0.1:9417/json').then((response) => response.json());
const page = pages.find((entry) => entry.type === 'page' && entry.url.includes('localhost:8000'));
if (!page) throw new Error('Game page not found at localhost:8000');
const socket = new WebSocket(page.webSocketDebuggerUrl);
const pending = new Map();
let nextId = 0;
socket.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data);
  if (message.id && pending.has(message.id)) {
    pending.get(message.id)(message);
    pending.delete(message.id);
  }
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
  if (response.result?.exceptionDetails) throw new Error(response.result.exceptionDetails.text);
  return response.result?.result?.value;
};

await send('Runtime.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width: 1440, height: 900, deviceScaleFactor: 1, mobile: false,
});
await send('Page.reload', { ignoreCache: true });
await new Promise((resolve) => setTimeout(resolve, 900));
await evaluate(`(async () => {
  const { game } = await import('/js/main.js');
  document.querySelector('#start-game-btn').click();
  game.loop.stop();
  game.renderer.render(performance.now(), 0);
  game.renderer.drawPokemonPhysics();
})()`);
const all = await send('Page.captureScreenshot', { format: 'png' });
const allPath = join(tmpdir(), 'pokemon-physics-all.png');
await writeFile(allPath, Buffer.from(all.result.data, 'base64'));

await evaluate(`(async () => {
  const { game } = await import('/js/main.js');
  const charmander = game.state.prizes.find((prize) => prize.name === 'Charmander');
  game.state.prizes.forEach((prize) => { prize.collected = prize !== charmander; });
  charmander.x = 360 - charmander.width / 2;
  charmander.y = 465 - charmander.height / 2;
  charmander.rotation = 0.18;
  game.physics.updateGeometry(charmander);
  game.renderer.render(performance.now(), 0);
  game.renderer.drawPokemonPhysics();
})()`);
const isolated = await send('Page.captureScreenshot', { format: 'png' });
const isolatedPath = join(tmpdir(), 'pokemon-physics-charmander.png');
await writeFile(isolatedPath, Buffer.from(isolated.result.data, 'base64'));
await send('Page.reload', { ignoreCache: true });
socket.close();
console.log(JSON.stringify({ allPath, isolatedPath }));
