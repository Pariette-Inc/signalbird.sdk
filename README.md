# Signalbird SDK

**Tek paket, dört yüzey, on iki giriş noktası.** Panelde tıklayarak yapabildiğiniz her şey
kodla da yapılabilir.

| Yüzey | Ne yapar | Anahtar | Nerede |
|---|---|---|---|
| **Telsiz** (Radio) | projenizden bir **kanala** log/olay yazar | `sb_secret_live_…` / `sb_public_live_…` | sunucu / tarayıcı |
| **Gönderim** (Messaging) | e-posta, SMS, push gönderir; kişi, liste, kampanya yönetir; mesaj durumu okur; webhook imzası doğrular | `sb_…` | yalnız sunucu |
| **Yönetim** (Management) | Telsiz projesi/kanalı açar, olay akışını okur, **sohbet gelen kutusunu** işler, uygulama ve cihaz yönetir | `sb_…` + scope | yalnız sunucu |
| **Uygulama** (App) | müşterinizin **son kullanıcısına** canlı sohbet + push cihaz kaydı | `sb_public_live_…` | web, iOS, Android |
| **Partner** | Signalbird'ü kendi ürününde satan **sözleşmeli platform** müşterisini sağlar ve yetkilendirir | `sb_secret_live_…` | yalnız sunucu |

Bir seçenek daha var ve kod yazmaz: hazır sohbet widget'ı
(`signalbird.js`), siteye tek `<script>` ile gömülür.

### Dil matrisi

| Dil / platform | Telsiz | Gönderim | Yönetim | Uygulama | Kurulum |
|---|:--:|:--:|:--:|:--:|---|
| Node.js / TypeScript | ✓ | ✓ | ✓ | ✓ | `npm i signalbird` |
| Tarayıcı (düz JS) | ✓ | — | — | ✓ | `signalbird/browser` · `/app` |
| React / Next.js | ✓ | ✓ | ✓ | ✓ | `signalbird/react` |
| Vue 3 | ✓ | — | — | ✓ | `signalbird/vue` |
| Angular | ✓ | — | — | ✓ | `signalbird/angular` |
| React Native / Expo | ✓ | — | — | ✓ | `signalbird/react-native` |
| PHP / Laravel | ✓ | ✓ | ✓ | — | `composer require pariette/signalbird` |
| Python | ✓ | ✓ | ✓ | — | `pip install signalbird` |
| Go | ✓ | ✓ | ✓ | — | `go get github.com/Pariette-Inc/signalbird.sdk` |
| .NET / ASP.NET Core | ✓ | ✓ | ✓ | — | `dotnet add package Signalbird.Sdk` |
| Swift (iOS) | ✓ | — | — | ✓ | SPM: `Signalbird` |
| Kotlin (Android) | ✓ | — | — | ✓ | `io.signalbird:signalbird-sdk` |

Metot adları diller arasında **birebir** aynıdır; her dil kendi yazım
geleneğini korur (`createRadioProject` / `create_radio_project` /
`CreateRadioProject`). `node scripts/check-parity.mjs` bunu her derlemede
denetler.

Uygulama yüzeyi mobil ve tarayıcı içindir: gizli anahtar oraya gömülmez.
Gönderim ve Yönetim yüzeyleri yalnız sunucudadır.

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

## Tek anahtar

`.env` dosyanıza **bir satır** yazarsınız:

```
SIGNALBIRD_DOMAIN_KEY=sb_secret_live_…
```

Takım anahtarı (`sb_…`) her şeyi kapsar: e-posta, SMS, push, kişi ve kampanya,
sohbet, uygulama, domain, Telsiz log yazımı. Ne yapabileceğini anahtarın
kapsamları belirler; panelde üretilirken seçersiniz. **Adres yazmanız
gerekmez** — üretim kökü paketin içindedir.

Ayrı anahtar isteğe bağlıdır: bir sunucunun yalnız log yazıp gönderim
yapamamasını istiyorsanız o sunucuya dar kapsamlı ikinci bir anahtar verirsiniz.

Bir de **açık** anahtarlar vardır; onlar `.env`'e değil, sayfanın içine gömülür
ve gizli olmadıkları için ayrı durmak zorundadırlar:

| Anahtar | Nerede | Ne yapar |
|---|---|---|
| `sb_public_live_…` | `<script data-key data-channel>` | sohbet widget'ı, push cihaz kaydı |
| `sb_public_live_…` | tarayıcı log istemcisi | yalnız izinli alan adlarından |

Gizli anahtar tarayıcıya **gömülemez**: sunucu, `Origin` başlığı taşıyan bir
istekte gizli anahtarı reddeder (`SECRET_KEY_IN_BROWSER`). Bu bir kolaylık
değil, kasıtlı bir duvardır — anahtar bir kez istemciye indiğinde herkesindir.

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
| Kotlin (Android) | `implementation("io.signalbird:signalbird-sdk:2.4.1")` |
| Canlı sohbet widget'ı (herhangi bir site) | `<script async src="https://signalbird.io/sdk/v1/signalbird.js" data-key="sb_public_live_…" data-channel="destek"></script>` |

> Hepsi **bu repodan** çıkar ve **aynı sürümü** taşır — ayrı SDK reposu ya da
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
`signalbird` kullanılır. **İstemci bileşenlerinde kullanmayın** — anahtar
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
```

Kayıtlar tek tek değil, **toplu** gider (varsayılan 3 saniyede bir) ve sekme
kapanırken `sendBeacon` ile boşaltılır.

**React** — `app/providers.tsx` ya da `main.tsx`:

```tsx
useEffect(() => {
  const sb = initSignalbird({ publicKey: process.env.NEXT_PUBLIC_SIGNALBIRD_DOMAIN_KEY! })
  return sb.captureErrors()
}, [])
```

**Vue** — `main.ts`:

```ts
const sb = initSignalbird({ publicKey: import.meta.env.VITE_SIGNALBIRD_DOMAIN_KEY })
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
SIGNALBIRD_DOMAIN_KEY=sb_secret_live_…
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

Signalbird::configure('sb_secret_live_…');
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
import { SignalbirdMessaging } from 'signalbird'

const sb = new SignalbirdMessaging({ domainKey: process.env.SIGNALBIRD_DOMAIN_KEY! })

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

`.env`: `SIGNALBIRD_DOMAIN_KEY=sb_secret_live_…` (isteğe bağlı `SIGNALBIRD_MESSAGING_URL`,
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

Panelden `radio:*`, `chat:*`, `apps:*` scope'larıyla bir `sb_…` anahtarı açın.

```ts
import { management } from 'signalbird'

// Yeni ortam kurulumu: proje aç, kanalını tanımla, anahtarı sakla
const { data } = await management().createRadioProject({ name: 'ödeme-servisi' })

// `secret` YALNIZ burada döner — sunucuda yalnız özeti saklanır
await vault.write('SIGNALBIRD_DOMAIN_KEY', data!.secret)

await management().createRadioChannel(data!.project.id, {
  key: 'odeme',
  name: 'Ödeme',
  level: 'critical',
  notify_push: true,
  quiet_from: 0,
  quiet_to: 7,        // kritik seviye sessiz saatleri yine de deler
})
```

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

Anahtar `embed:issue` kapsamı ister — jeton 60 dakikalık bir panel oturumuna
çevrildiği için bu kapsam bilerek ayrıdır.

Aynısı PHP, Python, Go ve .NET'te birebir aynı metot adlarıyla:

```php
Signalbird::management()->createRadioProject(['name' => 'ödeme-servisi']);
```

```python
signalbird.SignalbirdManagement(api_key=key).create_radio_project({"name": "ödeme-servisi"})
```

```go
admin.CreateRadioProject(ctx, map[string]any{"name": "ödeme-servisi"})
```

```csharp
await management.CreateRadioProjectAsync(new { name = "ödeme-servisi" });
```

Tam liste (40 metot): `docs/CONTRACT.md § 10`.

## Partner — müşteri sağlama

Signalbird'ü kendi ürününüzün içinde satıyorsanız (sözleşmeli platform) bu yüzey
sizindir: müşteri hesabı açar, domain ekleyip izlemeye alır, uptime okur, ödeme
alındığında modül açar ve panel ekranını kendi sayfanıza gömersiniz.

```ts
import { SignalbirdPartner } from 'signalbird'

const partner = new SignalbirdPartner({ domainKey: process.env.SIGNALBIRD_DOMAIN_KEY! })

// Müşteri açıldı — idempotent: aynı external_id ikinci kez yeni hesap AÇMAZ
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

// Gönderilen her şeyin durumu — kendi panelinizde çizmek için (salt okur)
const log = await partner.listMessages('sc_9911', { channel: 'email', status: 'delivered' })
const one = await partner.getMessage('sc_9911', 'm_01J…')       // olay zaman çizelgesi
const sum = await partner.messageSummary('sc_9911', '7d')       // kanal bazlı özet

// "Bu siparişe ait iletiler" kısayolu
await partner.listMessages('sc_9911', { external_ref: 'order_9911' })
```

PHP'de `Signalbird::partner()->createCompany([...])`.

İki kural: **anahtar tarayıcıya inmez** ve **TXT'siz domain kampanya
gönderemez** (izleme, sohbet ve push açıktır). Ayrıntı: `docs/CONTRACT.md § 12`.

Mesaj uçları **salt okurdur**: alıcı maskeli döner, gövde hiç dönmez — gövde
zaten saklanmıyor.

## Gönderim — müşterinin kendi sisteminden

Bir platformun (SubmitCMS, veribenim…) müşterisiyseniz kendi sunucunuzdan da
gönderim yapabilirsiniz. Gereken tek şey **kendi takım anahtarınızdır**
(`sb_…`); panelinizdeki entegrasyon kartında durur.

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

## Uygulama (App) — kendi sohbet arayüzünüz

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
```

`data-key`/`data-channel` yerine `Signalbird.init({ publicKey, chatKey, baseUrl?, locale? })` da
çağrılabilir. Widget ev sahibi sayfaya asla hata fırlatmaz; Shadow DOM içinde
çalışır, sayfanızın CSS'iyle çakışmaz; < 20 KB gzip. Ayrıntı:
`docs/CONTRACT.md § 9` ve https://signalbird.io/sdk/widget.

## Gömme (embed) — Signalbird ekranını kendi panelinizde çalıştırın

Partner (veribenim, submitcms, yeni ortaklar) Signalbird modülünü kendi
panelinin içinde gösterir. Ekran kopyalanmaz — **çalışan ekranın kendisi**
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

| Kod | Anlamı |
|---|---|
| `INVALID_KEY` | Anahtar yok, yanlış ya da proje pasif |
| `SECRET_KEY_IN_BROWSER` | Gizli anahtar tarayıcıdan kullanıldı |
| `ORIGIN_NOT_ALLOWED` | Tarayıcı anahtarı bu alan adına açık değil |
| `CHANNEL_NOT_ALLOWED` | Tarayıcı anahtarı bu kanala yazamaz |
| `MODULE_DISABLED` | Paketinizde Telsiz (`logger`) modülü yok |
| `LIMIT_REACHED` | Aylık kayıt limitiniz doldu |
| `CHANNEL_DISABLED` | Kanal kapalı — kayıt yazılmaz, kota da harcanmaz |

Gönderim ve Yönetim istemcilerine özgü: `WRONG_KEY_TYPE` (kurulumda),
`API_KEY_INVALID`, `API_KEY_SCOPE` (anahtarda gereken scope yok),
`VALIDATION_ERROR` (422), `NO_CONSENT`, `SUPPRESSED`, `NO_SENDING_DOMAIN`,
`LIST_NOT_FOUND`, `MODULE_DISABLED`, `NETWORK_ERROR`, `TIMEOUT`, `HTTP_<durum>`.

Uygulama yüzeyi ve widget: `VISITOR_INVALID` (yerel kimlik silinir, yeni
oturum açılır), `CHAT_UNAVAILABLE` (kota — "sohbet kullanılamıyor" bandı),
`NOT_INITIALIZED`.
