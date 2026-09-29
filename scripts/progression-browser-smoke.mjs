import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const pages = await fetch('http://127.0.0.1:9417/json').then((response) => response.json());
const PROFILE_VERSION_FOR_TEST = 2;
const page = pages.find((entry) => entry.type === 'page' && entry.url.includes('localhost:8000'));
if (!page) throw new Error('Game page not found. Start the local server and Chrome debug session first.');

const socket = new WebSocket(page.webSocketDebuggerUrl);
const pending = new Map();
const errors = [];
let nextId = 0;
socket.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data);
  if (message.id && pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); }
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
  if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
    errors.push(message.params.args.map((arg) => arg.value || arg.description).join(' '));
  }
});
await new Promise((resolveOpen, reject) => {
  socket.addEventListener('open', resolveOpen, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

const send = (method, params = {}) => {
  const id = ++nextId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolveResponse) => pending.set(id, resolveResponse));
};
const evaluate = async (expression) => {
  const response = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (response.result?.exceptionDetails) {
    throw new Error(response.result.exceptionDetails.exception?.description || response.result.exceptionDetails.text);
  }
  return response.result?.result?.value;
};
const pause = (ms) => new Promise((resolvePause) => setTimeout(resolvePause, ms));
const outputDir = resolve('artifacts/progression-review');
await mkdir(outputDir, { recursive: true });
let savedLocalStorage = null;

async function screenshot(name) {
  await pause(100);
  const response = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, fromSurface: true });
  await writeFile(resolve(outputDir, `${name}.png`), Buffer.from(response.result.data, 'base64'));
  return resolve(outputDir, `${name}.png`);
}

try {
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: 'http://localhost:8000/' });
  await pause(1000);
  savedLocalStorage = await evaluate('Object.fromEntries(Array.from({length:localStorage.length},(_,i)=>{const k=localStorage.key(i);return [k,localStorage.getItem(k)]}))');
  await evaluate('localStorage.clear()');
  await send('Page.reload', { ignoreCache: true });
  await pause(1000);

  const initial = await evaluate(`(async () => {
    const { game } = await import('/js/main.js');
    await game.assetsPromise;
    return {
      startVisible: !document.querySelector('#start-screen').hidden,
      coins: game.state.profile.coins,
      dailyCount: game.dailyMissions.missions.length,
      bonusDate: game.state.profile.lastLoginBonusDate,
      storedVersion: JSON.parse(localStorage.getItem('pokemon-machine-player-profile')).version,
    };
  })()`);
  assert.equal(initial.startVisible, true, 'new profile should land on the start screen');
  assert.equal(initial.coins, 600, '500 starting coins plus the daily login bonus');
  assert.equal(initial.dailyCount, 3, 'three daily missions should be present');
  assert.ok(initial.bonusDate, 'daily bonus date should be saved');
  assert.equal(initial.storedVersion, 2, 'versioned player profile should be saved');
  const startScreenshot = await screenshot('start-screen');

  const started = await evaluate(`(() => {
    document.querySelector('#start-game-btn').click();
    const { game } = window.__pokemonMachineTest || {};
    return true;
  })()`);
  assert.equal(started, true);
  await pause(200);
  const startState = await evaluate(`(async () => {
    const { game } = await import('/js/main.js');
    return { coins: game.state.profile.coins, plays: game.state.profile.stats.totalPlays, state: game.state.appState };
  })()`);
  assert.equal(startState.coins, 580, 'the first paid play deducts 20 coins');
  assert.equal(startState.plays, 1, 'paid play is recorded');
  assert.equal(startState.state, 'playing');
  const gameplayScreenshot = await screenshot('gameplay-hud');

  const physicalCatch = await evaluate(`(async () => {
    const wait = ms => new Promise(resolveWait => setTimeout(resolveWait, ms));
    const waitFor = async (test, timeout = 6500) => {
      const startedAt = performance.now();
      while (!test()) {
        if (performance.now() - startedAt > timeout) throw new Error('Timed out waiting for physical chute delivery');
        await wait(40);
      }
    };
    const { game } = await import('/js/main.js');
    const date = game.state.profile.dailyMissions.date;
    game.state.profile.dailyMissions = {
      date, allBonusClaimed: false,
      missions: [
        { id: 'browser-catch', definitionId: 'catch-3', type: 'catch-count', goal: 1, progress: 0, copy: 'Catch 1 Pokémon', reward: 100, completed: false },
        { id: 'browser-perfect', definitionId: 'perfect-2', type: 'perfect-count', goal: 1, progress: 0, copy: 'Get a PERFECT', reward: 150, completed: false },
        { id: 'browser-combo', definitionId: 'combo-3', type: 'combo', goal: 3, progress: 0, copy: 'Reach combo 3', reward: 200, completed: false },
      ],
    };
    game.storage.savePlayerProfile(game.state.profile);
    const prize = game.state.prizes.find(item => item.character.score > 0);
    prize.shiny = false; prize.variant = 'normal';
    game.state.prizes.forEach(item => { item.collected = item !== prize; });
    game.claw.x = 330;
    prize.x = game.claw.x - prize.width / 2;
    prize.y = 545 - prize.height;
    prize.isSleeping = true;
    game.physics.updateGeometry(prize);
    const originalRandom = Math.random;
    Math.random = () => 0.99;
    game.grab.attempt();
    await waitFor(() => prize.collected && game.state.profile.collection[prize.name].caughtCount > 0);
    Math.random = originalRandom;
    game.refresh({ pokedex: true });
    return {
      name: prize.name,
      rarity: prize.character.rarity,
      count: game.state.profile.collection[prize.name].caughtCount,
      score: game.state.score,
      coins: game.state.profile.coins,
      combo: game.state.currentCombo,
      collectionCount: game.state.profile.collection[prize.name].caughtCount,
      missionComplete: game.dailyMissions.missions[0].completed,
      state: game.claw.state,
    };
  })()`);
  assert.equal(physicalCatch.count, 1, 'only a chute-confirmed catch updates the collection');
  assert.ok(physicalCatch.coins > startState.coins, 'delivered catch awards coins');
  assert.equal(physicalCatch.combo, 1, 'delivered catch starts combo');
  assert.equal(physicalCatch.missionComplete, true, 'daily catch mission completes on delivery');
  const catchScreenshot = await screenshot('catch-reward');

  const progressionState = await evaluate(`(async () => {
    const { game } = await import('/js/main.js');
    const remaining = game.state.prizes.filter(item => item !== game.claw.droppingPrize);
    const shiny = remaining.find(item => item.name === 'Pikachu') || remaining.find(item => !item.collected) || remaining[0];
    shiny.collected = false; shiny.shiny = true; shiny.variant = 'shiny';
    game.score.processCatch({ pokemon: shiny, perfect: true, basePoints: shiny.character.score, comboMultiplier: game.combo.nextMultiplier(), grabQuality: 0.9 });
    game.refresh({ pokedex: true, animateScore: true, animateCombo: true });
    const shinyState = { combo: game.state.currentCombo, shinyCaught: game.state.profile.stats.shinyCaught, perfects: game.state.profile.stats.totalPerfects, coins: game.state.profile.coins };
    const more = game.state.prizes.filter(item => item !== shiny).slice(0, 3);
    for (let index = 0; index < 3; index += 1) {
      const pokemon = more[index];
      pokemon.shiny = false; pokemon.variant = 'normal';
      game.score.processCatch({ pokemon, perfect: false, basePoints: pokemon.character.score, comboMultiplier: game.combo.nextMultiplier(), grabQuality: 0.7 });
    }
    game.refresh({ pokedex: true, animateScore: true, animateCombo: true });
    return {
      shinyState,
      combo: game.state.currentCombo,
      fever: { ...game.state.fever },
      daily: game.dailyMissions.missions.map(mission => ({ completed: mission.completed, progress: mission.progress })),
      unlocked: Object.keys(game.state.profile.achievements).length,
      collection: game.state.profile.collection.Pikachu,
      coins: game.state.profile.coins,
    };
  })()`);
  assert.equal(progressionState.shinyState.combo, 2, 'second successful catch advances combo');
  assert.equal(progressionState.shinyState.shinyCaught, 1, 'shiny catch is counted');
  assert.equal(progressionState.shinyState.perfects, 1, 'perfect catch is counted');
  assert.equal(progressionState.combo, 5, 'five consecutive catches reach combo five');
  assert.equal(progressionState.fever.active, true, 'combo five triggers Fever');
  assert.ok(progressionState.daily.every((mission) => mission.completed), 'daily missions complete and auto-reward');
  assert.ok(progressionState.unlocked >= 3, 'catch, perfect, and shiny achievements unlock');
  const shinyScreenshot = await screenshot('shiny-catch');
  const feverScreenshot = await screenshot('fever-mode');

  await evaluate(`(() => document.querySelector('#open-daily-btn').click())()`);
  await pause(100);
  const dailyScreenshot = await screenshot('daily-missions');
  await evaluate(`(() => document.querySelector('[data-profile-tab="achievements"]').click())()`);
  const achievementScreenshot = await screenshot('achievements');
  await evaluate(`(() => document.querySelector('[data-profile-tab="pokedex"]').click())()`);
  const pokedexScreenshot = await screenshot('upgraded-pokedex');
  await evaluate(`(() => document.querySelector('[data-profile-tab="stats"]').click())()`);
  const statsScreenshot = await screenshot('player-stats');
  await evaluate(`(() => document.querySelector('#close-profile-btn').click())()`);

  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await pause(250);
  const mobileLayout = await evaluate(`(() => {
    const controls = ['left-btn','drop-btn','right-btn'].map(id => document.querySelector('#'+id).getBoundingClientRect());
    return {
      width: innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      controlsInViewport: controls.every(rect => rect.width > 0 && rect.bottom <= innerHeight),
      controlsHaveWidth: controls.every(rect => rect.width >= 50),
      coins: document.querySelector('#coin-balance').textContent,
      score: document.querySelector('#score').textContent,
      combo: document.querySelector('#combo-display').textContent,
    };
  })()`);
  assert.equal(mobileLayout.width, 390, 'mobile viewport is 390 CSS pixels');
  assert.ok(mobileLayout.documentWidth <= 390, 'mobile page has no horizontal overflow');
  assert.ok(mobileLayout.controlsInViewport && mobileLayout.controlsHaveWidth, 'LEFT/GRAB/RIGHT remain reachable and large enough');
  const mobileGameplayScreenshot = await screenshot('mobile-390-gameplay');
  await evaluate(`(() => document.querySelector('#open-profile-btn').click())()`);
  await evaluate(`(() => document.querySelector('[data-profile-tab="pokedex"]').click())()`);
  const mobileProfile = await evaluate(`(() => ({
    width: innerWidth,
    dialogWidth: document.querySelector('.progression-dialog').getBoundingClientRect().width,
    horizontalOverflow: document.querySelector('.progression-content').scrollWidth > document.querySelector('.progression-content').clientWidth + 1,
    cards: document.querySelectorAll('.profile-pokedex-card').length,
  }))()`);
  assert.ok(mobileProfile.dialogWidth <= 390, 'profile modal fits the mobile viewport');
  assert.equal(mobileProfile.horizontalOverflow, false, 'Pokédex panel has no horizontal overflow');
  assert.equal(mobileProfile.cards, 15, 'mobile Pokédex displays all species');
  const mobilePokedexScreenshot = await screenshot('mobile-390-pokedex');

  await send('Emulation.clearDeviceMetricsOverride');
  await send('Page.reload', { ignoreCache: true });
  await pause(1000);
  const persisted = await evaluate(`(async () => {
    const { game } = await import('/js/main.js');
    return {
      coins: game.state.profile.coins,
      totalCatches: game.state.profile.stats.totalCatches,
      shinyCaught: game.state.profile.stats.shinyCaught,
      pikachuCount: game.state.profile.collection.Pikachu.caughtCount,
      pikachuShinyCount: game.state.profile.collection.Pikachu.shinyCaughtCount,
      dailyCompleted: game.state.profile.dailyMissions.missions.filter(mission => mission.completed).length,
      achievementCount: Object.keys(game.state.profile.achievements).length,
      version: game.state.profile.version,
    };
  })()`);
  assert.equal(persisted.coins, progressionState.coins, 'coins persist after browser reload');
  assert.equal(persisted.totalCatches, 5, 'catch statistics persist after reload');
  assert.equal(persisted.shinyCaught, 1, 'shiny statistic persists after reload');
  assert.ok(persisted.pikachuCount > 0, 'Pokédex count persists after reload');
  assert.equal(persisted.pikachuShinyCount, 1, 'shiny collection status persists after reload');
  assert.equal(persisted.dailyCompleted, 3, 'daily mission progress persists after reload');
  assert.ok(persisted.achievementCount >= 3, 'achievements persist after reload');
  assert.equal(persisted.version, PROFILE_VERSION_FOR_TEST, 'profile version persists after reload');

  console.log(JSON.stringify({
    initial,
    startState,
    physicalCatch,
    progressionState,
    mobileLayout,
    mobileProfile,
    persisted,
    screenshots: [startScreenshot, gameplayScreenshot, catchScreenshot, shinyScreenshot, feverScreenshot,
      dailyScreenshot, achievementScreenshot, pokedexScreenshot, statsScreenshot, mobileGameplayScreenshot, mobilePokedexScreenshot],
    errors,
    valid: true,
  }, null, 2));
  assert.equal(errors.length, 0, `browser console should be error-free: ${errors.join('; ')}`);
} finally {
  if (savedLocalStorage) {
    await send('Emulation.clearDeviceMetricsOverride').catch(() => {});
    await send('Runtime.evaluate', {
      expression: `(() => { localStorage.clear(); const saved = ${JSON.stringify(savedLocalStorage)}; Object.entries(saved).forEach(([key,value]) => localStorage.setItem(key,value)); })()`,
      returnByValue: true,
    }).catch(() => {});
    await send('Page.reload', { ignoreCache: true }).catch(() => {});
    await pause(500);
  }
  socket.close();
}

