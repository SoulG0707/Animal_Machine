const pages = await fetch('http://127.0.0.1:9417/json').then((response) => response.json());
const page = pages.find((entry) => entry.type === 'page' && entry.url.includes('localhost:8000'));
if (!page) throw new Error('Game page not found');
const socket = new WebSocket(page.webSocketDebuggerUrl);
const pending = new Map();
const errors = [];
let nextId = 0;
socket.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data);
  if (message.id && pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); }
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
  if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') errors.push(message.params.args.map((arg) => arg.value || arg.description).join(' '));
});
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});
const send = (method, params = {}) => {
  const id = ++nextId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve) => pending.set(id, resolve));
};
const evaluate = async (expression) => {
  const response = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (response.result?.exceptionDetails) throw new Error(response.result.exceptionDetails.exception?.description || response.result.exceptionDetails.text);
  return response.result?.result?.value;
};
await send('Runtime.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.reload', { ignoreCache: true });
await new Promise((resolve) => setTimeout(resolve, 900));
const result = await evaluate(`(async () => {
  const { game } = await import('/js/main.js');
  game.ui.startScreen.openMode();
  document.querySelector('input[value="hard"]').checked = true;
  document.querySelector('#mode-confirm-btn').click();
  const mode = { state: game.state.mode, stored: localStorage.getItem('pokemon-machine-mode'), label: document.querySelector('#start-mode-badge').textContent };
  game.enterGame();
  game.state.mission = { type: 'count', target: 1, goal: 1, progress: 0, completed: false, copy: 'Catch 1 Pokémon' };
  const first = game.state.prizes.find(prize => prize.character.score > 0);
  const firstWasLocked = game.state.pokedexCounts[first.character.name] === 0;
  const firstStatus = game.score.processCatch({ pokemon: first, perfect: true, basePoints: first.character.score, comboMultiplier: 1 });
  game.refresh({ pokedex: true, animateScore: true, animateCombo: true });
  const afterFirst = {
    snapshot: game.getSnapshot(), status: firstStatus,
    count: game.state.pokedexCounts[first.character.name],
    storedCount: JSON.parse(localStorage.getItem('pokemon-machine-pokedex'))[first.character.name],
    newFlag: first.character.newThisGame,
  };
  const second = game.state.prizes.find(prize => prize !== first && prize.character.score > 0);
  game.score.processCatch({ pokemon: second, perfect: false, basePoints: second.character.score, comboMultiplier: game.combo.nextMultiplier() });
  game.refresh({ pokedex: true, animateScore: true, animateCombo: true });
  const afterSecond = { snapshot: game.getSnapshot(), comboText: document.querySelector('#combo-display').textContent, comboHidden: document.querySelector('#combo-display').hidden };
  document.querySelector('#reset-btn').click();
  const afterNewGame = game.getSnapshot();
  game.state.score = 123; game.state.turns = 0; game.finishGame();
  const complete = {
    visible: !document.querySelector('#game-complete-overlay').hidden,
    finalScore: document.querySelector('#final-score').textContent,
  };
  window.confirm = () => true;
  game.resetAllSavedData();
  const afterReset = {
    snapshot: game.getSnapshot(), best: game.state.bestScore, xp: game.state.trainerXp,
    storedMode: localStorage.getItem('pokemon-machine-mode'), storedBest: localStorage.getItem('animal-machine-best'),
    caughtTotal: Object.values(game.state.pokedexCounts).reduce((sum, count) => sum + count, 0),
  };
  return { mode, firstWasLocked, afterFirst, afterSecond, afterNewGame, complete, afterReset };
})()`);
console.log(JSON.stringify({ result, errors }, null, 2));
socket.close();
const valid = result.mode.state === 'hard' && result.mode.stored === 'hard'
  && result.afterFirst.snapshot.mission.completed
  && result.afterFirst.snapshot.turns === 6
  && result.afterFirst.status === '+1 TURN'
  && result.afterFirst.count === result.afterFirst.storedCount
  && (!result.firstWasLocked || result.afterFirst.newFlag)
  && result.afterSecond.snapshot.combo === 2
  && result.afterSecond.comboText.includes('×2')
  && !result.afterSecond.comboHidden
  && result.afterNewGame.score === 0 && result.afterNewGame.turns === 5 && result.afterNewGame.combo === 0
  && result.complete.visible && result.complete.finalScore === '123'
  && result.afterReset.snapshot.mode === 'medium' && result.afterReset.best === 0 && result.afterReset.xp === 0
  && result.afterReset.storedMode === null && result.afterReset.storedBest === null && result.afterReset.caughtTotal === 0
  && errors.length === 0;
if (!valid) process.exitCode = 1;
