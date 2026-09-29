import assert from 'node:assert/strict';
import { POKEMON_DATA } from '../js/config/pokemonData.js';
import { Pokemon } from '../js/entities/Pokemon.js';
import {
  ellipseIntersectsCircle, ellipseIntersectsRect,
  getPokemonCollider, getPokemonGrabZone, pointInEllipse,
  shapeIntersectsOrientedRect, transformLocalPoint,
} from '../js/utils/pokemonGeometry.js';

const makePokemon = (character, width, height) => new Pokemon(
  character, 0, { width, height }, { x: 100, y: 100, centerX: 100 + width / 2, centerY: 100 + height / 2 },
  { color: '#fff', velocityX: 0, velocityY: 0, rotation: 0, angularVelocity: 0,
    radius: 30, mass: character.weight || 1, restitution: 0.1, friction: 0.8, shiny: false },
);

assert.equal(POKEMON_DATA.length, 15);
for (const character of POKEMON_DATA) {
  assert.equal(character.collider.type, 'ellipse');
  assert.equal(character.grabZone.type, 'ellipse');
  const prize = makePokemon(character, 76, 76);
  const body = getPokemonCollider(prize);
  const grab = getPokemonGrabZone(prize);
  assert(body.radiusX > grab.radiusX && body.radiusY > grab.radiusY, character.name);
  assert(Number.isFinite(prize.worldCenterOfMassX));
  assert(Number.isFinite(prize.getGrabAnchorOffset().y));
}

const charmander = POKEMON_DATA.find((character) => character.name === 'Charmander');
const original = makePokemon(charmander, 64, 70);
const doubled = makePokemon(charmander, 128, 140);
assert.equal(original.geometry.collider.radiusX, 22);
assert.equal(original.geometry.collider.radiusY, 30);
assert.equal(original.geometry.grabZone.offsetY, -12);
assert.equal(doubled.geometry.collider.radiusX, 44);
assert.equal(doubled.geometry.grabZone.radiusY, 24);
assert.equal(doubled.geometry.carryAnchor.y, -30);
original.rotation = Math.PI / 2;
original.updateGeometry();
const rotatedBody = getPokemonCollider(original);
const rotatedGrab = getPokemonGrabZone(original);
assert(Math.abs(rotatedBody.x - (original.centerX - 5)) < 1e-8);
assert(Math.abs(rotatedGrab.x - (original.centerX + 12)) < 1e-8);
assert(Math.abs(rotatedGrab.y - original.centerY) < 1e-8);
assert(pointInEllipse(rotatedGrab.x, rotatedGrab.y, rotatedGrab));
assert(ellipseIntersectsCircle(rotatedBody, rotatedBody.x, rotatedBody.y, 3));
assert(ellipseIntersectsRect(rotatedBody, { x: rotatedBody.x - 1, y: rotatedBody.y - 1, width: 2, height: 2 }));
const rotatedAnchor = transformLocalPoint(original,
  original.geometry.carryAnchor.x, original.geometry.carryAnchor.y);
assert(Math.abs(rotatedAnchor.x - (original.centerX + 15)) < 1e-8);

const clawZone = (x, y) => ({ x, y, axisX: 1, axisY: 0, halfWidth: 8, halfHeight: 8 });
assert(shapeIntersectsOrientedRect(rotatedGrab, clawZone(rotatedGrab.x, rotatedGrab.y)));
assert(!shapeIntersectsOrientedRect(rotatedGrab, clawZone(rotatedGrab.x - 35, rotatedGrab.y)));
const narrowEllipse = { type: 'ellipse', x: 0, y: 0, angle: 0, radiusX: 10, radiusY: 50 };
assert(ellipseIntersectsCircle(narrowEllipse, 11, 20, 2.5));
assert(shapeIntersectsOrientedRect(narrowEllipse, clawZone(11, 20)));
assert(!shapeIntersectsOrientedRect(narrowEllipse, clawZone(30, 20)));

const circle = makePokemon({ name: 'Circle', collider: { type: 'circle', radius: 20 },
  grabZone: { type: 'circle', radius: 12 } }, 60, 60);
assert.equal(getPokemonCollider(circle).type, 'circle');
assert(pointInEllipse(circle.centerX + 19, circle.centerY, getPokemonCollider(circle)));
assert(!pointInEllipse(circle.centerX + 21, circle.centerY, getPokemonCollider(circle)));
assert(shapeIntersectsOrientedRect(getPokemonGrabZone(circle), clawZone(circle.centerX, circle.centerY)));

const rectangle = makePokemon({ name: 'Rect', collider: { type: 'rect', width: 40, height: 30 },
  grabZone: { type: 'rect', width: 20, height: 12 } }, 60, 60);
assert.equal(getPokemonCollider(rectangle).type, 'rect');
assert(pointInEllipse(rectangle.centerX + 19, rectangle.centerY + 14, getPokemonCollider(rectangle)));
assert(!pointInEllipse(rectangle.centerX + 21, rectangle.centerY, getPokemonCollider(rectangle)));
assert(shapeIntersectsOrientedRect(getPokemonGrabZone(rectangle), clawZone(rectangle.centerX, rectangle.centerY)));

const legacy = makePokemon({ name: 'Legacy', centerOfMassX: 0.54, centerOfMassY: 0.58 }, 60, 80);
assert.equal(legacy.geometry.collider.radiusX, 24);
assert.equal(legacy.geometry.collider.radiusY, 33.6);
assert.equal(legacy.grabAnchorX, 0.5);
assert(Math.abs(legacy.grabAnchorY - 0.22) < 1e-8);
assert.equal(legacy.centerOfMassX, 0.54);
assert.equal(legacy.centerOfMassY, 0.58);
assert(legacy.geometry.grabZone.radiusX < legacy.geometry.collider.radiusX);

console.log(JSON.stringify({ characters: POKEMON_DATA.length, charmScale: doubled.geometry.collider,
  rotatedGrab, circle: getPokemonCollider(circle).type,
  rect: getPokemonCollider(rectangle).type, fallback: legacy.geometry, valid: true }, null, 2));
