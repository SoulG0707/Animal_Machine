import { POKEMON_GRAB_ANCHOR } from '../config/gameConfig.js';

export function transformLocalPoint(pokemon, offsetX, offsetY) {
  const cosine = Math.cos(pokemon.rotation || 0);
  const sine = Math.sin(pokemon.rotation || 0);
  return {
    x: pokemon.centerX + offsetX * cosine - offsetY * sine,
    y: pokemon.centerY + offsetX * sine + offsetY * cosine,
  };
}

function scaleShape(source, scaleX, scaleY) {
  const type = source.type || 'ellipse';
  const shape = {
    type,
    offsetX: (source.offsetX || 0) * scaleX,
    offsetY: (source.offsetY || 0) * scaleY,
    radiusX: (source.radiusX ?? source.radius ?? source.width / 2) * scaleX,
    radiusY: (source.radiusY ?? source.radius ?? source.height / 2) * scaleY,
  };
  if (!(shape.radiusX > 0) || !(shape.radiusY > 0)) throw new Error(`Invalid Pokémon ${type} shape`);
  if (type === 'circle' && Math.abs(shape.radiusX - shape.radiusY) > 0.001) shape.type = 'ellipse';
  return shape;
}

export function createPokemonGeometry(character, width, height) {
  const referenceWidth = character.width || width;
  const referenceHeight = character.height || height;
  const scaleX = width / referenceWidth;
  const scaleY = height / referenceHeight;
  const collider = scaleShape(character.collider || {
    type: 'ellipse', offsetY: height * 0.08,
    radiusX: width * 0.4, radiusY: height * 0.42,
  }, character.collider ? scaleX : 1, character.collider ? scaleY : 1);
  const grabZone = scaleShape(character.grabZone || {
    type: 'ellipse', offsetX: collider.offsetX,
    offsetY: collider.offsetY - collider.radiusY * 0.18,
    radiusX: collider.radiusX * 0.7, radiusY: collider.radiusY * 0.65,
  }, character.grabZone ? scaleX : 1, character.grabZone ? scaleY : 1);
  const centerOfMass = character.centerOfMass
    ? { x: character.centerOfMass.offsetX * scaleX, y: character.centerOfMass.offsetY * scaleY }
    : { x: ((character.centerOfMassX ?? 0.5) - 0.5) * width,
      y: ((character.centerOfMassY ?? 0.5) - 0.5) * height };
  const carryAnchor = character.carryAnchor
    ? { x: character.carryAnchor.offsetX * scaleX, y: character.carryAnchor.offsetY * scaleY }
    : { x: ((character.grabAnchorX ?? POKEMON_GRAB_ANCHOR.x) - 0.5) * width,
      y: ((character.grabAnchorY ?? POKEMON_GRAB_ANCHOR.y) - 0.5) * height };
  return { collider, grabZone, centerOfMass, carryAnchor };
}

function worldShape(pokemon, localShape) {
  const center = transformLocalPoint(pokemon, localShape.offsetX, localShape.offsetY);
  return { ...localShape, ...center, angle: pokemon.rotation || 0 };
}

export function getPokemonCollider(pokemon) {
  return worldShape(pokemon, pokemon.geometry.collider);
}

export function getPokemonGrabZone(pokemon) {
  return worldShape(pokemon, pokemon.geometry.grabZone);
}

export function shapeRadiusAlong(shape, directionX, directionY) {
  const cosine = Math.cos(shape.angle);
  const sine = Math.sin(shape.angle);
  const localX = directionX * cosine + directionY * sine;
  const localY = -directionX * sine + directionY * cosine;
  if (shape.type === 'rect') {
    return Math.min(
      Math.abs(localX) < 1e-9 ? Infinity : shape.radiusX / Math.abs(localX),
      Math.abs(localY) < 1e-9 ? Infinity : shape.radiusY / Math.abs(localY),
    );
  }
  return 1 / Math.hypot(localX / shape.radiusX, localY / shape.radiusY);
}

export function shapeProjectionRadius(shape, axisX, axisY) {
  const cosine = Math.cos(shape.angle);
  const sine = Math.sin(shape.angle);
  const localX = axisX * cosine + axisY * sine;
  const localY = -axisX * sine + axisY * cosine;
  if (shape.type === 'rect') return Math.abs(localX) * shape.radiusX + Math.abs(localY) * shape.radiusY;
  return Math.hypot(localX * shape.radiusX, localY * shape.radiusY);
}

export function shapeSupportPoint(shape, axisX, axisY) {
  const cosine = Math.cos(shape.angle);
  const sine = Math.sin(shape.angle);
  const localDirectionX = axisX * cosine + axisY * sine;
  const localDirectionY = -axisX * sine + axisY * cosine;
  let localX;
  let localY;
  if (shape.type === 'rect') {
    localX = Math.sign(localDirectionX) * shape.radiusX;
    localY = Math.sign(localDirectionY) * shape.radiusY;
  } else {
    const radius = Math.hypot(localDirectionX * shape.radiusX, localDirectionY * shape.radiusY);
    localX = shape.radiusX ** 2 * localDirectionX / radius;
    localY = shape.radiusY ** 2 * localDirectionY / radius;
  }
  return {
    x: shape.x + localX * cosine - localY * sine,
    y: shape.y + localX * sine + localY * cosine,
  };
}

export function getShapeBounds(shape) {
  const halfWidth = shapeProjectionRadius(shape, 1, 0);
  const halfHeight = shapeProjectionRadius(shape, 0, 1);
  return { left: shape.x - halfWidth, right: shape.x + halfWidth,
    top: shape.y - halfHeight, bottom: shape.y + halfHeight };
}

export function pointInEllipse(pointX, pointY, shape) {
  const cosine = Math.cos(shape.angle);
  const sine = Math.sin(shape.angle);
  const deltaX = pointX - shape.x;
  const deltaY = pointY - shape.y;
  const localX = deltaX * cosine + deltaY * sine;
  const localY = -deltaX * sine + deltaY * cosine;
  if (shape.type === 'rect') return Math.abs(localX) <= shape.radiusX && Math.abs(localY) <= shape.radiusY;
  return (localX / shape.radiusX) ** 2 + (localY / shape.radiusY) ** 2 <= 1;
}

export function ellipseIntersectsCircle(shape, x, y, radius) {
  const cosine = Math.cos(shape.angle);
  const sine = Math.sin(shape.angle);
  const deltaX = x - shape.x;
  const deltaY = y - shape.y;
  const localX = Math.abs(deltaX * cosine + deltaY * sine);
  const localY = Math.abs(-deltaX * sine + deltaY * cosine);
  if (shape.type === 'rect') {
    return Math.hypot(
      Math.max(0, localX - shape.radiusX),
      Math.max(0, localY - shape.radiusY),
    ) <= radius;
  }
  if (localX ** 2 / shape.radiusX ** 2 + localY ** 2 / shape.radiusY ** 2 <= 1) return true;
  if (radius <= 0) return false;
  // Closest point on the ellipse: solve the monotone Lagrange multiplier equation.
  const squaredX = shape.radiusX ** 2;
  const squaredY = shape.radiusY ** 2;
  const distanceSquaredAt = (lambda) => (
    (shape.radiusX * localX / (lambda + squaredX)) ** 2
    + (shape.radiusY * localY / (lambda + squaredY)) ** 2
  );
  let low = 0;
  let high = Math.max(shape.radiusX, shape.radiusY) * Math.hypot(localX, localY);
  while (distanceSquaredAt(high) > 1) high *= 2;
  for (let index = 0; index < 24; index += 1) {
    const middle = (low + high) / 2;
    if (distanceSquaredAt(middle) > 1) low = middle;
    else high = middle;
  }
  const nearestX = squaredX * localX / (high + squaredX);
  const nearestY = squaredY * localY / (high + squaredY);
  return Math.hypot(localX - nearestX, localY - nearestY) <= radius;
}

export function ellipseIntersectsRect(shape, rectangle) {
  return shapeIntersectsOrientedRect(shape, {
    x: rectangle.x + rectangle.width / 2,
    y: rectangle.y + rectangle.height / 2,
    axisX: 1, axisY: 0,
    halfWidth: rectangle.width / 2,
    halfHeight: rectangle.height / 2,
  });
}

export function shapeIntersectsOrientedRect(shape, rectangle) {
  const vertices = [
    [-rectangle.halfWidth, -rectangle.halfHeight],
    [rectangle.halfWidth, -rectangle.halfHeight],
    [rectangle.halfWidth, rectangle.halfHeight],
    [-rectangle.halfWidth, rectangle.halfHeight],
  ].map(([localX, localY]) => ({
    x: rectangle.x + localX * rectangle.axisX - localY * rectangle.axisY,
    y: rectangle.y + localX * rectangle.axisY + localY * rectangle.axisX,
  }));
  const cosine = Math.cos(shape.angle);
  const sine = Math.sin(shape.angle);
  const localVertices = vertices.map((vertex) => {
    const deltaX = vertex.x - shape.x;
    const deltaY = vertex.y - shape.y;
    return {
      x: (deltaX * cosine + deltaY * sine) / shape.radiusX,
      y: (-deltaX * sine + deltaY * cosine) / shape.radiusY,
    };
  });
  if (shape.type === 'rect') {
    const axes = [{ x: 1, y: 0 }, { x: 0, y: 1 }];
    for (let index = 0; index < 2; index += 1) {
      const first = localVertices[index];
      const second = localVertices[index + 1];
      axes.push({ x: second.y - first.y, y: first.x - second.x });
    }
    return axes.every((axis) => {
      const projections = localVertices.map((vertex) => vertex.x * axis.x + vertex.y * axis.y);
      const extent = Math.abs(axis.x) + Math.abs(axis.y);
      return Math.max(...projections) >= -extent && Math.min(...projections) <= extent;
    });
  }
  let inside = true;
  for (let index = 0; index < 4; index += 1) {
    const first = localVertices[index];
    const second = localVertices[(index + 1) % 4];
    const edgeX = second.x - first.x;
    const edgeY = second.y - first.y;
    if (edgeX * -first.y - edgeY * -first.x < 0) inside = false;
    const progress = Math.max(0, Math.min(1,
      -(first.x * edgeX + first.y * edgeY) / (edgeX * edgeX + edgeY * edgeY),
    ));
    const nearestX = first.x + edgeX * progress;
    const nearestY = first.y + edgeY * progress;
    if (nearestX * nearestX + nearestY * nearestY <= 1) return true;
  }
  return inside;
}
