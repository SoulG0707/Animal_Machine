export const DIFFICULTY_SETTINGS = Object.freeze({
  easy: Object.freeze({
    label: 'DỄ', gripMissMin: 0.05, gripMissMax: 0.3,
    gripStrength: 1.14, baseSlip: 0.03, minSlip: 0.02, maxSlip: 0.3,
    turnTime: 20,
  }),
  medium: Object.freeze({
    label: 'VỪA', gripMissMin: 0.3, gripMissMax: 0.5,
    gripStrength: 1, baseSlip: 0.06, minSlip: 0.03, maxSlip: 0.38,
    turnTime: 15,
  }),
  hard: Object.freeze({
    label: 'KHÓ', gripMissMin: 0.5, gripMissMax: 0.9,
    gripStrength: 0.86, baseSlip: 0.1, minSlip: 0.05, maxSlip: 0.45,
    turnTime: 10,
  }),
});

export const DEFAULT_DIFFICULTY = 'medium';
export const TEASING_MESSAGE_CHANCE = 0.9;

export function isDifficulty(value) {
  return Object.prototype.hasOwnProperty.call(DIFFICULTY_SETTINGS, value);
}
