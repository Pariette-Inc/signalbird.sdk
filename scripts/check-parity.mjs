#!/usr/bin/env node
/**
 * Sözleşme denetimi: her dilin istemcisi AYNI metot kümesini sunmak zorunda.
 *
 * "Tek paket, tek davranış" iddiasını ayakta tutan şey budur — bir dile metot
 * eklenip diğerine eklenmezse CI kırılır.
 *
 * Beş yüzey, beş küme:
 *   - Telsiz    (docs/CONTRACT.md § 4)   — 7 metot   · sunucu dilleri
 *   - Gönderim  (docs/CONTRACT.md § 8.3) — 21 metot  · sunucu dilleri
 *   - Yönetim   (docs/CONTRACT.md § 10)  — 46 metot  · sunucu dilleri
 *   - Uygulama  (docs/CONTRACT.md § 11)  — 18 metot  · istemci dilleri
 *                                                     (TS, Swift, Kotlin)
 *   - Partner   (docs/CONTRACT.md § 12)  — 23 metot  · sunucu dilleri
 *       Mobil dile ya da tarayıcıya İNMEZ: partner anahtarı sunucuda kalır.
 * Adlar camelCase ve diller arasında birebirdir; her dil kendi yazım
 * geleneğini korur (`send_email` / `SendEmail` / `sendEmail` aynı metottur).
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

// Python: sınıf gövdesinde dört boşluk girintili `def ad(self, …)`.
const PYTHON_METHOD = /^\s{4}def (\w+)\s*\(\s*self/gm

// Go: `func (m *Management) Ad(` — alıcı tipi kümede zaten tek olduğu için
// alıcı adı okunmaz, yalnız metot adı alınır.
const GO_METHOD = /^func \(\w+ \*\w+\) (\w+)\(/gm

// C#: gövde ifadeli ya da bloklu genel metotlar. `public const`, `public
// class` gibi satırlar eşleşmesin diye ad-parantez sırası zorunlu tutulur.
const CSHARP_METHOD = /^\s{4}public (?:async |static |sealed |override )*[\w<>,?\[\]\. ]+? (\w+)(?:<[^>]*>)?\(/gm

// Swift: yalnız dışa açık metotlar (`public func`). İç yardımcılar
// (`private func`) sözleşmenin parçası değildir.
const SWIFT_METHOD = /^\s{4}public func (\w+)\s*\(/gm

// Kotlin: sınıf gövdesinde `fun` ya da `suspend fun`.
const KOTLIN_METHOD = /^\s{4}(?:suspend )?fun (\w+)\s*\(/gm

/**
 * Dilin kendi yazım geleneği bozulmaz; parite ADIN KENDİSİNDE aranır.
 *
 * `send_email` ile `SendEmail` ve `sendEmail` aynı metottur. Python'a camelCase
 * yazdırmak ya da Go'ya küçük harfle başlayan (yani DIŞA KAPALI) metot koymak,
 * paritenin sağladığı kolaylıktan fazlasını götürürdü.
 */
const toCamel = (name) =>
  name
    .replace(/_([a-z0-9])/g, (_, ch) => ch.toUpperCase())
    .replace(/^([A-Z])/, (ch) => ch.toLowerCase())

// C# metotları `Async` sonekiyle biter (dilin kuralı); sonek atılır.
const stripAsync = (name) => name.replace(/Async$/, '')

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
      { name: 'python', file: 'src/python/signalbird/client.py', pattern: PYTHON_METHOD, normalize: toCamel },
      { name: 'go', file: 'src/go/signalbird/radio.go', pattern: GO_METHOD, normalize: toCamel },
      { name: 'dotnet', file: 'src/dotnet/Signalbird.Sdk/SignalbirdClient.cs', pattern: CSHARP_METHOD, normalize: (n) => toCamel(stripAsync(n)) },
      // Swift ve Kotlin son kullanıcı yüzeyini taşır (§ 11); Telsiz kümesi
      // sunucu dilleri içindir — mobil uygulamaya gizli anahtar gömülmez.
    ],
  },
  {
    name: 'Gönderim',
    ref: 'docs/CONTRACT.md § 8.3',
    contract: [
      'sendEmail', 'sendSms', 'previewSms', 'sendPush',
      // Otomasyon olayı: müşterinin sistemindeki olay akışı tetikler (§11).
      'track',
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
      { name: 'python', file: 'src/python/signalbird/messaging.py', pattern: PYTHON_METHOD, normalize: toCamel },
      { name: 'go', file: 'src/go/signalbird/messaging.go', pattern: GO_METHOD, normalize: toCamel },
      { name: 'dotnet', file: 'src/dotnet/Signalbird.Sdk/MessagingClient.cs', pattern: CSHARP_METHOD, normalize: (n) => toCamel(stripAsync(n)) },
    ],
  },
  {
    name: 'Yönetim',
    ref: 'docs/CONTRACT.md § 10',
    contract: [
      // Telsiz yönetimi
      'radioSummary', 'radioEvents',
      'listRadioProjects', 'createRadioProject', 'getRadioProject', 'updateRadioProject',
      'deleteRadioProject', 'rotateRadioSecret',
      'createRadioChannel', 'updateRadioChannel', 'deleteRadioChannel',
      // Sohbet — ajan tarafı
      'chatSummary', 'chatUpdates',
      'listConversations', 'getConversation', 'listConversationMessages', 'startConversation',
      'updateConversation', 'setConversationStatus', 'assignConversation', 'readConversation',
      'setTyping', 'reply', 'editChatMessage', 'deleteChatMessage', 'reactToChatMessage',
      'getVisitor', 'updateVisitor', 'banVisitor',
      'listCannedReplies', 'createCannedReply', 'updateCannedReply', 'deleteCannedReply',
      'listChatTriggers', 'createChatTrigger', 'updateChatTrigger', 'deleteChatTrigger',
      'chatReport',
      // Uygulamalar
      'listApps', 'createApp', 'getApp', 'updateApp', 'deleteApp', 'rotateAppKey', 'listAppDevices',
      // Gömme: Signalbird ekranını müşterinin KENDİ panelinde göstermek.
      'embedToken',
    ],
    aliases: noProto({}),
    ignored: new Set(['constructor', '__construct', 'request', 'transport', 'fail', 'success', 'buildQuery', 'stringify', 'seg']),
    languages: [
      { name: 'node', file: 'src/node/management.ts', pattern: NODE_METHOD },
      { name: 'php', file: 'src/php/Management/ManagementClient.php', pattern: PHP_METHOD },
      { name: 'python', file: 'src/python/signalbird/management.py', pattern: PYTHON_METHOD, normalize: toCamel },
      { name: 'go', file: 'src/go/signalbird/management.go', pattern: GO_METHOD, normalize: toCamel },
      { name: 'dotnet', file: 'src/dotnet/Signalbird.Sdk/ManagementClient.cs', pattern: CSHARP_METHOD, normalize: (n) => toCamel(stripAsync(n)) },
    ],
  },
  {
    name: 'Uygulama',
    ref: 'docs/CONTRACT.md § 11',
    contract: [
      'bootstrap', 'startSession', 'identify', 'signOut',
      'listConversations', 'getConversation', 'startConversation', 'sendMessage',
      'editMessage', 'deleteMessage', 'reactToMessage', 'setTyping', 'markRead',
      'closeConversation', 'rateConversation',
      'registerDevice', 'unregisterDevice',
      // Bildirime dokunuldu sinyali: push'ta açılmayı yalnız uygulama bilir.
      'reportPushOpened',
    ],
    aliases: noProto({}),
    // `uploadAttachment` ve `currentVisitor` yalnız TS'te var: dosya yükleme
    // her platformda farklı bir tip ister (Blob / Data / Uri) ve tek imzada
    // birleşmiyor. Sözleşmeye girmez, dilin kendi belgesinde durur.
    ignored: new Set([
      'constructor', 'request', 'loadVisitor', 'storeVisitor',
      'uploadAttachment', 'currentVisitor', 'enc', 'buildQuery',
    ]),
    languages: [
      { name: 'typescript', file: 'src/app/client.ts', pattern: NODE_METHOD },
      { name: 'swift', file: 'src/swift/Sources/Signalbird/SignalbirdApp.swift', pattern: SWIFT_METHOD },
      { name: 'kotlin', file: 'src/kotlin/src/main/kotlin/io/signalbird/sdk/SignalbirdApp.kt', pattern: KOTLIN_METHOD },
    ],
  },
  {
    name: 'Partner',
    ref: 'docs/CONTRACT.md § 12',
    contract: [
      'createCompany', 'listCompanies', 'getCompany', 'updateCompany', 'suspendCompany', 'rotateKey',
      'addDomain', 'listDomains', 'getDomain', 'verifyDomain', 'removeDomain',
      'domainUptime', 'companyUptime',
      'listModules', 'grantModule', 'revokeModule',
      'createUser', 'listUsers', 'removeUser',
      // Salt okur mesaj günlüğü (MESSAGING_UNIFICATION_2026-08-25.md §5.1).
      'listMessages', 'getMessage', 'messageSummary',
      'createEmbedToken',
    ],
    aliases: noProto({}),
    // `uptimeQuery` Go'da paket düzeyinde bir yardımcıdır, metot değil.
    ignored: new Set(['constructor', '__construct', 'request', 'transport', 'fail', 'buildQuery', 'uptimeQuery', 'newPartner']),
    languages: [
      { name: 'node', file: 'src/node/partner.ts', pattern: NODE_METHOD },
      { name: 'php', file: 'src/php/Partner/PartnerClient.php', pattern: PHP_METHOD },
      { name: 'python', file: 'src/python/signalbird/partner.py', pattern: PYTHON_METHOD, normalize: toCamel },
      { name: 'go', file: 'src/go/signalbird/partner.go', pattern: GO_METHOD, normalize: toCamel },
      { name: 'dotnet', file: 'src/dotnet/Signalbird.Sdk/PartnerClient.cs', pattern: CSHARP_METHOD, normalize: (n) => toCamel(stripAsync(n)) },
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
    const normalize = lang.normalize ?? ((name) => name)
    const found = new Set(
      [...source.matchAll(lang.pattern)]
        // İç metotlar (Python `__init__`, `_helper`) sözleşmenin parçası değil.
        .filter((m) => !m[1].startsWith('_'))
        .map((m) => normalize(m[1]))
        .map((m) => surface.aliases[m] ?? m)
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
