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

await send('Runtime.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.reload', { ignoreCache: true });
await new Promise((resolve) => setTimeout(resolve, 900));

const result = await evaluate(`(async () => {
  const { game } = await import('/js/main.js');
  document.querySelector('#start-game-btn').click();
  await new Promise((resolve) => setTimeout(resolve, 100));
  const actualRandom = Math.random;

  const run = ({ seed, angle = 0, aimOffset = 0, species = null, isolated = false, miss = false }) => {
    let randomState = seed;
    Math.random = () => {
      randomState = (1664525 * randomState + 1013904223) >>> 0;
      return randomState / 4294967296;
    };
    game.resetGame();
    game.loop.stop();
    game.state.appState = 'playing';
    Math.random = actualRandom;

    const target = species
      ? game.state.prizes.find((prize) => prize.name === species)
      : game.state.prizes
        .filter((prize) => prize.centerX > 210 && prize.centerX < 480)
        .sort((first, second) => first.centerY - second.centerY)[0];
    if (isolated) {
      game.state.prizes.forEach((prize) => { prize.collected = prize !== target; });
      target.state = 'idle';
      target.rotation = 0;
      target.angularVelocity = 0;
      target.velocityX = 0;
      target.velocityY = 0;
      target.x = 330 - target.width / 2;
      target.y = 545 - target.height - 4;
      game.physics.updateGeometry(target);
    }
    game.claw.x = target.worldCenterOfMassX + aimOffset + (miss ? 180 : 0);
    game.claw.swingAngle = angle;
    game.claw.swingVelocity = 0;
    const targetBefore = {
      name: target.name, x: target.x, y: target.y,
      centerX: target.centerX, centerY: target.centerY,
      bodyRadius: target.bodyRadius,
    };

    let firstContact = null;
    let close = null;
    let firstGrab = null;
    let selectedTarget = null;
    const originalEmit = game.grab.emitHook.bind(game.grab);
    game.grab.emitHook = (name, payload) => {
      if (name === 'onClawContact' && !firstContact) {
        const zone = game.claw.getGrabZone();
        const dx = payload.prize.worldCenterOfMassX - zone.x;
        const dy = payload.prize.worldCenterOfMassY - zone.y;
        const localX = dx * zone.axisX + dy * zone.axisY;
        const localY = -dx * zone.axisY + dy * zone.axisX;
        firstContact = {
          prize: payload.prize.name,
          collider: payload.colliderId,
          clawY: game.claw.y,
          zoneY: zone.y,
          prizeCenterY: payload.prize.centerY,
          localX, localY,
          betweenProngs: Math.abs(localX) <= zone.halfWidth,
          inZone: Math.abs(localX) <= zone.halfWidth + payload.prize.bodyRadius
            && Math.abs(localY) <= zone.halfHeight + payload.prize.bodyRadius,
        };
      }
      originalEmit(name, payload);
    };
    const originalSelect = game.grab.selectPrizeFromClosedClaw.bind(game.grab);
    game.grab.selectPrizeFromClosedClaw = () => {
      if (game.claw.state !== 'closing') return originalSelect();
      const zone = game.claw.getGrabZone();
      const detection = game.grab.getGripPoint();
      const carry = game.claw.getCarryAttachmentPoint();
      const options = game.state.prizes.filter((prize) => game.physics.isPhysicsPrize(prize)).map((prize) => {
        const dx = prize.worldCenterOfMassX - zone.x;
        const dy = prize.worldCenterOfMassY - zone.y;
        const localX = dx * zone.axisX + dy * zone.axisY;
        const localY = -dx * zone.axisY + dy * zone.axisX;
        const inZone = Math.abs(localX) <= zone.halfWidth + prize.bodyRadius
          && Math.abs(localY) <= zone.halfHeight + prize.bodyRadius;
        const blockers = game.physics.getApproachBlockers(prize, {
          x: game.claw.headX,
          y: game.claw.homeY - 7 + Math.cos(game.claw.swingAngle) * 22,
        });
        return {
          name: prize.name, inZone, contacted: game.claw.contactCandidates.has(prize),
          blockers: blockers.map((blocker) => blocker.name), dx, dy,
        };
      });
      const selected = originalSelect();
      selectedTarget = selected?.prize || null;
      close = {
        clawX: game.claw.x, clawY: game.claw.y,
        pivotX: game.claw.pivotX, pivotY: game.claw.pivotY,
        collisionX: game.claw.colliders.head.x,
        collisionY: game.claw.colliders.head.y,
        detectionX: detection.x, detectionY: detection.y,
        carryX: carry.x, carryY: carry.y,
        contactCount: game.claw.contactCandidates.size,
        candidateCount: options.filter((option) => option.inZone && option.blockers.length === 0).length,
        selected: selected?.prize.name || null,
        perfect: selected?.evaluation.perfect ?? false,
        distance: selected?.evaluation.normalizedDistance ?? null,
        targetAtClose: options.find((option) => option.name === target.name),
        nearby: options.filter((option) => option.inZone || option.contacted),
      };
      return selected;
    };
    const originalSecure = game.grab.securePrize.bind(game.grab);
    game.grab.securePrize = (candidate, time) => {
      const secured = originalSecure(candidate, time);
      close.carriedPokemonId = game.claw.currentGrab?.pokemon.name || null;
      close.collisionResult = close.contactCount > 0;
      return secured;
    };

    Math.random = () => 0.99;
    const started = game.grab.attempt();
    const transitions = [game.claw.state];
    let priorState = game.claw.state;
    const startTime = performance.now();
    for (let frame = 1; frame < 720; frame += 1) {
      const time = startTime + frame * 1000 / 60;
      if (angle !== 0 && ['descending', 'closing'].includes(game.claw.state)) game.claw.swingAngle = angle;
      else game.claw.updateSwing(1 / 60);
      game.grab.update(time, 1000 / 60);
      game.grab.updateCarriedPrize(time);
      game.physics.update(1000 / 60);
      if (game.claw.state !== priorState) {
        transitions.push(game.claw.state);
        priorState = game.claw.state;
      }
      if (game.claw.currentGrab && !firstGrab) {
        const grabbed = game.claw.currentGrab.pokemon;
        const point = game.claw.getCarryAttachmentPoint();
        const anchor = grabbed.getGrabAnchorOffset();
        firstGrab = {
          name: grabbed.name,
          sameAsSelected: grabbed === selectedTarget,
          sameAsRendered: game.claw.caught === grabbed,
          y: grabbed.y,
          pivotY: game.claw.pivotY,
          anchorError: Math.hypot(grabbed.centerX + anchor.x - point.x, grabbed.centerY + anchor.y - point.y),
        };
      }
      if (game.claw.state === 'ready' && frame > 1) break;
    }
    Math.random = actualRandom;
    game.grab.emitHook = originalEmit;
    game.grab.selectPrizeFromClosedClaw = originalSelect;
    game.grab.securePrize = originalSecure;
    return {
      seed, angle, aimOffset, species, isolated, miss, started, targetBefore, firstContact,
      close, firstGrab, transitions,
      caught: game.state.caughtThisGame,
      turns: game.state.turns,
    };
  };

  return [
    run({ seed: 127 }),
    run({ seed: 777 }),
    run({ seed: 1203 }),
    run({ seed: 2001, species: 'Mewtwo', isolated: true }),
    run({ seed: 2002, species: 'Cyndaquil', isolated: true }),
    run({ seed: 2003, species: 'Pikachu', isolated: true, angle: 0.16 }),
    run({ seed: 2004, species: 'Pikachu', isolated: true, angle: -0.16 }),
    run({ seed: 2005, species: 'Pikachu', isolated: true, aimOffset: -12 }),
    run({ seed: 2006, species: 'Pikachu', isolated: true, aimOffset: 12 }),
    run({ seed: 2007, species: 'Pikachu', isolated: true, miss: true }),
  ];
})()`);

const checks = result.map((run) => ({
  seed: run.seed,
  species: run.species || run.targetBefore.name,
  angle: run.angle,
  aimOffset: run.aimOffset,
  miss: run.miss,
  contactCount: run.close?.contactCount ?? 0,
  candidateCount: run.close?.candidateCount ?? 0,
  selected: run.close?.selected || null,
  carried: run.close?.carriedPokemonId || null,
  caught: run.caught,
  anchorError: run.firstGrab?.anchorError ?? null,
  valid: run.started && (run.miss
    ? !run.firstGrab && run.caught === 0
    : run.close?.candidateCount > 0
      && run.close.selected === run.firstGrab?.name
      && run.firstGrab.sameAsSelected
      && run.firstGrab.sameAsRendered
      && run.firstGrab.y > run.firstGrab.pivotY
      && run.firstGrab.anchorError < 0.001
      && run.caught === 1),
}));
await send('Emulation.setDeviceMetricsOverride', {
  width: 390, height: 844, deviceScaleFactor: 3, mobile: true,
  screenWidth: 390, screenHeight: 844,
});
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
await send('Page.reload', { ignoreCache: true });
await new Promise((resolve) => setTimeout(resolve, 900));
const mobileSetup = await evaluate(`(async () => {
  const { game } = await import('/js/main.js');
  document.querySelector('#start-game-btn').click();
  await new Promise((resolve) => setTimeout(resolve, 100));
  game.resetGame();
  game.state.appState = 'playing';
  const target = game.state.prizes.find((prize) => prize.name === 'Pikachu');
  game.state.prizes.forEach((prize) => { prize.collected = prize !== target; });
  target.state = 'idle';
  target.rotation = 0;
  target.velocityX = 0;
  target.velocityY = 0;
  target.angularVelocity = 0;
  target.isSleeping = true;
  target.x = 330 - target.width / 2;
  target.y = 545 - target.height - 4;
  game.physics.updateGeometry(target);
  game.claw.x = target.worldCenterOfMassX;
  game.claw.swingAngle = 0;
  game.claw.swingVelocity = 0;
  window.__mobileGrabTarget = target;
  const originalSelect = game.grab.selectPrizeFromClosedClaw.bind(game.grab);
  game.grab.selectPrizeFromClosedClaw = () => {
    const candidate = originalSelect();
    if (game.claw.state === 'closing') window.__mobileSelected = candidate?.prize || null;
    return candidate;
  };
  window.__mobileRandom = Math.random;
  Math.random = () => 0.99;
  const button = document.querySelector('#drop-btn');
  button.scrollIntoView({ block: 'center' });
  const rect = button.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, turns: game.state.turns };
})()`);
await send('Input.dispatchTouchEvent', {
  type: 'touchStart',
  touchPoints: [{ x: mobileSetup.x, y: mobileSetup.y, radiusX: 4, radiusY: 4, force: 1 }],
});
await new Promise((resolve) => setTimeout(resolve, 40));
await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
const mobile = await evaluate(`(async () => {
  const { game } = await import('/js/main.js');
  const startedAt = performance.now();
  let firstGrab = null;
  while (performance.now() - startedAt < 10000) {
    const grabbed = game.claw.currentGrab?.pokemon;
    if (grabbed && !firstGrab) {
      const point = game.claw.getCarryAttachmentPoint();
      const anchor = grabbed.getGrabAnchorOffset();
      firstGrab = {
        name: grabbed.name,
        sameAsSelected: grabbed === window.__mobileSelected,
        sameAsRendered: grabbed === game.claw.caught,
        belowPivot: grabbed.y > game.claw.pivotY,
        anchorError: Math.hypot(grabbed.centerX + anchor.x - point.x, grabbed.centerY + anchor.y - point.y),
      };
    }
    if (game.claw.state === 'ready' && game.state.grabAttemptId > 0) break;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  Math.random = window.__mobileRandom;
  return {
    attemptId: game.state.grabAttemptId,
    selected: window.__mobileSelected?.name || null,
    targetName: window.__mobileGrabTarget.name,
    targetCollected: window.__mobileGrabTarget.collected,
    sameTarget: window.__mobileSelected === window.__mobileGrabTarget,
    firstGrab,
    caught: game.state.caughtThisGame,
    state: game.claw.state,
  };
})()`);
const mobileValid = mobile.attemptId === 1
  && mobile.selected === mobile.targetName
  && mobile.sameTarget
  && mobile.firstGrab?.sameAsSelected
  && mobile.firstGrab.sameAsRendered
  && mobile.firstGrab.belowPivot
  && mobile.firstGrab.anchorError < 0.001
  && mobile.caught === 1
  && mobile.targetCollected
  && mobile.state === 'ready';
console.log(JSON.stringify({
  checks, mobile, errors,
  valid: checks.every((check) => check.valid) && mobileValid && errors.length === 0,
}, null, 2));
await send('Page.reload', { ignoreCache: true });
socket.close();
if (!checks.every((check) => check.valid) || !mobileValid || errors.length) process.exitCode = 1;
