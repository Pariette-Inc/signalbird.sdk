#!/usr/bin/env node
/**
 * Widget çıktısını (`dist/signalbird.js`) signalbird.web'in public dizinine
 * kopyalar: `public/sdk/v1/signalbird.js` → https://signalbird.io/sdk/v1/signalbird.js
 *
 * Widget npm paketine GİRMEZ (müşteri `<script>` ile CDN'den alır); bu yüzden
 * yayın adımı burasıdır. `npm run build` sonunda otomatik çalışır. Web reposu
 * bu makinede yoksa (CI) uyarır ama build'i kırmaz — npm yayını web'e bağlı
 * değildir.
 *
 * `--web <yol>` ile hedef repo verilebilir; varsayılan `../signalbird.web`.
 * `SIGNALBIRD_WEB_DIR` ortam değişkeni de aynı işi görür.
 */
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import { readFileSync } from 'node:fs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = join(root, 'dist', 'signalbird.js')

const argIndex = process.argv.indexOf('--web')
const webDir = resolve(
  root,
  argIndex !== -1 ? process.argv[argIndex + 1] : process.env.SIGNALBIRD_WEB_DIR || '../signalbird.web'
)

if (!existsSync(source)) {
  console.error(`✗ ${source} yok — önce \`tsup\` çalışmalı.`)
  process.exit(1)
}

const raw = readFileSync(source)
const gzip = gzipSync(raw, { level: 9 }).length
const kb = (n) => (n / 1024).toFixed(1) + ' KB'
console.log(`widget: ${kb(raw.length)} ham, ${kb(gzip)} gzip`)

// Sözleşme (§3.2): < 40 KB gzip. Aşarsa yayın durmaz ama gürültü çıkarır.
if (gzip > 40 * 1024) {
  console.warn('⚠ widget 40 KB gzip hedefini aştı — bağımlılık/özellik gözden geçirilmeli')
}

if (!existsSync(join(webDir, 'package.json'))) {
  console.warn(`⚠ signalbird.web bulunamadı (${webDir}); kopyalama atlandı.`)
  process.exit(0)
}

const targetDir = join(webDir, 'public', 'sdk', 'v1')
mkdirSync(targetDir, { recursive: true })
const target = join(targetDir, 'signalbird.js')
copyFileSync(source, target)

console.log(`✓ ${target} (${kb(statSync(target).size)})`)
