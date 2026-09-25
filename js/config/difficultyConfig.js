export const DIFFICULTY_SETTINGS = Object.freeze({
  easy: Object.freeze({ label: 'DỄ', gripMissMin: 0.05, gripMissMax: 0.3 }),
  medium: Object.freeze({ label: 'VỪA', gripMissMin: 0.3, gripMissMax: 0.5 }),
  hard: Object.freeze({ label: 'KHÓ', gripMissMin: 0.5, gripMissMax: 0.9 }),
});

export const DEFAULT_DIFFICULTY = 'medium';
export const TEASING_MESSAGE_CHANCE = 0.9;

export function isDifficulty(value) {
  return Object.prototype.hasOwnProperty.call(DIFFICULTY_SETTINGS, value);
}
