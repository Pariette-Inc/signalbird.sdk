# Geliştirme Kaydı — signalbird.sdk

> Her sürüm ve API değişikliğinden sonra güncellenir. En yeni bölüm en üstte.

## 2026-08-19 — Gönderim istemcisi + canlı sohbet widget'ı (v1.1.0)

Platform genişlemesi (`signalbird.api/docs/PLATFORM_EXPANSION_2026-08-19.md` §3).
Paket artık üç yüzey taşır; Telsiz istemcisine dokunulmadı.

| Yüzey | Giriş noktası | Kimlik | Uçlar |
|---|---|---|---|
| Gönderim — Node | `@signalbird/sdk` → `SignalbirdMessaging`, `verifyWebhook` | `Authorization: Bearer sb_…` | `POST /v1/email/send`, `/v1/sms/send`, `/v1/sms/preview`, `/v1/push/send`; `GET/POST /v1/contacts`, `PATCH/DELETE /v1/contacts/{id}`, `POST /v1/contacts/bulk`; `GET/POST /v1/contact-lists`, `DELETE /v1/contact-lists/{id}`; `GET/POST /v1/campaigns`, `GET /v1/campaigns/{id}`, `POST /v1/campaigns/{id}/cancel`, `GET /v1/campaigns/{id}/messages`; `GET /v1/messages`, `GET /v1/messages/{id}` |
| Gönderim — PHP | `Signalbird\Sdk\Messaging\MessagingClient`, `Messaging\Webhook::verify()`, Laravel `Signalbird::messaging()` (`SIGNALBIRD_MESSAGING_KEY`) | aynı | aynı |
| Widget | `dist/signalbird.js` (IIFE, global `Signalbird`) → `signalbird.web/public/sdk/v1/signalbird.js` | `X-Signalbird-App-Key: sbw_pub_…` + `X-Signalbird-Visitor: <sır>` | `POST /v1/sdk/bootstrap`, `POST /v1/sdk/chat/session`, `GET/POST /v1/sdk/chat/conversations`, `GET …/{id}?after=&limit=`, `POST …/{id}/messages`, `PATCH/DELETE …/{id}/messages/{mid}`, `POST …/{id}/messages/{mid}/reactions`, `POST …/{id}/typing`, `POST …/{id}/read`, `POST …/{id}/attachments`, `POST …/{id}/close`, `POST …/{id}/rate`; `POST /v1/sdk/devices`, `POST /v1/sdk/identify` |

**Kararlar ve gerekçeleri**

- **Ayrı sınıf, aynı paket.** Gönderim için `SignalbirdClient`'a metot eklemek
  yerine `SignalbirdMessaging` açıldı: farklı anahtar (`sb_` ↔ `sbr_`), farklı
  kota, farklı hata kümesi. Yanlış anahtar kurulum anında `WRONG_KEY_TYPE` ile
  reddedilir — sessizce 401 yiyip haftalar sonra fark edilmesin.
- **Tek zarf.** Her metot `{ok, status, data?, code?, message?}` döner (PHP dizi).
  Kod eşlemesi iki dilde aynı: sunucu kodu → 422 `VALIDATION_ERROR` → 401
  `API_KEY_INVALID` → `HTTP_<n>`; ağ `NETWORK_ERROR`, süre `TIMEOUT`.
- **`bulkContacts` 1000'lik parça, sıralı.** Paralel değil: aynı e-posta iki
  parçadaysa yarış olmasın. Hata olursa o noktada durur, biriken sayımlar döner.
- **Webhook doğrulama ham gövdede, sabit zamanlı.** Node `timingSafeEqual`, PHP
  `hash_equals`; yalnız `sha256=` öneki.
- **`SignalbirdException` genişledi, geriye uyumlu.** `getErrorCode()`,
  `getStatus()`, `getBody()`; `new SignalbirdException('mesaj')` aynen çalışır.
- **PHP testleri.** `tests/php` (PHPUnit 10) — `transport()` `protected`, sahte
  istemci cURL yerine kuyruklu yanıt döner. `vendor/bin/phpunit`.
- **Widget: çerçeve yok, Shadow DOM, IIFE.** Sayfa CSS'inden izole; sürükle-
  bırak/yapıştır ek, yanıtla, tepki, düzenle/sil (15 dk), ✓/✓✓, yazıyor, gün
  ayracı, ön-form, çalışma saati bandı, puanlama, mobil tam ekran, tr/en, ses,
  sekme başlığı. Polling merdiveni penyu deseni (kapalı 20→60→180 s, açık 3 s,
  gizli sekmede tur atlanır). İyimser gönderim `client_id` ile. Hiçbir genel çağrı
  ev sahibine istisna fırlatmaz. ~16 KB gzip (hedef < 40).
- **Widget npm'e girmez.** `tsup` ikinci config `dist/signalbird.js` üretir;
  `scripts/publish-web.mjs` `../signalbird.web/public/sdk/v1/` altına kopyalar
  (`npm run build` = `tsup && node scripts/publish-web.mjs`).
- **`check-parity.mjs`** artık iki küme doğrular: Telsiz (7 metot) ve Gönderim
  (20 metot) — Node/PHP adları birebir.

**Dokümanlar:** `docs/CONTRACT.md` §8–9, `README.md`, `signalbird.web/public/docs/{tr,en}/sdk-messaging.md` + `sdk-widget.md`, `/sdk/messaging` ve `/sdk/widget` rotaları.

**Yapılmayanlar:** iOS/Android widget'ı (aynı sözleşme), WebSocket taşıyıcısı
(API imleçli, istemci-yalnız iş).

## 2026-08-19 — Telsiz (Radio) için sıfırdan yazıldı (v1.0.0)

Eski paket `POST /api/sdk/log/{key}` ucuna yazıyordu; o uç gelen kaydı **hiçbir
yere yazmıyor**, yalnız anahtarı üreten kişiye bir bildirim atıyordu. Kanal,
kalıcı kayıt, ekip yönlendirmesi ve arama yoktu. Uç kaldırıldı, paket yeni
Telsiz modeline göre baştan yazıldı.

| Giriş noktası | Kimlik | Endpoint |
|---|---|---|
| `@signalbird/sdk` (Node 18+) | `Authorization: Bearer sbr_live_…` | `POST /api/v1/radio/log`, `POST /api/v1/radio/log/batch` |
| `@signalbird/sdk/browser` | `X-Signalbird-Key: sbr_pub_…` (+ `Origin`) | aynı uçlar; sekme kapanışında `?key=` sorgu parametresiyle `sendBeacon` |
| `signalbird/sdk` (PHP/Laravel) | `Authorization: Bearer sbr_live_…` | aynı uçlar |

**Kararlar ve gerekçeleri**

- **Bağımlılık sıfırlandı.** Node tarafında `axios` çıkarıldı (Node 18+ `fetch`),
  PHP tarafında `guzzle` çıkarıldı (`ext-curl`). Bir log kütüphanesinin
  müşterinin projesine HTTP istemcisi sürümü dayatması, sürüm çakışmalarının en
  sık sebebidir.
- **Tarayıcı ayrı giriş noktası.** Teknik değil güvenlik gerekçesi: gizli anahtar
  istemciye inemez, sunucu `Origin` taşıyan gizli anahtarlı isteği reddeder.
- **`sendBeacon` için sorgu parametresi.** Beacon özel başlık taşıyamaz; sayfa
  kapanırken kuyruğu boşaltmanın başka yolu yok. Sunucu sorgu dizesinde YALNIZ
  açık anahtar kabul eder (`SECRET_KEY_IN_QUERY` aksi hâlde) — gizli anahtar
  erişim günlüklerine düşmesin.
- **Sessiz hata varsayılan.** `throwOnError: false`. Telsiz erişilemezse
  müşterinin ödeme akışı çökmemeli.
- **Monolog handler.** `Log::channel('signalbird')` ile mevcut `Log::error()`
  satırları tek satır kod yazmadan Telsiz'e düşer.

**Yapılmayanlar:** Go, .NET, Swift, Kotlin paketleri. Aynı repoya gelecek.
