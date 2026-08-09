#!/usr/bin/env node
/**
 * Sözleşme denetimi: her dilin istemcisi AYNI yedi metodu sunmak zorunda.
 *
 * "Tek paket, tek davranış" iddiasını ayakta tutan şey budur — bir dile metot
 * eklenip diğerine eklenmezse CI kırılır.
 *
 * Yeni dil eklendiğinde LANGUAGES'a bir giriş yaz: kaynak dosya + metot adlarını
 * çıkaran bir regex yeterli.
 *
 * Sözleşme: docs/CONTRACT.md § 4
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

/** docs/CONTRACT.md § 4 — sıra önemli değil, küme eşitliği aranır. */
const CONTRACT = ['info', 'warn', 'error', 'critical', 'confirm', 'debug', 'send']

const LANGUAGES = [
  {
    name: 'node',
    file: 'src/node/signalbird.ts',
    // "  info(payload: LogPayload): Promise<TriggerResponse> {"
    pattern: /^\s{2}(\w+)\s*\(/gm,
  },
  {
    name: 'php',
    file: 'src/php/Signalbird.php',
    // "    public function info(string $title, string $message): array"
    pattern: /public function (\w+)\s*\(/gm,
  },
  // Go, Swift, .NET, Android eklendiğinde buraya birer satır gelir
]

const IGNORED = new Set(['constructor', '__construct'])
const expected = new Set(CONTRACT)
let failed = false

for (const lang of LANGUAGES) {
  const path = join(root, lang.file)

  if (!existsSync(path)) {
    console.error(`✗ ${lang.name}: kaynak bulunamadı — ${lang.file}`)
    failed = true
    continue
  }

  const source = readFileSync(path, 'utf8')
  const found = new Set(
    [...source.matchAll(lang.pattern)]
      .map((m) => m[1])
      .filter((m) => !IGNORED.has(m))
  )

  const missing = CONTRACT.filter((m) => !found.has(m))
  const extra = [...found].filter((m) => !expected.has(m))

  if (missing.length || extra.length) {
    failed = true
    console.error(`✗ ${lang.name} (${lang.file})`)
    if (missing.length) console.error(`    eksik : ${missing.join(', ')}`)
    if (extra.length) {
      console.error(`    fazla : ${extra.join(', ')}`)
      console.error('            (sözleşmede yoksa ya kaldır ya docs/CONTRACT.md § 4\'e ekle)')
    }
  } else {
    console.log(`✓ ${lang.name.padEnd(8)} ${CONTRACT.length} metot, sözleşmeyle birebir`)
  }
}

if (failed) {
  console.error('\nDiller arası metot paritesi bozuk. Sözleşme: docs/CONTRACT.md § 4')
  process.exit(1)
}

console.log(`\n${LANGUAGES.length} dil sözleşmeyle uyumlu.`)
