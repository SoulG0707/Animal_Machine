const pages = await fetch('http://127.0.0.1:9417/json').then((response) => response.json());
const page = pages.find((entry) => entry.type === 'page' && entry.url.includes('localhost:8000'));
if (!page) throw new Error('Game page not found at localhost:8000');

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

await send('Runtime.enable');
await send('Page.enable');

const runViewport = async (mobile) => {
  await send('Emulation.setDeviceMetricsOverride', mobile
    ? { width: 390, height: 844, deviceScaleFactor: 3, mobile: true }
    : { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.reload', { ignoreCache: true });
  await new Promise((resolve) => setTimeout(resolve, 800));
  return evaluate(`(async () => {
    const { game } = await import('/js/main.js');
    document.querySelector('#start-game-btn').click();
    const run = ({ name, angle = 0, swingVelocity = 0, rate = 60, startAway = false, offChute = false }) => {
      game.resetGame();
      game.loop.stop();
      game.state.appState = 'playing';
      const prize = game.state.prizes.find((item) => item.name === name);
      if (!prize) throw new Error('Missing ' + name);
      game.state.prizes.forEach((item) => { item.collected = item !== prize; });
      prize.collected = false;
      prize.state = 'grabbed';
      if (offChute) prize.grabAnchorX = -1;
      const claw = game.claw;
      claw.x = claw.homeX + (startAway ? 90 : 0);
      claw.y = claw.homeY;
      claw.velocityX = 0;
      claw.accelerationX = 0;
      claw.swingAngle = angle * Math.PI / 180;
      claw.swingVelocity = swingVelocity;
      claw.openAmount = 0;
      claw.caught = prize;
      claw.state = 'carrying';
      const start = performance.now();
      claw.currentGrab = {
        pokemon: prize, willSlip: false, slipDuringCarry: false, carrySpeedMultiplier: 1,
        homeReleaseElapsed: null, lastPoseTime: start, targetTilt: 0,
        swingMultiplier: 1, dynamicTiltAmplitude: 0, rewardResolved: false,
      };
      game.grab.updateCarriedPrize(start);
      let homeMs = startAway ? null : 0;
      let detachMs = null;
      let detachAngle = null;
      let detachX = null;
      let chuteSensor = false;
      let premature = false;
      let offChuteHold = true;
      let safeStartMs = null;
      let safeDelayMs = null;
      let fallingSameFrame = false;
      const dt = 1000 / rate;
      for (let frame = 1; frame <= rate * 5; frame += 1) {
        const ms = frame * dt;
        const time = start + ms;
        if (offChute && ms >= 600 && prize.grabAnchorX === -1) prize.grabAnchorX = 0.5;
        claw.updateSwing(dt / 1000);
        game.grab.update(time, dt);
        game.grab.updateCarriedPrize(time);
        game.physics.update(dt);
        const atHome = Math.abs(claw.x - claw.homeX) < 0.001
          && Math.abs(claw.velocityX) < 0.001 && claw.y === claw.homeY;
        if (homeMs === null && atHome) homeMs = ms;
        if (claw.currentGrab?.homeReleaseElapsed === 0) safeStartMs = ms;
        if (claw.currentGrab?.homeReleaseElapsed === null) safeStartMs = null;
        if (offChute && ms < 600 && claw.currentGrab === null) offChuteHold = false;
        if (detachMs === null && claw.currentGrab === null && claw.droppingPrize === prize) {
          detachMs = ms;
          safeDelayMs = ms - safeStartMs;
          detachAngle = claw.swingAngle * 180 / Math.PI;
          detachX = prize.centerX;
          fallingSameFrame = prize.velocityY > 0 && prize.y > prize.releaseY;
          if (homeMs === null) premature = true;
        }
        if (prize.chuteSensorTriggered || prize.collected) chuteSensor = true;
        if (detachMs !== null && prize.collected) break;
      }
      return {
        name, angle, swingVelocity, rate, startAway, offChute,
        homeMs, detachMs, delayMs: detachMs === null ? null : detachMs - homeMs,
        safeDelayMs, detachAngle, detachX, premature, offChuteHold, chuteSensor,
        fallingSameFrame,
        caught: prize.collected,
      };
    };
    return [
      run({ name: 'Mewtwo' }),
      run({ name: 'Psyduck' }),
      run({ name: 'Pikachu', angle: 5, swingVelocity: 0.3 }),
      run({ name: 'Pikachu', angle: 12, swingVelocity: 0.5 }),
      run({ name: 'Pikachu', startAway: true }),
      run({ name: 'Pikachu', offChute: true }),
      run({ name: 'Pikachu', rate: 120 }),
      run({ name: 'Pikachu', rate: 144 }),
    ];
  })()`);
};

const desktop = await runViewport(false);
const mobile = await runViewport(true);
const all = [...desktop, ...mobile];
const checks = {
  delay: all.every((test) => test.safeDelayMs >= 150 && test.safeDelayMs <= 300)
    && all.filter((test) => test.angle <= 5 && !test.offChute)
      .every((test) => test.delayMs >= 150 && test.delayMs <= 300),
  homeFirst: all.every((test) => !test.premature && test.homeMs !== null),
  offChuteBlocked: all.filter((test) => test.offChute).every((test) => test.offChuteHold),
  chute: all.every((test) => test.chuteSensor && test.caught),
  fallingSameFrame: all.every((test) => test.fallingSameFrame),
  consoleClean: errors.length === 0,
};
const result = { desktop, mobile, errors, checks, valid: Object.values(checks).every(Boolean) };
console.log(JSON.stringify(result, null, 2));
socket.close();
if (!result.valid) process.exitCode = 1;
