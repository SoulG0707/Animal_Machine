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
    errors.push(message.params.args.map((argument) => argument.value || argument.description).join(' '));
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
  if (response.result?.exceptionDetails) {
    throw new Error(response.result.exceptionDetails.exception?.description || response.result.exceptionDetails.text);
  }
  return response.result?.result?.value;
};
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

await send('Runtime.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width: 1440, height: 900, deviceScaleFactor: 1, mobile: false,
});
await send('Page.reload', { ignoreCache: true });
await wait(900);

const desktop = await evaluate(`(async () => {
  const { game } = await import('/js/main.js');
  const { CLAW_MOVEMENT } = await import('/js/config/gameConfig.js');
  document.querySelector('#start-game-btn').click();
  game.loop.stop();

  const simulateRelease = (direction, holdFrames) => {
    game.claw.reset();
    game.claw.x = 360;
    game.claw.state = 'ready';
    const step = 1 / 60;
    for (let frame = 0; frame < holdFrames; frame += 1) {
      game.claw.updatePlayerMovement(direction, step);
      game.claw.updateSwing(step);
    }
    const before = {
      x: game.claw.x,
      headX: game.claw.headX,
      velocity: game.claw.velocityX,
      angle: game.claw.swingAngle,
    };
    game.claw.updatePlayerMovement(0, step);
    const released = {
      x: game.claw.x,
      headX: game.claw.headX,
      velocity: game.claw.velocityX,
      swingVelocity: game.claw.swingVelocity,
    };
    const samples = [];
    let peakAngle = Math.abs(game.claw.swingAngle);
    let previousSign = 0;
    let reversals = 0;
    for (let frame = 0; frame < 210; frame += 1) {
      game.claw.updatePlayerMovement(0, step);
      game.claw.updateSwing(step);
      peakAngle = Math.max(peakAngle, Math.abs(game.claw.swingAngle));
      const sign = Math.abs(game.claw.swingAngle) > 0.002 ? Math.sign(game.claw.swingAngle) : 0;
      if (sign && previousSign && sign !== previousSign) reversals += 1;
      if (sign) previousSign = sign;
      if (frame < 8 || frame % 30 === 0) {
        samples.push({ frame, x: game.claw.x, headX: game.claw.headX, angle: game.claw.swingAngle });
      }
    }
    return {
      before,
      released,
      coast: released.x - before.x,
      firstHeadDelta: samples[0].headX - before.headX,
      firstAngle: samples[0].angle,
      peakAngle,
      reversals,
      finalAngle: game.claw.swingAngle,
      finalVelocity: game.claw.swingVelocity,
      samples,
    };
  };

  const holdRight = simulateRelease(1, 70);
  const holdLeft = simulateRelease(-1, 70);
  const tapRight = simulateRelease(1, 2);

  game.resetGame();
  game.loop.stop();
  game.state.appState = 'playing';
  game.state.prizes.forEach((prize) => { prize.collected = true; });
  const target = game.state.prizes[0];
  target.collected = false;
  target.state = 'idle';
  target.rotation = 0;
  game.claw.x = 330;
  game.claw.y = 400;
  game.claw.state = 'ready';
  game.claw.swingAngle = 6 * Math.PI / 180;
  game.claw.swingVelocity = 0.24;
  const centerOfMassOffset = target.getCenterOfMassOffset(0);
  const intendedCenterOfMassX = game.claw.headX + 8;
  const intendedCenterOfMassY = game.claw.headY + 31;
  target.x = intendedCenterOfMassX - target.width / 2 - centerOfMassOffset.x;
  target.y = intendedCenterOfMassY - target.height / 2 - centerOfMassOffset.y;
  game.physics.updateGeometry(target);
  const headBeforeGrab = game.claw.headX;
  const evaluation = game.grab.evaluateGrab(target);
  const grabStarted = game.grab.attempt();
  const swingGrab = {
    grabStarted,
    perfect: evaluation.perfect,
    headBeforeGrab,
    headAfterGrab: game.claw.headX,
    headDistance: Math.abs(target.worldCenterOfMassX - headBeforeGrab),
    carriageDistance: Math.abs(target.worldCenterOfMassX - game.claw.x),
  };

  game.resetGame();
  game.loop.stop();
  game.state.appState = 'playing';
  const carried = game.state.prizes[0];
  game.state.prizes.forEach((prize) => { prize.collected = prize !== carried; });
  carried.state = 'grabbed';
  carried.collected = false;
  game.claw.x = game.claw.homeX;
  game.claw.y = game.claw.homeY;
  game.claw.velocityX = 0;
  game.claw.accelerationX = 0;
  game.claw.swingAngle = 8 * Math.PI / 180;
  game.claw.swingVelocity = 0.35;
  game.claw.carryOffsetX = 0;
  game.claw.carryOffsetY = 70;
  game.claw.caught = carried;
  game.claw.state = 'carrying';
  game.claw.currentGrab = {
    pokemon: carried,
    willSlip: false,
    slipDuringCarry: false,
    carrySpeedMultiplier: 1,
    homeSettleFrames: null,
    lastPoseTime: performance.now(),
  };
  let strongSwingState = null;
  let releaseFrame = null;
  let releaseAngle = null;
  let releaseVelocity = null;
  for (let frame = 0; frame < 360; frame += 1) {
    game.claw.updateSwing(1 / 60);
    game.grab.update(frame * 1000 / 60, 1000 / 60);
    if (frame === 0) strongSwingState = game.claw.state;
    if (game.claw.state === 'releasing') {
      releaseFrame = frame;
      releaseAngle = game.claw.swingAngle;
      releaseVelocity = game.claw.swingVelocity;
      break;
    }
  }
  const carrySettle = {
    strongSwingState,
    releaseFrame,
    releaseAngle,
    releaseVelocity,
    maxDropAngle: CLAW_MOVEMENT.swing.dropSettleAngle,
    maxDropVelocity: CLAW_MOVEMENT.swing.dropSettleVelocity,
  };

  return {
    holdRight,
    holdLeft,
    tapRight,
    swingGrab,
    carrySettle,
    configuredMaxAngle: CLAW_MOVEMENT.swing.maxAngle,
    configuredMaxCoast: CLAW_MOVEMENT.releaseCoastMax,
  };
})()`);

await send('Emulation.setDeviceMetricsOverride', {
  width: 390, height: 844, deviceScaleFactor: 3, mobile: true,
  screenWidth: 390, screenHeight: 844,
});
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
await send('Page.reload', { ignoreCache: true });
await wait(900);
await evaluate(`document.querySelector('#start-game-btn').click()`);
await wait(120);
const points = await evaluate(`Object.fromEntries(['right-btn', 'drop-btn'].map((id) => {
  const rect = document.getElementById(id).getBoundingClientRect();
  return [id, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }];
}))`);
await evaluate(`(async () => { const { game } = await import('/js/main.js'); game.claw.x = 300; })()`);
await send('Input.dispatchTouchEvent', {
  type: 'touchStart', touchPoints: [{ ...points['right-btn'], radiusX: 4, radiusY: 4, force: 1 }],
});
await wait(420);
await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
const mobileRelease = await evaluate(`(async () => (await import('/js/main.js')).game.getSnapshot())()`);
await wait(45);
const mobileAfterRelease = await evaluate(`(async () => (await import('/js/main.js')).game.getSnapshot())()`);
const turnsBeforeGrab = await evaluate(`(async () => (await import('/js/main.js')).game.state.turns)()`);
await send('Input.dispatchTouchEvent', {
  type: 'touchStart', touchPoints: [{ ...points['drop-btn'], radiusX: 4, radiusY: 4, force: 1 }],
});
await wait(35);
await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await wait(60);
const turnsAfterGrab = await evaluate(`(async () => (await import('/js/main.js')).game.state.turns)()`);
const mobile = {
  coast: mobileAfterRelease.clawX - mobileRelease.clawX,
  stoppedVelocity: mobileAfterRelease.clawVelocityX,
  swingVelocity: mobileAfterRelease.clawSwingVelocity,
  headOffset: mobileAfterRelease.clawHeadOffsetX,
  turnsBeforeGrab,
  turnsAfterGrab,
};

const degrees = (radians) => radians * 180 / Math.PI;
const valid = desktop.holdRight.before.velocity > 270
  && desktop.holdRight.coast >= 0 && desktop.holdRight.coast <= 3
  && desktop.holdRight.released.velocity === 0
  && desktop.holdRight.released.swingVelocity > 0
  && desktop.holdRight.firstHeadDelta > 0
  && desktop.holdRight.reversals >= 2
  && desktop.holdLeft.before.velocity < -270
  && desktop.holdLeft.coast <= 0 && desktop.holdLeft.coast >= -3
  && desktop.holdLeft.released.velocity === 0
  && desktop.holdLeft.released.swingVelocity < 0
  && desktop.holdLeft.firstHeadDelta < 0
  && desktop.holdLeft.reversals >= 2
  && desktop.tapRight.peakAngle < desktop.holdRight.peakAngle * 0.45
  && degrees(desktop.holdRight.peakAngle) >= 7.5
  && degrees(desktop.holdLeft.peakAngle) >= 7.5
  && desktop.holdRight.peakAngle <= desktop.configuredMaxAngle + 0.0001
  && desktop.holdLeft.peakAngle <= desktop.configuredMaxAngle + 0.0001
  && degrees(desktop.configuredMaxAngle) === 10
  && desktop.configuredMaxCoast <= 3
  && desktop.swingGrab.grabStarted
  && desktop.swingGrab.perfect
  && Math.abs(desktop.swingGrab.headAfterGrab - desktop.swingGrab.headBeforeGrab) < 0.001
  && desktop.swingGrab.headDistance <= 14
  && desktop.swingGrab.carriageDistance > 14
  && desktop.carrySettle.strongSwingState === 'carrying'
  && desktop.carrySettle.releaseFrame > 1
  && Math.abs(desktop.carrySettle.releaseAngle) <= desktop.carrySettle.maxDropAngle
  && Math.abs(desktop.carrySettle.releaseVelocity) <= desktop.carrySettle.maxDropVelocity
  && mobile.coast >= 0 && mobile.coast <= 3
  && Math.abs(mobile.stoppedVelocity) < 0.01
  && mobile.swingVelocity > 0
  && mobile.headOffset > 0
  && mobile.turnsAfterGrab === mobile.turnsBeforeGrab - 1
  && errors.length === 0;

console.log(JSON.stringify({ desktop, mobile, errors, valid }, null, 2));
socket.close();
if (!valid) process.exitCode = 1;
