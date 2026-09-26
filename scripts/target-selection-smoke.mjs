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
await send('Emulation.setDeviceMetricsOverride', {
  width: 1440, height: 900, deviceScaleFactor: 1, mobile: false,
});
await send('Page.reload', { ignoreCache: true });
await new Promise((resolve) => setTimeout(resolve, 900));

const result = await evaluate(`(async () => {
  const { game } = await import('/js/main.js');
  document.querySelector('#start-game-btn').click();
  game.loop.stop();

  const prizes = game.state.prizes;
  const top = prizes.find((prize) => prize.name === 'Pikachu');
  const middle = prizes.find((prize) => prize.name === 'Clefairy');
  const bottom = prizes.find((prize) => prize.name === 'Bulbasaur');

  const activateOnly = (...active) => prizes.forEach((prize) => {
    prize.collected = !active.includes(prize);
    if (prize.collected) return;
    Object.assign(prize, {
      state: 'idle', rotation: 0, velocityX: 0, velocityY: 0,
      angularVelocity: 0, isSleeping: true, sleepTimer: 720,
    });
  });
  const placeCenter = (prize, x, y) => {
    prize.x = x - prize.width / 2;
    prize.y = y - prize.height / 2;
    game.physics.updateGeometry(prize);
  };
  const prepareClaw = () => {
    game.claw.x = 360;
    game.claw.y = 450;
    game.claw.openAmount = 0;
    game.claw.swingAngle = 0;
    game.claw.swingVelocity = 0;
    game.grab.resetClawContacts();
    return game.claw.getGrabZone();
  };
  const contact = (prize, phase = 'descending') => game.grab.recordClawContacts([{
    prize, colliderId: phase === 'descending' ? 'head' : 'left-prong', penetration: 1, phase,
  }], phase);

  activateOnly(top, bottom);
  let zone = prepareClaw();
  placeCenter(top, zone.x + 7, zone.y - 20);
  placeCenter(bottom, zone.x, zone.y + 14);
  contact(top, 'descending');
  contact(bottom, 'closing');
  const twoStackCandidate = game.grab.selectPrizeFromClosedClaw();
  const twoStack = {
    selected: twoStackCandidate?.prize.name || null,
    firstContact: game.claw.contactHistory.get(top)?.firstFrame,
    lowerContact: game.claw.contactHistory.get(bottom)?.firstFrame,
    topQuality: game.grab.evaluateGrab(top).grabQuality,
    bottomQuality: game.grab.evaluateGrab(bottom).grabQuality,
    bottomBlockedByTop: game.physics.getApproachBlockers(
      bottom, { x: game.claw.headX, y: game.claw.homeY },
    ).includes(top),
  };

  activateOnly(top, middle, bottom);
  zone = prepareClaw();
  placeCenter(top, zone.x + 5, zone.y - 24);
  placeCenter(middle, zone.x - 3, zone.y - 4);
  placeCenter(bottom, zone.x, zone.y + 17);
  contact(top, 'descending');
  contact(middle, 'descending');
  contact(bottom, 'closing');
  const threeStackCandidate = game.grab.selectPrizeFromClosedClaw();
  const threeStack = {
    selected: threeStackCandidate?.prize.name || null,
    middleBlocked: game.physics.getApproachBlockers(
      middle, { x: game.claw.headX, y: game.claw.homeY },
    ).includes(top),
    bottomBlockers: game.physics.getApproachBlockers(
      bottom, { x: game.claw.headX, y: game.claw.homeY },
    ).map((prize) => prize.name),
  };

  activateOnly(top, bottom);
  zone = prepareClaw();
  placeCenter(bottom, zone.x, zone.y + 8);
  placeCenter(top, zone.x + top.bodyRadius + bottom.bodyRadius + 10, zone.y - 20);
  contact(top, 'descending');
  contact(bottom, 'closing');
  const exposedLowerCandidate = game.grab.selectPrizeFromClosedClaw();
  const exposedLower = {
    selected: exposedLowerCandidate?.prize.name || null,
    blockers: game.physics.getApproachBlockers(
      bottom, { x: game.claw.headX, y: game.claw.homeY },
    ).map((prize) => prize.name),
    topStillFirstContact: game.claw.contactHistory.get(top)?.firstFrame
      < game.claw.contactHistory.get(bottom)?.firstFrame,
  };

  return { twoStack, threeStack, exposedLower };
})()`);

const valid = result.twoStack.selected === 'Pikachu'
  && result.twoStack.firstContact < result.twoStack.lowerContact
  && result.twoStack.topQuality < result.twoStack.bottomQuality
  && result.twoStack.bottomBlockedByTop
  && result.threeStack.selected === 'Pikachu'
  && result.threeStack.middleBlocked
  && result.threeStack.bottomBlockers.includes('Pikachu')
  && result.exposedLower.selected === 'Bulbasaur'
  && result.exposedLower.blockers.length === 0
  && result.exposedLower.topStillFirstContact
  && errors.length === 0;

console.log(JSON.stringify({ result, errors, valid }, null, 2));
socket.close();
if (!valid) process.exitCode = 1;
