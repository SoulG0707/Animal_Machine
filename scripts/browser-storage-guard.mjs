import { tmpdir } from 'node:os';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';

const action = process.argv[2];
const backupPath = join(tmpdir(), 'animal-machine-browser-storage.json');
const pages = await fetch('http://127.0.0.1:9417/json').then((response) => response.json());
const page = pages.find((entry) => entry.type === 'page' && entry.url.includes('localhost:8000'));
if (!page) throw new Error('No localhost:8000 browser page for storage preservation');

const socket = new WebSocket(page.webSocketDebuggerUrl);
const pending = new Map();
let nextId = 0;
socket.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data);
  if (message.id && pending.has(message.id)) {
    pending.get(message.id)(message);
    pending.delete(message.id);
  }
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
  const response = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (response.result?.exceptionDetails) {
    throw new Error(response.result.exceptionDetails.exception?.description || response.result.exceptionDetails.text);
  }
  return response.result?.result?.value;
};

await send('Runtime.enable');
await send('Page.enable');
if (action === 'backup') {
  const storage = await evaluate('Object.fromEntries(Array.from({length:localStorage.length},(_,i)=>{const key=localStorage.key(i);return [key,localStorage.getItem(key)]}))');
  await writeFile(backupPath, JSON.stringify(storage));
  console.log('Browser localStorage backed up for regression tests.');
} else if (action === 'restore') {
  const storage = JSON.parse(await readFile(backupPath, 'utf8'));
  await evaluate(`(() => { localStorage.clear(); const saved = ${JSON.stringify(storage)}; Object.entries(saved).forEach(([key,value]) => localStorage.setItem(key,value)); })()`);
  await send('Emulation.clearDeviceMetricsOverride');
  await send('Page.navigate', { url: 'http://localhost:8000/' });
  await new Promise((resolve) => setTimeout(resolve, 900));
  await unlink(backupPath);
  console.log('Original browser localStorage restored.');
} else {
  throw new Error(`Usage: node scripts/browser-storage-guard.mjs backup|restore (received ${action})`);
}
socket.close();
