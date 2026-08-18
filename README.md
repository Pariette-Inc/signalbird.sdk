# Signalbird SDK

**Telsiz** istemcisi. Tek işi vardır: projenizden bir **kanala** mesaj yazmak.

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
