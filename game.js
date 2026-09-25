const canvas = document.querySelector('#game-canvas');
const context = canvas.getContext('2d');
context.imageSmoothingEnabled = true;
context.imageSmoothingQuality = 'high';

const scoreElement = document.querySelector('#score');
const turnsElement = document.querySelector('#turns');
const bestScoreElement = document.querySelector('#best-score');
const prizeCountElement = document.querySelector('#prize-count');
const statusText = document.querySelector('#status-text');
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
  DROPPING: 'dropping',
  RETURNING: 'returning',
  GAME_OVER: 'game-over',
});
const claw = {
  x: 350,
  y: 76,
  width: 58,
  height: 28,
  targetY: 76,
  state: GameState.READY,
  caught: null,
  currentGrab: null,
  openAmount: 1,
  phaseElapsed: 0,
  returnX: 350,
  carryOffsetX: 0,
  carryOffsetY: 0,
  grabStartedAt: 0,
};
const CLAW_SCALE = 0.84;
const PRIZE_SCALE = 0.8;
const CLAW_LANE_BOTTOM = 136;
const PRIZE_AREA_PADDING = 12;
const PRIZE_MIN_GAP = 12;
const PRIZE_POSITION_ATTEMPTS = 1000;
const PRIZE_ARRANGEMENT_RESTARTS = 40;
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
  x: 56,
  width: 112,
  centerX: 112,
  opening: {
    x: 64,
    y: machine.floorY + 7,
    width: 96,
    bottom: machine.height - 30,
  },
  exclusion: {
    x: 40,
    y: machine.floorY - 82,
    width: 144,
    height: machine.height - machine.floorY + 92,
  },
  landingBottom: machine.height - 34,
  flash: 0,
};
const ANIMATION = {
  descendSpeed: 500,
  liftSpeed: 520,
  carrySpeed: 430,
  returnSpeed: 440,
  closeDuration: 180,
  dropOpenDuration: 140,
  dropDuration: 380,
  bounceDuration: 150,
  fadeDuration: 110,
  carryY: CLAW_LANE_BOTTOM - 18,
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

function positionsOverlap(candidate, existing) {
  const separatedOnX = candidate.x + candidate.width + PRIZE_MIN_GAP <= existing.x
    || existing.x + existing.width + PRIZE_MIN_GAP <= candidate.x;
  const separatedOnY = candidate.y + candidate.height + PRIZE_MIN_GAP <= existing.y
    || existing.y + existing.height + PRIZE_MIN_GAP <= candidate.y;
  return !separatedOnX && !separatedOnY;
}

function isValidPrizePosition(candidate, placed) {
  if (candidate.x < prizeBounds.left || candidate.y < prizeBounds.top) return false;
  if (candidate.x + candidate.width > prizeBounds.right || candidate.y + candidate.height > prizeBounds.bottom) return false;
  if (positionsOverlap(candidate, prizeChute.exclusion)) return false;
  return placed.every((prize) => !positionsOverlap(candidate, prize));
}

function findRandomPosition(character, placed, attempts = PRIZE_POSITION_ATTEMPTS) {
  const dimensions = getSpriteDimensions(character);
  const maxX = prizeBounds.right - dimensions.width;
  const maxY = prizeBounds.bottom - dimensions.height;
  if (maxX < prizeBounds.left || maxY < prizeBounds.top) return null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const candidate = {
      x: prizeBounds.left + Math.random() * (maxX - prizeBounds.left),
      y: prizeBounds.top + Math.random() * (maxY - prizeBounds.top),
      width: dimensions.width,
      height: dimensions.height,
    };
    if (isValidPrizePosition(candidate, placed)) return candidate;
  }
  return null;
}

function generateRandomArrangement(restarts = PRIZE_ARRANGEMENT_RESTARTS, attempts = PRIZE_POSITION_ATTEMPTS) {
  for (let restart = 0; restart < restarts; restart += 1) {
    const placed = [];
    let complete = true;
    for (const character of shuffledCharacters()) {
      const position = findRandomPosition(character, placed, attempts);
      if (!position) {
        complete = false;
        break;
      }
      placed.push({ ...position, character });
    }
    if (complete && placed.length === characterAssets.length) return placed;
  }
  return null;
}

function createPrizes() {
  let arrangement = generateRandomArrangement();
  if (!arrangement) arrangement = generateRandomArrangement(24, 12000);
  if (!arrangement) {
    throw new Error('Could not create a non-overlapping random Pokémon layout inside the prize area.');
  }
  prizes = arrangement.map((pokemon, index) => ({
    ...pokemon,
    centerX: pokemon.x + pokemon.width / 2,
    centerY: pokemon.y + pokemon.height / 2,
    bottomY: pokemon.y + pokemon.height,
    color: fallbackColors[index % fallbackColors.length],
    name: pokemon.character.name,
    collected: false,
    shiny: Math.random() < SHINY_CHANCE,
  }));
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
  const outerY = machine.floorY - 4;
  const outerHeight = machine.height - outerY - 10;
  context.fillStyle = '#243346';
  context.fillRect(prizeChute.x, outerY, prizeChute.width, outerHeight);
  context.fillStyle = '#fffcf3';
  context.fillRect(prizeChute.x + 5, outerY + 5, prizeChute.width - 10, outerHeight - 10);
  context.fillStyle = '#243346';
  context.fillRect(prizeChute.opening.x - 3, prizeChute.opening.y - 3, prizeChute.opening.width + 6, prizeChute.opening.bottom - prizeChute.opening.y + 7);
  context.fillStyle = '#101b2b';
  context.fillRect(prizeChute.opening.x, prizeChute.opening.y, prizeChute.opening.width, prizeChute.opening.bottom - prizeChute.opening.y);
  context.fillStyle = '#e6464d';
  context.fillRect(prizeChute.x, outerY, prizeChute.width, 6);
  context.fillStyle = '#ffd342';
  context.font = 'bold 9px monospace';
  context.textAlign = 'center';
  context.fillText('PRIZE', prizeChute.centerX, outerY + 16);
  context.fillStyle = '#243346';
  context.fillRect(prizeChute.x, prizeChute.opening.bottom + 2, prizeChute.width, machine.height - prizeChute.opening.bottom - 12);
  context.fillStyle = '#fffcf3';
  context.beginPath();
  context.arc(prizeChute.centerX, prizeChute.opening.bottom + 12, 7, Math.PI, Math.PI * 2);
  context.fill();
  context.fillStyle = '#e6464d';
  context.fillRect(prizeChute.centerX - 7, prizeChute.opening.bottom + 12, 14, 2);
  context.fillStyle = '#243346';
  context.fillRect(prizeChute.centerX - 1, prizeChute.opening.bottom + 10, 2, 5);
  context.fillStyle = '#fffcf3';
  context.fillRect(prizeChute.centerX - 3, prizeChute.opening.bottom + 10, 6, 2);
  if (prizeChute.flash > 0) {
    context.save();
    context.globalAlpha = prizeChute.flash * 0.62;
    context.fillStyle = '#ffd342';
    context.fillRect(prizeChute.x - 3, outerY - 3, prizeChute.width + 6, 5);
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
  if (prize.collected || prize.isGrabbed) return;
  context.save();
  if (prize.isDropping) {
    context.beginPath();
    context.rect(
      prizeChute.opening.x,
      prizeChute.opening.y,
      prizeChute.opening.width,
      prizeChute.opening.bottom - prizeChute.opening.y,
    );
    context.clip();
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
  const scale = prize.isDropping ? prize.dropScale : 1;
  const drawHeight = prize.height * scale;
  const drawWidth = prize.width * scale;
  const drawTop = prize.y + (prize.height - drawHeight) / 2;
  const drawCenterX = prize.centerX;
  const drawBottom = drawTop + drawHeight;
  if (!drawCharacter(prize.character, drawCenterX, drawTop, 96 * PRIZE_SCALE * scale, drawBottom)) drawPixelPokeball(prize);
  if (!prize.isDropping && prize.shiny) {
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
  if (!prize || !prize.isGrabbed) return;
  const sway = Math.sin((time - claw.grabStartedAt) * 0.008) * 2.5;
  prize.x = claw.x + claw.carryOffsetX + sway - prize.width / 2;
  prize.y = claw.y + claw.carryOffsetY;
  updatePrizeGeometry(prize);
}

function beginPrizeDrop() {
  claw.state = GameState.DROPPING;
  claw.phaseElapsed = 0;
  claw.dropPhase = 'opening';
  claw.openAmount = 0;
  prizeChute.flash = 1;
  showStatus('CAUGHT!', 1200);
}

function releasePrizeIntoChute(prize) {
  prize.isGrabbed = false;
  prize.isDropping = true;
  prize.dropPhase = 'falling';
  prize.dropElapsed = 0;
  prize.dropStartY = prize.y;
  prize.dropTargetY = prizeChute.landingBottom - prize.height;
  prize.dropAlpha = 1;
  prize.dropScale = 1;
  claw.caught = null;
  claw.dropPhase = 'falling';
  claw.phaseElapsed = 0;
}

function advancePrizeDrop(prize, elapsed) {
  prize.dropElapsed += elapsed;
  if (prize.dropPhase === 'falling') {
    const progress = Math.min(prize.dropElapsed / ANIMATION.dropDuration, 1);
    const gravityEase = progress * progress;
    prize.y = prize.dropStartY + (prize.dropTargetY - prize.dropStartY) * gravityEase;
    prize.dropScale = 1 - 0.035 * progress;
    if (progress >= 1) {
      prize.dropPhase = 'bounce';
      prize.dropElapsed = 0;
      prize.y = prize.dropTargetY;
      prize.dropScale = 0.965;
    }
  } else if (prize.dropPhase === 'bounce') {
    const progress = Math.min(prize.dropElapsed / ANIMATION.bounceDuration, 1);
    prize.y = prize.dropTargetY - Math.sin(progress * Math.PI) * 6;
    prize.dropScale = 0.965 + Math.sin(progress * Math.PI) * 0.035;
    if (progress >= 1) {
      prize.dropPhase = 'fade';
      prize.dropElapsed = 0;
      prize.y = prize.dropTargetY;
      prize.dropScale = 0.965;
    }
  } else if (prize.dropPhase === 'fade') {
    const progress = Math.min(prize.dropElapsed / ANIMATION.fadeDuration, 1);
    prize.y = prize.dropTargetY;
    prize.dropScale = 0.965 - progress * 0.1;
    prize.dropAlpha = 1 - progress;
    if (progress >= 1) {
      updatePrizeGeometry(prize);
      return true;
    }
  }
  updatePrizeGeometry(prize);
  return false;
}

function finishGame() {
  stopMoving();
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
        const perfect = Math.abs(prize.centerX - claw.x) <= 14;
        claw.carryOffsetX = prize.centerX - claw.x;
        claw.carryOffsetY = prize.y - claw.y;
        claw.grabStartedAt = time;
        claw.currentGrab = {
          pokemon: prize,
          perfect,
          basePoints: prize.character.score,
          comboMultiplier: Math.min(currentCombo + 1, 3),
          startX: claw.returnX,
        };
        claw.caught = prize;
        prize.perfect = perfect;
        prize.isGrabbed = true;
        claw.openAmount = 1;
        claw.phaseElapsed = 0;
        claw.state = GameState.CLOSING;
        showStatus('GOTCHA!');
      } else if (claw.y >= claw.targetY) {
        claw.state = GameState.LIFTING;
      }
      break;
    }
    case GameState.CLOSING: {
      claw.phaseElapsed += elapsed;
      const progress = Math.min(claw.phaseElapsed / ANIMATION.closeDuration, 1);
      claw.openAmount = 1 - easeInOut(progress);
      if (progress >= 1) {
        claw.openAmount = 0;
        claw.phaseElapsed = 0;
        claw.state = GameState.LIFTING;
      }
      break;
    }
    case GameState.LIFTING: {
      claw.y = Math.max(76, claw.y - ANIMATION.liftSpeed * step);
      if (claw.y <= 76) {
        claw.y = 76;
        if (claw.currentGrab) {
          claw.carryTargetX = Math.max(36, Math.min(machine.width - 36, prizeChute.centerX - claw.carryOffsetX));
          claw.state = GameState.CARRYING;
          claw.phaseElapsed = 0;
        } else {
          currentCombo = 0;
          comboDisplay.classList.remove('combo-pop');
          updateHud();
          claw.openAmount = 1;
          claw.state = GameState.READY;
          machineElement.classList.remove('is-grabbing');
          dropButton.classList.remove('is-pressed');
          if (turns <= 0) finishGame();
          else {
            showStatus('MISSED!');
            readyStatusPending = true;
          }
        }
      }
      break;
    }
    case GameState.CARRYING: {
      if (claw.y < ANIMATION.carryY) {
        claw.y = Math.min(ANIMATION.carryY, claw.y + ANIMATION.liftSpeed * step);
      } else {
        claw.x = moveTowards(claw.x, claw.carryTargetX, ANIMATION.carrySpeed * step);
        if (claw.x === claw.carryTargetX) beginPrizeDrop();
      }
      break;
    }
    case GameState.DROPPING: {
      const prize = claw.currentGrab && claw.currentGrab.pokemon;
      if (!prize) break;
      if (claw.dropPhase === 'opening') {
        claw.phaseElapsed += elapsed;
        const progress = Math.min(claw.phaseElapsed / ANIMATION.dropOpenDuration, 1);
        claw.openAmount = easeInOut(progress);
        if (progress >= 1) releasePrizeIntoChute(prize);
      } else if (advancePrizeDrop(prize, elapsed)) {
        prize.isDropping = false;
        prize.collected = true;
        const resultStatus = processCatch(claw.currentGrab);
        claw.currentGrab = null;
        claw.caught = null;
        claw.returnTargetX = claw.returnX;
        claw.phaseElapsed = 0;
        claw.state = GameState.RETURNING;
        showStatus(resultStatus);
      }
      break;
    }
    case GameState.RETURNING: {
      claw.x = moveTowards(claw.x, claw.returnTargetX, ANIMATION.returnSpeed * step);
      claw.y = moveTowards(claw.y, 76, ANIMATION.returnSpeed * 0.7 * step);
      claw.openAmount = moveTowards(claw.openAmount, 1, step * 4);
      if (claw.x === claw.returnTargetX && claw.y === 76 && claw.openAmount === 1) {
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
  context.clearRect(0, 0, machine.width, machine.height);
  drawBackground();
  drawPrizeChute(elapsed);
  prizes.forEach((prize, index) => drawPrize(prize, index, time));
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
  return prizes.find((prize) => {
    if (prize.collected || prize.isGrabbed || prize.isDropping || Math.abs(prize.centerX - claw.x) >= 55) return false;
    const prizeTop = prize.y;
    const prizeBottom = prize.y + prize.height;
    return clawBottom >= prizeTop && clawTop <= prizeBottom;
  });
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
  turns -= 1;
  claw.returnX = claw.x;
  claw.returnTargetX = claw.x;
  claw.state = GameState.DESCENDING;
  claw.targetY = machine.floorY - 75;
  claw.currentGrab = null;
  claw.caught = null;
  claw.phaseElapsed = 0;
  claw.openAmount = 1;
  machineElement.classList.add('is-grabbing');
  dropButton.classList.add('is-pressed');
  showStatus('GRABBING...');
  updateHud();
}

function resetGame() {
  clearTimeout(statusTimer);
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
  claw.x = 350;
  claw.y = 76;
  claw.state = GameState.READY;
  claw.targetY = 76;
  claw.returnX = 350;
  claw.returnTargetX = 350;
  claw.caught = null;
  claw.currentGrab = null;
  claw.openAmount = 1;
  claw.phaseElapsed = 0;
  claw.carryOffsetX = 0;
  claw.carryOffsetY = 0;
  claw.grabStartedAt = 0;
  claw.dropPhase = null;
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
  if (claw.state !== GameState.READY || turns <= 0) return;
  dropButton.classList.add('is-pressed');
  if (dropButton.setPointerCapture) dropButton.setPointerCapture(event.pointerId);
});
dropButton.addEventListener('pointerup', () => dropButton.classList.remove('is-pressed'));
dropButton.addEventListener('pointercancel', () => dropButton.classList.remove('is-pressed'));
dropButton.addEventListener('lostpointercapture', () => dropButton.classList.remove('is-pressed'));
dropButton.addEventListener('click', dropClaw);
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
