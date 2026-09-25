import { readFile, readdir } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const jsRoot = join(root, 'js');

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  }));
  return nested.flat();
}

const files = (await walk(jsRoot)).filter((file) => extname(file) === '.js');
const graph = new Map();
for (const file of files) {
  const source = await readFile(file, 'utf8');
  const dependencies = [...source.matchAll(/from\s+['"](.+?)['"]/g)]
    .map((match) => match[1])
    .filter((specifier) => specifier.startsWith('.'))
    .map((specifier) => resolve(dirname(file), specifier));
  graph.set(file, dependencies);
}

const visiting = new Set();
const visited = new Set();
function visit(file, stack = []) {
  if (visiting.has(file)) throw new Error(`Circular import: ${[...stack, file].map((item) => item.slice(root.length + 1)).join(' -> ')}`);
  if (visited.has(file)) return;
  visiting.add(file);
  for (const dependency of graph.get(file) || []) {
    if (!graph.has(dependency)) throw new Error(`Missing import: ${dependency.slice(root.length + 1)}`);
    visit(dependency, [...stack, file]);
  }
  visiting.delete(file);
  visited.add(file);
}
files.forEach((file) => visit(file));
console.log(`Module graph OK: ${files.length} files, no missing or circular imports.`);
