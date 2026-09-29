import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = fileURLToPath(new URL('.', import.meta.url));
const scripts = [
  'back-navigation-smoke.mjs',
  'browser-smoke.mjs',
  'capture-layout.mjs',
  'check-modules.mjs',
  'claw-collision-smoke.mjs',
  'claw-motion-smoke.mjs',
  'feature-smoke.mjs',
  'gameplay-smoke.mjs',
  'geometry-lab-input-smoke.mjs',
  'geometry-lab-visual.mjs',
  'grab-physics-smoke.mjs',
  'grab-pipeline-smoke.mjs',
  'home-release-smoke.mjs',
  'ios-pwa-smoke.mjs',
  'mobile-controls-smoke.mjs',
  'pokemon-asset-alignment.mjs',
  'pokemon-asset-loading.mjs',
  'pokemon-assets-visual.mjs',
  'pokemon-geometry-audit.mjs',
  'pokemon-geometry-grab-audit.mjs',
  'pokemon-geometry-smoke.mjs',
  'pokemon-geometry-visual.mjs',
  'pokemon-visual-regression.mjs',
  'target-selection-smoke.mjs',
  'turn-timer-smoke.mjs',
];

const run = (args, options = {}) => spawnSync(process.execPath, args, {
  cwd: resolve(scriptDir, '..'),
  encoding: 'utf8',
  maxBuffer: 32 * 1024 * 1024,
  ...options,
});

const guard = resolve(scriptDir, 'browser-storage-guard.mjs');
const backup = run([guard, 'backup']);
if (backup.status !== 0) {
  process.stderr.write(backup.stderr || backup.stdout || 'Could not preserve browser storage.\n');
  process.exit(1);
}

const results = [];
let restoreResult;
try {
  for (const script of scripts) {
    const result = run([resolve(scriptDir, script)], { timeout: 180_000 });
    results.push({ script, passed: result.status === 0, output: result.stdout, error: result.stderr, status: result.status });
    console.log(`${result.status === 0 ? 'PASS' : 'FAIL'} ${script}`);
  }
} finally {
  restoreResult = run([guard, 'restore'], { timeout: 15_000 });
  console.log(restoreResult.status === 0 ? 'Browser storage restored.' : 'WARNING: browser storage restore failed.');
}

const failures = results.filter((result) => !result.passed);
if (failures.length) {
  for (const failure of failures) {
    console.log(`\n--- ${failure.script} (exit ${failure.status}) ---`);
    console.log(`${failure.output}\n${failure.error}`.trim().slice(-6000));
  }
}
console.log(`\n${results.length - failures.length}/${results.length} legacy regression scripts passed.`);
if (restoreResult?.status !== 0) process.exitCode = 2;
else if (failures.length) process.exitCode = 1;
