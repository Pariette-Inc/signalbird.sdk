# Geliştirme Kaydı — signalbird.sdk

> Her sürüm ve API değişikliğinden sonra güncellenir. En yeni bölüm en üstte.

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
