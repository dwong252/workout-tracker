/**
 * Generates PWA and iOS home-screen icons from a source SVG.
 *
 * Usage:
 *   1. Place your icon SVG at public/icon-source.svg
 *   2. npm install -D sharp   (one-time)
 *   3. node scripts/generate-icons.mjs
 *
 * If you'd rather use an online tool, upload public/icon-source.svg to
 * https://www.pwabuilder.com/imageGenerator and put the output in public/icons/.
 */

import { createRequire } from 'module'
import { readFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const require = createRequire(import.meta.url)
const __dir   = dirname(fileURLToPath(import.meta.url))
const root    = join(__dir, '..')
const outDir  = join(root, 'public', 'icons')

const sizes = [16, 32, 120, 152, 167, 180, 192, 512]

mkdirSync(outDir, { recursive: true })

let sharp
try {
  sharp = require('sharp')
} catch {
  console.error('sharp not installed. Run: npm install -D sharp')
  process.exit(1)
}

const src = join(root, 'public', 'icon-source.svg')

for (const size of sizes) {
  await sharp(src)
    .resize(size, size)
    .png()
    .toFile(join(outDir, `icon-${size}.png`))
  console.log(`✓ icon-${size}.png`)
}

// Maskable (add padding — 10% on each side)
const pad = Math.round(512 * 0.1)
await sharp(src)
  .resize(512 - pad * 2, 512 - pad * 2)
  .extend({ top: pad, bottom: pad, left: pad, right: pad, background: '#007AFF' })
  .png()
  .toFile(join(outDir, 'icon-512-maskable.png'))
console.log('✓ icon-512-maskable.png')

console.log('\nDone! Icons written to public/icons/')
