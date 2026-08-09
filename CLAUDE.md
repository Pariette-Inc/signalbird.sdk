# CLAUDE.md - Signalbird SDK

> Bu dosya Claude Code ve AI asistanları için proje bağlam dosyasıdır.

## Proje Tanımı

Signalbird'ün resmi SDK'sı. **Tek paket, tüm diller** — bu repo aynı anda bir
npm paketi, bir Composer paketi ve (eklendikçe) bir Go modülü, Swift paketi,
NuGet ve Maven artefaktıdır. Hepsi aynı etiketten çıkar, aynı sürümü ve aynı
davranışı taşır. Ayrı SDK reposu, ayna repo veya alt modül YOKTUR.

Temel endpoint: `POST /sdk/log/{api_key}` — auth yok, yetkiyi anahtar taşır.

## Repo yapısı

Manifest dosyaları **kökte** durur — her paket yöneticisi kendi manifestini
kökte arar. Kaynaklar dile göre ayrılır, her manifest kendi dizinini gösterir.

```
signalbird.sdk/
├── package.json            # npm       → @signalbird/sdk  (giriş: src/node)
├── composer.json           # Packagist → signalbird/sdk   (psr-4: src/php)
├── VERSION                 # kilitli tek sürüm (tek doğruluk kaynağı)
├── docs/CONTRACT.md        # diller arası davranış sözleşmesi ← ÖNCE BUNU OKU
├── scripts/
│   ├── sync-version.mjs
│   └── check-parity.mjs    # her dil aynı yedi metodu sunuyor mu
├── src/
│   ├── node/               # TypeScript kaynak
│   └── php/                # PHP kaynak
├── config/                 # Laravel config (vendor:publish)
├── dist/                   # npm build çıktısı (tsup)
└── .github/workflows/ci.yml
```

Her manifest **diğer dillerin dosyalarını kendi paketinden dışlar**:
`package.json` → `files`, `composer.json` → `archive.exclude`. Yeni dil eklerken
bu dışlama listelerini güncellemeyi unutma, yoksa npm kullanıcısı PHP kaynağı
indirir.

## Değişmez Kurallar

1. **Sözleşme önce gelir.** Davranışsal her değişiklik önce
   `docs/CONTRACT.md`'ye yazılır, sonra TÜM dillere uygulanır. Bir dilde olup
   diğerinde olmayan metot bırakma.
2. **Sürüm kilitli.** Tek dilde değişiklik olsa bile hepsi birlikte yükselir.
   `VERSION`'ı düzenle → `node scripts/sync-version.mjs` → commit. CI ayrışmayı
   yakalar ve build'i kırar.
3. **URL'ler sabit.** `production` → `https://live.signalbird.io/api`,
   `test` → `http://localhost/api`. Kullanıcıya serbest `baseUrl` verdirme —
   yanlış hosta log göndermek sessiz veri kaybıdır.
4. **Tek repo, tek paket.** Yeni dil için ayrı repo AÇILMAZ; manifesti bu
   reponun köküne gelir, kaynağı `src/<dil>/` altına.

## Dokümantasyon Kuralı (ZORUNLU)

Her geliştirme (yeni metot, parametre değişikliği, davranış değişikliği) şu
dosyalarda da güncellenir:

1. `docs/CONTRACT.md` — sözleşme
2. `README.md` — kök, dil matrisi ve hızlı başlangıç
3. `signalbird.web/public/docs/{tr,en}/sdk.md` ve `sdk-node.md` / `sdk-php.md`

### Akış

```
docs/CONTRACT.md güncelle
  → tüm src/* dillerinde uygula
  → node scripts/check-parity.mjs (parite bozulmamış olmalı)
  → README güncelle
  → signalbird.web public/docs/ güncelle (tr + en)
  → VERSION artır + node scripts/sync-version.mjs
  → git commit, git tag vX.Y.Z, git push --tags
  → npm publish; Packagist etiketi kendi alır
```

## Yapılmaması Gerekenler

- Auth token / Sanctum token SDK'da OLMAYACAK (uç public'tir)
- Incoming Webhook veya API anahtarı CRUD işlemleri OLMAYACAK (panelden yapılır)
- apiKey dışında kimlik doğrulama OLMAYACAK
- İstemci içinde otomatik retry OLMAYACAK — kritik alarmı iki kez çaldırır
- Batch/kuyruk/arka plan thread'i OLMAYACAK

## Yeni dil ekleme

`docs/CONTRACT.md` → "Yeni dil eklerken" bölümündeki yedi adımı izle. Özet:
kaynak `src/<dil>/`, manifest repo köküne, diğer dilleri paketten dışla,
`scripts/check-parity.mjs`'e bir giriş ekle.

## İlişkili Projeler

- **signalbird.api** — `POST /sdk/log/{key}` ucunun sahibi → `../signalbird.api/CLAUDE.md`
- **signalbird.web** — SDK dokümanlarını yayınlar (`public/docs/`) → `../signalbird.web/CLAUDE.md`
