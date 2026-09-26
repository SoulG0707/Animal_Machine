const pages = await fetch('http://127.0.0.1:9417/json').then((response) => response.json());
const page = pages.find((entry) => entry.type === 'page' && entry.url.includes('localhost:8000'));
if (!page) throw new Error('Game page not found');

const socket = new WebSocket(page.webSocketDebuggerUrl);
const pending = new Map();
const errors = [];
let nextId = 0;

socket.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data);
  if (message.id && pending.has(message.id)) {
    pending.get(message.id)(message);
    pending.delete(message.id);
  }
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
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
  if (response.result?.exceptionDetails) {
    throw new Error(response.result.exceptionDetails.exception?.description || response.result.exceptionDetails.text);
  }
  return response.result?.result?.value;
}

await send('Runtime.enable');
await send('Page.enable');
await send('Page.setWebLifecycleState', { state: 'active' });
await send('Page.bringToFront');
await send('Emulation.setDeviceMetricsOverride', {
  width: 1440, height: 900, deviceScaleFactor: 1, mobile: false,
});
await send('Page.reload', { ignoreCache: true });
await new Promise((resolve) => setTimeout(resolve, 1000));

const result = await evaluate(`(async () => {
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const waitFor = async (test, timeout = 9000) => {
    const started = performance.now();
    while (!test()) {
      if (performance.now() - started > timeout) throw new Error('Timed out waiting for timer gameplay state');
      await wait(25);
    }
  };
  const { game } = await import('/js/main.js');
  const { DIFFICULTY_SETTINGS } = await import('/js/config/difficultyConfig.js');
  if (!document.querySelector('#start-screen').hidden) document.querySelector('#start-game-btn').click();
  game.state.appState = 'playing';
  game.resumeGame();
  game.resetGame();
  await wait(80);

  const durations = Object.fromEntries(Object.entries(DIFFICULTY_SETTINGS).map(([mode, config]) => [mode, config.turnTime]));

  game.state.turnTimeRemaining = 3;
  game.resetGame();
  const newGameReset = game.state.turnTimeRemaining === game.state.turnTimeMax;
  game.state.turnTimeRemaining = 12;
  game.startMoving(1);
  await wait(180);
  game.stopMoving(1);
  const directionChangeKeepsTimer = game.state.turnTimeRemaining < 12 && game.state.turnTimeRemaining > 11.5;

  game.claw.x = 318;
  game.claw.lockHorizontalMotion({ applyCoast: false, transferMomentum: false });
  game.state.turnTimeRemaining = 0.08;
  await waitFor(() => game.state.grabAttemptId === 1);
  const normalAuto = {
    attempts: game.state.grabAttemptId,
    turns: game.state.turns,
    x: game.claw.x,
    state: game.claw.state,
    status: document.querySelector('#status-text').textContent,
    timer: game.state.turnTimeRemaining,
  };

  game.resetGame();
  game.state.turnTimeRemaining = 8;
  const manualStarted = game.attemptGrab();
  await wait(180);
  const manualAtEight = {
    manualStarted,
    attempts: game.state.grabAttemptId,
    turns: game.state.turns,
    timer: game.state.turnTimeRemaining,
  };

  game.resetGame();
  game.state.turnTimeRemaining = 0.1;
  const raceStarted = game.attemptGrab();
  await wait(220);
  const manualRace = {
    raceStarted,
    attempts: game.state.grabAttemptId,
    turns: game.state.turns,
    timer: game.state.turnTimeRemaining,
  };

  game.resetGame();
  game.state.score = 1;
  game.state.turnTimeRemaining = 9;
  game.requestReturnToMenu();
  const pausedAt = game.state.turnTimeRemaining;
  await wait(350);
  const pauseStable = Math.abs(game.state.turnTimeRemaining - pausedAt) < 0.001;
  game.cancelReturnToMenu();
  await wait(220);
  const resumedTicks = game.state.turnTimeRemaining < pausedAt - 0.08;

  game.resetGame();
  game.state.turnTimeRemaining = 7;
  game.finishGame();
  const gameOverAt = game.state.turnTimeRemaining;
  await wait(260);
  const gameOverStable = Math.abs(game.state.turnTimeRemaining - gameOverAt) < 0.001;
  game.state.appState = 'playing';
  game.resetGame();
  game.resumeGame();

  const prepareSinglePrize = () => {
    const target = game.state.prizes.find((prize) => prize.character.score > 0);
    game.state.prizes.forEach((prize) => { prize.collected = prize !== target; });
    game.claw.x = 330;
    target.rotation = 0;
    target.x = game.claw.headX - target.centerOfMassX * target.width;
    target.y = 545 - target.height;
    target.velocityX = 0;
    target.velocityY = 0;
    target.angularVelocity = 0;
    target.isSleeping = true;
    target.state = 'idle';
    target.collected = false;
    game.physics.updateGeometry(target);
    return target;
  };

  const originalRandom = Math.random;
  game.resetGame();
  prepareSinglePrize();
  Math.random = () => 0.99;
  game.state.turnTimeRemaining = 0.04;
  await waitFor(() => game.state.grabAttemptId === 1);
  await waitFor(() => game.claw.state === 'ready' || game.claw.state === 'game-over');
  const autoSuccess = {
    attempts: game.state.grabAttemptId,
    turns: game.state.turns,
    caught: game.state.caughtThisGame,
    timerReset: game.state.turnTimeRemaining > game.state.turnTimeMax - 0.5,
    autoFlagReset: !game.state.autoGrabTriggered,
  };

  game.resetGame();
  game.state.prizes.forEach((prize) => { prize.collected = true; });
  Math.random = () => 0.99;
  game.state.turnTimeRemaining = 0.04;
  await waitFor(() => game.state.grabAttemptId === 1);
  await waitFor(() => game.claw.state === 'ready' || game.claw.state === 'game-over');
  const autoMiss = {
    attempts: game.state.grabAttemptId,
    turns: game.state.turns,
    caught: game.state.caughtThisGame,
  };

  game.resetGame();
  prepareSinglePrize();
  Math.random = () => 0;
  game.state.turnTimeRemaining = 0.04;
  await waitFor(() => game.state.grabAttemptId === 1);
  await waitFor(() => game.claw.state === 'ready' || game.claw.state === 'game-over');
  const autoSlip = {
    attempts: game.state.grabAttemptId,
    turns: game.state.turns,
    caught: game.state.caughtThisGame,
  };
  Math.random = originalRandom;

  game.resetGame();
  game.state.turnTimeRemaining = 4.8;
  game.ui.hud.renderTimer(game.state.turnTimeRemaining);
  const warning = {
    text: document.querySelector('#turn-timer').textContent,
    urgent: document.querySelector('.timer-block').classList.contains('is-urgent'),
  };

  return {
    durations, newGameReset, directionChangeKeepsTimer, normalAuto, manualAtEight, manualRace,
    pauseStable, resumedTicks, gameOverStable,
    autoSuccess, autoMiss, autoSlip, warning,
  };
})()`);

await evaluate(`(async () => {
  const { game } = await import('/js/main.js');
  game.state.appState = 'playing';
  game.resetGame();
  game.resumeGame();
  game.state.turnTimeRemaining = 6;
  await new Promise((resolve) => setTimeout(resolve, 80));
  return game.state.turnTimeRemaining;
})()`);
const beforeBackground = await evaluate(`import('/js/main.js').then(({ game }) => game.state.turnTimeRemaining)`);
const frozenResponse = await send('Page.setWebLifecycleState', { state: 'frozen' });
await new Promise((resolve) => setTimeout(resolve, 650));
const activeResponse = await send('Page.setWebLifecycleState', { state: 'active' });
await send('Page.bringToFront');
await new Promise((resolve) => setTimeout(resolve, 120));
const afterBackground = await evaluate(`import('/js/main.js').then(({ game }) => ({
  timer: game.state.turnTimeRemaining,
  visibility: document.visibilityState,
}))`);
const background = {
  before: beforeBackground,
  after: afterBackground.timer,
  visibility: afterBackground.visibility,
  lifecycleSupported: !frozenResponse.error && !activeResponse.error,
  paused: beforeBackground - afterBackground.timer < 0.3,
};

await send('Emulation.setDeviceMetricsOverride', {
  width: 390, height: 844, deviceScaleFactor: 3, mobile: true,
});
const mobile = await evaluate(`(() => {
  const blocks = ['.score-block', '.turns-block', '.timer-block'].map((selector) => document.querySelector(selector).getBoundingClientRect());
  return {
    timerVisible: document.querySelector('#turn-timer').getBoundingClientRect().width > 0,
    sameRow: Math.max(...blocks.map((box) => box.top)) - Math.min(...blocks.map((box) => box.top)) < 2,
    columns: getComputedStyle(document.querySelector('.score-panel')).gridTemplateColumns.split(' ').length,
    viewportWidth: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  };
})()`);

console.log(JSON.stringify({ result, background, mobile, errors }, null, 2));
socket.close();
await fetch('http://127.0.0.1:9417/json/new?http://localhost:8000/', { method: 'PUT' });
await fetch(`http://127.0.0.1:9417/json/close/${page.id}`);

const valid = result.durations.easy === 20
  && result.durations.medium === 15
  && result.durations.hard === 10
  && result.newGameReset
  && result.directionChangeKeepsTimer
  && result.normalAuto.attempts === 1
  && result.normalAuto.turns === 4
  && result.normalAuto.x === 318
  && result.normalAuto.status === 'AUTO GRAB!'
  && result.normalAuto.timer === 0
  && result.manualAtEight.manualStarted
  && result.manualAtEight.attempts === 1
  && result.manualAtEight.turns === 4
  && result.manualAtEight.timer === 8
  && result.manualRace.raceStarted
  && result.manualRace.attempts === 1
  && result.manualRace.turns === 4
  && result.pauseStable
  && result.resumedTicks
  && result.gameOverStable
  && result.autoSuccess.attempts === 1
  && result.autoSuccess.turns === 4
  && result.autoSuccess.caught === 1
  && result.autoSuccess.timerReset
  && result.autoSuccess.autoFlagReset
  && result.autoMiss.attempts === 1
  && result.autoMiss.turns === 4
  && result.autoMiss.caught === 0
  && result.autoSlip.attempts === 1
  && result.autoSlip.turns === 4
  && result.autoSlip.caught === 0
  && result.warning.text === '05'
  && result.warning.urgent
  && background.lifecycleSupported
  && background.paused
  && mobile.timerVisible
  && mobile.sameRow
  && mobile.columns === 3
  && mobile.scrollWidth <= mobile.viewportWidth
  && errors.length === 0;

if (!valid) process.exitCode = 1;
