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
await send('Runtime.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.reload', { ignoreCache: true });
await new Promise((resolve) => setTimeout(resolve, 1000));

const result = await evaluate(`(async () => {
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const waitFor = async (test, timeout = 6000) => {
    const started = performance.now();
    while (!test()) {
      if (performance.now() - started > timeout) throw new Error('Timed out waiting for gameplay state');
      await wait(50);
    }
  };
  const { game } = await import('/js/main.js');
  document.querySelector('#start-game-btn').click();
  await wait(100);

  const initial = game.getSnapshot();
  const originalRandom = Math.random;
  const first = game.state.prizes.find(prize => prize.character.score > 0);
  game.claw.x = 330;
  first.x = game.claw.x - first.width / 2;
  first.y = 545 - first.height;
  first.isSleeping = true;
  game.physics.updateGeometry(first);
  Math.random = () => 0.99;
  game.grab.attempt();
  await waitFor(() => game.claw.state === 'ready' || game.claw.state === 'game-over');
  const success = game.getSnapshot();
  const collectedPrizes = game.state.prizes.filter(prize => prize.collected).length;

  game.resetGame();
  const slipPrize = game.state.prizes.find(prize => prize.character.score > 0);
  game.claw.x = 330;
  slipPrize.x = game.claw.x - slipPrize.width / 2;
  slipPrize.y = 545 - slipPrize.height;
  slipPrize.isSleeping = true;
  game.physics.updateGeometry(slipPrize);
  Math.random = () => 0;
  game.grab.attempt();
  await waitFor(() => game.claw.state === 'ready' || game.claw.state === 'game-over');
  const slip = game.getSnapshot();
  const activePhysicsPrizes = game.state.prizes.filter(prize => ['idle', 'slipping', 'falling', 'settling'].includes(prize.state)).length;
  Math.random = originalRandom;

  return {
    initial,
    success,
    collectedPrizes,
    slip,
    activePhysicsPrizes,
    overlayHidden: document.querySelector('#game-complete-overlay').hidden,
    storedBest: Number(localStorage.getItem('animal-machine-best') || 0),
  };
})()`);

console.log(JSON.stringify({ result, errors }, null, 2));
socket.close();
const valid = result.initial.turns === 5
  && result.success.turns === 4
  && result.success.caught === 1
  && result.collectedPrizes === 1
  && result.slip.turns === 4
  && result.slip.caught === 0
  && result.slip.combo === 0
  && errors.length === 0;
if (!valid) process.exitCode = 1;
