import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SPRITE_ASPECT_RATIOS } from '../js/config/gameConfig.js';
import { POKEMON_DATA } from '../js/config/pokemonData.js';
import { SpawnSystem } from '../js/systems/SpawnSystem.js';

const LOCKED_GEOMETRY_SHA256 = '666dfb351bbafac6269d19d84d37ea7e7c457b97d5e26d1b67b4130d1d5fefe9';
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const geometry = POKEMON_DATA.map(({ name, width, height, collider, grabZone, carryAnchor, centerOfMass }) =>
  ({ name, width, height, collider, grabZone, carryAnchor, centerOfMass }));
const geometryHash = createHash('sha256').update(JSON.stringify(geometry)).digest('hex');
assert.equal(geometryHash, LOCKED_GEOMETRY_SHA256, 'locked gameplay geometry changed');
assert.equal(POKEMON_DATA.length, 15);
assert.deepEqual(POKEMON_DATA.map(({ name }) => name), [
  'Pikachu', 'Bulbasaur', 'Charmander', 'Vulpix', 'Mewtwo', 'Chikorita', 'Cyndaquil', 'Poliwag',
  'Psyduck', 'Wartortle', 'Arbok', 'Clefairy', 'Kingler', 'Meowth', 'Ninetales',
]);
const spawn = new SpawnSystem({}, POKEMON_DATA, {}, {}, {}, {});

const assets = [];
for (const character of POKEMON_DATA) {
  assert(character.path.startsWith('assets/characters/'), `${character.name}: asset path is outside the user character folder`);
  const path = resolve(projectRoot, character.path);
  assert(path.startsWith(`${projectRoot}\\`), `${character.name}: asset path escaped project root`);
  const [fileInfo, source] = await Promise.all([stat(path), readFile(path, 'utf8')]);
  assert(fileInfo.size > 0, `${character.name}: asset file is empty`);
  assert(/<svg\b/i.test(source), `${character.name}: mapped asset is not an SVG`);
  assert(/viewBox=/i.test(source), `${character.name}: SVG is missing viewBox`);
  const visual = character.visualTransform || {};
  const dimensions = spawn.getSpriteDimensions({ ...character, image: { naturalWidth: 1, naturalHeight: 900 } });
  assert(Math.abs(dimensions.width / dimensions.height - SPRITE_ASPECT_RATIOS[character.name]) < 1e-8,
    `${character.name}: loaded image dimensions changed its gameplay frame`);
  for (const key of ['scale', 'scaleX', 'scaleY', 'offsetX', 'offsetY']) {
    if (visual[key] !== undefined) assert(Number.isFinite(visual[key]), `${character.name}: visual ${key} is not finite`);
  }
  assets.push({ name: character.name, path: character.path, bytes: fileInfo.size,
    geometryFrame: [dimensions.width, dimensions.height],
    presentation: { scale: visual.scale ?? 1, scaleX: visual.scaleX ?? 1, scaleY: visual.scaleY ?? 1,
      offsetX: visual.offsetX ?? 0, offsetY: visual.offsetY ?? 0 } });
}
assert.equal(new Set(assets.map(({ path }) => path)).size, 15, 'asset paths must be unique');

console.log(JSON.stringify({ geometryHash, geometryCount: geometry.length, assets,
  rendererSource: 'user-provided SVG files in assets/characters', valid: true }, null, 2));
