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
await send('Runtime.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.reload', { ignoreCache: true });
await new Promise((resolve) => setTimeout(resolve, 900));

const result = await evaluate(`(async () => {
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const { game } = await import('/js/main.js');
  const originalStorage = { ...localStorage };
  const initial = {
    appState: game.state.appState,
    loopRunning: Boolean(game.loop.running),
    startVisible: !game.ui.startScreen.screen.hidden,
    backHidden: game.ui.backButton.hidden,
  };

  game.state.bestScore = 190;
  game.state.trainerXp = 320;
  game.state.pokedexCounts.Pikachu = 2;
  game.storage.saveBestScore(190);
  game.storage.saveTrainerXp(320);
  game.storage.saveCollection(game.state.pokedexCounts);
  game.difficulty.select('hard');
  game.refresh({ pokedex: true });

  let backRequests = 0;
  const originalBackRequest = game.requestReturnToMenu.bind(game);
  game.requestReturnToMenu = () => { backRequests += 1; return originalBackRequest(); };

  document.querySelector('#start-game-btn').click();
  await wait(80);
  const startedHard = {
    appState: game.state.appState,
    loopRunning: game.loop.running,
    backVisible: !game.ui.backButton.hidden,
    mode: game.state.mode,
    score: game.state.score,
    turns: game.state.turns,
  };

  game.ui.backButton.click();
  await wait(80);
  const directBack = {
    appState: game.state.appState,
    loopRunning: Boolean(game.loop.running),
    startVisible: !game.ui.startScreen.screen.hidden,
    confirmHidden: game.ui.backConfirm.overlay.hidden,
    requests: backRequests,
  };

  game.difficulty.select('medium');
  game.startGame();
  await wait(80);
  game.grab.attempt();
  await wait(120);
  const clawYBeforeBack = game.claw.y;
  game.ui.backButton.click();
  const paused = {
    appState: game.state.appState,
    loopRunning: Boolean(game.loop.running),
    confirmVisible: !game.ui.backConfirm.overlay.hidden,
    turns: game.state.turns,
    caught: game.state.caughtThisGame,
  };
  await wait(300);
  const clawStayedStill = game.claw.y === clawYBeforeBack;
  game.ui.backConfirm.stayButton.click();
  await wait(80);
  const resumed = { appState: game.state.appState, loopRunning: game.loop.running, confirmHidden: game.ui.backConfirm.overlay.hidden };

  game.ui.backButton.click();
  game.ui.backConfirm.leaveButton.click();
  await wait(80);
  const leftMidGrab = {
    appState: game.state.appState,
    loopRunning: Boolean(game.loop.running),
    clawState: game.claw.state,
    clawAtHome: game.claw.x === game.claw.homeX && game.claw.y === game.claw.homeY,
    caught: game.state.caughtThisGame,
    best: game.state.bestScore,
    xp: game.state.trainerXp,
    pikachu: game.state.pokedexCounts.Pikachu,
  };

  game.difficulty.select('easy');
  game.startGame();
  await wait(80);
  const restartedEasy = {
    appState: game.state.appState,
    mode: game.state.mode,
    slipMin: game.difficulty.current.gripMissMin,
    score: game.state.score,
    turns: game.state.turns,
    best: game.state.bestScore,
    xp: game.state.trainerXp,
    pikachu: game.state.pokedexCounts.Pikachu,
  };
  game.returnToMenu();

  localStorage.clear();
  Object.entries(originalStorage).forEach(([key, value]) => localStorage.setItem(key, value));
  return { initial, startedHard, directBack, paused, clawStayedStill, resumed, leftMidGrab, restartedEasy };
})()`);

await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true, screenWidth: 390, screenHeight: 844 });
await send('Page.reload', { ignoreCache: true });
await new Promise((resolve) => setTimeout(resolve, 700));
const mobile = await evaluate(`(async () => {
  const { game } = await import('/js/main.js');
  game.startGame();
  await new Promise(resolve => setTimeout(resolve, 80));
  const button = document.querySelector('#back-to-menu-btn');
  const label = button.querySelector('.back-btn-label');
  return {
    visible: !button.hidden,
    labelDisplay: getComputedStyle(label).display,
    ariaLabel: button.getAttribute('aria-label'),
    headerHeight: document.querySelector('.topbar').getBoundingClientRect().height,
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: innerWidth,
  };
})()`);

console.log(JSON.stringify({ result, mobile, errors }, null, 2));
socket.close();
const valid = result.initial.appState === 'menu' && !result.initial.loopRunning && result.initial.backHidden
  && result.startedHard.appState === 'playing' && result.startedHard.loopRunning && result.startedHard.backVisible && result.startedHard.mode === 'hard'
  && result.directBack.appState === 'menu' && !result.directBack.loopRunning && result.directBack.startVisible && result.directBack.confirmHidden && result.directBack.requests === 1
  && result.paused.appState === 'paused' && !result.paused.loopRunning && result.paused.confirmVisible && result.paused.turns === 4
  && result.clawStayedStill
  && result.resumed.appState === 'playing' && result.resumed.loopRunning && result.resumed.confirmHidden
  && result.leftMidGrab.appState === 'menu' && !result.leftMidGrab.loopRunning && result.leftMidGrab.clawState === 'ready' && result.leftMidGrab.clawAtHome && result.leftMidGrab.caught === 0
  && result.leftMidGrab.best === 190 && result.leftMidGrab.xp === 320 && result.leftMidGrab.pikachu === 2
  && result.restartedEasy.appState === 'playing' && result.restartedEasy.mode === 'easy' && result.restartedEasy.slipMin === 0.05
  && result.restartedEasy.score === 0 && result.restartedEasy.turns === 5
  && result.restartedEasy.best === 190 && result.restartedEasy.xp === 320 && result.restartedEasy.pikachu === 2
  && mobile.visible && mobile.labelDisplay === 'none' && mobile.ariaLabel === 'Quay lại menu'
  && mobile.scrollWidth <= mobile.viewportWidth && mobile.headerHeight < 70
  && errors.length === 0;
if (!valid) process.exitCode = 1;
