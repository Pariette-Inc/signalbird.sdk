# Signalbird SDK

**Tek paket, tüm diller.** Bu repo aynı anda bir npm paketi, bir Composer paketi
ve (eklendikçe) bir Go modülü, Swift paketi, NuGet ve Maven artefaktıdır. Hepsi
aynı etiketten çıkar, aynı sürümü ve aynı davranışı taşır.

Ayrı SDK reposu, ayna repo ya da dil başına sürüm yoktur.

## Kurulum

Her paket yöneticisi **aynı repoyu** gösterir:

| Dil | Kurulum |
|---|---|
| Node.js / TypeScript | `npm install @signalbird/sdk` |
| PHP / Laravel | `composer require signalbird/sdk` |

> Yol haritası: Go, .NET, Swift ve Android. Hepsi bu repoya eklenir —
> `go.mod`, `Package.swift`, `.csproj` ve `build.gradle.kts` aynı köke gelir.

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

Her dil altı kısayol metodu ve bir genel metot sunar:

| Metot | Seviye | Not |
|---|---|---|
| `info` | `info` | Bilgilendirme |
| `warn` | `warn` | Uyarı |
| `error` | `error` | Hata — push önceliği yükselir |
| `critical` | `critical` | Kritik alarm — sesli + yüksek öncelikli push |
| `confirm` | `confirm` | Onay / başarı |
| `debug` | `debug` | Geliştirme kaydı |
| `send` | serbest | Seviye parametre olarak verilir |

Davranış kuralları (uç nokta, hata biçimi, zaman aşımı, ortam URL'leri):
[`docs/CONTRACT.md`](docs/CONTRACT.md). Yeni dil eklerken uyulacak tek belge odur.

## Repo yapısı

Manifest dosyaları **kökte** durur — her paket yöneticisi kendi manifestini
kökte arar. Kaynaklar dile göre ayrılır; her manifest kendi dizinini gösterir.

```
signalbird.sdk/
├── package.json          # npm       → @signalbird/sdk      (giriş: src/node)
├── composer.json         # Packagist → signalbird/sdk       (psr-4: src/php)
├── VERSION               # kilitli tek sürüm
├── src/
│   ├── node/             # TypeScript kaynak
│   └── php/              # PHP kaynak
├── config/               # Laravel config (vendor:publish)
├── dist/                 # npm build çıktısı (tsup)
├── docs/CONTRACT.md
└── scripts/sync-version.mjs
```

Her manifest kendi paketine girmeyecek dosyaları dışlar: `package.json` →
`files: ["dist","README.md"]`, `composer.json` → `archive.exclude`. Yani npm
tarball'ında PHP kaynağı, Packagist zip'inde TypeScript kaynağı bulunmaz.

## Sürümleme

Sürüm **kilitlidir**: tek bir dilde değişiklik olsa bile paket bir bütün olarak
yükselir. `Signalbird SDK v1.2.0` her dilde aynı şeyi ifade eder.

```bash
# Kök VERSION dosyasını düzenle, sonra:
node scripts/sync-version.mjs   # dosyaya sürüm yazan manifestleri günceller
git commit -am "v0.2.0"
git tag v0.2.0 && git push --tags
```

npm sürümü `package.json`'dan okur; Packagist **git etiketinden** okur (bu yüzden
`composer.json`'da `version` alanı yoktur — Packagist bunu zaten önermez). İkisinin
ayrışmasını CI `--check-tag` ile yakalar.

## Yayınlama

```bash
npm run build && npm publish --access public   # npm
git push --tags                                 # Packagist etiketi kendi alır
```

Packagist bir kereliğine `Pariette-Inc/signalbird.sdk` adresine kaydedilir;
sonrasında her `v*` etiketini kendisi toplar.
