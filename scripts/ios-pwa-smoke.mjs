import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

function pngDimensions(buffer) {
  const signature = buffer.subarray(0, 8).toString('hex');
  if (signature !== '89504e470d0a1a0a') throw new Error('Invalid PNG signature');
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

const expectedIcons = {
  'apple-touch-icon.png': 180,
  'icon-192.png': 192,
  'icon-512.png': 512,
};
const iconResults = {};
for (const [filename, expectedSize] of Object.entries(expectedIcons)) {
  const buffer = await readFile(resolve('assets/icons', filename));
  const dimensions = pngDimensions(buffer);
  iconResults[filename] = { ...dimensions, bytes: buffer.length };
  if (dimensions.width !== expectedSize || dimensions.height !== expectedSize) throw new Error(`${filename} has incorrect dimensions`);
}

const manifest = JSON.parse(await readFile('manifest.webmanifest', 'utf8'));
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
await new Promise((resolveOpen, reject) => {
  socket.addEventListener('open', resolveOpen, { once: true });
  socket.addEventListener('error', reject, { once: true });
});
const send = (method, params = {}) => {
  const id = ++nextId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolveMessage) => pending.set(id, resolveMessage));
};
const evaluate = async (expression) => {
  const response = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (response.result?.exceptionDetails) throw new Error(response.result.exceptionDetails.exception?.description || response.result.exceptionDetails.text);
  return response.result?.result?.value;
};

await send('Runtime.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true, screenWidth: 390, screenHeight: 844 });
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
await send('Page.reload', { ignoreCache: true });
await new Promise((resolveWait) => setTimeout(resolveWait, 900));
const browser = await evaluate(`(async () => {
  const selectors = ['#start-game-btn', '#open-mode-btn', '#reset-data-btn', '.start-current-mode'];
  const typography = Object.fromEntries(selectors.map(selector => {
    const element = document.querySelector(selector);
    const style = getComputedStyle(element);
    return [selector, { fontFamily: style.fontFamily, letterSpacing: style.letterSpacing, text: element.textContent.trim().replace(/\\s+/g, ' ') }];
  }));
  const loadIcon = source => new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = reject;
    image.src = source;
  });
  return {
    title: document.title,
    themeColor: document.querySelector('meta[name="theme-color"]').content,
    appleCapable: document.querySelector('meta[name="apple-mobile-web-app-capable"]').content,
    appleTitle: document.querySelector('meta[name="apple-mobile-web-app-title"]').content,
    appleIcon: document.querySelector('link[rel="apple-touch-icon"]').getAttribute('href'),
    manifest: document.querySelector('link[rel="manifest"]').getAttribute('href'),
    textSizeAdjust: getComputedStyle(document.documentElement).webkitTextSizeAdjust,
    typography,
    icon180: await loadIcon('./assets/icons/apple-touch-icon.png'),
    viewportWidth: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  };
})()`);

console.log(JSON.stringify({ browser, manifest, icons: iconResults, errors }, null, 2));
socket.close();
const uiFonts = Object.values(browser.typography).map((item) => item.fontFamily);
const valid = browser.title === 'Pokémon Machine'
  && browser.themeColor.toLowerCase() === '#ef444b'
  && browser.appleCapable === 'yes'
  && browser.appleTitle === 'Pokémon Machine'
  && browser.appleIcon === './assets/icons/apple-touch-icon.png'
  && browser.manifest === './manifest.webmanifest'
  && browser.textSizeAdjust === '100%'
  && new Set(uiFonts).size === 1
  && uiFonts[0].includes('-apple-system')
  && browser.icon180.width === 180 && browser.icon180.height === 180
  && browser.scrollWidth <= browser.viewportWidth
  && manifest.short_name === 'Pokémon Machine'
  && manifest.display === 'standalone'
  && errors.length === 0;
if (!valid) process.exitCode = 1;
