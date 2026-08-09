# Geliştirme Kaydı

> Her metot/davranış değişikliğinden sonra güncellenir. En yeni bölüm en üstte.
> Format: development-log skill'i (Claude) tarafından otomatik bakılır.

## 2026-08-10 — Tek paket, çok dil (ilk kayıt)

`sistemtakip.sdk` (Node) ve `sistemtakip.php.sdk` (PHP) **tek pakette** birleşti.
Bu repo aynı anda bir npm paketi ve bir Composer paketidir; ileride Go modülü,
Swift paketi, NuGet ve Maven artefaktı da aynı kökten çıkacak. Ayna repo yok.

### Servis yüzeyi

Tüm diller tek bir uç nokta tüketir:

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

### Paketleme

Manifestler **repo kökünde**; her paket yöneticisi manifestini kökte arar.
Kaynaklar `src/<dil>/` altında ayrılır.

| Dil | Kurulum | Manifest | Kaynak | Sürüm kaynağı |
|---|---|---|---|---|
| Node.js / TypeScript | `npm install @signalbird/sdk` | `package.json` | `src/node/` | `package.json` |
| PHP / Laravel | `composer require signalbird/sdk` | `composer.json` | `src/php/` | git etiketi `vX.Y.Z` |

Her manifest diğer dilleri kendi paketinden dışlar. Doğrulandı:
npm tarball'ı 8 dosya (`dist/` + `README.md` + `package.json`, PHP kaynağı yok),
Packagist arşivi 11 dosya (`src/php/` + `config/` + doküman, Node kaynağı yok).

### Bu turda yapılanlar

- **Yapı düzleştirildi.** Önceki turda kurulan `packages/*` + ayna repo düzeni
  geri alındı: manifestler köke, kaynaklar `src/<dil>/` altına taşındı.
  `split-php.yml` silindi — Packagist artık bu repoyu doğrudan izleyebiliyor.
- `src/node`: sınıflar `Signalbird`, `SignalbirdClient`, `SignalbirdError`,
  `SignalbirdConfig`. Prod URL `https://live.signalbird.io/api`.
- `src/php`: namespace `Signalbird\Sdk`, Facade `Signalbird`,
  `config/signalbird.php`, env `SIGNALBIRD_API_KEY` / `SIGNALBIRD_MODE` /
  `SIGNALBIRD_TIMEOUT`, publish tag `signalbird-config`.
  `composer.json`'dan `version` alanı kaldırıldı — Packagist sürümü etiketten okur.
- `docs/CONTRACT.md`: diller arası davranış sözleşmesi. Yeni dil eklemenin tek
  referansı; § 7 her registry'nin manifestini nereye koyacağını tablo hâlinde verir.
- `scripts/sync-version.mjs`: kilitli tek sürüm. Manifestinde `version` alanı
  olanları günceller; etiketten okuyanlar için `--check-tag` doğrulaması.
- `scripts/check-parity.mjs`: her dilin aynı yedi metodu sunduğunu denetler.
  Bir dile metot eklenip diğerine eklenmezse CI kırılır.
- `.github/workflows/ci.yml`: node build+typecheck+tarball sızıntı kontrolü,
  php lint + `composer validate --strict` + autoload çözümleme, sürüm kilidi,
  metot paritesi.

### Bekleyen kurulum

1. npm'de `@signalbird` scope'u açılmalı.
2. Packagist'te `signalbird/sdk` paketi **bu repo adresiyle** kaydedilmeli
   (`https://github.com/Pariette-Inc/signalbird.sdk`) — ayna repo gerekmiyor.
