# Signalbird SDK

Tek kaynak, çok dil. Signalbird'e proje içinden log ve bildirim göndermek için
resmi istemciler bu repoda yaşar — hepsi **aynı sürümü**, **aynı metot adlarını**
ve **aynı davranışı** paylaşır.

## Kurulum

| Dil | Paket | Kurulum | Kaynak |
|---|---|---|---|
| Node.js / TypeScript | `@signalbird/sdk` (npm) | `npm install @signalbird/sdk` | [`packages/node`](packages/node) |
| PHP / Laravel | `signalbird/sdk` (Packagist) | `composer require signalbird/sdk` | [`packages/php`](packages/php) |

> Yol haritası: Go, .NET, Swift ve Android istemcileri aynı sözleşmeyle
> [`docs/CONTRACT.md`](docs/CONTRACT.md) üzerinden eklenecek.

## Hızlı başlangıç

**Node.js**

```typescript
import { Signalbird } from '@signalbird/sdk'

const sb = new Signalbird({ apiKey: process.env.SIGNALBIRD_API_KEY! })

await sb.error({ title: 'Veritabanı Hatası', message: 'Bağlantı koptu' })
```

**PHP / Laravel**

```php
use Signalbird\Sdk\Facades\Signalbird;

Signalbird::error('Veritabanı Hatası', 'Bağlantı koptu');
```

API anahtarını Signalbird panelinde **SDK Anahtarları** bölümünden üretirsiniz
(`sb_` ile başlar).

## Ortak sözleşme

Her dilin istemcisi altı kısayol metodu ve bir genel metot sunar:

| Metot | Seviye | Not |
|---|---|---|
| `info` | `info` | Bilgilendirme |
| `warn` | `warn` | Uyarı |
| `error` | `error` | Hata — push önceliği yükselir |
| `critical` | `critical` | Kritik alarm — sesli + yüksek öncelikli push |
| `confirm` | `confirm` | Onay / başarı |
| `debug` | `debug` | Geliştirme kaydı |
| `send` | serbest | Seviye parametre olarak verilir |

Ayrıntılı davranış kuralları (uç nokta, hata biçimi, zaman aşımı, ortam URL'leri)
için: [`docs/CONTRACT.md`](docs/CONTRACT.md). Yeni bir dil eklerken uyulması
gereken tek belge odur.

## Repo yapısı

```
signalbird.sdk/
├── VERSION                 # kilitli tek sürüm — tüm paketler bunu taşır
├── docs/CONTRACT.md        # diller arası davranış sözleşmesi
├── scripts/sync-version.mjs
├── packages/
│   ├── node/               # @signalbird/sdk       → npm
│   └── php/                # signalbird/sdk        → Packagist (ayna repo üzerinden)
└── .github/workflows/
    ├── ci.yml
    └── split-php.yml       # packages/php → Pariette-Inc/signalbird.php.sdk
```

## Sürümleme

Sürüm **kilitlidir**: tek bir dilde değişiklik olsa bile tüm paketler birlikte
yükselir. `Signalbird SDK v1.2.0` her dilde aynı şeyi ifade eder.

```bash
# Kök VERSION dosyasını düzenle, sonra:
node scripts/sync-version.mjs      # dosyaya sürüm yazan paketleri günceller
git commit -am "v0.2.0"
git tag v0.2.0 && git push --tags  # split workflow'u tetikler
```

Her registry sürümü aynı yerden okumaz: npm `package.json`'dan, Packagist ise
**git etiketinden** okur (bu yüzden `composer.json`'da `version` alanı yoktur —
Packagist bunu zaten önermez). İkisinin ayrışmaması CI'da `--check-tag` ile
doğrulanır.

## Yayınlama

**npm** — `packages/node` içinden:

```bash
npm run build && npm publish --access public
```

**Packagist** — `packages/php` doğrudan yayınlanamaz; Packagist `composer.json`'ı
repo kökünde ister. `split-php.yml` workflow'u her sürüm etiketinde
`packages/php`'yi `Pariette-Inc/signalbird.php.sdk` ayna reposuna salt-okunur
olarak kopyalar ve etiketi taşır. Packagist o repoyu izler.

> Ayna repo **elle düzenlenmez** — kaynağı burasıdır.
