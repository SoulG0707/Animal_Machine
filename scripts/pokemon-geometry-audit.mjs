import assert from 'node:assert/strict';
import { POKEMON_DATA } from '../js/config/pokemonData.js';
import { Pokemon } from '../js/entities/Pokemon.js';
import {
  getPokemonCollider, getPokemonGrabZone, getShapeBounds, pointInEllipse, shapeSupportPoint,
  transformLocalPoint,
} from '../js/utils/pokemonGeometry.js';

assert.equal(POKEMON_DATA.length, 15);
const findings = [];
for (const character of POKEMON_DATA) {
  for (const key of ['collider', 'grabZone', 'centerOfMass', 'carryAnchor']) {
    assert(character[key], `${character.name}: missing ${key}`);
  }
  const width = character.width;
  const height = character.height;
  assert(Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0);
  for (const shape of [character.collider, character.grabZone]) {
    assert(['ellipse', 'circle', 'rect'].includes(shape.type), `${character.name}: invalid shape type`);
    for (const key of ['offsetX', 'offsetY', 'radiusX', 'radiusY']) {
      assert(Number.isFinite(shape[key]), `${character.name}: ${key} is not finite`);
    }
    assert(shape.radiusX > 0 && shape.radiusY > 0, `${character.name}: nonpositive radius`);
  }
  for (const point of [character.centerOfMass, character.carryAnchor]) {
    assert(Number.isFinite(point.offsetX) && Number.isFinite(point.offsetY), `${character.name}: nonfinite anchor`);
    assert(Math.abs(point.offsetX) <= width * 0.5 && Math.abs(point.offsetY) <= height * 0.5,
      `${character.name}: anchor outside visual bounds`);
  }
  const prize = new Pokemon(character, 0, { width, height },
    { x: 100, y: 100 },
    { color: '#fff', velocityX: 0, velocityY: 0, rotation: 0, angularVelocity: 0,
      radius: 30, mass: character.weight, restitution: 0.1, friction: 0.8, shiny: false });
  const body = getPokemonCollider(prize);
  const grab = getPokemonGrabZone(prize);
  const bounds = getShapeBounds(body);
  const margin = Math.max(width, height) * 0.08;
  assert(bounds.left >= prize.x - margin && bounds.right <= prize.x + width + margin
    && bounds.top >= prize.y - margin && bounds.bottom <= prize.y + height + margin,
  `${character.name}: collider outside visual bounds`);
  assert(pointInEllipse(grab.x, grab.y, body), `${character.name}: grab center outside collider`);
  const grabAreaRatio = grab.radiusX * grab.radiusY / (body.radiusX * body.radiusY);
  assert(grabAreaRatio >= 0.12 && grabAreaRatio <= 0.7, `${character.name}: grab zone too large/small`);
  const mass = transformLocalPoint(prize, prize.geometry.centerOfMass.x, prize.geometry.centerOfMass.y);
  assert(pointInEllipse(mass.x, mass.y, body), `${character.name}: COM outside body`);
  const anchor = transformLocalPoint(prize, prize.geometry.carryAnchor.x, prize.geometry.carryAnchor.y);
  assert(anchor.y < mass.y, `${character.name}: carry anchor should sit above COM`);
  for (const angle of [0.16, -0.16]) {
    prize.rotation = angle;
    prize.updateGeometry();
    const rotated = getPokemonGrabZone(prize);
    const expected = transformLocalPoint(prize, prize.geometry.grabZone.offsetX, prize.geometry.grabZone.offsetY);
    assert(Math.hypot(rotated.x - expected.x, rotated.y - expected.y) < 1e-8,
      `${character.name}: grab zone does not rotate with sprite`);
    const rotatedMass = transformLocalPoint(prize, prize.geometry.centerOfMass.x, prize.geometry.centerOfMass.y);
    assert(Math.hypot(rotatedMass.x - prize.worldCenterOfMassX, rotatedMass.y - prize.worldCenterOfMassY) < 1e-8,
      `${character.name}: COM does not rotate with sprite`);
    const rotatedBody = getPokemonCollider(prize);
    const ground = shapeSupportPoint(rotatedBody, 0, 1);
    assert(Math.abs(ground.y - getShapeBounds(rotatedBody).bottom) < 1e-8,
      `${character.name}: ground marker is not the body support point`);
  }
  findings.push({ name: character.name, body: [body.radiusX, body.radiusY],
    grab: [grab.radiusX, grab.radiusY], grabAreaRatio: Number(grabAreaRatio.toFixed(2)),
    anchorY: character.carryAnchor.offsetY, comY: character.centerOfMass.offsetY });
}
console.log(JSON.stringify({ count: findings.length, findings, valid: true }, null, 2));
