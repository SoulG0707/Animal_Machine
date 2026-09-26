export function moveTowards(current, target, maxStep) {
  if (Math.abs(target - current) <= maxStep) return target;
  return current + Math.sign(target - current) * maxStep;
}

export function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

export function easeInOut(progress) {
  return progress * progress * (3 - 2 * progress);
}

export function formatPoints(points) {
  return (points > 0 ? '+' : '') + points;
}
