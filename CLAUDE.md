# CLAUDE.md - Signalbird SDK

> Bu dosya Claude Code ve AI asistanları için proje bağlam dosyasıdır.

## Proje Tanımı

Signalbird'ün resmi SDK'sı. **Tek paket, tüm diller** — bu repo aynı anda bir
npm paketi, bir Composer paketi ve (eklendikçe) bir Go modülü, Swift paketi,
NuGet ve Maven artefaktıdır. Hepsi aynı etiketten çıkar, aynı sürümü ve aynı
davranışı taşır. Ayrı SDK reposu, ayna repo veya alt modül YOKTUR.

Paket **beş yüzey** taşır; her birinin anahtarı ve kapısı farklıdır:

| Yüzey | Anahtar | Uçlar | Kaynak |
|---|---|---|---|
| **Telsiz** (Radio) — log/olay | `sbr_live_…` (sunucu, `Authorization: Bearer`) / `sbr_pub_…` (tarayıcı, `X-Signalbird-Key`) | `POST /v1/radio/log`, `POST /v1/radio/log/batch` | `src/{node,browser,python,go,dotnet,swift,kotlin}` |
| **Gönderim** (Messaging) — e-posta/SMS/push, kişi, liste, kampanya, mesaj, webhook imzası | `sb_…` takım API anahtarı (yalnız sunucu) | `/v1/email/send`, `/v1/sms/*`, `/v1/push/send`, `/v1/contacts*`, `/v1/contact-lists*`, `/v1/campaigns*`, `/v1/messages*` | `src/{node,php,python,go,dotnet}` |
| **Yönetim** (Management) — Telsiz projesi/kanalı, olay akışı, sohbet gelen kutusu, uygulama ve cihaz | `sb_…` + `radio\|chat\|apps` scope'ları (yalnız sunucu) | `/v1/radio/{summary,events,projects…}`, `/v1/chat/*`, `/v1/apps*` | `src/node/management.ts`, `src/php/Management/`, `src/{python,go,dotnet}` |
| **Uygulama** (App) — son kullanıcıya canlı sohbet + push cihaz kaydı | `sbw_pub_…` uygulama anahtarı (`X-Signalbird-App-Key`) + ziyaretçi sırrı (`X-Signalbird-Visitor`) | `/v1/sdk/bootstrap`, `/v1/sdk/chat/*`, `/v1/sdk/devices`, `/v1/sdk/identify` | `src/app/`, `src/{react,vue,angular,react-native}`, `src/swift`, `src/kotlin`, `src/widget/` → `dist/signalbird.js` |
| **Partner** — sözleşmeli platformun müşteri sağlaması, modül yetkisi, gömme jetonu | `sbp_live_…` partner anahtarı (yalnız sunucu) | `/v1/partner/*` | `src/node/partner.ts`, `src/php/Partner/`, `src/{python,go,dotnet}` |

**Yönetim ADMIN yüzeyi DEĞİLDİR.** Anahtar tek bir takıma bağlıdır ve yalnız o
takımın kayıtlarına dokunur. Kullanıcı yönetimi, faturalama, abonelik ve plan
işlemleri SDK'ya GİRMEZ.

**Partner yüzeyi bu kuralın BİLİNÇLİ istisnasıdır** (CONTRACT §12.1) ve istisna
olduğu için ayrı anahtar türü taşır. Kural, müşterinin kendi anahtarıyla (`sb_`)
şirket açamaması içindi ve o kural aynen duruyor; sözleşmeli partner farklı bir
taraftır. Partner da süper yönetici değildir: yalnız KENDİ açtığı company'lere
erişir, başkasınınki 404 döner.

Ana kaynak sözleşme: `docs/CONTRACT.md` (§0 yüzey tablosu, §1–7 Telsiz,
§8 Gönderim, §9 Widget, §10 Yönetim, §11 Uygulama, §12 Partner) ve platform sözleşmesi
`../signalbird.api/docs/PLATFORM_EXPANSION_2026-08-19.md` §3.

## Repo yapısı

Manifest dosyaları **kökte** durur — her paket yöneticisi kendi manifestini
kökte arar. Kaynaklar dile göre ayrılır, her manifest kendi dizinini gösterir.

```
signalbird.sdk/
├── package.json            # npm       → signalbird       (src/node, browser, app, react, vue, angular, react-native)
├── composer.json           # Packagist → pariette/signalbird        (psr-4: src/php)
├── pyproject.toml          # PyPI      → signalbird            (src/python)
├── go.mod                  # Go        → …/signalbird.sdk      (src/go/signalbird)
├── Package.swift           # SPM       → Signalbird            (src/swift/Sources)
├── build.gradle.kts        # Maven     → io.signalbird:signalbird-sdk (src/kotlin)
├── Signalbird.Sdk.csproj   # NuGet     → Signalbird.Sdk        (src/dotnet)
├── VERSION                 # kilitli tek sürüm (tek doğruluk kaynağı)
├── docs/CONTRACT.md        # diller arası davranış sözleşmesi ← ÖNCE BUNU OKU
├── scripts/
│   ├── sync-version.mjs    # VERSION → package.json, pyproject, csproj, gradle, __init__.py
│   ├── check-parity.mjs    # 5 küme: Telsiz 7 · Gönderim 20 · Yönetim 45 · Uygulama 17 · Partner 20
│   └── publish-web.mjs     # dist/signalbird.js → ../signalbird.web/public/sdk/v1/
├── src/
│   ├── node/               # TS sunucu: client (Telsiz), messaging + webhook, management, http
│   ├── browser/            # Telsiz tarayıcı istemcisi (signalbird/browser)
│   ├── app/                # Son kullanıcı yüzeyi: client.ts + session.ts (ChatSession)
│   ├── react/ vue/ angular/ react-native/   # app'in üstüne oturan ince uyarlamalar
│   ├── widget/             # Hazır sohbet widget'ı (chat.ts, ui/, store, poller, i18n)
│   ├── php/                # SignalbirdClient · Messaging/ · Management/ · Partner/ · Mail/ · Laravel provider
│   ├── python/signalbird/  # client · messaging · management · partner · webhook · _http
│   ├── go/signalbird/      # radio · messaging · management · partner · webhook · http
│   ├── dotnet/Signalbird.Sdk/  # SignalbirdClient · MessagingClient · ManagementClient · PartnerClient · DI
│   ├── swift/Sources/Signalbird/   # SignalbirdApp (sohbet/push) · SignalbirdClient · Storage
│   └── kotlin/src/main/kotlin/io/signalbird/sdk/   # SignalbirdApp · SignalbirdClient · Storage
├── config/                 # Laravel config (vendor:publish)
├── tests/php/              # PHPUnit (vendor/bin/phpunit) — Messaging/ + Management/
├── dist/                   # tsup çıktısı: index, browser, app, react, vue, angular, react-native, signalbird.js
└── .github/workflows/ci.yml
```

Her manifest **diğer dillerin dosyalarını kendi paketinden dışlar**:
`package.json` → `files`, `composer.json` → `archive.exclude`. Yeni dil eklerken
bu dışlama listelerini güncellemeyi unutma, yoksa npm kullanıcısı PHP kaynağı
indirir. Widget (`dist/signalbird.js`) npm tarball'ında durur ama müşteri onu
CDN'den (`https://signalbird.io/sdk/v1/signalbird.js`) alır.

## Değişmez Kurallar

1. **Sözleşme önce gelir.** Davranışsal her değişiklik önce
   `docs/CONTRACT.md`'ye yazılır, sonra TÜM dillere uygulanır. Bir dilde olup
   diğerinde olmayan metot bırakma (`node scripts/check-parity.mjs`).
2. **Sürüm kilitli.** Tek dilde değişiklik olsa bile hepsi birlikte yükselir.
   `VERSION`'ı düzenle → `node scripts/sync-version.mjs` → commit. CI ayrışmayı
   yakalar ve build'i kırar.
3. **URL sabit, `baseUrl` serbest.** Varsayılan `https://signalbird.io/api`;
   kendi kurulumu olan müşteri için `baseUrl` kabul edilir. Widget'ta
   `data-base-url`.
4. **Tek repo, tek paket.** Yeni dil için ayrı repo AÇILMAZ; manifesti bu
   reponun köküne gelir, kaynağı `src/<dil>/` altına.
5. **Anahtar türü kurulumda denetlenir.** Gönderim istemcisi `sb_` dışını
   `WRONG_KEY_TYPE` ile reddeder; Telsiz sunucu istemcisi `sbr_pub_` kabul etmez.
6. **Widget ev sahibine hata fırlatmaz.** `src/widget/index.ts` içindeki her
   genel çağrı try/catch'lidir; bunu bozacak değişiklik yapma.

## Komutlar

```
npm run typecheck              # tsc
npm run build                  # tsup (7 giriş + signalbird.js) + publish-web
node scripts/check-parity.mjs  # 5 yüzey metot paritesi
vendor/bin/phpunit             # PHP testleri (composer install gerekir)
swift build                    # Swift paketi
python3 -c "import signalbird"  # src/python içinden
gzip -c dist/signalbird.js | wc -c   # widget boyutu (< 40 KB hedef)
```

Go, Kotlin ve .NET araç zincirleri bu makinede kurulu değil; CI'da derlenir.

## Dokümantasyon Kuralı (ZORUNLU)

Her geliştirme (yeni metot, parametre değişikliği, davranış değişikliği) şu
dosyalarda da güncellenir:

1. `docs/CONTRACT.md` — sözleşme
2. `README.md` — kök, dil matrisi ve hızlı başlangıç
3. `DEVELOPMENT.md` — tarihli kayıt (en yeni üstte)
4. `signalbird.web/public/docs/{tr,en}/` — `sdk-node.md`, `sdk-browser.md`,
   `sdk-php.md`, `sdk-messaging.md`, `sdk-widget.md`, `sdk-management.md`,
   `sdk-app.md`, `sdk-partner.md`, `sdk-python.md`, `sdk-go.md`, `sdk-dotnet.md`,
   `sdk-swift.md`, `sdk-kotlin.md`
5. `signalbird.web/src/app/[locale]/(marketing)/sdk/page.tsx` — yüzey × dil
   seçicili ana sayfa; oradaki her kod örneği pakette GERÇEKTEN olmalı

### Akış

```
docs/CONTRACT.md güncelle
  → tüm src/* dillerinde uygula
  → node scripts/check-parity.mjs (parite bozulmamış olmalı)
  → npm run typecheck && npm run build && vendor/bin/phpunit
  → README + DEVELOPMENT güncelle
  → signalbird.web public/docs/ güncelle (tr + en)
  → VERSION artır + node scripts/sync-version.mjs
  → git commit, git tag vX.Y.Z, git push --tags
  → npm publish; Packagist etiketi kendi alır; widget web deploy'la yayına çıkar
```

## Yapılmaması Gerekenler

- Auth token / Sanctum token SDK'da OLMAYACAK (uçlar anahtarla çalışır)
- Incoming Webhook veya API anahtarı CRUD işlemleri OLMAYACAK (panelden yapılır)
- **Admin yüzeyi OLMAYACAK**: kullanıcı yönetimi, faturalama, abonelik, plan,
  şirket/takım CRUD. Yönetim yüzeyi müşterinin KENDİ projesi içindir.
  **Tek istisna Partner yüzeyidir** ve ayrı anahtar türü taşır (CONTRACT §12.1)
- Mobil dillerde (Swift, Kotlin) Gönderim ya da Yönetim istemcisi OLMAYACAK —
  `sb_` anahtarı telefona gömülmez
- Anahtar dışında kimlik doğrulama OLMAYACAK (widget'ta ziyaretçi sırrı da bir anahtardır)
- İstemci içinde otomatik retry OLMAYACAK — kritik alarmı iki kez çaldırır,
  iletiyi iki kez gönderir
- Batch/kuyruk/arka plan thread'i OLMAYACAK (widget'ın polling'i hariç — o
  sunucuya değil ziyaretçiye hizmet eder)
- Widget'a çerçeve/bağımlılık EKLENMEYECEK — düz DOM, Shadow DOM, tek IIFE

## Yeni dil ekleme

1. Kaynak `src/<dil>/` altına; `docs/CONTRACT.md`'deki her kural (Telsiz §1–7,
   Gönderim §8) o dilde birebir uygulanır.
2. Manifest repo köküne; diğer dillerin dosyalarını paketten dışla.
3. `scripts/check-parity.mjs` → `SURFACES` içindeki her kümeye bir dil girişi
   (dosya + metot adı regex'i).
4. `scripts/sync-version.mjs` → manifest sürüm alanı taşıyorsa `TARGETS`'a ekle.
5. CI'ya (`.github/workflows/ci.yml`) build/lint adımı.
6. README dil matrisi + `signalbird.web/public/docs/{tr,en}/sdk-<dil>.md`.

## İlişkili Projeler

- **signalbird.api** — `/v1/radio/*`, `/v1/email|sms|push|contacts|campaigns|messages`, `/v1/sdk/*` uçlarının sahibi → `../signalbird.api/CLAUDE.md`
- **signalbird.web** — SDK dokümanlarını (`public/docs/`) ve widget'ı (`public/sdk/v1/signalbird.js`) yayınlar → `../signalbird.web/CLAUDE.md`
- **veribenim.api** — Gönderim istemcisinin (PHP) ilk büyük kullanıcısı
