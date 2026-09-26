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

export const CLAW_MOVEMENT = Object.freeze({
  leftBound: 45,
  rightBound: MACHINE.width - 45,
  maxSpeed: 280,
  acceleration: 1250,
  deceleration: 3200,
  reverseAcceleration: 2400,
  grabBrakeDuration: 0.08,
  tapImpulse: 175,
  carry: Object.freeze({
    maxSpeed: 430,
    acceleration: 1900,
    deceleration: 2600,
    arrivalRadius: 76,
  }),
  return: Object.freeze({
    maxSpeed: 440,
    acceleration: 2100,
    deceleration: 2800,
    arrivalRadius: 80,
  }),
  swing: Object.freeze({
    spring: 28,
    damping: 6.8,
    descendingDamping: 9.2,
    automaticDamping: 10.4,
    accelerationForce: 0.0012,
    maxAngle: 6 * Math.PI / 180,
    maxHeadOffset: 14,
    settleAngle: 0.001,
    settleVelocity: 0.008,
  }),
});

export const DEBUG_GRAB_PHYSICS = false;

export const GRAB_PHYSICS = Object.freeze({
  gripPointOffsetY: 31,
  captureDepth: 7,
  horizontalReachPadding: 24,
  verticalReachPadding: 30,
  perfectQuality: 0.84,
  perfectSlipMultiplier: 0.55,
  lowGripPenalty: 0.22,
  badGrabPenalty: 0.28,
  weightPenalty: 0.08,
  instabilityPenalty: 0.1,
  maxOffsetTilt: 18 * Math.PI / 180,
  maxTotalRotation: 22 * Math.PI / 180,
  dynamicTilt: 2.2 * Math.PI / 180,
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
