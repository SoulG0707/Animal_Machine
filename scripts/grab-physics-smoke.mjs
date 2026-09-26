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
  const { DIFFICULTY_SETTINGS } = await import('/js/config/difficultyConfig.js');
  document.querySelector('#start-game-btn').click();
  await new Promise((resolve) => setTimeout(resolve, 100));

  const metadataComplete = game.state.prizes.every((prize) =>
    Number.isFinite(prize.weight)
    && Number.isFinite(prize.grip)
    && prize.centerOfMassX >= 0 && prize.centerOfMassX <= 1
    && prize.centerOfMassY >= 0 && prize.centerOfMassY <= 1
    && prize.mass === prize.weight
  );

  const measure = (name, offsetRatio) => {
    const prize = game.state.prizes.find((candidate) => candidate.name === name);
    prize.rotation = 0;
    game.physics.updateGeometry(prize);
    game.claw.swingAngle = 0;
    game.claw.x = prize.worldCenterOfMassX;
    game.claw.y = prize.worldCenterOfMassY - 31;
    const centered = game.grab.evaluateGrab(prize);
    game.claw.x += centered.horizontalReach * offsetRatio;
    const offset = game.grab.evaluateGrab(prize);
    const chances = Object.fromEntries(Object.entries(DIFFICULTY_SETTINGS).map(([mode, settings]) => [
      mode,
      {
        centered: game.grab.calculateGrip(prize, centered, settings).slipChance,
        offset: game.grab.calculateGrip(prize, offset, settings).slipChance,
      },
    ]));
    return {
      prize,
      centered,
      offset,
      chances,
      centeredMotion: game.grab.getMotionProfile(prize, centered.grabQuality),
      offsetMotion: game.grab.getMotionProfile(prize, offset.grabQuality),
    };
  };

  const pikachu = measure('Pikachu', 0.62);
  const bulbasaur = measure('Bulbasaur', 0.62);

  const prize = pikachu.prize;
  game.claw.x = prize.worldCenterOfMassX + pikachu.offset.horizontalReach * 0.62;
  game.claw.y = prize.worldCenterOfMassY - 31;
  game.claw.carryOffsetX = 0;
  game.claw.carryOffsetY = prize.centerY - game.claw.y;
  game.claw.swingAngle = 0.025;
  game.claw.state = 'carrying';
  prize.rotation = 0;
  prize.state = 'grabbed';
  const startedAt = performance.now();
  game.claw.grabStartedAt = startedAt;
  game.claw.currentGrab = {
    pokemon: prize,
    grabQuality: pikachu.offset.grabQuality,
    targetTilt: pikachu.offset.targetTilt,
    swingMultiplier: pikachu.offsetMotion.swingMultiplier,
    dynamicTiltAmplitude: 0.02,
    lastPoseTime: startedAt,
  };
  for (let frame = 1; frame <= 30; frame += 1) game.grab.updateCarriedPrize(startedAt + frame * 16.667);
  const carriedRotation = prize.rotation;
  const carriedAngularVelocity = prize.angularVelocity;

  const beforeSlip = { rotation: prize.rotation, angularVelocity: prize.angularVelocity };
  const originalRandom = Math.random;
  Math.random = () => 0.5;
  game.grab.releaseSlippedPrize();
  Math.random = originalRandom;
  const afterSlip = {
    rotation: prize.rotation,
    angularVelocity: prize.angularVelocity,
    velocityY: prize.velocityY,
    state: prize.state,
  };

  return {
    metadataComplete,
    pokemonCount: game.state.prizes.length,
    pikachu: {
      weight: pikachu.prize.weight,
      grip: pikachu.prize.grip,
      centerQuality: pikachu.centered.grabQuality,
      centerPerfect: pikachu.centered.perfect,
      centerTiltDegrees: pikachu.centered.targetTilt * 180 / Math.PI,
      offsetQuality: pikachu.offset.grabQuality,
      offsetPerfect: pikachu.offset.perfect,
      offsetTiltDegrees: pikachu.offset.targetTilt * 180 / Math.PI,
      chances: pikachu.chances,
      motion: pikachu.offsetMotion,
    },
    bulbasaur: {
      weight: bulbasaur.prize.weight,
      grip: bulbasaur.prize.grip,
      chances: bulbasaur.chances,
      motion: bulbasaur.offsetMotion,
    },
    carriedRotation,
    carriedAngularVelocity,
    beforeSlip,
    afterSlip,
  };
})()`);

const pikachuChances = result.pikachu.chances;
const bulbasaurChances = result.bulbasaur.chances;
const valid = result.metadataComplete
  && result.pokemonCount === 15
  && result.pikachu.centerQuality === 1
  && result.pikachu.centerPerfect
  && Math.abs(result.pikachu.centerTiltDegrees) < 0.01
  && result.pikachu.offsetQuality < result.pikachu.centerQuality
  && !result.pikachu.offsetPerfect
  && Math.abs(result.pikachu.offsetTiltDegrees) >= 10
  && pikachuChances.easy.centered < pikachuChances.medium.centered
  && pikachuChances.medium.centered < pikachuChances.hard.centered
  && pikachuChances.easy.offset < pikachuChances.medium.offset
  && pikachuChances.medium.offset < pikachuChances.hard.offset
  && pikachuChances.medium.centered < pikachuChances.medium.offset
  && bulbasaurChances.medium.centered > pikachuChances.medium.centered
  && result.bulbasaur.motion.liftSpeedMultiplier < result.pikachu.motion.liftSpeedMultiplier
  && result.bulbasaur.motion.carrySpeedMultiplier < result.pikachu.motion.carrySpeedMultiplier
  && result.bulbasaur.motion.swingMultiplier > result.pikachu.motion.swingMultiplier
  && Math.abs(result.carriedRotation) > 0.08
  && Math.abs(result.afterSlip.rotation - result.beforeSlip.rotation) < 0.0001
  && Math.abs(result.afterSlip.angularVelocity) > 0.01
  && result.afterSlip.velocityY > 0
  && result.afterSlip.state === 'slipping'
  && errors.length === 0;

console.log(JSON.stringify({ result, errors, valid }, null, 2));
socket.close();
if (!valid) process.exitCode = 1;
