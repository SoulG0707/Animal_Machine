const pages = await fetch('http://127.0.0.1:9417/json').then((response) => response.json());
const page = pages.find((entry) => entry.type === 'page' && entry.url.includes('localhost:8000'));
if (!page) throw new Error('Game page not found');

const socket = new WebSocket(page.webSocketDebuggerUrl);
const pending = new Map();
let nextId = 0;
const errors = [];

socket.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data);
  if (message.id && pending.has(message.id)) {
    pending.get(message.id)(message);
    pending.delete(message.id);
  }
  if (message.method === 'Runtime.exceptionThrown') {
    errors.push(message.params.exceptionDetails.text);
  }
  if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
    errors.push(message.params.args.map((arg) => arg.value || arg.description).join(' '));
  }
});

await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

function send(method, params = {}) {
  const id = ++nextId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve) => pending.set(id, resolve));
}

async function evaluate(expression) {
  const response = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (response.result?.exceptionDetails) throw new Error(response.result.exceptionDetails.text);
  return response.result?.result?.value;
}

await send('Runtime.enable');
await send('Page.enable');
await send('Page.reload', { ignoreCache: true });
await new Promise((resolve) => setTimeout(resolve, 1200));

const result = await evaluate(`(async () => ({
  ready: document.readyState,
  title: document.title,
  startVisible: !document.querySelector('#start-screen').hidden,
  canvasWidth: document.querySelector('#game-canvas').width,
  pokemonImages: [...document.images].filter(image => image.src.includes('/assets/characters/')).length,
  brokenImages: [...document.images].filter(image => image.complete && image.naturalWidth === 0).map(image => image.src),
  controls: ['left-btn', 'drop-btn', 'right-btn'].every(id => document.getElementById(id)),
  snapshot: (await import('/js/main.js')).game.getSnapshot(),
}))()`);

console.log(JSON.stringify({ ...result, errors }, null, 2));
socket.close();
if (errors.length || result.brokenImages.length || !result.controls) process.exitCode = 1;
