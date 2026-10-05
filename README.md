# Signalbird SDK

**Tek paket, beş yüzey, on iki giriş noktası.** Panelde tıklayarak yapabildiğiniz her şey
kodla da yapılabilir.

| Yüzey | Ne yapar | Anahtar | Nerede |
|---|---|---|---|
| **Telsiz** (Radio) | uygulamanızdan bir **kanala** log/olay yazar | `sb_secret_live_…` / `sb_public_live_…` | sunucu / tarayıcı |
| **Gönderim** (Messaging) | e-posta, SMS, push gönderir; kişi, liste, kampanya yönetir; mesaj durumu okur; webhook imzası doğrular | `sb_secret_live_…` | yalnız sunucu |
| **Yönetim** (Management) | kanal (modül anahtarı) açar, olay akışını okur, **sohbet gelen kutusunu** işler, push cihazlarını listeler | `sb_secret_live_…` | yalnız sunucu |
| **Uygulama** (App) | müşterinizin **son kullanıcısına** canlı sohbet + push cihaz kaydı | `sb_public_live_…` | web, iOS, Android |
| **Partner** | Signalbird'ü kendi ürününde satan **sözleşmeli platform** müşterisini sağlar ve yetkilendirir | `sb_secret_live_…` | yalnız sunucu |

Bir seçenek daha var ve kod yazmaz: hazır sohbet widget'ı
(`signalbird.js`), siteye tek `<script>` ile gömülür.

### Dil matrisi

| Dil / platform | Telsiz | Gönderim | Yönetim | Uygulama | Kurulum |
|---|:--:|:--:|:--:|:--:|---|
| Node.js / TypeScript | ✓ | ✓ | ✓ | ✓ | `npm i signalbird` |
| Tarayıcı (düz JS) | ✓ | - | - | ✓ | `signalbird/browser` · `/app` |
| React / Next.js | ✓ | ✓ | ✓ | ✓ | `signalbird/react` |
| Vue 3 | ✓ | - | - | ✓ | `signalbird/vue` |
| Angular | ✓ | - | - | ✓ | `signalbird/angular` |
| React Native / Expo | ✓ | - | - | ✓ | `signalbird/react-native` |
| PHP / Laravel | ✓ | ✓ | ✓ | - | `composer require pariette/signalbird` |
| Python | ✓ | ✓ | ✓ | - | `pip install signalbird` |
| Go | ✓ | ✓ | ✓ | - | `go get github.com/Pariette-Inc/signalbird.sdk` |
| .NET / ASP.NET Core | ✓ | ✓ | ✓ | - | `dotnet add package Signalbird.Sdk` |
| Swift (iOS) | ✓ | - | - | ✓ | SPM: `Signalbird` |
| Kotlin (Android) | ✓ | - | - | ✓ | `io.signalbird:signalbird-sdk` |

Metot adları diller arasında **birebir** aynıdır; her dil kendi yazım
geleneğini korur (`createModuleKey` / `create_module_key` /
`CreateModuleKey` / `CreateModuleKeyAsync`). `node scripts/check-parity.mjs` bunu her derlemede
denetler.

Uygulama yüzeyi mobil ve tarayıcı içindir: gizli anahtar oraya gömülmez.
Gönderim ve Yönetim yüzeyleri yalnız sunucudadır.

## Telsiz

Telsiz'in tek işi vardır: uygulamanızdan bir **kanala** mesaj yazmak.

Bildirimin kime gideceği, hangi kanaldan (push/e-posta), sessiz saatlerde ne
olacağı ve aynı mesajın kaç kez uyarı üreteceği **sunucuda, kanal ayarlarında**
durur. Kod tarafında bunlar yoktur ve olmamalıdır: bildirim kuralını
değiştirmek için uygulamanızı yeniden yayınlamanız gerekmesin.

```
domain anahtarı  →  sb_secret_live_… / sb_public_live_…   (kimlik: alan adınızın anahtarı)
modül anahtarı   →  odemeHatasi, deploy, browser…         (kanal adı; bildirim kuralı burada)
olay             →  tek bir kayıt
```

Kanal adı (modül anahtarı) **gizli değildir** ve kodun içinde durur: domain
anahtarı olmadan hiçbir işe yaramaz. Gövdede `key` alanıyla gider.

## Tek anahtar

`.env` dosyanıza **bir satır** yazarsınız:

```
SIGNALBIRD_DOMAIN_KEY=sb_secret_live_…
```

Bu, alan adınızın **gizli domain anahtarıdır** (Panel → Alan adları →
Anahtarlar) ve sunucu yüzeylerinin hepsini kapsar: Telsiz log yazımı, e-posta,
SMS, push, kişi ve kampanya, Yönetim. Kapsam (scope) listesi yoktur (v2.0);
ayrım anahtarın **türündedir** - gizli (`sb_secret_live_…`, sunucu) ya da açık
(`sb_public_live_…`, istemci). Hangi kanala yazdığınızı **modül anahtarı**
(kanal adı) belirler. **Adres yazmanız gerekmez** - üretim kökü paketin
içindedir.

Bir de **açık** anahtarlar vardır; onlar `.env`'e değil, sayfanın içine gömülür
ve gizli olmadıkları için ayrı durmak zorundadırlar:

| Anahtar | Nerede | Ne yapar |
|---|---|---|
| `sb_public_live_…` | `<script data-key data-channel>` | sohbet widget'ı, push cihaz kaydı |
| `sb_public_live_…` | tarayıcı log istemcisi | yalnız izinli kökenlerden (alan adları) |

Gizli anahtar tarayıcıya **gömülemez**: sunucu, `Origin` başlığı taşıyan bir
istekte gizli anahtarı reddeder (`SECRET_KEY_IN_BROWSER`). Bu bir kolaylık
değil, kasıtlı bir duvardır - anahtar bir kez istemciye indiğinde herkesindir.

## Kurulum

| Dil / çatı | Kurulum |
|---|---|
| Node.js, Next.js (sunucu), Express, NestJS, Fastify | `npm install signalbird` |
| React, Vue, Angular, Svelte, düz JS (tarayıcı) | `npm install signalbird` → `/browser`, `/app`, `/react`, `/vue`, `/angular` |
| React Native, Expo | `npm install signalbird` → `/react-native` |
| PHP, Laravel | `composer require pariette/signalbird` |
| Python (Django, FastAPI, Flask, Celery) | `pip install signalbird` |
| Go | `go get github.com/Pariette-Inc/signalbird.sdk` |
| .NET, ASP.NET Core | `dotnet add package Signalbird.Sdk` |
| Swift (iOS, macOS) | SPM: `https://github.com/Pariette-Inc/signalbird.sdk` |
| Kotlin (Android) | `implementation("io.signalbird:signalbird-sdk:2.9.0")` |
| Canlı sohbet widget'ı (herhangi bir site) | `<script async src="https://signalbird.io/sdk/v1/signalbird.js" data-key="sb_public_live_…" data-channel="destek"></script>` |

> Hepsi **bu repodan** çıkar ve **aynı sürümü** taşır - ayrı SDK reposu ya da
> dil başına sürüm yoktur.

## Node.js / TypeScript

```ts
import { signalbird } from 'signalbird'

// SIGNALBIRD_DOMAIN_KEY ortam değişkeninden okunur
await signalbird().critical('critical', 'ödeme servisi yanıt vermiyor', {
  service: 'iyzico',
  attempt: 3,
})

await signalbird().info('info', 'ahmet@x.com yeni hesap oluşturdu')
```

Kendi istemcinizi kurmak isterseniz:

```ts
import { SignalbirdClient } from 'signalbird'

const sb = new SignalbirdClient({
  domainKey: process.env.SIGNALBIRD_DOMAIN_KEY!,
  source: 'api-01',        // hangi sunucudan geldiği
  throwOnError: false,     // üretimde kapalı kalmalı
})

await sb.log({ key: 'deploy', message: 'v2.4.0 yayında', level: 'info' })

// Kanalı bir kez bağlayıp yazmak:
await sb.radio('deploy').info('v2.4.0 yayında')
```

**Yakalanmamış hatalar:**

```ts
signalbird().captureUncaught('critical')
```

**Toplu gönderim** (kısmi başarı normaldir, satır satır sonuç döner):

```ts
const result = await signalbird().batch([
  { key: 'isler', message: 'iş 1 bitti', level: 'info' },
  { key: 'isler', message: 'iş 2 bitti', level: 'info' },
])
```

### Next.js

Sunucu tarafında (route handler, server action, `app/api/**`) doğrudan
`signalbird` kullanılır. **İstemci bileşenlerinde kullanmayın** - anahtar
paketle birlikte tarayıcıya iner.

```ts
// app/api/webhook/route.ts
import { signalbird } from 'signalbird'

export async function POST(req: Request) {
  try {
    // …
  } catch (error) {
    await signalbird().error('webhook', (error as Error).message)
    throw error
  }
}
```

## Tarayıcı (React, Vue, Angular, düz JS)

Çatıya özel sarmalayıcı yoktur; gereken tek şey bir fonksiyon çağrısıdır.

```ts
// uygulama açılışında bir kez
import { initSignalbird } from 'signalbird/browser'

const sb = initSignalbird({
  publicKey: 'sb_public_live_…',
  source: 'web',
})

sb.captureErrors('browser')   // window.onerror + unhandledrejection
sb.error('browser', 'sepet güncellenemedi', { cartId })

// Kanalı bir kez bağlamak (2.9.0): debug · info · warn · error
const sepet = sb.radio('sepet')
sepet.warn('stok azaldı', { sku })
```

Tarayıcı istemcisinin metotları: `log(key, message, level?, context?)`,
`info`, `warn`, `error`, `radio(key)`, `captureErrors(key?)`, `flush()`,
`destroy()`. Ayrı bir `critical()` / `debug()` kısayolu **yoktur**: istemci
kodu herkesin elindedir ve oradan kritik alarm çaldırmak kötüye kullanıma
açıktır (gerekirse `log(key, msg, 'critical')`; kanalın bildirimi panelde
susturulabilir).

Kayıtlar tek tek değil, **toplu** gider (varsayılan 3 saniyede bir) ve sekme
kapanırken `sendBeacon` ile boşaltılır (`text/plain` gövde - tarayıcı
cross-origin beacon'da JSON içerik türüne izin vermez).

**React** - `app/providers.tsx` ya da `main.tsx`:

```tsx
useEffect(() => {
  const sb = initSignalbird({ publicKey: process.env.NEXT_PUBLIC_SIGNALBIRD_DOMAIN_KEY! })
  return sb.captureErrors()
}, [])
```

**Vue** - `main.ts`:

```ts
const sb = initSignalbird({ publicKey: import.meta.env.VITE_SIGNALBIRD_DOMAIN_KEY })
app.config.errorHandler = (err) => sb.error('browser', String(err))
```

**Angular** - `ErrorHandler` sağlayıcısı:

```ts
@Injectable()
export class SignalbirdErrorHandler implements ErrorHandler {
  private sb = initSignalbird({ publicKey: environment.signalbirdKey })
  handleError(error: unknown) { this.sb.error('browser', String(error)) }
}
```

Panelde açık anahtarın **izinli kökenlerini** (alan adlarını) tanımlamayı
unutmayın; liste boşken tarayıcı anahtarı hiçbir şey yazamaz
(`ORIGIN_NOT_ALLOWED`). Kanal bazında bir kısıt **yoktur**: açık anahtar,
izinli kökenden her kanala yazabilir. Bu yüzden tarayıcıdan yazılan kanalları
(`browser` gibi) sunucunun kritik kanallarından ayrı tutun ve bildirim
kurallarını ona göre verin - istemci kodu herkesin elindedir.

## PHP / Laravel

```php
use Signalbird\Sdk\Facades\Signalbird;

Signalbird::critical('critical', 'ödeme servisi yanıt vermiyor', [
    'service' => 'iyzico',
]);

Signalbird::info('info', 'ahmet@x.com yeni hesap oluşturdu');
```

`.env`:

```
SIGNALBIRD_DOMAIN_KEY=sb_secret_live_…
SIGNALBIRD_SOURCE=api-01
```

**Laravel'in kendi loglarını Telsiz'e bağlamak** - `config/logging.php`:

```php
'signalbird' => [
    'driver'  => 'monolog',
    'handler' => \Signalbird\Sdk\SignalbirdLogHandler::class,
    'with'    => ['key' => 'laravel'],   // kanal adı (modül anahtarı)
    'level'   => 'error',
],
```

Sonra `LOG_STACK=single,signalbird`. Mevcut `Log::error()` satırlarınız olduğu
gibi çalışır; tek satır kod yazmadan Telsiz'e düşerler. `context` içindeki
istisna (`['exception' => $e]`) sınıf, mesaj, dosya, satır ve ilk 20 yığın
çerçevesiyle gider (2.9.0).

Laravel dışı PHP:

```php
use Signalbird\Sdk\Signalbird;

Signalbird::configure('sb_secret_live_…');
Signalbird::error('api', 'veritabanı bağlantısı koptu');
```

## AWS / webhook ile Telsiz'e yazmak

SDK kurmanın mümkün olmadığı ya da gereksiz olduğu kaynaklar (AWS alarmları,
CI, üçüncü parti servisler) Telsiz kanalına **gelen bağlantı adresiyle**
yazar. Her kanalın kendi adresi vardır; panelde **Telsiz → Kanallar → AWS /
Webhook** altında oluşturulur:

```
POST https://live.signalbird.io/api/v1/radio/hook/sbh_…
```

- Kimlik URL'deki kanal jetonudur (`sbh_…`), domain anahtarı değil: jetonun
  yetkisi yalnız o kanala log yazmaktır. Jetonu bir sır gibi saklayın;
  sızarsa panelden yenileyin.
- **AWS SNS:** konuya HTTPS aboneliği olarak bu adresi ekleyin. Abonelik
  onayı (`SubscriptionConfirmation`) kendiliğinden yapılır ve her SNS
  mesajının imzası doğrulanır.
- **CloudWatch alarmları:** `ALARM` → `critical`, `OK` → `info` seviyesinde
  yazılır.
- **Herhangi bir sistem** JSON gönderebilir:

```bash
curl -X POST https://live.signalbird.io/api/v1/radio/hook/sbh_… \
  -H 'Content-Type: application/json' \
  -d '{"message": "yedekleme başarısız", "level": "error"}'
```

`level` verilmezse kanalın varsayılan seviyesi geçerlidir; isteğe bağlı
`context` (nesne) ve `source` alanları da kabul edilir. SDK gerekmez.

## Davranış kuralları

- **Sessiz hata varsayılandır.** Telsiz erişilemezse çağrı `ok: false` döner ve
  uygulamanız çalışmaya devam eder. Log göndermek, ödeme akışını çökertmek için
  geçerli bir sebep değildir. Geliştirme sırasında `throwOnError: true`.
- **Tanımsız kanal düşürülmez.** İlk `log('odeme-hatasi', …)` çağrısında kanal
  kendiliğinden açılır ve panelde "otomatik açıldı" işaretiyle görünür. Yeni
  kanal **sessizdir** - kuralı ekip koyar.
- **Seviye kanalın varsayılanını ezer.** `level` göndermezseniz kanalın kendi
  seviyesi geçerlidir.
- **Kritik seviye sessiz saatleri deler.** Gece üçte ölen servis sabahı bekleyemez.
- **Tekrar bastırma kaydı değil bildirimi susturur.** Aynı mesaj kanalın
  `dedupe` süresi içinde tekrar gelirse ikinci bildirim gitmez ama kayıt tutulur.
- **Mesaj 4000 karaktere kırpılır (2.9.0).** API daha uzununu 422 ile reddeder
  ve toplu gönderimde tek uzun satır bütün paketi düşürürdü; SDK göndermeden
  önce kırpar. `context` güvenle serileştirilir: döngüsel başvuru
  `"[Circular]"`, `Error` `{name, message, stack}`, `BigInt` metin olur (PHP'de
  `Throwable` → `class, message, code, file, line, trace`).
- **SDK sürümünü bildirir (2.6.0).** Her istek `X-Signalbird-Sdk:
  <platform>/<sürüm>` taşır. Yeni sürüm çıktığında SDK süreç başına **bir kez**
  uyarı yazar; eski sürümdeki anahtarların sahiplerine panel bildirimi gider.
  Uyarı hata değildir, istek sonucu değişmez (CONTRACT §14).
- **Ziyaretçi kimliği doğrulanır (2.7.0).** Sohbet/push ziyaretçisinin
  `external_id`'si ancak sunucunuzda üretilen `identity_hash` ile birlikte
  gelirse güvenilir sayılır: kişi kaydına bağlama, cihaza push ve kanal
  ajanının araçlarına giden güvenilir kimlik buna bağlıdır. Widget ayrıca
  gerektiğinde Cloudflare Turnstile ister (CONTRACT §15).

## Gönderim (Messaging)

Telsiz ile **aynı** gizli domain anahtarıyla (`sb_secret_live_…`) çalışır.
Açık anahtar burada geçmez - istemci kurulurken `WRONG_KEY_TYPE` ile reddeder.
Yalnız sunucuda kullanılır.

Node:

```ts
import { SignalbirdMessaging } from 'signalbird'

const sb = new SignalbirdMessaging({ domainKey: process.env.SIGNALBIRD_DOMAIN_KEY! })

const r = await sb.sendEmail({
  to: 'ali@example.com',
  class: 'transactional',       // zorunlu: transactional | commercial
  subject: 'Siparişiniz yola çıktı',
  body: '<p>Merhaba {{first_name}}…</p>',
})
if (!r.ok) console.error(r.code, r.message)   // ok:false → code + message

// Panelde tanımlı şablonla ve gönderici kanalıyla (PHP: Signalbird::sendMail('noReply')):
await sb.sendEmail({
  to: 'ali@example.com',
  class: 'transactional',
  template: 'Sipariş Onayı',     // ad ya da template_id; varken subject/body gerekmez
  vars: { ad: 'Ali', no: 'S-1234' },
  module_key: 'noReply',         // From adresini kanal seçer
  reply_to: 'destek@ornek.com',
})

await sb.sendSms({ to: '+905551112233', class: 'transactional', body: 'Kodunuz: 4821' })
await sb.sendPush({ to: 'external:user-1042', class: 'transactional', subject: 'Yeni mesaj', body: '…' })

// Kişi + liste + kampanya
const list = await sb.createContactList({ name: 'agustos-kampanya' })
await sb.bulkContacts({                       // 1000'lik parçalara bölünür
  list_id: list.data.id,
  consent_source: 'offline',
  contacts: [{ email: 'a@x.com', first_name: 'Ayşe', attributes: { external_ref: 'rcp_1' } }],
})
const c = await sb.createCampaign({
  name: 'Ağustos', channel: 'email', list_id: list.data.id,
  subject: 'Merhaba {{first_name}}', body: '…', external_ref: 'cc_42',
})
for await (const m of sb.iterateCampaignMessages(c.data.batch.id)) {
  console.log(m.external_ref, m.status)
}
```

PHP / Laravel:

```php
use Signalbird\Sdk\Facades\Signalbird;

$r = Signalbird::messaging()->sendEmail([
    'to' => 'ali@example.com', 'class' => 'transactional',
    'subject' => 'Siparişiniz yola çıktı', 'body' => '<p>…</p>',
]);
if (! $r['ok']) { Log::warning($r['code'], $r); }
```

`.env`: `SIGNALBIRD_DOMAIN_KEY=sb_secret_live_…` (isteğe bağlı `SIGNALBIRD_MESSAGING_URL`,
`SIGNALBIRD_MESSAGING_TIMEOUT`). Laravel dışı PHP:
`Signalbird::configureMessaging('sb_secret_live_…')` ya da
`new MessagingClient('sb_secret_live_…')`.

Metot kümesi iki dilde aynıdır: `sendEmail` `sendSms` `previewSms` `sendPush` ·
`listContacts` `createContact` `updateContact` `deleteContact` `bulkContacts` ·
`listContactLists` `createContactList` `deleteContactList` · `listCampaigns`
`createCampaign` `getCampaign` `cancelCampaign` `listCampaignMessages`
`iterateCampaignMessages` · `listMessages` `getMessage`. Hepsi
`{ok, status, data?, code?, message?}` döner; `throwOnError: true` ile istisna
(`SignalbirdError` / `SignalbirdException`, `code` + `status` + `body` taşır).

**Webhook imzası** (`message.*`, `campaign.*` olayları):

```ts
import { verifyWebhook } from 'signalbird'
// Express: app.post('/hooks/signalbird', express.raw({ type: '*/*' }), (req, res) => {
if (!verifyWebhook(req.body, req.header('X-Signalbird-Signature'), process.env.SIGNALBIRD_WEBHOOK_SECRET!)) {
  return res.status(401).end()
}
```

```php
use Signalbird\Sdk\Messaging\Webhook;

abort_unless(Webhook::verify($request->getContent(), $request->header('X-Signalbird-Signature'), config('services.signalbird.webhook_secret')), 401);
```

Doğrulama **ham gövde** üzerinde yapılır; JSON'u ayrıştırıp yeniden
serileştirmek imzayı bozar.

## Yönetim (Management)

Panelde tıklayarak yaptığınız her şeyi kodla yapar. Ortam kurulumunuz, CI
akışınız ya da kendi ajan arayüzünüz artık panel oturumu taklit etmek zorunda
değil.

**Bu bir admin yüzeyi değildir:** anahtar tek bir takıma bağlıdır ve yalnız o
takımın kayıtlarına dokunur. Kullanıcı, faturalama ve abonelik işlemleri SDK'da
yoktur.

Aynı gizli domain anahtarıyla (`sb_secret_live_…`) çalışır; ayrı anahtar ya
da kapsam (scope) gerekmez. Domain anahtarının kendisi panelden üretilir ve
döndürülür - SDK anahtar üretmez.

```ts
import { management } from 'signalbird'

// Yeni ortam kurulumu: Telsiz kanalını (modül anahtarını) bildirim kuralıyla aç
const { data } = await management().createModuleKey('logger', {
  key: 'odeme',            // kodda kullanacağınız ad: signalbird().radio('odeme')
  title: 'Ödeme',
  level: 'critical',
  notify: ['push'],
  quiet_from: 0,
  quiet_to: 7,             // kritik seviye sessiz saatleri yine de deler
})
console.log(data?.module_key.id)
```

`module` ∈ `logger` (Telsiz) · `email` · `sms` · `push` · `chat`. Diğer
metotlar: `listModuleKeys`, `getModuleKey`, `updateModuleKey` (ad
değiştirilebilir; eski ad 30 gün kabul edilir), `deleteModuleKey`,
`listModuleKeyDevices`, `radioSummary`, `radioEvents`.

Sohbet gelen kutusunu kendi botunuzla işleyin:

```ts
const inbox = await management().listConversations({ status: 'open', per_page: 20 })

for (const conversation of inbox.data?.data ?? []) {
  await management().reply(conversation.id, {
    body: 'Merhaba! Ekibimiz birkaç dakika içinde yanıtlayacak.',
  })

  // İç not: gelen kutusunda görünür, ziyaretçiye ASLA gitmez
  await management().reply(conversation.id, { body: 'Bot yanıtladı', is_internal: true })
}
```

Signalbird ekranını **kendi panelinizde** göstermek isterseniz gömme jetonu:

```ts
const { data } = await management().embedToken({ module: 'chat' })
// data.url → 120 saniyelik, TEK KULLANIMLIK adres; doğrudan <iframe>'e verin
```

Anahtarın panelde **gömme jetonu üretebilir** (`can_issue_embed`) onayı
taşıması gerekir; yoksa 403 `EMBED_NOT_ALLOWED`. Jeton 60 dakikalık bir panel
oturumuna çevrildiği için bu onay bilerek ayrıdır.

Aynısı PHP, Python, Go ve .NET'te birebir aynı metot adlarıyla:

```php
Signalbird::management()->createModuleKey('logger', ['key' => 'odeme', 'title' => 'Ödeme']);
```

```python
signalbird.SignalbirdManagement(domain_key=key).create_module_key("logger", {"key": "odeme", "title": "Ödeme"})
```

```go
admin.CreateModuleKey(ctx, "logger", map[string]any{"key": "odeme", "title": "Ödeme"})
```

```csharp
await management.CreateModuleKeyAsync("logger", new Dictionary<string, object?> { ["key"] = "odeme", ["title"] = "Ödeme" });
```

Tam liste (40 metot): `docs/CONTRACT.md § 10`.

## Partner - müşteri sağlama

Signalbird'ü kendi ürününüzün içinde satıyorsanız (sözleşmeli platform) bu yüzey
sizindir: müşteri hesabı açar, domain ekleyip izlemeye alır, uptime okur, ödeme
alındığında modül açar ve panel ekranını kendi sayfanıza gömersiniz.

```ts
import { SignalbirdPartner } from 'signalbird'

const partner = new SignalbirdPartner({ domainKey: process.env.SIGNALBIRD_DOMAIN_KEY! })

// Müşteri açıldı - idempotent: aynı external_id ikinci kez yeni hesap AÇMAZ
const { data } = await partner.createCompany({
  external_id: 'sc_9911',
  name: 'Acme',
  owner: { email: 'sahip@acme.com', name: 'Acme Sahibi', external_id: 'u_88' },
})

// Domain açıldı → anında izlemeye girsin
await partner.addDomain('sc_9911', {
  external_id: 'd_5',
  domain: 'acme.com',
  monitoring: { enabled: true, frequency: 5 },
})

// Ödeme alındı → modül açılsın
await partner.grantModule('sc_9911', { module: 'email', expires_at: '2027-08-20' })

// Kendi domain listesi ekranınızda uptime
const uptime = await partner.companyUptime('sc_9911', '7d')

// Sohbet ekranını kendi sayfanıza gömün (jetonu SUNUCUNUZ üretir)
const embed = await partner.createEmbedToken('sc_9911', {
  user_external_id: 'u_88', module: 'chat', theme: 'dark',
})
// → <iframe src={embed.data.url} />

// Gönderilen her şeyin durumu - kendi panelinizde çizmek için (salt okur)
const log = await partner.listMessages('sc_9911', { channel: 'email', status: 'delivered' })
const one = await partner.getMessage('sc_9911', 'm_01J…')       // olay zaman çizelgesi
const sum = await partner.messageSummary('sc_9911', '7d')       // kanal bazlı özet

// "Bu siparişe ait iletiler" kısayolu
await partner.listMessages('sc_9911', { external_ref: 'order_9911' })
```

PHP'de `Signalbird::partner()->createCompany([...])`.

İki kural: **anahtar tarayıcıya inmez** ve **TXT'siz domain kampanya
gönderemez** (izleme, sohbet ve push açıktır). Ayrıntı: `docs/CONTRACT.md § 12`.

Mesaj uçları **salt okurdur**: alıcı maskeli döner, gövde hiç dönmez - gövde
zaten saklanmıyor.

## Gönderim - müşterinin kendi sisteminden

Bir platformun (SubmitCMS, veribenim…) müşterisiyseniz kendi sunucunuzdan da
gönderim yapabilirsiniz. Gereken tek şey **kendi gizli domain anahtarınızdır**
(`sb_secret_live_…`); panelde Alan adları → Anahtarlar altında durur.

```ts
import { SignalbirdMessaging } from 'signalbird'

const sb = new SignalbirdMessaging({ domainKey: process.env.SIGNALBIRD_DOMAIN_KEY! })

// İşlemsel: sipariş bildirimi, şifre sıfırlama. İYS'ye tabi DEĞİLDİR.
await sb.sendEmail({
  to: 'musteri@ornek.com',
  class: 'transactional',
  subject: 'Siparişiniz hazırlanıyor',
  body: '<p>Merhaba {{ad}}, siparişiniz yola çıktı.</p>',
  vars: { ad: 'Ayşe' },
})

// Ticari: duyuru, kampanya. İzin ŞARTTIR ve İYS kapısından geçer.
await sb.sendEmail({ to: '…', class: 'commercial', subject: '…', body: '…' })
```

```php
// Laravel: tek satır konfigürasyonla UYGULAMANIN TAMAMI buradan çıkar
// config/mail.php → 'signalbird' => ['transport' => 'signalbird', 'class' => 'transactional']
// .env           → MAIL_MAILER=signalbird, SIGNALBIRD_DOMAIN_KEY=sb_secret_live_…
Mail::to($user)->send(new SiparisBildirimi($order));  // hiçbir Mailable değişmez

// Gövde PANELDE duruyorsa (şablon + değişken), zincirlenebilir yüz:
Signalbird::mail()
    ->to($user->email)
    ->template('Sipariş Onayı')        // panelde yazan ad ya da id
    ->vars(['ad' => $user->name])
    ->fromName('Penyu Destek')
    ->transactional()                   // sınıf ZORUNLU, varsayılanı yok
    ->send();
```

İkisinin farkı gövdenin nerede durduğudur: taşıyıcıda uygulamada (Blade),
`mail()`'de Signalbird panelinde. Metni değiştirmek için dağıtım beklemek
istemiyorsanız ikincisi.

Üç şey bilinmeli:

1. **Sınıfı siz seçmezsiniz, sistem belirler.** Kampanya arayüzünden çıkan her
   şey zorunlu `commercial`tır. Ticari iletiyi `transactional` işaretleyip
   İYS'yi atlamak, sistemin izin verebileceği en pahalı hatadır.
2. **Gönderen kimliği panelde kurulur.** Hazır adresiniz
   (`bildirim@<takım>.sendsignalbird.com`) hesapla birlikte gelir; kendi alan
   adınızı bağlamak için DKIM/SPF/MX kayıtlarını yayınlamanız gerekir.
3. **Anahtar sunucuda kalır.** Tarayıcıya ya da mobil uygulamaya konmaz;
   oralar için açık uygulama anahtarı (`sb_public_live_…`) vardır.

## Uygulama (App) - kendi sohbet arayüzünüz

Hazır widget yerine kendi arayüzünüzü yazmak, ya da sohbeti **mobil
uygulamanıza** koymak istiyorsanız bu yüzey içindir. Açık uygulama anahtarı
(`sb_public_live_…`) kullanır ve yalnız ziyaretçinin kendi verisine dokunur.

**React / Next.js**

```tsx
import { SignalbirdProvider, useChat } from 'signalbird/react'

export function App() {
  return (
    <SignalbirdProvider publicKey={process.env.NEXT_PUBLIC_SIGNALBIRD_APP_KEY!}>
      <Chat />
    </SignalbirdProvider>
  )
}

function Chat() {
  const { messages, unread, agentTyping, send } = useChat({ open: true })

  return (
    <>
      {messages.map((m) => <Bubble key={m.id} message={m} />)}
      {agentTyping && <Typing />}
      <Composer onSend={send} />
    </>
  )
}
```

**Vue 3**

```ts
app.use(signalbirdPlugin, { publicKey: import.meta.env.VITE_SIGNALBIRD_APP_KEY })

const { state, send } = useChat({ open: isOpen })
```

**Angular**

```ts
bootstrapApplication(App, { providers: [provideSignalbird({ publicKey, chatKey })] })

// bileşende
chat$ = inject(SignalbirdService).chat$()
```

**React Native / Expo**

```tsx
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createSignalbirdApp, asyncStorageAdapter, useNativeChat } from 'signalbird/react-native'

// Depoyu vermek ZORUNLU: sır cihazda kalmazsa geçmiş her açılışta kaybolur
const client = createSignalbirdApp({ publicKey, chatKey, storage: asyncStorageAdapter(AsyncStorage) })

const { messages, send } = useNativeChat(client, { open: true, isForeground })
```

**Swift (iOS)**

```swift
let client = try SignalbirdApp(config: .init(publicKey: "sb_public_live_…"))

try await client.startSession(["name": "Ayşe"])
try await client.startConversation(body: "Kargom nerede?")
try await client.registerDevice(token: apnsToken)
```

**Kotlin (Android)**

```kotlin
val client = SignalbirdApp(SignalbirdAppConfig(publicKey = "sb_public_live_…", storage = prefsStorage))

client.startSession(mapOf("name" to "Ayşe"))
client.startConversation("Kargom nerede?")
client.registerDevice(token = fcmToken)
```

Tam liste (17 metot) ve yoklama merdiveni: `docs/CONTRACT.md § 11`.

## Widget (canlı sohbet)

Panelde **Gelen Kutusu → Ayarlar → Uygulamalar**'dan bir uygulama açın; verilen
`sb_public_live_…` anahtarını sitenize gömün:

```html
<script async src="https://signalbird.io/sdk/v1/signalbird.js" data-key="sb_public_live_…" data-channel="destek"></script>
```

Bu kadar. Sohbet modülü açıksa balon görünür; renk, konum, karşılama, ön-form,
çalışma saatleri panelden yönetilir. Programatik kullanım:

```js
Signalbird.identify({ external_id: 'user-1042', email: 'ali@example.com', name: 'Ali Veli' })
Signalbird.chat.open()                       // close() · toggle() · isOpen()
Signalbird.chat.on('unread', (n) => badge.textContent = n)
Signalbird.push.register({ token, platform: 'web', provider: 'fcm' })
Signalbird.destroy()
Signalbird.reset()                           // kullanıcı ÇIKIŞ yapınca (2.8.0, CONTRACT §15.3)
```

**Çıkışta `Signalbird.reset()` zorunlu (2.8.0).** Ziyaretçi sırrını, sohbet
geçmişini ve kimliği tarayıcıdan siler; aynı tarayıcıyı kullanan sonraki kişi
öncekinin sohbetini görmez, destek ajanı onu önceki kullanıcı sanmaz.
Sunucu da kimliği her oturumda yeniden imza ister.

`data-key`/`data-channel` yerine `Signalbird.init({ publicKey, chatKey, baseUrl?, locale? })` da
çağrılabilir.

**Kimlik doğrulaması (2.7.0).** Oturum açmış kullanıcıyı tanıtırken
`external_id`'nin hash'ini SUNUCUNUZDA üretip birlikte verin; yoksa Signalbird
bu kimliği doğrulanmamış sayar (kişi kaydına bağlamaz, cihaza push hedeflemez,
ajan araçları kimliği yalnız `visitor.unverified` altında görür):

```php
// Blade - gizli anahtar sunucuda kalır
<script async src="https://signalbird.io/sdk/v1/signalbird.js"
        data-key="sb_public_live_…" data-channel="destek"
        data-external-id="{{ $user->id }}"
        data-identity-hash="{{ Signalbird::identityHash((string) $user->id) }}"></script>
```

```js
Signalbird.identify({ external_id: 'user-1042', identityHash: '<sunucudan>', email: 'ali@example.com' })
```

`identity_hash = hex(HMAC-SHA256(hex(SHA-256(sb_secret_live_…)), external_id))`;
Node `client.identityHash(id)`, Python `client.identity_hash(id)`, Go
`client.IdentityHash(id)`, .NET `client.IdentityHash(id)`.

**Captcha.** Kanalda açıksa widget yeni ziyaretçide ve doğrulanmamış
ziyaretçinin ilk konuşmasında görünmez bir Cloudflare Turnstile jetonu alır;
betik yalnız panel ilk açıldığında yüklenir, etkileşim yalnız Cloudflare
isterse görünür. Kurulumda yapmanız gereken bir şey yoktur. Widget ev sahibi sayfaya asla hata fırlatmaz; Shadow DOM içinde
çalışır, sayfanızın CSS'iyle çakışmaz; < 40 KB gzip. Ayrıntı:
`docs/CONTRACT.md § 9` ve https://signalbird.io/sdk/widget.

## Gömme (embed) - Signalbird ekranını kendi panelinizde çalıştırın

Partner (veribenim, submitcms, yeni ortaklar) Signalbird modülünü kendi
panelinin içinde gösterir. Ekran kopyalanmaz - **çalışan ekranın kendisi**
gelir; Signalbird'de güncellenen her şey partner panelinde de anında günceldir.

```html
<div id="sb-chat"></div>
<script async src="https://signalbird.io/sdk/v1/signalbird.js"></script>
<script>
  Signalbird.embed({
    module: 'chat',                       // chat | monitoring | campaigns | contacts | radio | messages
    // Jeton SİZİN sunucunuzdan gelir; partner anahtarı tarayıcıya inmez.
    mint: () => fetch('/api/signalbird/embed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ module: 'chat' }),
    }).then((r) => r.json()),
    theme: 'auto',
    height: 'auto',
  }).mount('#sb-chat')
</script>
```

npm ile:

```ts
import { createEmbed } from 'signalbird/embed'

const chat = createEmbed({ module: 'chat', mint })
await chat.mount('#sb-chat')
chat.on('ready', () => console.log('geldi'))
// tema değişince: chat.setTheme('dark') · ekrandan çıkarken: chat.destroy()
```

Sunucu tarafı tek çağrıdır (`Signalbird::partner()->createEmbedToken(...)`,
§12.5): 120 saniyelik, tek kullanımlık jeton. Ayrıntı: `docs/CONTRACT.md § 13`.

## Hata kodları

Telsiz (`/v1/radio/log`, `/v1/radio/log/batch`) ve bütün anahtarlı uçların
ortak kapısı:

| Kod | HTTP | Anlamı |
|---|---|---|
| `DOMAIN_KEY_MISSING` | 401 | `X-Signalbird-Key` başlığı yok |
| `DOMAIN_KEY_INVALID` | 401 | Anahtar tanınmadı ya da kullanım dışı (iptal edilmiş) |
| `SECRET_KEY_IN_BROWSER` | 401 | Gizli anahtar `Origin` taşıyan (tarayıcı) bir istekte kullanıldı |
| `SECRET_KEY_IN_QUERY` | 401 | Gizli anahtar sorgu dizesinde (`?k=`) gönderildi |
| `SECRET_KEY_REQUIRED` | 403 | Uç gizli anahtar ister; açık anahtar verildi |
| `ORIGIN_REQUIRED` | 403 | Açık (web) anahtar `Origin`'siz, yani sunucudan kullanıldı |
| `ORIGIN_NOT_ALLOWED` | 403 | İstek kökeni açık anahtarın izinli kökenleri arasında değil |
| `APP_KEY_IN_BROWSER` | 403 | Mobil uygulama anahtarı web sayfasından kullanıldı |
| `DOMAIN_INACTIVE` / `TEAM_INACTIVE` | 403 | Alan adı ya da takım pasif |
| `MODULE_DISABLED` | 403 | Paketinizde Telsiz (`logger`) modülü yok |
| `MODULE_KEY_INVALID` | 422 | Kanal adı (`key`) geçersiz - normalize edilince boş kalıyor |
| `MODULE_KEY_DISABLED` | **202** | Kanal panelde kapalı - kayıt yazılmaz, kota da harcanmaz; yanıt `ok: false` taşır, tekrar denemeyin |
| `LIMIT_REACHED` | 429 | Aylık kayıt limitiniz doldu |
| `OVERAGE_CEILING_REACHED` | 429 | Aşım tavanına ulaşıldı |
| `NETWORK_ERROR` | - | SDK sunucuya ulaşamadı (istemci tarafı) |

Toplu uçta (`/log/batch`) kapı hatası tüm isteği reddeder; `MODULE_*` ve
kota kodları ise satır satır `results[i].code` içinde döner. Gövde
doğrulaması (ör. 4000 karakteri aşan `message`) satır satır DEĞİLDİR - tek
geçersiz satır bütün paketi 422 ile düşürür; SDK bu yüzden mesajı göndermeden
kırpar (2.9.0).

Gönderim ve Yönetim istemcilerine özgü: `WRONG_KEY_TYPE` (kurulumda, SDK),
`NO_CONSENT`, `SUPPRESSED`, `NO_SENDING_DOMAIN`, `SENDER_NOT_CONFIGURED`
(gönderici kanalına adres bağlanmamış), `MODULE_KEY_NOT_FOUND`,
`LIST_NOT_FOUND`, `EMBED_NOT_ALLOWED`, `MODULE_DISABLED`. SDK eşlemeleri
(sunucu kod döndürmediğinde): 401 → `API_KEY_INVALID`, 422 →
`VALIDATION_ERROR`, diğerleri `HTTP_<durum>`; ağ tarafı `NETWORK_ERROR`,
`TIMEOUT`.

Uygulama yüzeyi ve widget: `VISITOR_INVALID` (yerel kimlik silinir, yeni
oturum açılır), `CHAT_UNAVAILABLE` (kota - "sohbet kullanılamıyor" bandı),
`NOT_INITIALIZED`, `CAPTCHA_REQUIRED` / `CAPTCHA_INVALID` (403 - widget yeni
jetonla bir kez yeniden dener), `CONVERSATION_RATE_LIMITED` (429 - nazik bant).
