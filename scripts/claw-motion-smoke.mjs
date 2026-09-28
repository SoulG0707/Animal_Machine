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
  const { Claw } = await import('/js/entities/Claw.js');
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
      cableX: game.claw.cableX,
      pivotX: game.claw.pivotX,
    };
    const samples = [];
    let peakAngle = Math.abs(game.claw.swingAngle);
    let earlyPeak = 0;
    let latePeak = 0;
    let previousSign = 0;
    let reversals = 0;
    for (let frame = 0; frame < 180; frame += 1) {
      game.claw.updatePlayerMovement(0, step);
      game.claw.updateSwing(step);
      peakAngle = Math.max(peakAngle, Math.abs(game.claw.swingAngle));
      if (frame < 40) earlyPeak = Math.max(earlyPeak, Math.abs(game.claw.swingAngle));
      if (frame >= 120) latePeak = Math.max(latePeak, Math.abs(game.claw.swingAngle));
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
      earlyPeak,
      latePeak,
      finalAngle: game.claw.swingAngle,
      finalVelocity: game.claw.swingVelocity,
      samples,
    };
  };

  const holdRight = simulateRelease(1, 70);
  const holdLeft = simulateRelease(-1, 70);
  const tapRight = simulateRelease(1, 2);
  const tapLeft = simulateRelease(-1, 2);

  const simulateRapidReversal = (firstDirection, secondDirection) => {
    game.claw.reset();
    game.claw.x = 360;
    const step = 1 / 60;
    for (let frame = 0; frame < 20; frame += 1) {
      game.claw.updatePlayerMovement(firstDirection, step);
      game.claw.updateSwing(step);
    }
    const beforeReverse = { x: game.claw.x, velocity: game.claw.velocityX };
    for (let frame = 0; frame < 12; frame += 1) {
      game.claw.updatePlayerMovement(secondDirection, step);
      game.claw.updateSwing(step);
    }
    const afterReverse = { x: game.claw.x, velocity: game.claw.velocityX };
    game.claw.updatePlayerMovement(0, step);
    let maximumAngle = Math.abs(game.claw.swingAngle);
    for (let frame = 0; frame < 180; frame += 1) {
      game.claw.updatePlayerMovement(0, step);
      game.claw.updateSwing(step);
      maximumAngle = Math.max(maximumAngle, Math.abs(game.claw.swingAngle));
    }
    return { beforeReverse, afterReverse, maximumAngle, finalAngle: game.claw.swingAngle };
  };
  const rapidLeftToRight = simulateRapidReversal(-1, 1);
  const rapidRightToLeft = simulateRapidReversal(1, -1);

  const simulateAtRate = (rate) => {
    const claw = new Claw(360);
    const step = 1 / rate;
    for (let frame = 0; frame < Math.round(1.2 * rate); frame += 1) {
      claw.updatePlayerMovement(1, step);
      claw.updateSwing(step);
    }
    claw.updatePlayerMovement(0, step);
    let peakAngle = Math.abs(claw.swingAngle);
    for (let frame = 0; frame < 3 * rate; frame += 1) {
      claw.updatePlayerMovement(0, step);
      claw.updateSwing(step);
      peakAngle = Math.max(peakAngle, Math.abs(claw.swingAngle));
    }
    return { rate, peakAngle, finalAngle: claw.swingAngle };
  };
  const frameRateRuns = [30, 60, 120].map(simulateAtRate);

  game.claw.reset();
  game.claw.x = 360;
  game.claw.y = 420;
  game.claw.getPhysicalColliders();
  const uprightHead = game.claw.colliders.head.x;
  const uprightProng = game.claw.colliders.leftProng.bx;
  const uprightGrip = game.claw.localToWorld(0, 31);
  game.claw.swingAngle = 8 * Math.PI / 180;
  game.claw.getPhysicalColliders();
  const tiltedHead = game.claw.colliders.head.x;
  const tiltedProng = game.claw.colliders.leftProng.bx;
  const tiltedGrip = game.claw.localToWorld(0, 31);
  const localRoundTrip = game.claw.worldToLocal(tiltedGrip.x, tiltedGrip.y);
  const headOffsetAt420 = game.claw.headOffsetX;
  game.claw.y = 180;
  const headOffsetAt180 = game.claw.headOffsetX;
  const transform = {
    cableDisplacement: game.claw.cableX - game.claw.pivotX,
    headOffsetAt420,
    headOffsetAt180,
    headColliderShift: tiltedHead - uprightHead,
    prongShift: tiltedProng - uprightProng,
    gripShift: tiltedGrip.x - uprightGrip.x,
    localRoundTripError: Math.hypot(localRoundTrip.x, localRoundTrip.y - 31),
  };

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
  const intendedGrip = game.grab.getGripPoint();
  target.x = intendedGrip.x - target.width / 2 - centerOfMassOffset.x;
  target.y = intendedGrip.y - target.height / 2 - centerOfMassOffset.y;
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
  const simStart = performance.now();
  game.claw.currentGrab = {
    pokemon: carried,
    willSlip: false,
    slipDuringCarry: false,
    carrySpeedMultiplier: 1,
    homeSettleFrames: null,
    lastPoseTime: simStart,
    carryLocalX: 0,
    initialCarryLocalX: 0,
    carryLocalY: 36,
    targetTilt: 0,
    swingMultiplier: 1,
    dynamicTiltAmplitude: 0,
    rewardResolved: true,
  };
  game.grab.updateCarriedPrize(simStart);
  const initialAttachment = game.claw.localToWorld(0, 36);
  const initialComOffset = carried.getCenterOfMassOffset(carried.rotation);
  const initialAttachmentError = Math.hypot(
    carried.centerX + initialComOffset.x - initialAttachment.x,
    carried.centerY + initialComOffset.y - initialAttachment.y,
  );
  const firstAngle = game.claw.swingAngle;
  game.claw.updateSwing(1 / 60);
  game.grab.updateCarriedPrize(simStart + 1000 / 60);
  const movedAttachment = game.claw.localToWorld(0, 36);
  const movedComOffset = carried.getCenterOfMassOffset(carried.rotation);
  const movedAttachmentError = Math.hypot(
    carried.centerX + movedComOffset.x - movedAttachment.x,
    carried.centerY + movedComOffset.y - movedAttachment.y,
  );
  const attachmentFollowedSwing = Math.abs(initialAttachment.x - game.claw.x) > 3;
  let strongSwingState = null;
  let releaseFrame = null;
  let releaseAngle = null;
  let releaseVelocity = null;
  let chuteSensorTriggered = false;
  let prizeCollected = false;
  let chuteX = null;
  for (let frame = 0; frame < 600; frame += 1) {
    game.claw.updateSwing(1 / 60);
    const time = simStart + (frame + 2) * 1000 / 60;
    game.grab.update(time, 1000 / 60);
    game.grab.updateCarriedPrize(time);
    if (frame === 0) strongSwingState = game.claw.state;
    if (releaseFrame === null && game.claw.state === 'releasing') {
      releaseFrame = frame;
      releaseAngle = game.claw.swingAngle;
      releaseVelocity = game.claw.swingVelocity;
    }
    if (game.claw.state === 'waiting-for-chute') {
      chuteX = carried.centerX;
      if (carried.dropPhase === 'sensor-confirmed') chuteSensorTriggered = true;
    }
    if (carried.collected) { prizeCollected = true; break; }
  }
  const carrySettle = {
    strongSwingState,
    releaseFrame,
    releaseAngle,
    releaseVelocity,
    chuteSensorTriggered,
    prizeCollected,
    chuteX,
    attachmentFollowedSwing,
    initialAttachmentError,
    movedAttachmentError,
    firstAngle,
    maxDropAngle: CLAW_MOVEMENT.swing.dropSettleAngle,
    maxDropVelocity: CLAW_MOVEMENT.swing.dropSettleVelocity,
  };

  return {
    holdRight,
    holdLeft,
    tapRight,
    tapLeft,
    rapidLeftToRight,
    rapidRightToLeft,
    frameRateRuns,
    transform,
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
const points = await evaluate(`Object.fromEntries(['left-btn', 'right-btn', 'drop-btn'].map((id) => {
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
await evaluate(`(async () => { const { game } = await import('/js/main.js'); game.claw.reset(); game.claw.x = 360; })()`);
await send('Input.dispatchTouchEvent', {
  type: 'touchStart', touchPoints: [{ ...points['left-btn'], radiusX: 4, radiusY: 4, force: 1 }],
});
await wait(420);
await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
const mobileLeftRelease = await evaluate(`(async () => (await import('/js/main.js')).game.getSnapshot())()`);
await wait(45);
const mobileLeftAfterRelease = await evaluate(`(async () => (await import('/js/main.js')).game.getSnapshot())()`);
await evaluate(`(async () => { const { game } = await import('/js/main.js'); game.claw.reset(); })()`);
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
  headXDelta: mobileAfterRelease.clawHeadX - mobileRelease.clawHeadX,
  headOffset: mobileAfterRelease.clawHeadOffsetX,
  cableDisplacement: mobileAfterRelease.clawCableX - mobileAfterRelease.clawPivotX,
  leftCoast: mobileLeftAfterRelease.clawX - mobileLeftRelease.clawX,
  leftVelocity: mobileLeftAfterRelease.clawVelocityX,
  leftSwingVelocity: mobileLeftAfterRelease.clawSwingVelocity,
  leftHeadXDelta: mobileLeftAfterRelease.clawHeadX - mobileLeftRelease.clawHeadX,
  leftHeadOffset: mobileLeftAfterRelease.clawHeadOffsetX,
  leftCableDisplacement: mobileLeftAfterRelease.clawCableX - mobileLeftAfterRelease.clawPivotX,
  turnsBeforeGrab,
  turnsAfterGrab,
};

const degrees = (radians) => radians * 180 / Math.PI;
const checks = {
  holdRight: desktop.holdRight.before.velocity > 270
    && desktop.holdRight.coast >= 0 && desktop.holdRight.coast <= 3
    && desktop.holdRight.released.velocity === 0
    && desktop.holdRight.released.swingVelocity > 0
    && desktop.holdRight.firstHeadDelta > 0
    && desktop.holdRight.reversals >= 2 && desktop.holdRight.reversals <= 4
    && desktop.holdRight.earlyPeak > desktop.holdRight.latePeak * 6
    && desktop.holdRight.latePeak < desktop.holdRight.earlyPeak * 0.15
    && desktop.holdRight.peakAngle >= 14 * Math.PI / 180,
  holdLeft: desktop.holdLeft.before.velocity < -270
    && desktop.holdLeft.coast <= 0 && desktop.holdLeft.coast >= -3
    && desktop.holdLeft.released.velocity === 0
    && desktop.holdLeft.released.swingVelocity < 0
    && desktop.holdLeft.firstHeadDelta < 0
    && desktop.holdLeft.reversals >= 2 && desktop.holdLeft.reversals <= 4
    && desktop.holdLeft.peakAngle >= 14 * Math.PI / 180,
  taps: desktop.tapRight.peakAngle < desktop.holdRight.peakAngle * 0.45
    && desktop.tapLeft.peakAngle < desktop.holdLeft.peakAngle * 0.45,
  angleLimit: desktop.holdRight.peakAngle <= desktop.configuredMaxAngle + 0.0001
    && desktop.holdLeft.peakAngle <= desktop.configuredMaxAngle + 0.0001
    && Math.abs(degrees(desktop.configuredMaxAngle) - 18) < 0.001
    && desktop.rapidLeftToRight.maximumAngle <= desktop.configuredMaxAngle + 0.0001
    && desktop.rapidRightToLeft.maximumAngle <= desktop.configuredMaxAngle + 0.0001,
  shortCableTransform: desktop.transform.cableDisplacement === 0
    && Math.abs(desktop.transform.headOffsetAt420 - desktop.transform.headOffsetAt180) < 0.000001
    && Math.abs(desktop.transform.headOffsetAt420) <= Math.sin(desktop.configuredMaxAngle) * 22 + 0.001
    && desktop.transform.headColliderShift > 1
    && desktop.transform.prongShift > 4
    && desktop.transform.gripShift > 4
    && desktop.transform.localRoundTripError < 0.000001,
  rapidReversals: desktop.rapidLeftToRight.beforeReverse.velocity < 0
    && desktop.rapidLeftToRight.afterReverse.velocity > 0
    && desktop.rapidRightToLeft.beforeReverse.velocity > 0
    && desktop.rapidRightToLeft.afterReverse.velocity < 0,
  frameRateIndependent: Math.max(...desktop.frameRateRuns.map((run) => run.peakAngle))
    - Math.min(...desktop.frameRateRuns.map((run) => run.peakAngle)) < Math.PI / 180,
  tiltedGrab: desktop.swingGrab.grabStarted
    && desktop.swingGrab.perfect
    && Math.abs(desktop.swingGrab.headAfterGrab - desktop.swingGrab.headBeforeGrab) < 0.001
    && desktop.swingGrab.headDistance <= 14
    && desktop.swingGrab.carriageDistance > desktop.swingGrab.headDistance + 1,
  loadedAttachmentAndDrop: desktop.carrySettle.strongSwingState === 'carrying'
    && desktop.carrySettle.releaseFrame > 1
    && Math.abs(desktop.carrySettle.releaseAngle) <= desktop.carrySettle.maxDropAngle
    && Math.abs(desktop.carrySettle.releaseVelocity) <= desktop.carrySettle.maxDropVelocity
    && desktop.carrySettle.attachmentFollowedSwing
    && desktop.carrySettle.initialAttachmentError < 0.0001
    && desktop.carrySettle.movedAttachmentError < 0.0001
    && Math.abs(desktop.carrySettle.chuteX - 112) <= 8
    && desktop.carrySettle.chuteSensorTriggered
    && desktop.carrySettle.prizeCollected,
  mobileRight: mobile.coast >= 0 && mobile.coast <= 3
    && Math.abs(mobile.stoppedVelocity) < 0.01
    && mobile.swingVelocity > 0 && mobile.headXDelta > 0
    && mobile.cableDisplacement === 0,
  mobileLeft: mobile.leftCoast <= 0 && mobile.leftCoast >= -3
    && Math.abs(mobile.leftVelocity) < 0.01
    && mobile.leftSwingVelocity < 0 && mobile.leftHeadXDelta < 0
    && mobile.leftCableDisplacement === 0
    && mobile.turnsAfterGrab === mobile.turnsBeforeGrab - 1,
  consoleClean: errors.length === 0,
};
const valid = Object.values(checks).every(Boolean);
const summary = {
  desktop: {
    holdRight: { coast: desktop.holdRight.coast, peakDegrees: degrees(desktop.holdRight.peakAngle), reversals: desktop.holdRight.reversals, latePeakDegrees: degrees(desktop.holdRight.latePeak) },
    holdLeft: { coast: desktop.holdLeft.coast, peakDegrees: degrees(desktop.holdLeft.peakAngle), reversals: desktop.holdLeft.reversals },
    taps: { rightDegrees: degrees(desktop.tapRight.peakAngle), leftDegrees: degrees(desktop.tapLeft.peakAngle) },
    rapidReversal: { leftToRight: desktop.rapidLeftToRight.afterReverse.velocity, rightToLeft: desktop.rapidRightToLeft.afterReverse.velocity },
    frameRatePeakDegrees: desktop.frameRateRuns.map((run) => ({ rate: run.rate, peak: degrees(run.peakAngle) })),
    transform: desktop.transform,
    tiltedGrab: desktop.swingGrab,
    carryAndChute: desktop.carrySettle,
    configuredMaxAngleDegrees: degrees(desktop.configuredMaxAngle),
    configuredMaxCoast: desktop.configuredMaxCoast,
  },
  mobile,
  errors,
  checks,
  valid,
};

console.log(JSON.stringify(summary, null, 2));
socket.close();
if (!valid) process.exitCode = 1;
