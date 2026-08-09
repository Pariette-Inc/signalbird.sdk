# Signalbird SDK — Diller Arası Davranış Sözleşmesi

Bu belge, `packages/` altındaki **her** istemcinin uyması gereken kuralları tanımlar.
Yeni bir dil eklerken tek referans budur; bir kural burada yoksa o kural yoktur.

## 1. Uç nokta

Tek uç nokta kullanılır:

```
POST {baseUrl}/sdk/log/{apiKey}
Content-Type: application/json
Accept: application/json

{ "title": "...", "message": "...", "level": "info" }
```

- `apiKey` **yol parametresidir**, header'a konmaz.
- Auth header, token yenileme, oturum kavramı **yoktur**. Uç nokta public'tir ve
  yetkiyi anahtarın kendisi taşır.

## 2. Ortam URL'leri

| Mod | URL |
|---|---|
| `production` (varsayılan) | `https://live.signalbird.io/api` |
| `test` | `http://localhost/api` |

Bu değerler istemcide **sabittir**. Kullanıcının serbest `baseUrl` geçmesine izin
verilmez — yanlış hosta log göndermek sessiz veri kaybıdır.

## 3. Seviyeler

`info` · `warn` · `error` · `critical` · `confirm` · `debug`

Sunucu bu altısı dışında bir değeri 422 ile reddeder. İstemci kendi tarafında
doğrulama yapmaz; sunucunun hatasını olduğu gibi yüzeye çıkarır.

## 4. Genel arayüz

Her istemci şu yedi metodu sunar. İsimlendirme dilin idiomuna uyar
(`snake_case`, `camelCase`, `PascalCase`) ama **anlam ve sıra değişmez**:

| Metot | İmza (mantıksal) |
|---|---|
| `info(title, message)` | seviye `info` ile gönderir |
| `warn(title, message)` | seviye `warn` |
| `error(title, message)` | seviye `error` |
| `critical(title, message)` | seviye `critical` |
| `confirm(title, message)` | seviye `confirm` |
| `debug(title, message)` | seviye `debug` |
| `send(title, message, level)` | seviye çağıran tarafından verilir |

Yapılandırma üç alandır: `apiKey` (zorunlu), `mode` (varsayılan `production`),
`timeout` (varsayılan **10 saniye**).

## 5. Hata davranışı

- HTTP 2xx dışı her yanıt, dile özgü **tek bir istisna tipiyle** fırlatılır:
  `SignalbirdError` / `SignalbirdException` / `SignalbirdError` (Go'da `error` değeri).
- İstisna üç şey taşır: **mesaj** (sunucunun `message` alanı, yoksa taşıma katmanı
  hatası), **statusCode** (ağ hatasında `0`), **details** (çözümlenmiş gövde, varsa).
- İstemci **kendi kendine yeniden denemez**. Retry çağıranın kararıdır; sessiz
  tekrar, kritik alarmın iki kez çalmasına yol açar.

## 6. Yapılmayacaklar

- Incoming webhook / API anahtarı CRUD işlemleri SDK'da **yer almaz** — panelden yapılır.
- Anahtar dışında kimlik doğrulama **yoktur**.
- Toplu (batch) gönderim, kuyruk ve arka plan thread'i **yoktur**; çağrı senkron
  ya da dilin doğal async modelidir.
- Telemetri, kullanım ölçümü, otomatik hata yakalama **yoktur**.

## 7. Yeni dil eklerken

1. `packages/<dil>/` klasörünü aç.
2. Yukarıdaki yedi metodu ve üç yapılandırma alanını uygula.
3. Paket adını hizala: npm `@signalbird/sdk`, Packagist `signalbird/sdk`,
   NuGet `Signalbird.Sdk`, Maven `io.signalbird:sdk`, Go
   `github.com/Pariette-Inc/signalbird.sdk/go`, SPM `SignalbirdSDK`.
4. Sürüm: dosyada `version` alanı taşıyan bir registry ise (npm, NuGet, Maven)
   `scripts/sync-version.mjs` içindeki `TARGETS`'a ekle. Etiketten sürüm alan bir
   registry ise (Packagist, Go, SPM) hiçbir yere yazma — kilit `--check-tag` ile
   korunur.
5. Kök `README.md`'deki kurulum tablosuna bir satır ekle.
6. Registry kökü şart koşuyorsa (Packagist, SPM) `.github/workflows/` altına
   split workflow'u ekle.
