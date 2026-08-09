# CLAUDE.md - Signalbird SDK

> Bu dosya Claude Code ve AI asistanları için proje bağlam dosyasıdır.

## Proje Tanımı

Signalbird'ün **çok dilli** resmi SDK monoreposu. Geliştiricinin kendi
projesinden Signalbird'e log ve bildirim göndermesini sağlar. Her dilin
istemcisi aynı sürümü, aynı metot adlarını ve aynı davranışı paylaşır.

Temel endpoint: `POST /sdk/log/{api_key}` — auth yok, yetkiyi anahtar taşır.

## Repo yapısı

```
signalbird.sdk/
├── VERSION                 # kilitli tek sürüm (tek doğruluk kaynağı)
├── docs/CONTRACT.md        # diller arası davranış sözleşmesi ← ÖNCE BUNU OKU
├── scripts/sync-version.mjs
├── packages/
│   ├── node/               # @signalbird/sdk  → npm
│   └── php/                # signalbird/sdk   → Packagist (ayna repo üzerinden)
└── .github/workflows/
    ├── ci.yml              # node build+typecheck, php lint, sürüm kilidi
    └── split-php.yml       # packages/php → Pariette-Inc/signalbird.php.sdk
```

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
4. **Ayna repo elle düzenlenmez.** `signalbird.php.sdk` bu repodan üretilir.

## Dokümantasyon Kuralı (ZORUNLU)

Her geliştirme (yeni metot, parametre değişikliği, davranış değişikliği) şu
dosyalarda da güncellenir:

1. `docs/CONTRACT.md` — sözleşme
2. `README.md` — kök, dil matrisi ve hızlı başlangıç
3. `packages/<dil>/README.md` — o dilin resmi dokümanı
4. `signalbird.web/public/docs/{tr,en}/sdk.md` ve `sdk-node.md` / `sdk-php.md`

### Akış

```
docs/CONTRACT.md güncelle
  → tüm packages/* içinde uygula
  → README'leri güncelle
  → signalbird.web public/docs/ güncelle (tr + en)
  → VERSION artır + node scripts/sync-version.mjs
  → git commit, git tag vX.Y.Z, git push --tags
  → npm publish (packages/node), Packagist aynayı otomatik alır
```

## Yapılmaması Gerekenler

- Auth token / Sanctum token SDK'da OLMAYACAK (uç public'tir)
- Incoming Webhook veya API anahtarı CRUD işlemleri OLMAYACAK (panelden yapılır)
- apiKey dışında kimlik doğrulama OLMAYACAK
- İstemci içinde otomatik retry OLMAYACAK — kritik alarmı iki kez çaldırır
- Batch/kuyruk/arka plan thread'i OLMAYACAK

## Yeni dil ekleme

`docs/CONTRACT.md` → "Yeni dil eklerken" bölümündeki altı adımı izle.
Registry kökü şart koşan diller (Packagist, Swift Package Manager) için
`.github/workflows/` altına bir split workflow'u gerekir.

## İlişkili Projeler

- **signalbird.api** — `POST /sdk/log/{key}` ucunun sahibi → `../signalbird.api/CLAUDE.md`
- **signalbird.web** — SDK dokümanlarını yayınlar (`public/docs/`) → `../signalbird.web/CLAUDE.md`
