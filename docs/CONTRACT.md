# Signalbird SDK — Diller Arası Davranış Sözleşmesi

Bu belge, `src/` altındaki **her** dil istemcisinin uyması gereken kuralları
tanımlar. Yeni bir dil eklerken tek referans budur; bir kural burada yoksa o
kural yoktur.

## 1. Uç noktalar

```
POST {baseUrl}/v1/radio/log
POST {baseUrl}/v1/radio/log/batch
```

Gövde:

```json
{ "channel": "critical", "message": "…", "level": "critical", "context": {}, "source": "api-01" }
```

`level` ve `context` isteğe bağlıdır. `level` verilmezse **kanalın kendi
varsayılanı** geçerlidir — istemci burada bir varsayılan uydurmaz.

## 2. Kimlik

| Ortam | Başlık | Anahtar biçimi |
|---|---|---|
| Sunucu | `Authorization: Bearer <key>` | `sbr_live_…` |
| Tarayıcı | `X-Signalbird-Key: <key>` | `sbr_pub_…` |
| Tarayıcı (yalnız `sendBeacon`) | `?key=<key>` | `sbr_pub_…` |

**Gizli anahtar sorgu dizesine KONMAZ** ve sunucu bunu reddeder
(`SECRET_KEY_IN_QUERY`): sorgu dizeleri erişim günlüklerine düşer.

Sunucu istemcisi `sbr_pub_` ile başlayan anahtarı kabul etmez ve kurulum
anında hata verir. Sessizce çalışıp kanal kısıtına takılması, hatanın
haftalar sonra fark edilmesi demektir.

## 3. baseUrl

Varsayılan `https://signalbird.io/api`. Kullanıcının kendi kurulumu olabileceği
için serbest `baseUrl` **kabul edilir** (eski sözleşmede yasaktı; kendi
kurulumunu yapan müşteriyi dışarıda bırakıyordu).

## 4. Ortak yüzey

Her dil istemcisi şu metotları sunar:

| Metot | Anlamı |
|---|---|
| `log(channel, message, level?, context?)` | Temel çağrı |
| `debug` `info` `warn` `error` `critical` | Seviye kısayolları |
| `batch(events)` | En fazla 100 kayıt, satır satır sonuç |

Seviye kümesi tam olarak: `debug`, `info`, `warn`, `error`, `critical`.
Fazlası eklenmez — beş seviye kanal ayarını anlaşılır tutar.

## 5. Hata davranışı

Varsayılan **sessiz hata**: ağ ya da sunucu hatasında istisna fırlatılmaz,
`ok: false` + `code` döner. Log göndermek uygulamanın asıl işi değildir.

`throwOnError` açıksa istisna fırlatılır. Bu bayrak geliştirme içindir.

## 6. Zaman aşımı

Varsayılan 5 saniye. Bir log çağrısı, kullanıcının isteğini bekletmemeli.

## 7. Toplu gönderim

Kısmi başarı normaldir (kota tam ortada dolabilir). Yanıt tek bir durum değil,
indeks → sonuç eşlemesidir. İstemci başarısız satırları yeniden denemez:
yeniden deneme kararı çağıranındır, çünkü aynı logu iki kez yazmak da bir
maliyettir.
