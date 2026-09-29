import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { RenderSystem } from '../js/systems/RenderSystem.js';
import { GAME_CONFIG, MACHINE, SPRITE_ASPECT_RATIOS } from '../js/config/gameConfig.js';
import { POKEMON_DATA } from '../js/config/pokemonData.js';
import { SpawnSystem } from '../js/systems/SpawnSystem.js';

const spawn = new SpawnSystem({}, POKEMON_DATA, MACHINE, {}, {}, {});
const visualFrame = RenderSystem.prototype.getPokemonVisualFrame;
const rows = [];
for (const character of POKEMON_DATA) {
  const artificialImage = { naturalWidth: 900, naturalHeight: 40 };
  const dimensions = spawn.getSpriteDimensions({ ...character, image: artificialImage });
  assert(Math.abs(dimensions.width / dimensions.height - SPRITE_ASPECT_RATIOS[character.name]) < 1e-8,
    `${character.name}: asset dimensions leaked into its physical frame`);
  assert.equal(Math.max(dimensions.width, dimensions.height), 96 * GAME_CONFIG.prizeScale);
  const prize = { character, width: dimensions.width, height: dimensions.height };
  const fitted = visualFrame.call({}, prize, artificialImage);
  assert(fitted.width <= dimensions.width + 1e-8 && fitted.height <= dimensions.height + 1e-8,
    `${character.name}: actual source art does not fit within its fixed game frame`);
  assert(Math.abs(fitted.width / fitted.height - artificialImage.naturalWidth / artificialImage.naturalHeight) < 1e-8,
    `${character.name}: asset presentation was distorted`);
  rows.push({ name: character.name, frame: [dimensions.width, dimensions.height],
    displayedAsset: [fitted.width, fitted.height] });
}

const pikachu = POKEMON_DATA[0];
const transformedPrize = { character: { ...pikachu, visualTransform: {
  scale: 0.9, offsetX: 0.05, offsetY: -0.02,
} }, width: 80, height: 80 };
const transformed = visualFrame.call({}, transformedPrize, { naturalWidth: 100, naturalHeight: 100 });
assert.deepEqual(transformed, { width: 72, height: 72, offsetX: 4, offsetY: -1.6 });

const rendererSource = await readFile(new URL('../js/systems/RenderSystem.js', import.meta.url), 'utf8');
assert(!rendererSource.includes('PokemonVisuals.js'), 'production render path still imports procedural art');
console.log(JSON.stringify({ characters: rows.length, rows, presentationTransform: transformed,
  productionRendererIsAssetOnly: true, valid: true }, null, 2));
