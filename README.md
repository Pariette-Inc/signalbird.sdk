# Signalbird SDK

Tek paket, üç yüzey:

| Yüzey | Ne yapar | Anahtar | Nerede |
|---|---|---|---|
| **Telsiz** (Radio) | projenizden bir **kanala** log/olay yazar | `sbr_live_…` / `sbr_pub_…` | sunucu / tarayıcı |
| **Gönderim** (Messaging) | e-posta, SMS, push gönderir; kişi, liste, kampanya yönetir; mesaj durumu okur; webhook imzası doğrular | `sb_…` | yalnız sunucu |
| **Widget** (`signalbird.js`) | müşterinin sitesine canlı sohbet balonu + push cihaz kaydı | `sbw_pub_…` | tarayıcı, tek `<script>` |

## Telsiz

Telsiz'in tek işi vardır: projenizden bir **kanala** mesaj yazmak.

Bildirimin kime gideceği, hangi kanaldan (push/e-posta), sessiz saatlerde ne
olacağı ve aynı mesajın kaç kez uyarı üreteceği **sunucuda, kanal ayarlarında**
durur. Kod tarafında bunlar yoktur ve olmamalıdır: bildirim kuralını
değiştirmek için uygulamanızı yeniden yayınlamanız gerekmesin.

```
proje  →  penyu.io        (anahtarın sahibi)
kanal  →  critical, info, deploy…   (bildirim kuralı burada)
olay   →  tek bir kayıt
```

## İki anahtar, iki paket

| | Sunucu | Tarayıcı |
|---|---|---|
| Anahtar | `sbr_live_…` **gizli** | `sbr_pub_…` **açık** |
| Giriş noktası | `@signalbird/sdk` · `signalbird/sdk` | `@signalbird/sdk/browser` |
| Yazabildiği kanal | hepsi | yalnız izin verilenler |
| Kısıt | — | yalnız izinli alan adlarından |

Gizli anahtar tarayıcıya **gömülemez**: sunucu, `Origin` başlığı taşıyan bir
istekte gizli anahtarı reddeder (`SECRET_KEY_IN_BROWSER`). Bu bir kolaylık
değil, kasıtlı bir duvardır — anahtar bir kez istemciye indiğinde herkesindir.

## Kurulum

| Dil / çatı | Kurulum |
|---|---|
| Node.js, Next.js (sunucu), Express, NestJS, Fastify | `npm install @signalbird/sdk` |
| React, Vue, Angular, Svelte, düz JS (tarayıcı) | `npm install @signalbird/sdk` → `@signalbird/sdk/browser` |
| PHP, Laravel | `composer require signalbird/sdk` |
| Canlı sohbet widget'ı (herhangi bir site) | `<script async src="https://signalbird.io/sdk/v1/signalbird.js" data-app-key="sbw_pub_…"></script>` |

> Yol haritası: Go, .NET, Swift, Kotlin. Hepsi bu repoya gelir — ayrı SDK
> reposu ya da dil başına sürüm yoktur.

## Node.js / TypeScript

```ts
import { signalbird } from '@signalbird/sdk'

// SIGNALBIRD_KEY ortam değişkeninden okunur
await signalbird().critical('critical', 'ödeme servisi yanıt vermiyor', {
  service: 'iyzico',
  attempt: 3,
})

await signalbird().info('info', 'ahmet@x.com yeni hesap oluşturdu')
```

Kendi istemcinizi kurmak isterseniz:

```ts
import { SignalbirdClient } from '@signalbird/sdk'

const sb = new SignalbirdClient({
  apiKey: process.env.SIGNALBIRD_KEY!,
  source: 'api-01',        // hangi sunucudan geldiği
  throwOnError: false,     // üretimde kapalı kalmalı
})

await sb.log({ channel: 'deploy', message: 'v2.4.0 yayında', level: 'info' })
```

**Yakalanmamış hatalar:**

```ts
signalbird().captureUncaught('critical')
```

**Toplu gönderim** (kısmi başarı normaldir, satır satır sonuç döner):

```ts
const result = await signalbird().batch([
  { channel: 'info', message: 'iş 1 bitti' },
  { channel: 'info', message: 'iş 2 bitti' },
])
```

### Next.js

Sunucu tarafında (route handler, server action, `app/api/**`) doğrudan
`@signalbird/sdk` kullanılır. **İstemci bileşenlerinde kullanmayın** — anahtar
paketle birlikte tarayıcıya iner.

```ts
// app/api/webhook/route.ts
import { signalbird } from '@signalbird/sdk'

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
import { initSignalbird } from '@signalbird/sdk/browser'

const sb = initSignalbird({
  publicKey: 'sbr_pub_…',
  source: 'web',
})

sb.captureErrors('browser')   // window.onerror + unhandledrejection
sb.error('browser', 'sepet güncellenemedi', { cartId })
```

Kayıtlar tek tek değil, **toplu** gider (varsayılan 3 saniyede bir) ve sekme
kapanırken `sendBeacon` ile boşaltılır.

**React** — `app/providers.tsx` ya da `main.tsx`:

```tsx
useEffect(() => {
  const sb = initSignalbird({ publicKey: process.env.NEXT_PUBLIC_SIGNALBIRD_KEY! })
  return sb.captureErrors()
}, [])
```

**Vue** — `main.ts`:

```ts
const sb = initSignalbird({ publicKey: import.meta.env.VITE_SIGNALBIRD_KEY })
app.config.errorHandler = (err) => sb.error('browser', String(err))
```

**Angular** — `ErrorHandler` sağlayıcısı:

```ts
@Injectable()
export class SignalbirdErrorHandler implements ErrorHandler {
  private sb = initSignalbird({ publicKey: environment.signalbirdKey })
  handleError(error: unknown) { this.sb.error('browser', String(error)) }
}
```

Panelde bu projenin **izinli kökenlerini** ve **izinli kanallarını** açmayı
unutmayın; ikisi de boşken tarayıcı anahtarı hiçbir şey yapamaz. Kritik
kanalları tarayıcıya açmayın: istemci kodu herkesin elindedir.

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
SIGNALBIRD_KEY=sbr_live_…
SIGNALBIRD_SOURCE=api-01
```

**Laravel'in kendi loglarını Telsiz'e bağlamak** — `config/logging.php`:

```php
'signalbird' => [
    'driver'  => 'monolog',
    'handler' => \Signalbird\Sdk\SignalbirdLogHandler::class,
    'with'    => ['channel' => 'laravel'],
    'level'   => 'error',
],
```

Sonra `LOG_STACK=single,signalbird`. Mevcut `Log::error()` satırlarınız olduğu
gibi çalışır; tek satır kod yazmadan Telsiz'e düşerler.

Laravel dışı PHP:

```php
use Signalbird\Sdk\Signalbird;

Signalbird::configure('sbr_live_…');
Signalbird::error('api', 'veritabanı bağlantısı koptu');
```

## Davranış kuralları

- **Sessiz hata varsayılandır.** Telsiz erişilemezse çağrı `ok: false` döner ve
  uygulamanız çalışmaya devam eder. Log göndermek, ödeme akışını çökertmek için
  geçerli bir sebep değildir. Geliştirme sırasında `throwOnError: true`.
- **Tanımsız kanal düşürülmez.** İlk `log('odeme-hatasi', …)` çağrısında kanal
  kendiliğinden açılır ve panelde "otomatik açıldı" işaretiyle görünür. Yeni
  kanal **sessizdir** — kuralı ekip koyar.
- **Seviye kanalın varsayılanını ezer.** `level` göndermezseniz kanalın kendi
  seviyesi geçerlidir.
- **Kritik seviye sessiz saatleri deler.** Gece üçte ölen servis sabahı bekleyemez.
- **Tekrar bastırma kaydı değil bildirimi susturur.** Aynı mesaj kanalın
  `dedupe` süresi içinde tekrar gelirse ikinci bildirim gitmez ama kayıt tutulur.

## Gönderim (Messaging)

Takım API anahtarı (`sb_…`, panelde **Konsol → API anahtarları**, scope'lu)
ile çalışır. Telsiz anahtarı burada geçmez — istemci kurulurken
`WRONG_KEY_TYPE` ile reddeder. Yalnız sunucuda kullanılır.

Node:

```ts
import { SignalbirdMessaging } from '@signalbird/sdk'

const sb = new SignalbirdMessaging({ apiKey: process.env.SIGNALBIRD_MESSAGING_KEY! })

const r = await sb.sendEmail({
  to: 'ali@example.com',
  class: 'transactional',       // zorunlu: transactional | commercial
  subject: 'Siparişiniz yola çıktı',
  body: '<p>Merhaba {{first_name}}…</p>',
})
if (!r.ok) console.error(r.code, r.message)   // ok:false → code + message

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

`.env`: `SIGNALBIRD_MESSAGING_KEY=sb_…` (isteğe bağlı `SIGNALBIRD_MESSAGING_URL`,
`SIGNALBIRD_MESSAGING_TIMEOUT`). Laravel dışı PHP:
`Signalbird::configureMessaging('sb_…')` ya da `new MessagingClient('sb_…')`.

Metot kümesi iki dilde aynıdır: `sendEmail` `sendSms` `previewSms` `sendPush` ·
`listContacts` `createContact` `updateContact` `deleteContact` `bulkContacts` ·
`listContactLists` `createContactList` `deleteContactList` · `listCampaigns`
`createCampaign` `getCampaign` `cancelCampaign` `listCampaignMessages`
`iterateCampaignMessages` · `listMessages` `getMessage`. Hepsi
`{ok, status, data?, code?, message?}` döner; `throwOnError: true` ile istisna
(`SignalbirdError` / `SignalbirdException`, `code` + `status` + `body` taşır).

**Webhook imzası** (`message.*`, `campaign.*` olayları):

```ts
import { verifyWebhook } from '@signalbird/sdk'
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

## Widget (canlı sohbet)

Panelde **Gelen Kutusu → Ayarlar → Uygulamalar**'dan bir uygulama açın; verilen
`sbw_pub_…` anahtarını sitenize gömün:

```html
<script async src="https://signalbird.io/sdk/v1/signalbird.js" data-app-key="sbw_pub_…"></script>
```

Bu kadar. Sohbet modülü açıksa balon görünür; renk, konum, karşılama, ön-form,
çalışma saatleri panelden yönetilir. Programatik kullanım:

```js
Signalbird.identify({ external_id: 'user-1042', email: 'ali@example.com', name: 'Ali Veli' })
Signalbird.chat.open()                       // close() · toggle() · isOpen()
Signalbird.chat.on('unread', (n) => badge.textContent = n)
Signalbird.push.register({ token, platform: 'web', provider: 'fcm' })
Signalbird.destroy()
```

`data-app-key` yerine `Signalbird.init({ appKey, baseUrl?, locale? })` da
çağrılabilir. Widget ev sahibi sayfaya asla hata fırlatmaz; Shadow DOM içinde
çalışır, sayfanızın CSS'iyle çakışmaz; < 20 KB gzip. Ayrıntı:
`docs/CONTRACT.md § 9` ve https://signalbird.io/sdk/widget.

## Hata kodları

| Kod | Anlamı |
|---|---|
| `INVALID_KEY` | Anahtar yok, yanlış ya da proje pasif |
| `SECRET_KEY_IN_BROWSER` | Gizli anahtar tarayıcıdan kullanıldı |
| `ORIGIN_NOT_ALLOWED` | Tarayıcı anahtarı bu alan adına açık değil |
| `CHANNEL_NOT_ALLOWED` | Tarayıcı anahtarı bu kanala yazamaz |
| `MODULE_DISABLED` | Paketinizde Telsiz (`logger`) modülü yok |
| `LIMIT_REACHED` | Aylık kayıt limitiniz doldu |
| `CHANNEL_DISABLED` | Kanal kapalı — kayıt yazılmaz, kota da harcanmaz |

Gönderim istemcisine özgü: `WRONG_KEY_TYPE` (kurulumda), `API_KEY_INVALID`,
`API_KEY_SCOPE`, `VALIDATION_ERROR` (422), `NO_CONSENT`, `SUPPRESSED`,
`NO_SENDING_DOMAIN`, `LIST_NOT_FOUND`, `NETWORK_ERROR`, `TIMEOUT`, `HTTP_<durum>`.
Widget: `VISITOR_INVALID` (yerel kimlik silinir, yeni oturum), `CHAT_UNAVAILABLE`
(kota — "sohbet kullanılamıyor" bandı).
