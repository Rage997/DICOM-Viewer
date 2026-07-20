/**
 * Bundle-size budget check (CI Tier-1 perf guard).
 *
 * Measures the gzip size of each build chunk and fails if any exceeds its
 * budget. Guards against accidental bloat — a heavy dependency slipping into a
 * chunk, or un-tree-shaken/dead code shipping to production (the class of bug
 * where a dev-only `debug-render` tool once landed in the prod bundle).
 *
 * Budgets are gzip kB, set with headroom over the sizes measured 2026-07-16.
 * When a change legitimately grows a chunk, bump the number here in the same
 * commit — the diff makes the size decision explicit and reviewable.
 *
 * Run after `build`:  node scripts/check-bundle-size.mjs   (npm run size)
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

// Per-chunk gzip budgets (kB). Keyed by a hash-agnostic filename pattern so the
// content-hash in the filename doesn't matter.
const BUDGETS = [
  { name: 'app (index.js)', pattern: /^index-.*\.js$/, maxGzipKB: 55 },
  { name: 'app styles (index.css)', pattern: /^index-.*\.css$/, maxGzipKB: 12 },
  { name: 'three', pattern: /^three-.*\.js$/, maxGzipKB: 135 },
  { name: 'react-vendor', pattern: /^react-vendor-.*\.js$/, maxGzipKB: 55 },
  { name: 'dicom worker (dcmjs)', pattern: /^dicom-parser\.worker-.*\.js$/, maxGzipKB: 185 },
];

const assetsDir = join(process.cwd(), 'dist', 'assets');

if (!existsSync(assetsDir)) {
  console.error(`✗ ${assetsDir} not found — run \`yarn build\` first.`);
  process.exit(1);
}

const files = readdirSync(assetsDir).filter((f) => /\.(js|css)$/.test(f));
const gzipKB = (f) => gzipSync(readFileSync(join(assetsDir, f))).length / 1024;

const results = [];
const failures = [];
const matched = new Set();

for (const budget of BUDGETS) {
  const hits = files.filter((f) => budget.pattern.test(f));
  hits.forEach((f) => matched.add(f));

  if (hits.length === 0) {
    // A budget that matches nothing is a dead guard — the build layout changed.
    failures.push(`${budget.name}: no chunk matched ${budget.pattern} — update budgets.`);
    results.push({ chunk: budget.name, gzipKB: '—', budgetKB: budget.maxGzipKB, status: 'MISSING' });
    continue;
  }

  const size = hits.reduce((sum, f) => sum + gzipKB(f), 0);
  const over = size > budget.maxGzipKB;
  if (over) {
    failures.push(
      `${budget.name}: ${size.toFixed(1)} kB gzip exceeds ${budget.maxGzipKB} kB by ${(size - budget.maxGzipKB).toFixed(1)} kB.`
    );
  }
  results.push({
    chunk: budget.name,
    gzipKB: size.toFixed(1),
    budgetKB: budget.maxGzipKB,
    status: over ? 'OVER' : 'ok',
  });
}

// Surface any unbudgeted chunk (e.g. a new vite manualChunk) for visibility.
// Not fatal — the empty `dcmjs` split is expected — but worth seeing in logs.
const uncovered = files.filter((f) => !matched.has(f));

console.log('Bundle size budgets (gzip):');
console.table(results);
if (uncovered.length > 0) {
  console.log(
    'Unbudgeted chunks:',
    uncovered.map((f) => `${f} (${gzipKB(f).toFixed(1)} kB)`).join(', ')
  );
}

if (failures.length > 0) {
  console.error('\n✗ Bundle size budget exceeded:');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log('\n✓ All chunks within budget.');
