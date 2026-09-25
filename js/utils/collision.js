export function circleIntersectsRect(centerX, centerY, radius, rectangle, padding = 0) {
  const left = rectangle.x - padding;
  const right = rectangle.x + rectangle.width + padding;
  const top = rectangle.y - padding;
  const bottom = rectangle.y + rectangle.height + padding;
  const closestX = Math.max(left, Math.min(centerX, right));
  const closestY = Math.max(top, Math.min(centerY, bottom));
  return Math.hypot(centerX - closestX, centerY - closestY) < radius;
}
