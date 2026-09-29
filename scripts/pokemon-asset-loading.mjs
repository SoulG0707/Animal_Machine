import assert from 'node:assert/strict';
import { POKEMON_DATA } from '../js/config/pokemonData.js';
import { SpawnSystem } from '../js/systems/SpawnSystem.js';

class MockImage {
  static created = [];

  constructor() {
    this.complete = false;
    this.naturalWidth = 0;
    this.naturalHeight = 0;
    MockImage.created.push(this);
  }

  set src(path) {
    this.path = path;
    queueMicrotask(() => {
      this.complete = true;
      if (path.includes('__missing_asset_fixture__')) {
        this.onerror?.(new Error('fixture missing'));
        return;
      }
      this.naturalWidth = 150;
      this.naturalHeight = 150;
      this.onload?.();
    });
  }
}

const previousImage = globalThis.Image;
const previousWarn = console.warn;
const warnings = [];
globalThis.Image = MockImage;
console.warn = (...args) => warnings.push(args.join(' '));

try {
  const characters = [
    ...POKEMON_DATA,
    { ...POKEMON_DATA[0], name: 'Pikachu duplicate' },
    { name: 'Missing fixture', path: 'assets/characters/__missing_asset_fixture__.svg', width: 100, height: 100 },
  ];
  const spawn = new SpawnSystem({}, characters, {}, {}, {}, {});
  spawn.loadImages();
  const loaded = await spawn.assetsReady;
  assert.equal(loaded.length, 17);
  assert.equal(MockImage.created.length, 16, 'each unique path should create only one image');
  assert.equal(spawn.imageCache.size, 16);
  assert.equal(spawn.characters[0].image, spawn.characters[15].image, 'duplicate path did not reuse its image');
  assert(spawn.characters.slice(0, 16).every((character) => character.loaded && character.assetLoadState === 'loaded'));
  assert.equal(spawn.characters[16].assetLoadState, 'error');
  assert.deepEqual(spawn.assetFailures, [{ name: 'Missing fixture', path: 'assets/characters/__missing_asset_fixture__.svg' }]);
  assert.deepEqual(warnings, ['Missing Pokémon asset: Missing fixture (assets/characters/__missing_asset_fixture__.svg)']);
  assert.deepEqual(spawn.getSpriteDimensions({ ...spawn.characters[0], image: { naturalWidth: 900, naturalHeight: 10 } }),
    spawn.getSpriteDimensions(spawn.characters[0]), 'asset natural dimensions affected the gameplay frame');
  console.log(JSON.stringify({ loadedCharacters: 16, failedCharacter: spawn.characters[16].name,
    uniqueImageObjects: MockImage.created.length, duplicatePathReused: true,
    failureSettled: true, warningCount: warnings.length, valid: true }, null, 2));
} finally {
  if (previousImage === undefined) delete globalThis.Image;
  else globalThis.Image = previousImage;
  console.warn = previousWarn;
}
