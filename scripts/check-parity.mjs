#!/usr/bin/env node
/**
 * Sözleşme denetimi: her dilin istemcisi AYNI metot kümesini sunmak zorunda.
 *
 * "Tek paket, tek davranış" iddiasını ayakta tutan şey budur — bir dile metot
 * eklenip diğerine eklenmezse CI kırılır.
 *
 * İki yüzey, iki küme:
 *   - Telsiz   (docs/CONTRACT.md § 4) — 7 metot
 *   - Gönderim (docs/CONTRACT.md § 8.3) — 20 metot, adlar camelCase ve birebir
 *
 * Yeni dil eklendiğinde her yüzeyin `languages` listesine bir giriş yaz:
 * kaynak dosya + metot adlarını çıkaran bir regex yeterli.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

// Node sınıf gövdesinde iki boşluk girintili metotlar: "  info(…) {", "  async log(…) {",
// "  async *iterate(…)". PHP: "public function info(…)".
const NODE_METHOD = /^\s{2}(?:async\s+)?\*?(\w+)\s*(?:<[^>]*>)?\s*\(/gm
const PHP_METHOD = /public function (\w+)\s*\(/gm

// Object.create(null): `constructor` gibi prototip adları eşleşmeye karışmasın.
const noProto = (obj) => Object.assign(Object.create(null), obj)

// Sınıf dışı yardımcı fonksiyonların gövdesi de iki boşluk girintilidir;
// oradaki `if (`, `for (` gibi anahtar sözcükler metot sanılmasın.
const KEYWORDS = new Set(['if', 'for', 'while', 'switch', 'return', 'catch', 'function', 'else'])

const SURFACES = [
  {
    name: 'Telsiz',
    ref: 'docs/CONTRACT.md § 4',
    contract: ['log', 'debug', 'info', 'warn', 'error', 'critical', 'batch'],
    // Node tarafında `debug` adı `debugLog`tur: `debug` yapılandırma alanıyla
    // çakışıyordu. Eşleme burada yapılır, sözleşme bozulmaz.
    aliases: noProto({ debugLog: 'debug' }),
    ignored: new Set(['constructor', '__construct', 'captureUncaught', 'post', 'send', 'request']),
    languages: [
      { name: 'node', file: 'src/node/client.ts', pattern: NODE_METHOD },
      { name: 'php', file: 'src/php/SignalbirdClient.php', pattern: PHP_METHOD },
      // Go, Swift, .NET, Android eklendiğinde buraya birer satır gelir
    ],
  },
  {
    name: 'Gönderim',
    ref: 'docs/CONTRACT.md § 8.3',
    contract: [
      'sendEmail', 'sendSms', 'previewSms', 'sendPush',
      'listContacts', 'createContact', 'updateContact', 'deleteContact', 'bulkContacts',
      'listContactLists', 'createContactList', 'deleteContactList',
      'listCampaigns', 'createCampaign', 'getCampaign', 'cancelCampaign',
      'listCampaignMessages', 'iterateCampaignMessages',
      'listMessages', 'getMessage',
    ],
    aliases: noProto({}),
    // İç yardımcılar (private/protected) — Node'da girinti regex'i onları da yakalar
    ignored: new Set(['constructor', '__construct', 'request', 'transport', 'fail', 'success', 'buildQuery', 'stringify']),
    languages: [
      { name: 'node', file: 'src/node/messaging.ts', pattern: NODE_METHOD },
      { name: 'php', file: 'src/php/Messaging/MessagingClient.php', pattern: PHP_METHOD },
    ],
  },
]

let failed = false

for (const surface of SURFACES) {
  const expected = new Set(surface.contract)
  console.log(`— ${surface.name} (${surface.ref})`)

  for (const lang of surface.languages) {
    const path = join(root, lang.file)

    if (!existsSync(path)) {
      console.error(`  ✗ ${lang.name}: kaynak bulunamadı — ${lang.file}`)
      failed = true
      continue
    }

    const source = readFileSync(path, 'utf8')
    const found = new Set(
      [...source.matchAll(lang.pattern)]
        .map((m) => surface.aliases[m[1]] ?? m[1])
        .filter((m) => !surface.ignored.has(m) && !KEYWORDS.has(m))
    )

    const missing = surface.contract.filter((m) => !found.has(m))
    const extra = [...found].filter((m) => !expected.has(m))

    if (missing.length || extra.length) {
      failed = true
      console.error(`  ✗ ${lang.name} (${lang.file})`)
      if (missing.length) console.error(`      eksik : ${missing.join(', ')}`)
      if (extra.length) {
        console.error(`      fazla : ${extra.join(', ')}`)
        console.error(`              (sözleşmede yoksa ya kaldır ya ${surface.ref}'e ekle)`)
      }
    } else {
      console.log(`  ✓ ${lang.name.padEnd(8)} ${surface.contract.length} metot, sözleşmeyle birebir`)
    }
  }
}

if (failed) {
  console.error('\nDiller arası metot paritesi bozuk. Sözleşme: docs/CONTRACT.md § 4 ve § 8.3')
  process.exit(1)
}

console.log(`\n${SURFACES.length} yüzey, tüm diller sözleşmeyle uyumlu.`)
