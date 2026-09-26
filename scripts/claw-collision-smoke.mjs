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
  const { DEBUG_CLAW_COLLIDERS } = await import('/js/config/gameConfig.js');
  document.querySelector('#start-game-btn').click();
  game.loop.stop();

  const prizes = game.state.prizes;
  const activateOnly = (...active) => prizes.forEach((prize) => {
    prize.collected = !active.includes(prize);
    if (!prize.collected) {
      prize.state = 'idle';
      prize.rotation = 0;
      prize.velocityX = 0;
      prize.velocityY = 0;
      prize.angularVelocity = 0;
      prize.isSleeping = true;
      prize.sleepTimer = 720;
    }
  });
  const placeCenter = (prize, x, y) => {
    prize.x = x - prize.width / 2;
    prize.y = y - prize.height / 2;
    game.physics.updateGeometry(prize);
  };

  const light = prizes.find((prize) => prize.name === 'Pikachu');
  const heavy = prizes.find((prize) => prize.name === 'Bulbasaur');
  activateOnly(light, heavy);
  game.claw.x = 360;
  game.claw.y = 400;
  game.claw.openAmount = 1;
  game.claw.swingAngle = 0;
  game.grab.resetClawContacts();
  const openColliders = game.claw.updateColliderGeometry();
  const penetration = 8;
  placeCenter(
    light,
    openColliders.leftProng.bx - (light.bodyRadius + openColliders.leftProng.radius - penetration),
    openColliders.leftProng.by,
  );
  placeCenter(
    heavy,
    openColliders.rightProng.bx + (heavy.bodyRadius + openColliders.rightProng.radius - penetration),
    openColliders.rightProng.by,
  );
  const beforeSeparation = { lightX: light.centerX, heavyX: heavy.centerX };
  const descentContacts = game.physics.resolveClawCollisions(game.claw, {
    phase: 'descending', velocityY: 500,
  });
  game.grab.recordClawContacts(descentContacts);
  const separation = {
    lightDelta: light.centerX - beforeSeparation.lightX,
    heavyDelta: heavy.centerX - beforeSeparation.heavyX,
    lightVelocity: light.velocityX,
    heavyVelocity: heavy.velocityX,
    lightAngularVelocity: light.angularVelocity,
    heavyAngularVelocity: heavy.angularVelocity,
    contactCount: descentContacts.length,
  };
  game.claw.openAmount = 0;
  const missSelection = game.grab.selectPrizeFromClosedClaw();

  const target = prizes.find((prize) => prize.name === 'Clefairy');
  activateOnly(target);
  game.claw.x = 360;
  game.claw.y = 470;
  game.claw.openAmount = 1;
  game.claw.swingAngle = 0;
  game.grab.resetClawContacts();
  const initialZone = game.claw.getGrabZone();
  placeCenter(target, initialZone.x, initialZone.y);
  let maximumSpeed = 0;
  let closingContacts = 0;
  for (let frame = 1; frame <= 12; frame += 1) {
    const previousOpen = game.claw.openAmount;
    const progress = frame / 12;
    const eased = progress * progress * (3 - 2 * progress);
    game.claw.openAmount = 1 - eased;
    const closingSpeed = (previousOpen - game.claw.openAmount) * 9 * 0.84 / (1 / 60);
    const contacts = game.physics.resolveClawCollisions(game.claw, {
      phase: 'closing', velocityY: 0, closingSpeed,
    });
    closingContacts += contacts.length;
    game.grab.recordClawContacts(contacts);
    game.physics.update(16.667);
    maximumSpeed = Math.max(maximumSpeed, Math.hypot(target.velocityX, target.velocityY));
  }
  const selected = game.grab.selectPrizeFromClosedClaw();
  const originalRandom = Math.random;
  Math.random = () => 0.99;
  const secured = game.grab.securePrize(selected, performance.now());
  Math.random = originalRandom;
  const success = {
    selected: selected?.prize.name,
    secured,
    currentGrab: game.claw.currentGrab?.pokemon.name,
    contacted: game.claw.contactCandidates.has(target),
    closingContacts,
    maximumSpeed,
    finalAngularVelocity: target.angularVelocity,
  };

  game.claw.reset();
  game.claw.openAmount = 1;
  game.claw.swingAngle = 0;
  const descentLimitAt = (x) => {
    game.claw.x = x;
    game.claw.y = game.claw.homeY;
    const limit = game.physics.getClawDescentLimit(game.claw, 470);
    game.claw.y = limit;
    return { limit, bottom: game.claw.getColliderBounds().bottom };
  };
  const chuteSafety = {
    home: descentLimitAt(112),
    divider: descentLimitAt(190),
    dividerTop: game.chute.divider.y,
  };

  return {
    separation,
    miss: {
      selected: missSelection?.prize.name || null,
      boardChanged: Math.abs(separation.lightDelta) > 0.1 || Math.abs(separation.heavyDelta) > 0.1,
    },
    success,
    chuteSafety,
    debugDefault: DEBUG_CLAW_COLLIDERS,
  };
})()`);

const valid = result.separation.contactCount >= 2
  && result.separation.lightDelta < 0
  && result.separation.heavyDelta > 0
  && Math.abs(result.separation.lightVelocity) > Math.abs(result.separation.heavyVelocity)
  && Math.abs(result.separation.lightDelta) > Math.abs(result.separation.heavyDelta)
  && Math.abs(result.separation.lightAngularVelocity) > 0.01
  && Math.abs(result.separation.heavyAngularVelocity) > 0.01
  && result.miss.selected === null
  && result.miss.boardChanged
  && result.success.selected === 'Clefairy'
  && result.success.secured
  && result.success.currentGrab === 'Clefairy'
  && result.success.contacted
  && result.success.closingContacts > 0
  && result.success.maximumSpeed < 72
  && result.chuteSafety.home.limit === 470
  && result.chuteSafety.divider.limit < 470
  && result.chuteSafety.divider.bottom <= result.chuteSafety.dividerTop - 2
  && result.debugDefault === false
  && errors.length === 0;

console.log(JSON.stringify({ result, errors, valid }, null, 2));
socket.close();
if (!valid) process.exitCode = 1;
