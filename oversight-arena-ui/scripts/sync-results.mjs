#!/usr/bin/env node
/**
 * Copies the committed evaluation / training artifacts from the repository's
 * `results/` directory into `public/results-data/` so the static export (and
 * `next dev`) can serve them to the browser.
 *
 * `results/` stays the single source of truth. The copy is git-ignored and is
 * regenerated on every `npm run dev` and `npm run build` (see package.json
 * `predev` / `prebuild`), so the UI cannot drift from the recorded files.
 *
 * Override the source directory with RESULTS_DIR (the Docker build copies
 * `results/` to /app/results, which is `../results` from /app/ui).
 */
import { copyFileSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Keep in sync with RESULT_FILES in lib/evaluation.ts (a test asserts this).
export const SYNCED_FILES = [
  'eval_baseline_summary.json',
  'eval_grpo_summary.json',
  'training_summary.json',
  'ablation_summary.json',
  'eval_groq_summary.json',
  'grpo_rewards.csv',
]

// Docs the dashboard quotes for the documentation-reported Run 1 result (see lib/documented.ts), as
// [file name in public/results-data/docs, path relative to the repo root, required?].
// Keep in sync with DOC_FILES in lib/documented.ts (a test asserts this).
export const SYNCED_DOCS = [
  ['README.md', 'README.md', true],
  ['blog.md', 'blog.md', false],
  ['judge_qa.md', 'docs/judge_qa.md', false],
]

const here = dirname(fileURLToPath(import.meta.url))
const uiRoot = resolve(here, '..')
const source = resolve(process.env.RESULTS_DIR ?? join(uiRoot, '..', 'results'))
const dest = join(uiRoot, 'public', 'results-data')

const missing = SYNCED_FILES.filter((f) => !existsSync(join(source, f)))
if (missing.length > 0) {
  console.error(`[sync-results] missing in ${source}: ${missing.join(', ')}`)
  process.exit(1)
}

rmSync(dest, { recursive: true, force: true })
mkdirSync(dest, { recursive: true })
for (const f of SYNCED_FILES) copyFileSync(join(source, f), join(dest, f))
console.log(`[sync-results] copied ${SYNCED_FILES.length} files from ${source} -> public/results-data/`)

const repoRoot = dirname(source)
mkdirSync(join(dest, 'docs'), { recursive: true })
for (const [name, rel, required] of SYNCED_DOCS) {
  const from = join(repoRoot, rel)
  if (!existsSync(from)) {
    if (required) {
      console.error(`[sync-results] missing required doc: ${from}`)
      process.exit(1)
    }
    console.warn(`[sync-results] optional doc not found, skipping: ${from}`)
    continue
  }
  copyFileSync(from, join(dest, 'docs', name))
}
console.log(`[sync-results] copied docs from ${repoRoot} -> public/results-data/docs/`)
