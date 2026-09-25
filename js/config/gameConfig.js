export const MACHINE = Object.freeze({ width: 720, height: 650, floorY: 545 });

export const PHYSICS = Object.freeze({
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

export const ANIMATION = Object.freeze({
  descendSpeed: 500,
  liftSpeed: 520,
  carrySpeed: 430,
  returnSpeed: 440,
  closeDuration: 180,
  slipLoosenDuration: 110,
  dropOpenDuration: 140,
  chuteFadeDuration: 240,
});

export const GAME_CONFIG = Object.freeze({
  clawScale: 0.84,
  prizeScale: 0.8,
  clawLaneBottom: 136,
  prizeAreaPadding: 12,
  shinyChance: 0.018,
  experiencePerLevel: 250,
  initialTurns: 5,
});

export const RARITY_COLORS = Object.freeze({
  common: '#52a879',
  rare: '#4b9dce',
  epic: '#a36ac7',
  legendary: '#e9ad35',
});

export const FALLBACK_COLORS = Object.freeze([
  '#e6464d', '#5cae75', '#f47b32', '#eab640',
  '#8064a9', '#72bb69', '#db6f35', '#4ea3b7',
]);

export const SPRITE_ASPECT_RATIOS = Object.freeze({
  Bulbasaur: 730.616 / 729.493,
  Meowth: 1097.67 / 1260.96,
  Mewtwo: 1019.249 / 1419.975,
  Ninetales: 1086.06 / 1022.313,
  Pikachu: 723.9 / 940,
});

export const ENCOURAGING_MESSAGES = Object.freeze([
  'Cố lên! Sắp gắp được {name} rồi!',
  'Một chút nữa thôi!',
  'Gần lắm rồi!',
]);

export const TEASING_MESSAGES = Object.freeze([
  'Ui, có thế cũng hụt à, gà =))))',
  'Ơ kìa, tới miệng còn rớt =))))',
  'Càng gắp phản chủ rồi =))))',
  'Ủa alo? Rớt thật luôn cha =)))',
  '{name}: bắt được tôi còn lâu nhé!',
  'Úi gà thía =)))))',
  'Ê =)))))',
  'Gắp mà rớt, gà quá =))))',
  'Thua rồi =))))',
]);
