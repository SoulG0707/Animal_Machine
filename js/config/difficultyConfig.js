export const DIFFICULTY_SETTINGS = Object.freeze({
  easy: Object.freeze({ label: 'DỄ', gripMissMin: 0.05, gripMissMax: 0.12 }),
  medium: Object.freeze({ label: 'VỪA', gripMissMin: 0.10, gripMissMax: 0.22 }),
  hard: Object.freeze({ label: 'KHÓ', gripMissMin: 0.18, gripMissMax: 0.35 }),
});

export const DEFAULT_DIFFICULTY = 'medium';
export const TEASING_MESSAGE_CHANCE = 0.9;

export function isDifficulty(value) {
  return Object.prototype.hasOwnProperty.call(DIFFICULTY_SETTINGS, value);
}
