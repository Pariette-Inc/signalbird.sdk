# Geliştirme Kaydı

> Her metot/davranış değişikliğinden sonra güncellenir. En yeni bölüm en üstte.
> Format: development-log skill'i (Claude) tarafından otomatik bakılır.

## 2026-08-10 — Çok dilli monorepo (ilk kayıt)

`sistemtakip.sdk` (Node) ve `sistemtakip.php.sdk` (PHP) tek repoda birleştirildi.
Amaç: tüm dillerin aynı sürümü, aynı metot adlarını ve aynı davranışı paylaşması.

### Servis yüzeyi

Tüm istemciler tek bir uç nokta tüketir:

| SDK metodu | API Endpoint | Gövde | Not |
|---|---|---|---|
| `info(title, message)` | `POST /api/sdk/log/{apiKey}` | `{title, message, level:"info"}` | — |
| `warn(title, message)` | `POST /api/sdk/log/{apiKey}` | `level:"warn"` | — |
| `error(title, message)` | `POST /api/sdk/log/{apiKey}` | `level:"error"` | push önceliği yükselir |
| `critical(title, message)` | `POST /api/sdk/log/{apiKey}` | `level:"critical"` | sesli + yüksek öncelikli push |
| `confirm(title, message)` | `POST /api/sdk/log/{apiKey}` | `level:"confirm"` | — |
| `debug(title, message)` | `POST /api/sdk/log/{apiKey}` | `level:"debug"` | — |
| `send(title, message, level)` | `POST /api/sdk/log/{apiKey}` | seviye çağırandan | sunucu geçersiz seviyeyi 422 ile reddeder |

Ucun sahibi `signalbird.api` → `ApiKeyController@log`. Auth yoktur; yetkiyi yol
parametresindeki anahtar taşır (`sb_` öneki).

### Paketler

| Dil | Paket | Registry | Sürüm kaynağı |
|---|---|---|---|
| Node.js / TypeScript | `@signalbird/sdk` | npm | `packages/node/package.json` |
| PHP / Laravel | `signalbird/sdk` | Packagist (ayna repo) | git etiketi `vX.Y.Z` |

### Bu turda yapılanlar

- `packages/node`: `sistemtakip.sdk`'dan geçirildi. Sınıflar `Signalbird`,
  `SignalbirdClient`, `SignalbirdError`, `SignalbirdConfig`. Prod URL
  `https://live.signalbird.io/api`.
- `packages/php`: `sistemtakip.php.sdk`'dan geçirildi. Namespace `Signalbird\Sdk`,
  Facade `Signalbird`, config `config/signalbird.php`, env `SIGNALBIRD_API_KEY` /
  `SIGNALBIRD_MODE` / `SIGNALBIRD_TIMEOUT`, publish tag `signalbird-config`.
  `composer.json`'dan `version` alanı kaldırıldı — Packagist sürümü etiketten okur.
- `docs/CONTRACT.md`: diller arası davranış sözleşmesi yazıldı. Yeni dil eklemenin
  tek referansı burasıdır.
- `VERSION` + `scripts/sync-version.mjs`: kilitli tek sürüm. Dosyaya sürüm yazan
  registry'leri günceller; etiketten okuyanlar için `--check-tag` doğrulaması var.
- `.github/workflows/ci.yml`: node build + typecheck, php lint + `composer validate
  --strict`, sürüm kilidi kontrolü.
- `.github/workflows/split-php.yml`: `packages/php` → `Pariette-Inc/signalbird.php.sdk`
  salt-okunur ayna. Packagist `composer.json`'ı repo kökünde istediği için gerekli.

### Bekleyen kurulum

1. `Pariette-Inc/signalbird.php.sdk` reposu **henüz yok** — açılmalı (boş, public).
2. Bu repoda `SPLIT_TOKEN` secret'ı tanımlanmalı (hedef repoya Contents read/write
   yetkili PAT).
3. npm'de `@signalbird` scope'u ve Packagist'te `signalbird/sdk` kaydı yapılmalı.
