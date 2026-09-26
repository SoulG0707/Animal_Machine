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
const key = (type, keyName, code) => send('Input.dispatchKeyEvent', {
  type,
  key: keyName,
  code,
  windowsVirtualKeyCode: keyName === 'ArrowLeft' ? 37 : 39,
  nativeVirtualKeyCode: keyName === 'ArrowLeft' ? 37 : 39,
});

await send('Runtime.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.reload', { ignoreCache: true });
await wait(900);
await evaluate(`document.querySelector('#start-game-btn').click()`);
await wait(120);

await key('keyDown', 'ArrowRight', 'ArrowRight');
await wait(50);
const accelerationStart = await evaluate(`(async () => (await import('/js/main.js')).game.getSnapshot())()`);
await wait(120);
const accelerationMiddle = await evaluate(`(async () => (await import('/js/main.js')).game.getSnapshot())()`);
await wait(260);
const accelerationEnd = await evaluate(`(async () => (await import('/js/main.js')).game.getSnapshot())()`);
await key('keyUp', 'ArrowRight', 'ArrowRight');
const release = await evaluate(`(async () => (await import('/js/main.js')).game.getSnapshot())()`);
await wait(180);
const stopped = await evaluate(`(async () => (await import('/js/main.js')).game.getSnapshot())()`);
await wait(1200);
const settled = await evaluate(`(async () => (await import('/js/main.js')).game.getSnapshot())()`);

await evaluate(`(async () => {
  const { game } = await import('/js/main.js');
  game.stopMoving();
  game.claw.x = 300;
  game.claw.velocityX = 280;
  game.claw.swingAngle = 0;
  game.claw.swingVelocity = 0;
})()`);
await key('keyDown', 'ArrowLeft', 'ArrowLeft');
await wait(55);
const reverseBeforeZero = await evaluate(`(async () => (await import('/js/main.js')).game.claw.velocityX)()`);
await wait(120);
const reverseAfterZero = await evaluate(`(async () => (await import('/js/main.js')).game.claw.velocityX)()`);
await key('keyUp', 'ArrowLeft', 'ArrowLeft');

const boundary = await evaluate(`(async () => {
  const { game } = await import('/js/main.js');
  game.stopMoving();
  game.claw.x = 674;
  game.claw.velocityX = 280;
  game.claw.updatePlayerMovement(1, 1 / 30);
  const first = { x: game.claw.x, velocity: game.claw.velocityX };
  game.claw.updatePlayerMovement(1, 1 / 30);
  return { first, second: { x: game.claw.x, velocity: game.claw.velocityX } };
})()`);

const carryHome = await evaluate(`(async () => {
  const { game } = await import('/js/main.js');
  game.stopMoving();
  game.claw.reset();
  game.claw.x = 560;
  game.claw.state = 'carrying';
  let minimumX = game.claw.x;
  let arrivedFrame = null;
  let releaseReadyFrame = null;
  for (let frame = 0; frame < 360; frame += 1) {
    const arrived = game.claw.updateAutomaticMovement(game.claw.homeX, 1 / 60, 'carry');
    game.claw.updateSwing(1 / 60);
    minimumX = Math.min(minimumX, game.claw.x);
    if (arrived && arrivedFrame === null) arrivedFrame = frame;
    if (arrived && Math.abs(game.claw.headX - game.claw.homeX) < 1.5) {
      releaseReadyFrame = frame;
      break;
    }
  }
  return {
    x: game.claw.x,
    headX: game.claw.headX,
    velocity: game.claw.velocityX,
    minimumX,
    arrivedFrame,
    releaseReadyFrame,
  };
})()`);

const actualHeadGrab = await evaluate(`(async () => {
  const { game } = await import('/js/main.js');
  const originalRandom = Math.random;
  game.resetGame();
  game.state.prizes.forEach((prize) => { prize.collected = true; });
  const prize = game.state.prizes[0];
  prize.collected = false;
  prize.state = 'idle';
  game.claw.x = 330;
  game.claw.y = 400;
  game.claw.targetY = 470;
  game.claw.swingAngle = 6 * Math.PI / 180;
  game.claw.swingVelocity = 0;
  prize.rotation = 0;
  const centerOfMassOffset = prize.getCenterOfMassOffset(0);
  const intendedCenterOfMassX = game.claw.headX + 8;
  const intendedCenterOfMassY = game.claw.headY + 31;
  prize.x = intendedCenterOfMassX - prize.width / 2 - centerOfMassOffset.x;
  prize.y = intendedCenterOfMassY - prize.height / 2 - centerOfMassOffset.y;
  game.physics.updateGeometry(prize);
  game.claw.state = 'descending';
  Math.random = () => 0.99;
  game.grab.update(performance.now(), 0);
  Math.random = originalRandom;
  return {
    perfect: game.claw.currentGrab?.perfect,
    headDistance: Math.abs(prize.worldCenterOfMassX - game.claw.headX),
    carriageDistance: Math.abs(prize.worldCenterOfMassX - game.claw.x),
  };
})()`);

const desktop = {
  acceleration: [accelerationStart.clawVelocityX, accelerationMiddle.clawVelocityX, accelerationEnd.clawVelocityX],
  inertiaDistance: stopped.clawX - release.clawX,
  releasedVelocity: release.clawVelocityX,
  stoppedVelocity: stopped.clawVelocityX,
  swingAfterStop: stopped.clawSwingAngle,
  swingSettled: settled.clawSwingAngle,
  reverseBeforeZero,
  reverseAfterZero,
  boundary,
  carryHome,
  actualHeadGrab,
};

await send('Emulation.setDeviceMetricsOverride', {
  width: 390, height: 844, deviceScaleFactor: 3, mobile: true, screenWidth: 390, screenHeight: 844,
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
await wait(350);
await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
const mobileRelease = await evaluate(`(async () => (await import('/js/main.js')).game.getSnapshot())()`);
await wait(180);
const mobileStopped = await evaluate(`(async () => (await import('/js/main.js')).game.getSnapshot())()`);
const turnsBeforeGrab = await evaluate(`(async () => (await import('/js/main.js')).game.state.turns)()`);
await send('Input.dispatchTouchEvent', {
  type: 'touchStart', touchPoints: [{ ...points['drop-btn'], radiusX: 4, radiusY: 4, force: 1 }],
});
await wait(35);
await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await wait(60);
const turnsAfterGrab = await evaluate(`(async () => (await import('/js/main.js')).game.state.turns)()`);
const mobile = {
  inertiaDistance: mobileStopped.clawX - mobileRelease.clawX,
  releasedVelocity: mobileRelease.clawVelocityX,
  stoppedVelocity: mobileStopped.clawVelocityX,
  turnsBeforeGrab,
  turnsAfterGrab,
};

const valid = desktop.acceleration[0] > 0
  && desktop.acceleration[0] < desktop.acceleration[1]
  && desktop.acceleration[1] < desktop.acceleration[2]
  && desktop.inertiaDistance >= 4 && desktop.inertiaDistance <= 15
  && Math.abs(desktop.stoppedVelocity) < 0.01
  && Math.abs(desktop.swingAfterStop) > Math.abs(desktop.swingSettled)
  && desktop.reverseBeforeZero > 0 && desktop.reverseAfterZero < 0
  && desktop.boundary.first.x === 675 && desktop.boundary.first.velocity === 0
  && desktop.boundary.second.x === 675 && desktop.boundary.second.velocity === 0
  && desktop.carryHome.x === 112 && desktop.carryHome.velocity === 0
  && desktop.carryHome.minimumX >= 112
  && Math.abs(desktop.carryHome.headX - 112) < 1.5
  && desktop.carryHome.releaseReadyFrame >= desktop.carryHome.arrivedFrame
  && desktop.actualHeadGrab.perfect === true
  && desktop.actualHeadGrab.headDistance <= 14
  && desktop.actualHeadGrab.carriageDistance > 14
  && mobile.inertiaDistance >= 4 && mobile.inertiaDistance <= 15
  && Math.abs(mobile.stoppedVelocity) < 0.01
  && mobile.turnsAfterGrab === mobile.turnsBeforeGrab - 1
  && errors.length === 0;

console.log(JSON.stringify({ desktop, mobile, errors, valid }, null, 2));
socket.close();
if (!valid) process.exitCode = 1;
