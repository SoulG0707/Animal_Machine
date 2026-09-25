const canvas = document.querySelector('#game-canvas');
const context = canvas.getContext('2d');
context.imageSmoothingEnabled = true;
context.imageSmoothingQuality = 'high';

const scoreElement = document.querySelector('#score');
const turnsElement = document.querySelector('#turns');
const bestScoreElement = document.querySelector('#best-score');
const prizeCountElement = document.querySelector('#prize-count');
const statusText = document.querySelector('#status-text');
const machineMessage = document.querySelector('#machine-message');
const canvasFrame = document.querySelector('.canvas-frame');
const turnPips = document.querySelector('#turn-pips');
const machineElement = document.querySelector('.machine');
const characterList = document.querySelector('#character-list');
const characterDetail = document.querySelector('#character-detail');
const gameCompleteOverlay = document.querySelector('#game-complete-overlay');
const finalScoreElement = document.querySelector('#final-score');
const modalBestScoreElement = document.querySelector('#modal-best-score');
const modalCaughtElement = document.querySelector('#modal-caught');
const modalComboElement = document.querySelector('#modal-combo');
const modalNewPokemonElement = document.querySelector('#modal-new-pokemon');
const newBestBadge = document.querySelector('#new-best-badge');
const playAgainButton = document.querySelector('#play-again-btn');
const leftButton = document.querySelector('#left-btn');
const rightButton = document.querySelector('#right-btn');
const dropButton = document.querySelector('#drop-btn');
const controlActions = document.querySelector('.control-actions');
const comboDisplay = document.querySelector('#combo-display');
const missionCard = document.querySelector('.mission-card');
const missionCopy = document.querySelector('#mission-copy');
const missionProgressText = document.querySelector('#mission-progress');
const missionState = document.querySelector('#mission-state');
const missionFill = document.querySelector('#mission-fill');
const trainerLevelElement = document.querySelector('#trainer-level');

const machine = { width: canvas.width, height: canvas.height, floorY: 545 };
const GameState = Object.freeze({
  READY: 'ready',
  DESCENDING: 'descending',
  CLOSING: 'closing',
  LIFTING: 'lifting',
  CARRYING: 'carrying',
  RELEASING: 'releasing',
  WAITING_FOR_CHUTE: 'waiting-for-chute',
  SLIPPING: 'slipping',
  RETURNING: 'returning',
  GAME_OVER: 'game-over',
});
const PokemonState = Object.freeze({
  IDLE: 'idle',
  GRABBED: 'grabbed',
  SLIPPING: 'slipping',
  FALLING: 'falling',
  SETTLING: 'settling',
  DROPPING_TO_CHUTE: 'dropping-to-chute',
  CAUGHT: 'caught',
});
const GRIP_MISS_MIN = 0.4;
const GRIP_MISS_MAX = 0.9;
const TEASING_MESSAGE_CHANCE = 0.9;
const PHYSICS = Object.freeze({
  gravity: 1080,
  restitution: 0.12,
  wallRestitution: 0.16,
  floorFriction: 0.86,
  airFriction: 0.994,
  angularDamping: 0.975,
  maxAngularVelocity: 1.35,
  sleepSpeed: 7,
  sleepAngularSpeed: 0.09,
  sleepDelay: 720,
  solverIterations: 4,
  maxStep: 1 / 90,
});
const GRAVITY = PHYSICS.gravity;
const encouragingMessages = [
  'Cố lên! Sắp gắp được {name} rồi!',
  'Một chút nữa thôi!',
  'Gần lắm rồi!',
];
const teasingMessages = [
  'Ui, có thế cũng hụt à, gà =))))',
  'Ơ kìa, tới miệng còn rớt =))))',
  'Càng gắp phản chủ rồi =))))',
  'Ủa alo? Rớt thật luôn cha =)))',
  '{name}: bắt được tôi còn lâu nhé!',
  'Úi gà thía =)))))',
  'Ê =)))))',
  'Gắp mà rớt, gà quá =))))',
  'Thua rồi =))))',
];
const CLAW_SCALE = 0.84;
const PRIZE_SCALE = 0.8;
const CLAW_LANE_BOTTOM = 136;
canvasFrame.style.setProperty('--claw-lane-height', (CLAW_LANE_BOTTOM / machine.height * 100) + '%');
const PRIZE_AREA_PADDING = 12;
const SHINY_CHANCE = 0.018;
const EXPERIENCE_PER_LEVEL = 250;
const STORAGE_KEYS = {
  best: 'animal-machine-best',
  collection: 'pokemon-machine-pokedex',
  trainerXp: 'pokemon-machine-trainer-xp',
};
const characterAssets = [
  { name: 'Pikachu', path: 'character/Pikachu.svg', score: 50, rarity: 'epic' },
  { name: 'Bulbasaur', path: 'character/Bulbasaur.svg', score: 10, rarity: 'common' },
  { name: 'Charmander', path: 'character/Charmander.svg', score: 10, rarity: 'common' },
  { name: 'Vulpix', path: 'character/Vulpix.svg', score: 20, rarity: 'rare' },
  { name: 'Mewtwo', path: 'character/Mewtwo.svg', score: 70, rarity: 'legendary' },
  { name: 'Chikorita', path: 'character/Chikorita.svg', score: 10, rarity: 'common' },
  { name: 'Cyndaquil', path: 'character/Cyndaquil.svg', score: 10, rarity: 'common' },
  { name: 'Poliwag', path: 'character/Poliwag.svg', score: 10, rarity: 'common' },
  { name: 'Psyduck', path: 'character/Psyduck.svg', score: 10, rarity: 'common' },
  { name: 'Wartortle', path: 'character/Wartortle.svg', score: 20, rarity: 'rare' },
  { name: 'Arbok', path: 'character/Arbok.svg', score: -20, rarity: 'common' },
  { name: 'Clefairy', path: 'character/Clefairy.svg', score: 20, rarity: 'rare' },
  { name: 'Kingler', path: 'character/Kingler.svg', score: 20, rarity: 'rare' },
  { name: 'Meowth', path: 'character/Meowth.svg', score: -10, rarity: 'common' },
  { name: 'Ninetales', path: 'character/Ninetales.svg', score: 30, rarity: 'rare' },
];
const rarityColors = {
  common: '#52a879',
  rare: '#4b9dce',
  epic: '#a36ac7',
  legendary: '#e9ad35',
};
const fallbackColors = ['#e6464d', '#5cae75', '#f47b32', '#eab640', '#8064a9', '#72bb69', '#db6f35', '#4ea3b7'];
const spriteAspectRatios = {
  Bulbasaur: 730.616 / 729.493,
  Meowth: 1097.67 / 1260.96,
  Mewtwo: 1019.249 / 1419.975,
  Ninetales: 1086.06 / 1022.313,
  Pikachu: 723.9 / 940,
};
const prizeBounds = {
  left: PRIZE_AREA_PADDING,
  right: machine.width - PRIZE_AREA_PADDING,
  top: CLAW_LANE_BOTTOM + PRIZE_AREA_PADDING,
  bottom: machine.floorY - PRIZE_AREA_PADDING,
};
const prizeChute = {
  x: 38,
  width: 148,
  mouth: {
    x: 52,
    y: machine.floorY - 16,
    width: 120,
    height: 16,
  },
  tunnel: {
    x: 52,
    y: machine.floorY - 16,
    width: 120,
    bottom: machine.height - 38,
  },
  sensor: {
    x: 64,
    y: machine.height - 54,
    width: 96,
    height: 10,
  },
  walls: {
    left: {
      x: 38,
      y: machine.floorY - 24,
      width: 14,
      height: machine.height - machine.floorY + 12,
    },
    right: {
      x: 172,
      y: machine.floorY - 24,
      width: 14,
      height: machine.height - machine.floorY + 12,
    },
    leftLip: {
      x: 30,
      y: machine.floorY - 24,
      width: 22,
      height: 10,
    },
    rightLip: {
      x: 172,
      y: machine.floorY - 24,
      width: 22,
      height: 10,
    },
  },
  divider: {
    x: 186,
    y: machine.floorY - 160,
    width: 18,
    height: 160,
  },
  exclusion: {
    x: 18,
    y: machine.floorY - 160,
    width: 186,
    height: 172,
  },
  flash: 0,
};
const chuteCenterX = prizeChute.mouth.x + prizeChute.mouth.width / 2;
const CLAW_HOME_X = chuteCenterX;
const CLAW_HOME_Y = 76;
const claw = {
  x: CLAW_HOME_X,
  y: CLAW_HOME_Y,
  homeX: CLAW_HOME_X,
  homeY: CLAW_HOME_Y,
  width: 58,
  height: 28,
  targetY: CLAW_HOME_Y,
  state: GameState.READY,
  caught: null,
  currentGrab: null,
  openAmount: 1,
  phaseElapsed: 0,
  carryOffsetX: 0,
  grabOffsetX: 0,
  carryOffsetY: 0,
  grabStartedAt: 0,
  droppingPrize: null,
  dropGrab: null,
};
const ANIMATION = {
  descendSpeed: 500,
  liftSpeed: 520,
  carrySpeed: 430,
  returnSpeed: 440,
  closeDuration: 180,
  slipLoosenDuration: 110,
  dropOpenDuration: 140,
  chuteFadeDuration: 240,
};
const characterCards = new Map();

characterAssets.forEach((character) => {
  character.image = new Image();
  character.image.onload = () => { character.loaded = true; };
  character.image.src = encodeURI(character.path);
});

function readStorageItem(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function writeStorageItem(key, value) {
  try { localStorage.setItem(key, value); } catch { /* Storage can be disabled by the browser. */ }
}

function readStoredNumber(key, fallback = 0) {
  const stored = readStorageItem(key);
  if (stored === null || stored.trim() === '') return fallback;
  const value = Number(stored);
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : fallback;
}

function loadCollection() {
  let stored = {};
  try {
    const raw = readStorageItem(STORAGE_KEYS.collection);
    stored = raw ? JSON.parse(raw) : {};
  } catch {
    stored = {};
  }
  const counts = {};
  characterAssets.forEach((character) => {
    const value = Number(stored && stored[character.name]);
    counts[character.name] = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  });
  return counts;
}

let prizes = [];
let score = 0;
let turns = 5;
let bestScore = readStoredNumber(STORAGE_KEYS.best);
let trainerXp = readStoredNumber(STORAGE_KEYS.trainerXp);
let lastTime = 0;
let statusTimer;
let messageTimer;
let messageClearTimer;
let readyStatusPending = false;
let heldDirection = 0;
let newBestThisGame = false;
let currentCombo = 0;
let bestCombo = 0;
let caughtThisGame = 0;
let newUnlocksThisGame = [];
let sessionCaughtSpecies = new Set();
let selectedCharacter = characterAssets[0];
let mission = null;
let particles = [];
let grabAttemptId = 0;
const pokedexCounts = loadCollection();

function formatPoints(points) {
  return (points > 0 ? '+' : '') + points;
}

function trainerLevel(experience = trainerXp) {
  return Math.floor(experience / EXPERIENCE_PER_LEVEL) + 1;
}

function refreshTrainerLevel() {
  const level = trainerLevel();
  trainerLevelElement.textContent = 'LV ' + level;
  trainerLevelElement.title = trainerXp + ' XP · ' + (EXPERIENCE_PER_LEVEL - (trainerXp % EXPERIENCE_PER_LEVEL)) + ' XP to next level';
}

function showStatus(message, duration = 1500) {
  clearTimeout(statusTimer);
  readyStatusPending = false;
  statusText.classList.remove('status-pop');
  statusText.textContent = message;
  if (!message) return;
  void statusText.offsetWidth;
  statusText.classList.add('status-pop');
  statusTimer = setTimeout(() => {
    statusText.textContent = '';
    statusText.classList.remove('status-pop');
    if (readyStatusPending && claw.state === GameState.READY) {
      readyStatusPending = false;
      showStatus('READY', 900);
    }
  }, duration);
}

function hideMessage(immediate = false) {
  clearTimeout(messageTimer);
  clearTimeout(messageClearTimer);
  machineMessage.classList.remove('is-visible');
  machineMessage.setAttribute('aria-hidden', 'true');
  if (immediate) {
    machineMessage.textContent = '';
    delete machineMessage.dataset.tone;
    return;
  }
  messageClearTimer = setTimeout(() => {
    if (machineMessage.classList.contains('is-visible')) return;
    machineMessage.textContent = '';
    delete machineMessage.dataset.tone;
  }, 350);
}

function showMachineMessage(message, options = {}) {
  if (!message) {
    hideMessage();
    return;
  }
  const duration = Math.max(2500, Math.min(Number(options.duration) || 3200, 4000));
  const tone = options.tone === 'tease' ? 'tease' : 'encourage';
  clearTimeout(messageTimer);
  clearTimeout(messageClearTimer);
  machineMessage.classList.remove('is-visible');
  machineMessage.textContent = message;
  machineMessage.dataset.tone = tone;
  machineMessage.setAttribute('aria-hidden', 'false');
  void machineMessage.offsetWidth;
  machineMessage.classList.add('is-visible');
  messageTimer = setTimeout(() => hideMessage(), duration);
}

function showCharacterDetail(character) {
  const detail = document.createElement('span');
  const count = pokedexCounts[character.name] || 0;
  if (count === 0) {
    detail.textContent = 'LOCKED · Gắp Pokémon để mở khóa';
    detail.className = '';
  } else {
    const times = count === 1 ? 'time' : 'times';
    detail.textContent = character.name + ' · ' + character.rarity.toUpperCase() + ' · ' + formatPoints(character.score) + ' điểm · Caught ' + count + ' ' + times;
    detail.className = character.score < 0 ? 'is-penalty' : '';
  }
  characterDetail.replaceChildren(detail);
}

function buildCharacterGuide() {
  characterAssets.forEach((character, index) => {
    const button = document.createElement('button');
    const image = document.createElement('img');
    const countText = document.createElement('span');
    const newBadge = document.createElement('span');
    button.className = 'character-card';
    button.type = 'button';
    button.setAttribute('aria-pressed', String(index === 0));
    image.src = encodeURI(character.path);
    image.alt = '';
    image.width = 30;
    image.height = 30;
    image.draggable = false;
    countText.className = 'character-catch-count';
    newBadge.className = 'character-new-badge';
    newBadge.textContent = 'NEW';
    newBadge.hidden = true;
    button.append(image, countText, newBadge);
    button.addEventListener('click', () => {
      selectedCharacter = character;
      characterList.querySelectorAll('.character-card').forEach((card) => {
        card.setAttribute('aria-pressed', String(card === button));
      });
      showCharacterDetail(character);
    });
    characterList.append(button);
    characterCards.set(character.name, { button, image, countText, newBadge });
  });
  showCharacterDetail(selectedCharacter);
}

function updatePokedex() {
  let caughtSpecies = 0;
  characterAssets.forEach((character) => {
    const count = pokedexCounts[character.name] || 0;
    const card = characterCards.get(character.name);
    if (count > 0) caughtSpecies += 1;
    if (!card) return;
    const locked = count === 0;
    card.button.classList.toggle('is-locked', locked);
    card.button.title = locked ? 'LOCKED · Gắp để mở khóa Pokémon' : character.name + ' · ' + character.rarity.toUpperCase() + ' · ' + formatPoints(character.score) + ' điểm · ' + count + ' lần bắt';
    card.button.setAttribute('aria-label', locked ? 'Pokémon chưa mở khóa. Gắp Pokémon để mở khóa.' : character.name + ', ' + character.rarity + ', ' + formatPoints(character.score) + ' điểm, đã bắt ' + count + ' lần.');
    card.image.classList.toggle('is-locked', locked);
    card.countText.textContent = locked ? 'LOCKED' : '×' + count;
    card.newBadge.hidden = !character.newThisGame;
  });
  prizeCountElement.textContent = caughtSpecies + ' / ' + characterAssets.length + ' CAUGHT';
  if (selectedCharacter) showCharacterDetail(selectedCharacter);
}

function startMission() {
  const missionType = Math.floor(Math.random() * 3);
  if (missionType === 0) {
    const targets = characterAssets.filter((character) => character.score > 0);
    const target = targets[Math.floor(Math.random() * targets.length)];
    mission = { type: 'species', target: target.name, goal: 1, progress: 0, completed: false };
    missionCopy.textContent = 'Catch ' + target.name;
  } else if (missionType === 1) {
    mission = { type: 'count', target: 3, goal: 3, progress: 0, completed: false };
    missionCopy.textContent = 'Catch 3 Pokémon';
  } else {
    mission = { type: 'score', target: 150, goal: 150, progress: 0, completed: false };
    missionCopy.textContent = 'Earn 150 points';
  }
  updateMissionUI();
}

function updateMissionUI() {
  if (!mission) return;
  if (mission.type === 'species') mission.progress = sessionCaughtSpecies.has(mission.target) ? 1 : 0;
  if (mission.type === 'count') mission.progress = caughtThisGame;
  if (mission.type === 'score') mission.progress = Math.max(0, score);
  const progress = Math.min(mission.progress, mission.goal);
  const unit = mission.type === 'score' ? ' PTS' : '';
  missionProgressText.textContent = progress + ' / ' + mission.goal + unit;
  missionFill.style.width = Math.round((progress / mission.goal) * 100) + '%';
  missionCard.classList.toggle('is-complete', mission.completed);
  missionState.textContent = mission.completed ? 'COMPLETE' : 'IN PROGRESS';
}

function checkMissionCompletion() {
  updateMissionUI();
  if (mission.completed || mission.progress < mission.goal) return false;
  mission.completed = true;
  turns += 1;
  updateMissionUI();
  return true;
}

function getSpriteDimensions(character) {
  const spriteSize = 96 * PRIZE_SCALE;
  const image = character.image;
  const aspectRatio = image && image.naturalWidth && image.naturalHeight
    ? image.naturalWidth / image.naturalHeight
    : spriteAspectRatios[character.name] || 1;
  return aspectRatio > 1
    ? { width: spriteSize, height: spriteSize / aspectRatio }
    : { width: spriteSize * aspectRatio, height: spriteSize };
}

function shuffledCharacters() {
  const shuffled = characterAssets.slice();
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const otherIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[otherIndex]] = [shuffled[otherIndex], shuffled[index]];
  }
  return shuffled;
}

function circleIntersectsRect(centerX, centerY, radius, rectangle, padding = 0) {
  const left = rectangle.x - padding;
  const right = rectangle.x + rectangle.width + padding;
  const top = rectangle.y - padding;
  const bottom = rectangle.y + rectangle.height + padding;
  const closestX = Math.max(left, Math.min(centerX, right));
  const closestY = Math.max(top, Math.min(centerY, bottom));
  return Math.hypot(centerX - closestX, centerY - closestY) < radius;
}

function findInitialPrizePosition(dimensions, radius, placed) {
  const minimumY = machine.floorY - 218;
  const maximumY = machine.floorY - dimensions.height - 6;
  for (let attempt = 0; attempt < 1200; attempt += 1) {
    const x = randomBetween(prizeBounds.left + 4, prizeBounds.right - dimensions.width - 4);
    const y = randomBetween(minimumY, maximumY);
    const centerX = x + dimensions.width / 2;
    const centerY = y + dimensions.height / 2;
    if (circleIntersectsRect(centerX, centerY, radius, prizeChute.exclusion, 8)) continue;
    const overlapsPrize = placed.some((other) => (
      Math.hypot(centerX - other.centerX, centerY - other.centerY)
      < (radius + other.bodyRadius) * 0.9
    ));
    if (!overlapsPrize) return { x, y, centerX, centerY };
  }

  const safeLeft = prizeChute.exclusion.x + prizeChute.exclusion.width + 8;
  const usableWidth = prizeBounds.right - safeLeft;
  const column = placed.length % 7;
  const row = Math.floor(placed.length / 7);
  const x = Math.min(
    prizeBounds.right - dimensions.width,
    safeLeft + 8 + column * (usableWidth - dimensions.width) / 6,
  );
  const y = machine.floorY - dimensions.height - 12 - row * 68;
  return { x, y, centerX: x + dimensions.width / 2, centerY: y + dimensions.height / 2 };
}

function settleInitialPrizes() {
  const maximumFrames = 480;
  for (let frame = 0; frame < maximumFrames; frame += 1) {
    updatePrizePhysics(16);
    if (frame > 120 && prizes.every((prize) => prize.isSleeping)) break;
  }
  prizes.forEach((prize) => {
    prize.velocityX = 0;
    prize.velocityY = 0;
    prize.angularVelocity = 0;
    prize.sleepTimer = PHYSICS.sleepDelay;
    prize.isSleeping = true;
    prize.state = PokemonState.IDLE;
  });
}

function createPrizes() {
  const placed = [];
  prizes = shuffledCharacters().map((character, index) => {
    const dimensions = getSpriteDimensions(character);
    const radius = Math.max(22, Math.max(dimensions.width, dimensions.height) * 0.42);
    const position = findInitialPrizePosition(dimensions, radius, placed);
    const prize = {
      character,
      x: position.x,
      y: position.y,
      width: dimensions.width,
      height: dimensions.height,
      centerX: position.centerX,
      centerY: position.centerY,
      bottomY: position.y + dimensions.height,
      color: fallbackColors[index % fallbackColors.length],
      name: character.name,
      collected: false,
      state: PokemonState.IDLE,
      velocityX: randomBetween(-8, 8),
      velocityY: randomBetween(-3, 5),
      rotation: randomBetween(-0.3, 0.3),
      angularVelocity: randomBetween(-0.18, 0.18),
      bodyRadius: radius,
      mass: Math.max(0.7, dimensions.width * dimensions.height / 4200),
      inverseMass: 0,
      restitution: PHYSICS.restitution + randomBetween(-0.02, 0.025),
      friction: PHYSICS.floorFriction + randomBetween(-0.025, 0.025),
      isSleeping: false,
      sleepTimer: 0,
      touchingSurface: false,
      bounceCount: 0,
      shiny: Math.random() < SHINY_CHANCE,
    };
    placed.push(prize);
    return prize;
  });
  prizes.forEach((prize) => { prize.inverseMass = 1 / prize.mass; });
  settleInitialPrizes();
}

function drawBackground() {
  context.fillStyle = '#c7edf2';
  context.fillRect(0, 0, machine.width, machine.floorY);
  context.fillStyle = '#d8f2ea';
  context.fillRect(0, CLAW_LANE_BOTTOM, machine.width, machine.floorY - CLAW_LANE_BOTTOM);
  for (let x = 0; x < machine.width; x += 56) {
    context.fillStyle = x % 112 === 0 ? '#d0eee8' : '#d8f2ea';
    context.fillRect(x, CLAW_LANE_BOTTOM, 28, machine.floorY - CLAW_LANE_BOTTOM);
  }
  context.fillStyle = 'rgba(57, 149, 109, .28)';
  context.fillRect(0, CLAW_LANE_BOTTOM - 2, machine.width, 2);
  context.fillStyle = '#83cb73';
  context.fillRect(0, machine.floorY, machine.width, machine.height - machine.floorY);
  context.fillStyle = '#4a9b5c';
  context.fillRect(0, machine.floorY, machine.width, 10);
  for (let x = 12; x < machine.width; x += 64) {
    context.fillStyle = '#a2d982';
    context.fillRect(x, machine.floorY + 20, 22, 7);
    context.fillRect(x + 30, machine.floorY + 48, 18, 6);
    context.fillStyle = '#67b568';
    context.fillRect(x + 8, machine.floorY + 68, 5, 5);
  }
}

function drawPrizeChute(elapsed) {
  prizeChute.flash = Math.max(0, prizeChute.flash - elapsed / 520);
  const outerY = prizeChute.mouth.y - 8;
  const outerBottom = machine.height - 12;
  const tunnelHeight = prizeChute.tunnel.bottom - prizeChute.tunnel.y;
  context.fillStyle = 'rgba(21, 34, 48, .2)';
  context.fillRect(prizeChute.x - 7, outerY + 8, prizeChute.width + 14, outerBottom - outerY + 3);
  const chuteDepth = context.createLinearGradient(0, prizeChute.tunnel.y, 0, prizeChute.tunnel.bottom);
  chuteDepth.addColorStop(0, '#0c1725');
  chuteDepth.addColorStop(0.65, '#172639');
  chuteDepth.addColorStop(1, '#0a121d');
  context.fillStyle = chuteDepth;
  context.fillRect(prizeChute.tunnel.x, prizeChute.tunnel.y, prizeChute.tunnel.width, tunnelHeight);
  context.fillStyle = 'rgba(255, 255, 255, .08)';
  context.fillRect(prizeChute.tunnel.x + 7, prizeChute.tunnel.y + 6, prizeChute.tunnel.width - 14, 3);
  context.fillStyle = '#1b2b3d';
  context.fillRect(prizeChute.x + 6, prizeChute.sensor.y + 9, prizeChute.width - 12, outerBottom - prizeChute.sensor.y - 9);
}

function drawPrizeChuteForeground() {
  const outerY = prizeChute.mouth.y - 8;
  const outerBottom = machine.height - 12;

  context.fillStyle = '#243346';
  context.fillRect(prizeChute.walls.leftLip.x, prizeChute.walls.leftLip.y, prizeChute.walls.leftLip.width, prizeChute.walls.leftLip.height);
  context.fillRect(prizeChute.walls.rightLip.x, prizeChute.walls.rightLip.y, prizeChute.walls.rightLip.width, prizeChute.walls.rightLip.height);
  context.fillStyle = '#e6464d';
  context.fillRect(prizeChute.walls.leftLip.x + 2, prizeChute.walls.leftLip.y + 2, prizeChute.walls.leftLip.width - 2, 4);
  context.fillRect(prizeChute.walls.rightLip.x, prizeChute.walls.rightLip.y + 2, prizeChute.walls.rightLip.width - 2, 4);
  context.fillStyle = '#ffd342';
  context.fillRect(prizeChute.mouth.x, prizeChute.mouth.y - 3, 18, 3);
  context.fillRect(prizeChute.mouth.x + prizeChute.mouth.width - 18, prizeChute.mouth.y - 3, 18, 3);

  context.fillStyle = '#243346';
  context.fillRect(prizeChute.walls.left.x, prizeChute.walls.left.y, prizeChute.walls.left.width, prizeChute.walls.left.height);
  context.fillRect(prizeChute.walls.right.x, prizeChute.walls.right.y, prizeChute.walls.right.width, prizeChute.walls.right.height);
  context.fillRect(prizeChute.x, prizeChute.sensor.y + 7, prizeChute.width, outerBottom - prizeChute.sensor.y - 7);
  context.fillStyle = '#fffcf3';
  context.fillRect(prizeChute.x + 5, outerY + 9, 4, outerBottom - outerY - 18);
  context.fillRect(prizeChute.x + prizeChute.width - 9, outerY + 9, 4, outerBottom - outerY - 18);

  const divider = prizeChute.divider;
  context.fillStyle = 'rgba(184, 235, 238, .3)';
  context.fillRect(divider.x, divider.y, divider.width, divider.height);
  context.fillStyle = '#243346';
  context.fillRect(divider.x, divider.y, 4, divider.height);
  context.fillRect(divider.x + divider.width - 4, divider.y, 4, divider.height);
  context.fillRect(divider.x - 2, divider.y - 5, divider.width + 4, 7);
  context.fillStyle = '#fffcf3';
  context.fillRect(divider.x + 5, divider.y + 7, 2, divider.height - 14);

  context.fillStyle = '#ffd342';
  context.font = 'bold 9px monospace';
  context.textAlign = 'center';
  context.fillText('PRIZE', chuteCenterX, prizeChute.sensor.y + 22);

  context.fillStyle = '#fffcf3';
  context.beginPath();
  context.arc(chuteCenterX, outerBottom - 1, 7, Math.PI, Math.PI * 2);
  context.fill();
  context.fillStyle = '#e6464d';
  context.fillRect(chuteCenterX - 7, outerBottom - 1, 14, 2);
  context.fillStyle = '#243346';
  context.fillRect(chuteCenterX - 1, outerBottom - 3, 2, 5);
  if (prizeChute.flash > 0) {
    context.save();
    context.globalAlpha = prizeChute.flash * 0.62;
    context.fillStyle = '#ffd342';
    context.fillRect(prizeChute.mouth.x, prizeChute.mouth.y - 5, prizeChute.mouth.width, 5);
    context.restore();
  }
}

function drawPixelPokeball(prize) {
  const y = Math.round(prize.bottomY - 15 * PRIZE_SCALE);
  context.save();
  context.translate(Math.round(prize.centerX), y);
  context.scale(PRIZE_SCALE, PRIZE_SCALE);
  context.fillStyle = prize.color;
  context.fillRect(-22, -22, 44, 20);
  context.fillStyle = '#fff9ef';
  context.fillRect(-22, -2, 44, 21);
  context.fillStyle = '#243346';
  context.fillRect(-25, -5, 50, 6);
  context.fillRect(-7, -9, 14, 14);
  context.fillStyle = '#fff9ef';
  context.fillRect(-3, -5, 6, 6);
  context.restore();
}

function drawCharacter(character, x, y, size, bottomY = null) {
  if (!character || !character.loaded) return false;
  const dimensions = getSpriteDimensions(character);
  const scale = size / (96 * PRIZE_SCALE);
  const drawWidth = dimensions.width * scale;
  const drawHeight = dimensions.height * scale;
  context.drawImage(
    character.image,
    Math.round(x - drawWidth / 2),
    Math.round(bottomY === null ? y - drawHeight * 0.62 : bottomY - drawHeight),
    Math.round(drawWidth),
    Math.round(drawHeight),
  );
  return true;
}

function drawSparkle(x, y, size, alpha) {
  context.save();
  context.globalAlpha = alpha;
  context.fillStyle = '#fff9d7';
  context.fillRect(Math.round(x + size / 2), Math.round(y), 2, size);
  context.fillRect(Math.round(x), Math.round(y + size / 2), size + 2, 2);
  context.restore();
}

function drawPrize(prize, index, time) {
  const isChuteDrop = prize.state === PokemonState.DROPPING_TO_CHUTE
    || (prize.state === PokemonState.CAUGHT && prize.dropPhase === 'sensor-confirmed');
  if (prize.collected || prize.state === PokemonState.GRABBED) return;
  context.save();
  if (isChuteDrop) {
    context.globalAlpha = prize.dropAlpha;
  } else {
    const shadowY = Math.min(prize.bottomY, machine.floorY - 3);
    const rarity = prize.character.rarity || 'common';
    if (rarity !== 'common' || prize.shiny) {
      context.save();
      context.globalAlpha = prize.shiny ? 0.2 : rarity === 'legendary' ? 0.15 : 0.1;
      context.fillStyle = prize.shiny ? '#ffd342' : rarityColors[rarity];
      context.beginPath();
      context.ellipse(prize.centerX, prize.centerY, prize.width * 0.48, prize.height * 0.46, 0, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
    context.fillStyle = 'rgba(36, 51, 70, .14)';
    context.fillRect(prize.centerX - prize.width * 0.28, shadowY, prize.width * 0.56, 3);
  }
  const scale = isChuteDrop ? prize.dropScale : 1;
  const drawHeight = prize.height * scale;
  const drawWidth = prize.width * scale;
  const drawTop = prize.y + (prize.height - drawHeight) / 2;
  const drawCenterX = prize.centerX;
  const drawBottom = drawTop + drawHeight;
  if (prize.character.loaded) {
    const dimensions = getSpriteDimensions(prize.character);
    context.save();
    context.translate(drawCenterX, prize.centerY);
    context.rotate(prize.rotation || 0);
    context.drawImage(
      prize.character.image,
      -dimensions.width * scale / 2,
      -dimensions.height * scale / 2,
      dimensions.width * scale,
      dimensions.height * scale,
    );
    context.restore();
  } else if (!drawCharacter(prize.character, drawCenterX, drawTop, 96 * PRIZE_SCALE * scale, drawBottom)) {
    drawPixelPokeball(prize);
  }
  if (!isChuteDrop && prize.shiny) {
    const phase = time / 450 + index * 1.73;
    drawSparkle(prize.centerX - 27 + Math.sin(phase) * 18, prize.centerY + Math.cos(phase * 0.9) * 16, 6, 0.55);
    drawSparkle(prize.centerX + 15 + Math.cos(phase * 0.8) * 18, prize.centerY + Math.sin(phase) * 20, 4, 0.38);
  }
  context.restore();
}

function drawClaw() {
  const x = Math.round(claw.x);
  const y = Math.round(claw.y);
  context.fillStyle = '#243346';
  context.fillRect(x - 3, 0, 6, Math.max(0, y - 7));
  context.save();
  context.translate(x, y);
  context.scale(CLAW_SCALE, CLAW_SCALE);
  context.fillStyle = '#243346';
  context.fillRect(-34, -8, 68, 23);
  context.fillStyle = '#e6464d';
  context.fillRect(-28, -4, 56, 14);
  context.fillStyle = '#ffd342';
  context.fillRect(-5, -2, 10, 9);
  const spread = 6 + claw.openAmount * 9;
  context.fillStyle = '#243346';
  context.fillRect(-14 - spread, 10, 8, 24);
  context.fillRect(6 + spread, 10, 8, 24);
  context.fillRect(-20 - spread, 30, 15, 8);
  context.fillRect(5 + spread, 30, 15, 8);
  if (claw.caught) {
    context.fillStyle = '#243346';
    const hookLength = Math.max(8, claw.caught.y - claw.y - 35);
    context.fillRect(-2, 35, 5, hookLength);
  }
  context.restore();
  if (claw.caught) {
    const prize = claw.caught;
    const swayAngle = Math.sin((lastTime - claw.grabStartedAt) * 0.007) * 0.035;
    if (prize.character.loaded) {
      context.save();
      context.translate(prize.centerX, prize.centerY);
      context.rotate(swayAngle);
      context.drawImage(prize.character.image, -prize.width / 2, -prize.height / 2, prize.width, prize.height);
      context.restore();
    } else {
      drawPixelPokeball(prize);
    }
  }
}

function spawnCatchParticles(prize) {
  const rarity = prize.character.rarity || 'common';
  const color = prize.shiny ? '#ffd342' : rarityColors[rarity] || rarityColors.common;
  const count = prize.shiny ? 12 : rarity === 'common' ? 5 : 8;
  const originY = prize.centerY;
  for (let i = 0; i < count; i += 1) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.35;
    const speed = 1.1 + Math.random() * 1.7;
    particles.push({
      x: prize.centerX,
      y: originY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 0.5,
      size: 2 + Math.floor(Math.random() * 3),
      color,
      life: 420 + Math.random() * 300,
      maxLife: 720,
    });
  }
}

function renderParticles(elapsed) {
  particles = particles.filter((particle) => particle.life > 0);
  particles.forEach((particle) => {
    particle.life -= elapsed;
    particle.x += particle.vx * elapsed / 16;
    particle.y += particle.vy * elapsed / 16;
    particle.vy += 0.035 * elapsed / 16;
    context.save();
    context.globalAlpha = Math.max(0, particle.life / particle.maxLife);
    context.fillStyle = particle.color;
    context.fillRect(Math.round(particle.x), Math.round(particle.y), particle.size, particle.size);
    context.restore();
  });
}

function moveTowards(current, target, maxStep) {
  if (Math.abs(target - current) <= maxStep) return target;
  return current + Math.sign(target - current) * maxStep;
}

function randomBetween(minimum, maximum) {
  return minimum + Math.random() * (maximum - minimum);
}

function easeInOut(progress) {
  return progress * progress * (3 - 2 * progress);
}

function updatePrizeGeometry(prize) {
  prize.centerX = prize.x + prize.width / 2;
  prize.centerY = prize.y + prize.height / 2;
  prize.bottomY = prize.y + prize.height;
}

function updateCarriedPrize(time) {
  const prize = claw.currentGrab && claw.currentGrab.pokemon;
  if (!prize || prize.state !== PokemonState.GRABBED) return;
  const sway = Math.sin((time - claw.grabStartedAt) * 0.008) * 2.5;
  prize.x = claw.x + claw.carryOffsetX + sway - prize.width / 2;
  prize.y = claw.y + claw.carryOffsetY;
  updatePrizeGeometry(prize);
}

function beginPrizeDrop() {
  const prize = claw.currentGrab && claw.currentGrab.pokemon;
  if (!prize
    || Math.abs(claw.x - claw.homeX) > 0.001
    || Math.abs(claw.x - chuteCenterX) >= 2
    || Math.abs(claw.x + claw.carryOffsetX - chuteCenterX) >= 2) return false;
  claw.x = claw.homeX;
  claw.state = GameState.RELEASING;
  claw.phaseElapsed = 0;
  claw.openAmount = 0;
  showStatus('RELEASING...', 900);
  return true;
}

function releaseGrabbedPrize() {
  const grab = claw.currentGrab;
  if (!grab || !grab.pokemon) return false;
  const prize = grab.pokemon;
  const swayAngle = Math.sin((lastTime - claw.grabStartedAt) * 0.007) * 0.035;
  prize.rotation = swayAngle;
  updatePrizeGeometry(prize);
  prize.state = PokemonState.DROPPING_TO_CHUTE;
  prize.dropPhase = 'falling';
  prize.dropElapsed = 0;
  prize.dropAlpha = 1;
  prize.dropScale = 1;
  prize.velocityX = 0;
  prize.velocityY = 0;
  prize.angularVelocity = randomBetween(-0.025, 0.025);
  prize.chuteSensorTriggered = false;
  prize.releaseX = prize.x;
  prize.releaseY = prize.y;
  prize.isSleeping = false;
  prize.sleepTimer = 0;
  claw.dropGrab = grab;
  claw.droppingPrize = prize;
  claw.currentGrab = null;
  claw.caught = null;
  claw.phaseElapsed = 0;
  claw.state = GameState.WAITING_FOR_CHUTE;
  showStatus('DROPPING...', 1000);
  return true;
}

function updateChuteDropPhysics(prize, elapsed) {
  const safeElapsed = Math.min(elapsed, 50);
  const totalSeconds = safeElapsed / 1000;
  const substeps = Math.max(1, Math.min(5, Math.ceil(totalSeconds / PHYSICS.maxStep)));
  const step = totalSeconds / substeps;
  const result = { sensorTriggered: false, complete: false };
  prize.dropElapsed += safeElapsed;

  for (let substep = 0; substep < substeps; substep += 1) {
    prize.velocityY += GRAVITY * step;
    prize.x += prize.velocityX * step;
    prize.y += prize.velocityY * step;
    prize.rotation += prize.angularVelocity * step;
    updatePrizeGeometry(prize);
    resolveChuteWalls(prize);

    const sensor = prizeChute.sensor;
    const insideSensorX = prize.centerX >= sensor.x && prize.centerX <= sensor.x + sensor.width;
    if (!prize.chuteSensorTriggered && insideSensorX && prize.bottomY >= sensor.y) {
      prize.chuteSensorTriggered = true;
      prize.state = PokemonState.CAUGHT;
      prize.dropPhase = 'sensor-confirmed';
      prize.dropElapsed = 0;
      prizeChute.flash = 1;
      result.sensorTriggered = true;
      break;
    }
  }

  if (prize.dropPhase === 'sensor-confirmed') {
    const progress = Math.min(prize.dropElapsed / ANIMATION.chuteFadeDuration, 1);
    prize.dropScale = 1 - progress * 0.08;
    prize.dropAlpha = 1 - progress;
    if (progress >= 1) result.complete = true;
  }
  updatePrizeGeometry(prize);
  return result;
}

function chooseSlipMessage(name) {
  const tone = Math.random() < TEASING_MESSAGE_CHANCE ? 'tease' : 'encourage';
  const messages = tone === 'encourage' ? encouragingMessages : teasingMessages;
  const template = messages[Math.floor(Math.random() * messages.length)];
  return { text: template.replaceAll('{name}', name), tone };
}

function isPhysicsPrize(prize) {
  return !prize.collected && (
    prize.state === PokemonState.IDLE
    || prize.state === PokemonState.SLIPPING
    || prize.state === PokemonState.FALLING
    || prize.state === PokemonState.SETTLING
  );
}

function wakePrize(prize) {
  prize.isSleeping = false;
  prize.sleepTimer = 0;
}

function resolveWorldBounds(prize) {
  const minimumX = prizeBounds.left;
  const maximumX = prizeBounds.right - prize.width;
  let collided = false;

  if (prize.x < minimumX) {
    prize.x = minimumX;
    prize.velocityX = Math.abs(prize.velocityX) * PHYSICS.wallRestitution;
    prize.angularVelocity += Math.min(0.28, Math.abs(prize.velocityY) * 0.0007);
    collided = true;
  } else if (prize.x > maximumX) {
    prize.x = maximumX;
    prize.velocityX = -Math.abs(prize.velocityX) * PHYSICS.wallRestitution;
    prize.angularVelocity -= Math.min(0.28, Math.abs(prize.velocityY) * 0.0007);
    collided = true;
  }

  if (prize.y + prize.height >= machine.floorY) {
    prize.y = machine.floorY - prize.height;
    if (prize.velocityY > 24) {
      prize.velocityY = -prize.velocityY * prize.restitution;
    } else {
      prize.velocityY = 0;
    }
    prize.velocityX *= prize.friction;
    prize.angularVelocity *= 0.72;
    prize.touchingSurface = true;
    collided = true;
  }

  if (prize.y < -prize.height * 1.5) {
    prize.y = -prize.height * 1.5;
    prize.velocityY = Math.max(0, prize.velocityY);
  }
  updatePrizeGeometry(prize);
  return collided;
}

function resolveStaticRectCollision(prize, rectangle) {
  const closestX = Math.max(rectangle.x, Math.min(prize.centerX, rectangle.x + rectangle.width));
  const closestY = Math.max(rectangle.y, Math.min(prize.centerY, rectangle.y + rectangle.height));
  let deltaX = prize.centerX - closestX;
  let deltaY = prize.centerY - closestY;
  let distance = Math.hypot(deltaX, deltaY);
  let penetration = prize.bodyRadius - distance;

  if (distance === 0) {
    const distances = [
      { value: prize.centerX - rectangle.x, normalX: -1, normalY: 0 },
      { value: rectangle.x + rectangle.width - prize.centerX, normalX: 1, normalY: 0 },
      { value: prize.centerY - rectangle.y, normalX: 0, normalY: -1 },
      { value: rectangle.y + rectangle.height - prize.centerY, normalX: 0, normalY: 1 },
    ].sort((first, second) => first.value - second.value);
    deltaX = distances[0].normalX;
    deltaY = distances[0].normalY;
    distance = 1;
    penetration = prize.bodyRadius + distances[0].value;
  }

  if (penetration <= 0) return false;
  const normalX = deltaX / distance;
  const normalY = deltaY / distance;
  prize.x += normalX * penetration;
  prize.y += normalY * penetration;
  const velocityAlongNormal = prize.velocityX * normalX + prize.velocityY * normalY;
  if (velocityAlongNormal < 0) {
    prize.velocityX -= (1 + prize.restitution) * velocityAlongNormal * normalX;
    prize.velocityY -= (1 + prize.restitution) * velocityAlongNormal * normalY;
    const tangentX = -normalY;
    const tangentY = normalX;
    const tangentVelocity = prize.velocityX * tangentX + prize.velocityY * tangentY;
    prize.velocityX -= tangentVelocity * 0.18 * tangentX;
    prize.velocityY -= tangentVelocity * 0.18 * tangentY;
    prize.angularVelocity += tangentVelocity * 0.0007;
  }
  prize.touchingSurface = true;
  updatePrizeGeometry(prize);
  return true;
}

function resolveChuteWalls(prize) {
  const hitLeftWall = resolveStaticRectCollision(prize, prizeChute.walls.left);
  const hitRightWall = resolveStaticRectCollision(prize, prizeChute.walls.right);
  const hitLeftLip = resolveStaticRectCollision(prize, prizeChute.walls.leftLip);
  const hitRightLip = resolveStaticRectCollision(prize, prizeChute.walls.rightLip);
  const hitDivider = resolveStaticRectCollision(prize, prizeChute.divider);
  return hitLeftWall || hitRightWall || hitLeftLip || hitRightLip || hitDivider;
}

function resolvePrizeCollision(first, second) {
  const deltaX = second.centerX - first.centerX;
  const deltaY = second.centerY - first.centerY;
  const minimumDistance = first.bodyRadius + second.bodyRadius;
  const distanceSquared = deltaX * deltaX + deltaY * deltaY;
  if (distanceSquared >= minimumDistance * minimumDistance) return false;

  const distance = Math.sqrt(distanceSquared) || 0.001;
  const normalX = distance > 0.001 ? deltaX / distance : (first.centerX <= second.centerX ? 1 : -1);
  const normalY = distance > 0.001 ? deltaY / distance : 0;
  const overlap = minimumDistance - distance;
  const firstWeight = first.isSleeping ? 0 : first.inverseMass;
  const secondWeight = second.isSleeping ? 0 : second.inverseMass;
  const movableWeight = firstWeight + secondWeight;

  if (movableWeight > 0) {
    const correction = Math.max(0, overlap - 0.35) / movableWeight * 0.72;
    if (!first.isSleeping) {
      first.x -= normalX * correction * firstWeight;
      first.y -= normalY * correction * firstWeight;
      updatePrizeGeometry(first);
    }
    if (!second.isSleeping) {
      second.x += normalX * correction * secondWeight;
      second.y += normalY * correction * secondWeight;
      updatePrizeGeometry(second);
    }
  }

  const relativeX = second.velocityX - first.velocityX;
  const relativeY = second.velocityY - first.velocityY;
  const velocityAlongNormal = relativeX * normalX + relativeY * normalY;
  if (velocityAlongNormal < 0) {
    if (Math.abs(velocityAlongNormal) > 10) {
      wakePrize(first);
      wakePrize(second);
    }
    const firstImpulseMass = first.isSleeping ? 0 : first.inverseMass;
    const secondImpulseMass = second.isSleeping ? 0 : second.inverseMass;
    const inverseMassSum = firstImpulseMass + secondImpulseMass;
    if (inverseMassSum <= 0) return true;
    const restitution = Math.min(first.restitution, second.restitution);
    const impulse = -(1 + restitution) * velocityAlongNormal / inverseMassSum;
    const impulseX = impulse * normalX;
    const impulseY = impulse * normalY;
    first.velocityX -= impulseX * firstImpulseMass;
    first.velocityY -= impulseY * firstImpulseMass;
    second.velocityX += impulseX * secondImpulseMass;
    second.velocityY += impulseY * secondImpulseMass;

    const tangentX = -normalY;
    const tangentY = normalX;
    const tangentSpeed = relativeX * tangentX + relativeY * tangentY;
    const frictionImpulse = Math.max(-impulse * 0.22, Math.min(impulse * 0.22, -tangentSpeed / inverseMassSum));
    first.velocityX -= frictionImpulse * tangentX * firstImpulseMass;
    first.velocityY -= frictionImpulse * tangentY * firstImpulseMass;
    second.velocityX += frictionImpulse * tangentX * secondImpulseMass;
    second.velocityY += frictionImpulse * tangentY * secondImpulseMass;

    const spin = frictionImpulse * 0.0008;
    first.angularVelocity -= spin;
    second.angularVelocity += spin;
    if (Math.abs(impulse) > 45) {
      wakePrize(first);
      wakePrize(second);
    }
  }

  first.touchingSurface = true;
  second.touchingSurface = true;
  return true;
}

function integratePrize(prize, step) {
  if (prize.isSleeping) return;
  const airDamping = Math.pow(PHYSICS.airFriction, step * 60);
  const angularDamping = Math.pow(PHYSICS.angularDamping, step * 60);
  prize.velocityY += GRAVITY * step;
  prize.velocityX *= airDamping;
  prize.angularVelocity *= angularDamping;
  prize.angularVelocity = Math.max(
    -PHYSICS.maxAngularVelocity,
    Math.min(PHYSICS.maxAngularVelocity, prize.angularVelocity),
  );
  prize.x += prize.velocityX * step;
  prize.y += prize.velocityY * step;
  prize.rotation += prize.angularVelocity * step;
  updatePrizeGeometry(prize);
}

function updateSleeping(prize, elapsed) {
  if (!isPhysicsPrize(prize) || prize.isSleeping) return;
  if (prize.touchingSurface) {
    const contactDamping = Math.pow(0.82, elapsed / 16.667);
    prize.velocityX *= Math.pow(0.94, elapsed / 16.667);
    prize.angularVelocity *= contactDamping;
  }
  const speed = Math.hypot(prize.velocityX, prize.velocityY);
  if (prize.touchingSurface
    && speed < PHYSICS.sleepSpeed
    && Math.abs(prize.angularVelocity) < PHYSICS.sleepAngularSpeed) {
    prize.sleepTimer += elapsed;
    if (prize.sleepTimer >= PHYSICS.sleepDelay) {
      prize.isSleeping = true;
      prize.velocityX = 0;
      prize.velocityY = 0;
      prize.angularVelocity = 0;
      if (prize.state !== PokemonState.IDLE) prize.state = PokemonState.IDLE;
    }
  } else {
    prize.sleepTimer = 0;
  }
}

function updatePrizePhysics(elapsed) {
  const safeElapsed = Math.min(Math.max(elapsed, 0), 50);
  if (safeElapsed <= 0) return;
  const dynamicPrizes = prizes.filter(isPhysicsPrize);
  const totalSeconds = safeElapsed / 1000;
  const substeps = Math.max(1, Math.min(5, Math.ceil(totalSeconds / PHYSICS.maxStep)));
  const step = totalSeconds / substeps;
  dynamicPrizes.forEach((prize) => { prize.touchingSurface = false; });

  for (let substep = 0; substep < substeps; substep += 1) {
    dynamicPrizes.forEach((prize) => {
      integratePrize(prize, step);
      resolveWorldBounds(prize);
      resolveChuteWalls(prize);
    });
    for (let iteration = 0; iteration < PHYSICS.solverIterations; iteration += 1) {
      for (let firstIndex = 0; firstIndex < dynamicPrizes.length; firstIndex += 1) {
        for (let secondIndex = firstIndex + 1; secondIndex < dynamicPrizes.length; secondIndex += 1) {
          resolvePrizeCollision(dynamicPrizes[firstIndex], dynamicPrizes[secondIndex]);
        }
      }
      dynamicPrizes.forEach((prize) => {
        resolveWorldBounds(prize);
        resolveChuteWalls(prize);
      });
    }
  }
  dynamicPrizes.forEach((prize) => updateSleeping(prize, safeElapsed));
}

function nudgePileAtClaw(grabbedPrize = null) {
  const contactY = claw.y + 34;
  prizes.forEach((prize) => {
    if (prize === grabbedPrize || !isPhysicsPrize(prize)) return;
    const deltaX = prize.centerX - claw.x;
    const deltaY = prize.centerY - contactY;
    if (Math.abs(deltaX) > prize.bodyRadius + 42 || Math.abs(deltaY) > prize.bodyRadius + 36) return;
    if (prize.lastClawPushAttempt === grabAttemptId) return;
    prize.lastClawPushAttempt = grabAttemptId;
    const direction = deltaX === 0 ? (Math.random() < 0.5 ? -1 : 1) : Math.sign(deltaX);
    wakePrize(prize);
    prize.velocityX += direction * randomBetween(28, 52);
    prize.velocityY += randomBetween(8, 24);
    prize.angularVelocity += direction * randomBetween(0.12, 0.28);
  });
}

function releaseSlippedPrize() {
  const grab = claw.currentGrab;
  if (!grab) return;
  const prize = grab.pokemon;
  prize.state = PokemonState.SLIPPING;
  prize.velocityX = randomBetween(-28, 28);
  prize.velocityY = randomBetween(0, 18);
  prize.angularVelocity = randomBetween(-0.72, 0.72);
  prize.isSleeping = false;
  prize.sleepTimer = 0;
  prize.bounceCount = 0;
  claw.currentGrab = null;
  claw.caught = null;
  claw.slipPhase = 'retracting';
  claw.openAmount = 0.58;
  currentCombo = 0;
  comboDisplay.classList.remove('combo-pop');
  updateHud();
  const feedback = chooseSlipMessage(prize.name);
  showStatus('MISSED!', 1400);
  showMachineMessage(feedback.text, { duration: 3200, tone: feedback.tone });
  readyStatusPending = true;
}

function beginGripSlip() {
  if (!claw.currentGrab) return;
  claw.state = GameState.SLIPPING;
  claw.slipPhase = 'loosening';
  claw.phaseElapsed = 0;
}

function finishGame() {
  stopMoving();
  hideMessage(true);
  claw.state = GameState.GAME_OVER;
  claw.openAmount = 1;
  machineElement.classList.remove('is-grabbing');
  dropButton.classList.remove('is-pressed');
  showStatus('GAME COMPLETE', 1800);
  showGameComplete();
}

function updateClawAnimation(time, elapsed) {
  const step = elapsed / 1000;
  switch (claw.state) {
    case GameState.DESCENDING: {
      claw.y = Math.min(claw.targetY, claw.y + ANIMATION.descendSpeed * step);
      const prize = findPrizeAtClaw();
      if (prize) {
        nudgePileAtClaw(prize);
        const perfect = Math.abs(prize.centerX - claw.x) <= 14;
        const gripMissChance = randomBetween(GRIP_MISS_MIN, GRIP_MISS_MAX) * (perfect ? 0.6 : 1);
        const willSlip = Math.random() < gripMissChance;
        const slipDuringCarry = willSlip && Math.random() < 0.3;
        const slipProgress = willSlip ? randomBetween(0.25, 0.65) : null;
        const grabY = claw.y;
        claw.carryOffsetX = prize.centerX - claw.x;
        claw.grabOffsetX = claw.carryOffsetX;
        claw.carryOffsetY = prize.y - claw.y;
        claw.grabStartedAt = time;
        claw.currentGrab = {
          pokemon: prize,
          perfect,
          basePoints: prize.character.score,
          comboMultiplier: Math.min(currentCombo + 1, 3),
          willSlip,
          grabY,
          slipProgress,
          slipY: willSlip ? grabY + (claw.homeY - grabY) * slipProgress : null,
          slipDuringCarry,
          carrySlipDistance: slipDuringCarry ? randomBetween(24, 72) : 0,
        };
        claw.caught = prize;
        prize.perfect = perfect;
        prize.state = PokemonState.GRABBED;
        prize.velocityX = 0;
        prize.velocityY = 0;
        prize.angularVelocity = 0;
        prize.isSleeping = false;
        prize.sleepTimer = 0;
        claw.openAmount = 1;
        claw.phaseElapsed = 0;
        claw.state = GameState.CLOSING;
        showStatus('GOTCHA!');
      } else {
        nudgePileAtClaw();
        if (claw.y >= claw.targetY) claw.state = GameState.LIFTING;
      }
      break;
    }
    case GameState.CLOSING: {
      claw.phaseElapsed += elapsed;
      const progress = Math.min(claw.phaseElapsed / ANIMATION.closeDuration, 1);
      claw.openAmount = 1 - easeInOut(progress);
      claw.carryOffsetX = claw.grabOffsetX * (1 - easeInOut(progress));
      if (progress >= 1) {
        claw.openAmount = 0;
        claw.carryOffsetX = 0;
        claw.phaseElapsed = 0;
        claw.state = GameState.LIFTING;
      }
      break;
    }
    case GameState.LIFTING: {
      const grab = claw.currentGrab;
      claw.y = Math.max(claw.homeY, claw.y - ANIMATION.liftSpeed * step);
      if (grab && grab.willSlip && !grab.slipDuringCarry && claw.y <= grab.slipY) {
        beginGripSlip();
        break;
      }
      if (claw.y <= claw.homeY) {
        claw.y = claw.homeY;
        if (grab) {
          if (grab.willSlip && grab.slipDuringCarry) {
            grab.carryStartX = claw.x;
            grab.carrySlipDistance = Math.min(grab.carrySlipDistance, Math.abs(claw.homeX - claw.x) * 0.7);
          }
          claw.state = GameState.CARRYING;
          claw.phaseElapsed = 0;
        } else {
          currentCombo = 0;
          comboDisplay.classList.remove('combo-pop');
          updateHud();
          claw.openAmount = 1;
          claw.state = GameState.RETURNING;
          showStatus('MISSED!');
          const feedback = chooseSlipMessage('Pokémon');
          showMachineMessage(feedback.text, { duration: 3200, tone: feedback.tone });
          readyStatusPending = true;
        }
      }
      break;
    }
    case GameState.CARRYING: {
      const grab = claw.currentGrab;
      claw.x = moveTowards(claw.x, claw.homeX, ANIMATION.carrySpeed * step);
      if (grab && grab.willSlip && grab.slipDuringCarry
        && Math.abs(claw.x - grab.carryStartX) >= grab.carrySlipDistance) {
        beginGripSlip();
        break;
      }
      if (claw.x === claw.homeX) beginPrizeDrop();
      break;
    }
    case GameState.SLIPPING: {
      if (claw.slipPhase === 'loosening') {
        claw.phaseElapsed += elapsed;
        const progress = Math.min(claw.phaseElapsed / ANIMATION.slipLoosenDuration, 1);
        claw.openAmount = 0.58 * easeInOut(progress);
        if (progress >= 1) releaseSlippedPrize();
      } else {
        claw.y = moveTowards(claw.y, claw.homeY, ANIMATION.liftSpeed * step);
        if (claw.y === claw.homeY) claw.state = GameState.RETURNING;
      }
      break;
    }
    case GameState.RELEASING: {
      claw.phaseElapsed += elapsed;
      const progress = Math.min(claw.phaseElapsed / ANIMATION.dropOpenDuration, 1);
      claw.openAmount = easeInOut(progress);
      if (progress >= 1 && !releaseGrabbedPrize()) {
        claw.state = GameState.RETURNING;
      }
      break;
    }
    case GameState.WAITING_FOR_CHUTE: {
      const prize = claw.droppingPrize;
      const grab = claw.dropGrab;
      if (!prize || !grab) {
        claw.droppingPrize = null;
        claw.dropGrab = null;
        claw.state = GameState.RETURNING;
        break;
      }

      const dropResult = updateChuteDropPhysics(prize, elapsed);
      if (dropResult.sensorTriggered && !grab.rewardResolved) {
        grab.rewardResolved = true;
        const rewardStatus = processCatch(grab);
        showStatus('CAUGHT! · ' + rewardStatus, 1800);
      }
      if (dropResult.complete) {
        prize.collected = true;
        claw.droppingPrize = null;
        claw.dropGrab = null;
        claw.phaseElapsed = 0;
        claw.state = GameState.RETURNING;
      }
      break;
    }
    case GameState.RETURNING: {
      claw.x = moveTowards(claw.x, claw.homeX, ANIMATION.returnSpeed * step);
      claw.y = moveTowards(claw.y, claw.homeY, ANIMATION.returnSpeed * 0.7 * step);
      claw.openAmount = moveTowards(claw.openAmount, 1, step * 4);
      if (claw.x === claw.homeX && claw.y === claw.homeY && claw.openAmount === 1) {
        machineElement.classList.remove('is-grabbing');
        dropButton.classList.remove('is-pressed');
        if (turns <= 0) finishGame();
        else {
          claw.state = GameState.READY;
          if (statusText.textContent) readyStatusPending = true;
          else showStatus('READY');
        }
      }
      break;
    }
    default:
      break;
  }
  updateCarriedPrize(time);
}

function render(time = 0) {
  const elapsed = lastTime ? Math.min(time - lastTime, 50) : 0;
  if (claw.state === GameState.READY && heldDirection !== 0) {
    claw.x = Math.max(45, Math.min(machine.width - 45, claw.x + heldDirection * elapsed * 0.28));
  }
  lastTime = time;
  updateClawAnimation(time, elapsed);
  updatePrizePhysics(elapsed);
  context.clearRect(0, 0, machine.width, machine.height);
  drawBackground();
  drawPrizeChute(elapsed);
  prizes.forEach((prize, index) => drawPrize(prize, index, time));
  drawPrizeChuteForeground();
  drawClaw();
  renderParticles(elapsed);
  requestAnimationFrame(render);
}

function updateHud() {
  scoreElement.textContent = String(score).padStart(3, '0');
  turnsElement.textContent = String(turns).padStart(2, '0');
  bestScoreElement.textContent = String(bestScore).padStart(3, '0');
  turnPips.querySelectorAll('i').forEach((pip, index) => pip.classList.toggle('empty', index >= turns));
  const comboMultiplier = Math.min(currentCombo, 3);
  comboDisplay.hidden = currentCombo < 2;
  if (currentCombo >= 2) comboDisplay.textContent = 'COMBO ×' + comboMultiplier;
}

function showGameComplete() {
  canvasFrame.classList.add('is-game-over');
  finalScoreElement.textContent = String(score).padStart(3, '0');
  modalBestScoreElement.textContent = String(bestScore).padStart(3, '0');
  modalCaughtElement.textContent = String(caughtThisGame);
  modalComboElement.textContent = '×' + bestCombo;
  modalNewPokemonElement.textContent = newUnlocksThisGame.length ? newUnlocksThisGame.join(', ') : 'None this run';
  newBestBadge.hidden = !newBestThisGame;
  gameCompleteOverlay.hidden = false;
  gameCompleteOverlay.setAttribute('aria-hidden', 'false');
  playAgainButton.focus({ preventScroll: true });
}

function findPrizeAtClaw() {
  const clawTop = claw.y + 10;
  const clawBottom = claw.y + 38;
  return prizes
    .filter((prize) => {
      if (!isPhysicsPrize(prize) || Math.abs(prize.centerX - claw.x) >= prize.bodyRadius + 24) return false;
      return clawBottom >= prize.y && clawTop <= prize.bottomY;
    })
    .sort((first, second) => {
      const firstDistance = Math.abs(first.centerX - claw.x);
      const secondDistance = Math.abs(second.centerX - claw.x);
      return firstDistance - secondDistance || first.centerY - second.centerY;
    })[0];
}

function animateCombo() {
  if (currentCombo < 2) return;
  comboDisplay.classList.remove('combo-pop');
  void comboDisplay.offsetWidth;
  comboDisplay.classList.add('combo-pop');
}

function processCatch(grab) {
  const prize = grab.pokemon;
  const character = prize.character;
  currentCombo += 1;
  bestCombo = Math.max(bestCombo, currentCombo);
  caughtThisGame += 1;
  sessionCaughtSpecies.add(character.name);

  const previousCount = pokedexCounts[character.name] || 0;
  pokedexCounts[character.name] = previousCount + 1;
  if (previousCount === 0) {
    character.newThisGame = true;
    newUnlocksThisGame.push(character.name);
  }
  writeStorageItem(STORAGE_KEYS.collection, JSON.stringify(pokedexCounts));

  const comboMultiplier = grab.comboMultiplier;
  const basePoints = grab.basePoints;
  const catchPoints = basePoints * (basePoints > 0 ? comboMultiplier : 1) * (prize.shiny ? 2 : 1);
  const perfectBonus = grab.perfect ? 20 : 0;
  const pointsEarned = catchPoints + perfectBonus;
  score += pointsEarned;

  const oldLevel = trainerLevel();
  trainerXp += Math.max(0, pointsEarned);
  writeStorageItem(STORAGE_KEYS.trainerXp, String(trainerXp));
  refreshTrainerLevel();
  const leveledUp = trainerLevel() > oldLevel;

  if (score > bestScore) {
    bestScore = score;
    newBestThisGame = true;
    writeStorageItem(STORAGE_KEYS.best, String(bestScore));
  }

  const missionCompleted = checkMissionCompletion();
  updatePokedex();
  updateHud();
  animateCombo();
  scoreElement.classList.remove('score-pop');
  void scoreElement.offsetWidth;
  scoreElement.classList.add('score-pop');
  spawnCatchParticles(prize);

  if (missionCompleted) return '+1 TURN';
  if (leveledUp) return 'LEVEL UP! LV ' + trainerLevel();
  if (grab.perfect) return 'PERFECT +20';
  if (prize.shiny) return 'SHINY! x2';
  if (character.rarity !== 'common') return 'RARE CATCH!';
  return pointsEarned < 0 ? 'PENALTY ' + pointsEarned : formatPoints(pointsEarned) + ' POINTS';
}

function dropClaw() {
  if (claw.state !== GameState.READY || turns <= 0) return;
  stopMoving();
  grabAttemptId += 1;
  turns -= 1;
  claw.state = GameState.DESCENDING;
  claw.targetY = machine.floorY - 75;
  claw.currentGrab = null;
  claw.caught = null;
  claw.phaseElapsed = 0;
  claw.slipPhase = null;
  claw.openAmount = 1;
  claw.grabOffsetX = 0;
  claw.carryOffsetX = 0;
  claw.carryOffsetY = 0;
  machineElement.classList.add('is-grabbing');
  dropButton.classList.add('is-pressed');
  showStatus('GRABBING...');
  updateHud();
}

function resetGame() {
  clearTimeout(statusTimer);
  hideMessage(true);
  readyStatusPending = false;
  score = 0;
  turns = 5;
  heldDirection = 0;
  newBestThisGame = false;
  currentCombo = 0;
  bestCombo = 0;
  caughtThisGame = 0;
  newUnlocksThisGame = [];
  sessionCaughtSpecies = new Set();
  particles = [];
  characterAssets.forEach((character) => { character.newThisGame = false; });
  claw.x = claw.homeX;
  claw.y = claw.homeY;
  claw.state = GameState.READY;
  claw.targetY = claw.homeY;
  claw.caught = null;
  claw.currentGrab = null;
  claw.droppingPrize = null;
  claw.dropGrab = null;
  claw.openAmount = 1;
  claw.phaseElapsed = 0;
  claw.slipPhase = null;
  claw.grabOffsetX = 0;
  claw.carryOffsetX = 0;
  claw.carryOffsetY = 0;
  claw.grabStartedAt = 0;
  prizeChute.flash = 0;
  canvasFrame.classList.remove('is-game-over');
  gameCompleteOverlay.hidden = true;
  gameCompleteOverlay.setAttribute('aria-hidden', 'true');
  leftButton.classList.remove('is-pressed');
  rightButton.classList.remove('is-pressed');
  dropButton.classList.remove('is-pressed');
  comboDisplay.classList.remove('combo-pop');
  machineElement.classList.remove('is-grabbing');
  createPrizes();
  startMission();
  updatePokedex();
  updateHud();
  showStatus('READY');
}

function startMoving(direction) {
  if (claw.state === GameState.READY && turns > 0) heldDirection = direction;
}

function stopMoving() {
  heldDirection = 0;
  leftButton.classList.remove('is-pressed');
  rightButton.classList.remove('is-pressed');
}

[leftButton, rightButton].forEach((button, index) => {
  const direction = index === 0 ? -1 : 1;
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    if (claw.state !== GameState.READY || turns <= 0) return;
    button.classList.add('is-pressed');
    startMoving(direction);
    if (button.setPointerCapture) button.setPointerCapture(event.pointerId);
  });
  button.addEventListener('pointerup', stopMoving);
  button.addEventListener('pointercancel', stopMoving);
  button.addEventListener('lostpointercapture', stopMoving);
  button.addEventListener('pointerleave', (event) => {
    if (!button.hasPointerCapture?.(event.pointerId)) stopMoving();
  });
  button.addEventListener('click', (event) => {
    if (event.detail === 0 && claw.state === GameState.READY && turns > 0) {
      claw.x = Math.max(45, Math.min(machine.width - 45, claw.x + direction * 62));
    }
  });
});

dropButton.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  if (claw.state !== GameState.READY || turns <= 0) return;
  dropButton.classList.add('is-pressed');
  if (dropButton.setPointerCapture) dropButton.setPointerCapture(event.pointerId);
});
dropButton.addEventListener('pointerup', () => dropButton.classList.remove('is-pressed'));
dropButton.addEventListener('pointercancel', () => dropButton.classList.remove('is-pressed'));
dropButton.addEventListener('lostpointercapture', () => dropButton.classList.remove('is-pressed'));
dropButton.addEventListener('click', dropClaw);
['contextmenu', 'dragstart', 'selectstart'].forEach((eventName) => {
  controlActions.addEventListener(eventName, (event) => event.preventDefault());
});
document.querySelector('#reset-btn').addEventListener('click', resetGame);
playAgainButton.addEventListener('click', () => {
  resetGame();
  dropButton.focus({ preventScroll: true });
});

function isEditableTarget(target) {
  return target instanceof Element && target.closest('input, textarea, select, [contenteditable="true"]');
}

document.addEventListener('keydown', (event) => {
  if (!gameCompleteOverlay.hidden) {
    if (event.key === 'Tab' || event.key === 'Escape') {
      event.preventDefault();
      playAgainButton.focus();
    }
    return;
  }
  if (isEditableTarget(event.target)) return;
  const key = event.key.toLowerCase();
  if (claw.state !== GameState.READY || turns <= 0) return;
  if (event.key === 'ArrowLeft' || key === 'a') {
    event.preventDefault();
    leftButton.classList.add('is-pressed');
    startMoving(-1);
  }
  if (event.key === 'ArrowRight' || key === 'd') {
    event.preventDefault();
    rightButton.classList.add('is-pressed');
    startMoving(1);
  }
  if (event.code === 'Space' && !event.repeat && !(event.target instanceof Element && event.target.closest('button, a'))) {
    event.preventDefault();
    dropButton.classList.add('is-pressed');
    dropClaw();
  }
});

document.addEventListener('keyup', (event) => {
  const key = event.key.toLowerCase();
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || key === 'a' || key === 'd') stopMoving();
  if (event.code === 'Space') dropButton.classList.remove('is-pressed');
});
window.addEventListener('blur', () => {
  stopMoving();
  dropButton.classList.remove('is-pressed');
});

buildCharacterGuide();
createPrizes();
startMission();
updatePokedex();
refreshTrainerLevel();
updateHud();
showStatus('READY');
requestAnimationFrame(render);
