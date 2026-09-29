import assert from 'node:assert/strict';
import { PROGRESSION_CONFIG, PROFILE_VERSION } from '../js/config/progressionConfig.js';
import { POKEMON_DATA } from '../js/config/pokemonData.js';
import { GameEventBus } from '../js/core/GameEventBus.js';
import { GameState } from '../js/core/GameState.js';
import { PlayerProfile } from '../js/storage/PlayerProfile.js';
import { StorageService } from '../js/storage/StorageService.js';
import { AchievementSystem } from '../js/systems/AchievementSystem.js';
import { CollectionSystem } from '../js/systems/CollectionSystem.js';
import { ComboSystem } from '../js/systems/ComboSystem.js';
import { DailyMissionSystem } from '../js/systems/DailyMissionSystem.js';
import { ProgressionSystem } from '../js/systems/ProgressionSystem.js';
import { RewardSystem } from '../js/systems/RewardSystem.js';
import { SpawnSystem } from '../js/systems/SpawnSystem.js';

let assertions = 0;
function check(condition, message) { assert.ok(condition, message); assertions += 1; }
function equal(actual, expected, message) { assert.equal(actual, expected, message); assertions += 1; }

const initialStore = new StorageService({ temporary: true });
const initialSave = initialStore.loadProfile(POKEMON_DATA).playerProfile;
equal(initialSave.coins, 500, 'new profiles get configured starting coins');
equal(initialSave.version, PROFILE_VERSION, 'profile schema is versioned');
equal(Object.values(initialSave.collection).filter((entry) => entry.discovered).length, 0, 'new collection starts undiscovered');

const legacyStore = new StorageService({ temporary: true });
legacyStore.write('animal-machine-best', '190');
legacyStore.write('pokemon-machine-trainer-xp', '630');
legacyStore.write('pokemon-machine-mode', 'hard');
legacyStore.write('pokemon-machine-pokedex', JSON.stringify({ Pikachu: 7, Mewtwo: 1, Bulbasaur: { caught: true } }));
const migrated = legacyStore.loadProfile(POKEMON_DATA).playerProfile;
equal(migrated.bestScore, 190, 'legacy best score survives migration');
equal(migrated.trainerXp, 630, 'legacy trainer XP survives migration');
equal(migrated.mode, 'hard', 'legacy mode survives migration');
equal(migrated.collection.Pikachu.caughtCount, 7, 'legacy Pokédex catch counts survive migration');
equal(migrated.collection.Mewtwo.discovered, true, 'legacy discoveries are marked discovered');
equal(migrated.collection.Bulbasaur.caughtCount, 1, 'legacy caught=true Pokédex entries migrate without being lost');
const migrationReload = new StorageService({ temporary: true });
migrationReload.memory = legacyStore.memory;
equal(migrationReload.loadProfile(POKEMON_DATA).playerProfile.collection.Pikachu.caughtCount, 7, 'migrated collection persists on reload');

const rewardSystem = new RewardSystem();
equal(rewardSystem.rarityBase('common'), 20, 'common reward');
equal(rewardSystem.rarityBase('uncommon'), 35, 'uncommon reward');
equal(rewardSystem.rarityBase('rare'), 60, 'rare reward');
equal(rewardSystem.rarityBase('epic'), 100, 'epic reward');
equal(rewardSystem.rarityBase('legendary'), 200, 'legendary reward');
equal(rewardSystem.calculateCatchReward({ rarity: 'rare', shiny: true }).total, 180, 'shiny rare uses the ×3 reward multiplier');
equal(rewardSystem.calculateCatchReward({ rarity: 'common', comboMultiplier: 1.5, fever: true }).total, 60, 'combo and Fever multipliers compose');
equal(PROGRESSION_CONFIG.playCost, 20, 'play cost comes from configuration');

const store = new StorageService({ temporary: true });
const profile = store.loadProfile(POKEMON_DATA).playerProfile;
const state = new GameState({ playerProfile: profile, pokedexCounts: Object.fromEntries(POKEMON_DATA.map(({ name }) => [name, 0])) });
const events = new GameEventBus();
const combo = new ComboSystem(state, events);
const progression = new ProgressionSystem(state, store, events, rewardSystem, combo);
let currentDate = new Date(2026, 8, 29, 12, 0, 0);
const missionDefinitions = [
  { id: 'catch-test', type: 'catch-count', goal: 2, copy: 'Catch 2 Pokémon', weight: 1 },
  { id: 'perfect-test', type: 'perfect-count', goal: 1, copy: 'Get a PERFECT', weight: 1 },
  { id: 'combo-test', type: 'combo', goal: 3, copy: 'Reach combo 3', weight: 1 },
];
const daily = new DailyMissionSystem(profile, store, events, POKEMON_DATA, {
  now: () => currentDate,
  rng: () => 0.41,
  definitions: missionDefinitions,
});
const collection = new CollectionSystem(state, store, events, POKEMON_DATA, { now: () => new Date('2026-09-29T12:00:00.000Z') });
// Recreate the listener order used by Game: collection, progression, daily, achievements.
collection.unsubscribe();
const orderedEvents = new GameEventBus();
const orderedStore = new StorageService({ temporary: true });
const orderedProfile = orderedStore.loadProfile(POKEMON_DATA).playerProfile;
const orderedState = new GameState({ playerProfile: orderedProfile, pokedexCounts: Object.fromEntries(POKEMON_DATA.map(({ name }) => [name, 0])) });
const orderedCombo = new ComboSystem(orderedState, orderedEvents);
const orderedCollection = new CollectionSystem(orderedState, orderedStore, orderedEvents, POKEMON_DATA, { now: () => new Date('2026-09-29T12:00:00.000Z') });
const orderedProgression = new ProgressionSystem(orderedState, orderedStore, orderedEvents, rewardSystem, orderedCombo);
const orderedDaily = new DailyMissionSystem(orderedProfile, orderedStore, orderedEvents, POKEMON_DATA, {
  now: () => currentDate, rng: () => 0.41, definitions: missionDefinitions,
});
const achievements = new AchievementSystem(orderedProfile, orderedStore, orderedEvents, { now: () => new Date('2026-09-29T12:00:00.000Z') });

equal(orderedProgression.coins, 500, 'new player coin balance');
check(orderedProgression.claimDailyLoginBonus(currentDate), 'daily bonus can be claimed once');
equal(orderedProgression.coins, 600, 'daily bonus awards 100 coins');
equal(orderedProgression.claimDailyLoginBonus(currentDate), false, 'same-day login bonus cannot be claimed twice');
check(orderedProgression.spendCoins(20), 'affordable play starts');
equal(orderedProgression.coins, 580, 'a play costs 20 coins');
equal(orderedProgression.spendCoins(1000), false, 'overspending is rejected');
check(orderedProgression.coins >= 0, 'coin balance cannot go negative');
orderedProgression.recordPlay();
equal(orderedProfile.stats.totalPlays, 1, 'paid play is counted');

const pikachu = { name: 'Pikachu', character: POKEMON_DATA[0], shiny: false, variant: 'normal' };
orderedCombo.registerCatch();
orderedEvents.emit('pokemon:caught', { pokemon: pikachu, grab: { grabQuality: 0.9, comboMultiplier: 1 } });
equal(orderedProfile.collection.Pikachu.caughtCount, 1, 'normal catch is recorded in collection');
equal(orderedProfile.collection.Pikachu.shinyCaughtCount, 0, 'normal catch does not increment shiny count');
equal(orderedState.pokedexCounts.Pikachu, 1, 'legacy collection view reads the new profile');
equal(orderedProfile.stats.totalCatches, 1, 'catch statistic increments');
check(Boolean(orderedProfile.achievements['first-catch']), 'first catch achievement unlocks');
check(orderedProfile.stats.totalCoinsEarned > 0, 'catch reward is included in lifetime earnings');
check(orderedDaily.missions.some((mission) => mission.definitionId === 'catch-test' && mission.progress === 1), 'daily catch mission progresses');

orderedEvents.emit('pokemon:perfect', { pokemon: pikachu });
equal(orderedProfile.stats.totalPerfects, 1, 'perfect statistic increments');
check(orderedDaily.missions.some((mission) => mission.definitionId === 'perfect-test' && mission.completed), 'perfect daily mission auto-completes');
for (let index = 0; index < 2; index += 1) orderedCombo.registerCatch();
check(orderedDaily.missions.some((mission) => mission.definitionId === 'combo-test' && mission.completed), 'combo daily mission completes when target is reached');
equal(orderedDaily.missions.length, 3, 'three daily missions are generated');
equal(orderedProfile.dailyMissions.missions.length, 3, 'daily missions persist in profile');

const shinyPikachu = { ...pikachu, shiny: true, variant: 'shiny' };
orderedCombo.registerCatch();
const coinsBeforeShiny = orderedProgression.coins;
orderedEvents.emit('pokemon:caught', { pokemon: shinyPikachu, grab: { grabQuality: 0.7, comboMultiplier: 1.75 } });
orderedEvents.emit('pokemon:shinyCaught', { pokemon: shinyPikachu });
equal(orderedProfile.collection.Pikachu.shinyCaughtCount, 1, 'shiny catch persists separately for its species');
equal(orderedProfile.stats.shinyCaught, 1, 'shiny statistic increments');
check(orderedProgression.coins - coinsBeforeShiny >= 100, 'shiny and combo multipliers raise coin reward');
check(Boolean(orderedProfile.achievements['lucky-find']), 'first shiny unlocks Lucky Find once');

for (let index = 0; index < 5; index += 1) {
  orderedCombo.registerCatch();
  orderedEvents.emit('pokemon:caught', { pokemon: pikachu, grab: { comboMultiplier: 2 } });
}
equal(orderedState.fever.active, true, 'five consecutive delivered catches start Fever');
equal(orderedState.fever.remaining, 10, 'Fever lasts ten seconds');
check(Boolean(orderedProfile.achievements['on-fire']), 'combo five unlocks On Fire');
orderedProgression.update(10.01);
equal(orderedState.fever.active, false, 'Fever expires from a delta-time update');
orderedEvents.emit('pokemon:missed', { reason: 'smoke-test' });
equal(orderedState.currentCombo, 0, 'miss resets combo');
equal(orderedProfile.stats.totalMisses, 1, 'miss statistic increments');

const firstDay = orderedProfile.dailyMissions.date;
currentDate = new Date(2026, 8, 30, 12, 0, 0);
check(orderedDaily.ensureCurrentDay(), 'daily missions reset on the next local day');
check(orderedProfile.dailyMissions.date !== firstDay, 'new local day gets a fresh mission set');
check(orderedProgression.claimDailyLoginBonus(currentDate), 'login bonus becomes available on a new day');
equal(orderedProgression.claimDailyLoginBonus(currentDate), false, 'new-day login bonus persists after its first claim');

const firstGeneration = new DailyMissionSystem(new PlayerProfile({}, POKEMON_DATA), new StorageService({ temporary: true }), new GameEventBus(), POKEMON_DATA).generate('2026-10-01');
const secondGeneration = new DailyMissionSystem(new PlayerProfile({}, POKEMON_DATA), new StorageService({ temporary: true }), new GameEventBus(), POKEMON_DATA).generate('2026-10-01');
equal(JSON.stringify(firstGeneration), JSON.stringify(secondGeneration), 'same local date generates deterministic missions');

const spawnState = {};
const fakePhysics = { update() { spawnState.prizes.forEach((prize) => { prize.isSleeping = true; }); } };
const spawn = new SpawnSystem(spawnState, POKEMON_DATA, { floorY: 545 },
  { exclusion: { x: 0, y: 0, width: 1, height: 1 } },
  { left: 12, right: 708, top: 148, bottom: 533 }, fakePhysics, { rng: () => 0 });
spawn.createPrizes();
check(spawnState.prizes.every((pokemon) => pokemon.variant === 'shiny'), 'injected RNG can deterministically force shiny spawns');

console.log(JSON.stringify({
  assertions,
  profileVersion: PROFILE_VERSION,
  startingCoins: PROGRESSION_CONFIG.startingCoins,
  rarityTiers: Object.keys(PROGRESSION_CONFIG.rarityRewards),
  achievementCount: achievements.getItems().length,
  generatedDailyMissions: orderedProfile.dailyMissions.missions.length,
  shinySpawnInjection: 'forced all 15 shiny with rng=0',
  valid: true,
}, null, 2));
