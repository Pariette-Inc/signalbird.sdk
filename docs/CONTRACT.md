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

---

## 8. Gönderim (Messaging) istemcisi

Telsiz'den ayrı ikinci bir yüzeydir: **takım API anahtarı** (`sb_…`) ile
e-posta / SMS / push gönderir, kişi ve liste yönetir, kampanya açar, mesaj
durumlarını okur. Farklı anahtar, farklı kapı, farklı kota — Telsiz
istemcisiyle karışmaz. Yalnız **sunucuda** çalışır; tarayıcı girişi yoktur.

| Dil | Sınıf |
|---|---|
| Node | `SignalbirdMessaging` (`@signalbird/sdk`) |
| PHP | `Signalbird\Sdk\Messaging\MessagingClient` — Laravel: `Signalbird::messaging()` |

### 8.1 Kurucu

| Alan | Varsayılan | Not |
|---|---|---|
| `apiKey` | — | `sb_` ile başlamalı. `sbr_` (Telsiz) ya da `sbw_pub_` (uygulama) verilirse **kurulum anında** `WRONG_KEY_TYPE`; boşsa `NO_KEY` |
| `baseUrl` | `https://signalbird.io/api` | sondaki `/` kırpılır |
| `timeout` | 15 s | toplu kişi yükleme uzun sürebilir |
| `throwOnError` | `false` | açıksa `SignalbirdError` / `SignalbirdException` |

Kimlik: `Authorization: Bearer <sb_…>` — her istekte.

### 8.2 Sonuç biçimi

Her metot aynı zarfı döner (PHP'de dizi):

```
{ ok: true,  status, data }
{ ok: false, status, code, message, data? }
```

Kod eşlemesi (dil bağımsız): sunucu `{code}` verdiyse o; 422 ve kodsuz →
`VALIDATION_ERROR`; 401 ve kodsuz → `API_KEY_INVALID`; diğer → `HTTP_<durum>`;
ağ hatası → `NETWORK_ERROR` (status 0); zaman aşımı → `TIMEOUT` (status 0).
`message` sunucunun `message` alanı, yoksa `HTTP <durum>`.

`throwOnError` açıkken istisna `code`, `status` ve ham `body` taşır
(Node: `SignalbirdError.code/status/body`; PHP: `getErrorCode()/getStatus()/getBody()`).

### 8.3 Metot kümesi

Adlar iki dilde de **birebir aynıdır** (camelCase); `check-parity.mjs` bunu
denetler. Alan adları API ile aynıdır (snake_case) — SDK yeniden adlandırmaz.

| Alan | Metot | HTTP |
|---|---|---|
| e-posta | `sendEmail({to, class, subject, body?, template_hash?, vars?, sending_domain_id?, contact_id?})` | `POST /v1/email/send` |
| SMS | `sendSms({to, class, body, brand_id?, contact_id?})` · `previewSms(body)` | `POST /v1/sms/send` · `POST /v1/sms/preview` |
| push | `sendPush({to, class, subject, body, vars?, contact_id?})` — `to`: token, `contact:<id>`, `external:<id>` | `POST /v1/push/send` |
| kişiler | `listContacts(q)` · `createContact(c)` · `updateContact(id, c)` · `deleteContact(id)` · `bulkContacts({contacts[], list_id?, consent_source?, consent_text?})` | `/v1/contacts…` |
| listeler | `listContactLists()` · `createContactList({name, description?})` · `deleteContactList(id)` | `/v1/contact-lists…` |
| kampanyalar | `listCampaigns(q)` · `createCampaign({name, channel, list_id, subject?, body, template_hash?, sending_domain_id?, brand_id?, scheduled_at?, metadata?, external_ref?})` · `getCampaign(id)` · `cancelCampaign(id)` · `listCampaignMessages(id, q)` · `iterateCampaignMessages(id, q)` (yardımcı, sayfa sayfa gezer) | `/v1/campaigns…` |
| mesajlar | `listMessages(q)` · `getMessage(id)` | `/v1/messages…` |

`class` (`transactional` | `commercial`) zorunludur ve **varsayılanı yoktur** —
hukuki kapı çağıranın elindedir.

### 8.4 Toplu kişi yükleme

`bulkContacts` girdiyi **1000'lik parçalara** böler ve SIRAYLA gönderir
(paralel değil — aynı e-posta iki parçada da varsa yarış olmasın). Sonuç tek
zarfta birleşir: `{imported, updated, skipped[]}`. Bir parça başarısız olursa
o noktada durulur; `ok:false` + o parçanın kodu döner, `data` o ana kadar
biriken sayımları taşır. Boş liste istek atmaz, sıfırlarla döner.

### 8.5 Sorgu dizesi

`null`/`undefined` alanlar atlanır; diziler `key[]=` biçiminde gider; boole
`true`/`false` metnine çevrilir. Yol parçaları URL-kodlanır.

### 8.6 Webhook doğrulama

Mesaj olay webhook'ları (`message.*`, `campaign.*`) `X-Signalbird-Signature:
sha256=<hex hmac-sha256(raw_body, secret)>` taşır. Her dil sabit zamanlı
karşılaştıran bir doğrulayıcı sunar:

| Dil | İmza |
|---|---|
| Node | `verifyWebhook(rawBody, signatureHeader, secret): boolean` |
| PHP | `Signalbird\Sdk\Messaging\Webhook::verify(string $rawBody, ?string $header, string $secret): bool` |

Kurallar: yalnız `sha256=` öneki kabul edilir; başlık ya da sır boşsa `false`;
doğrulama **ham gövde** üzerinde yapılır (JSON'u yeniden serileştirmek imzayı
bozar). Yeniden gönderimlere karşı `id` (`evt_…`) alanıyla tekilleştirme
çağıranındır.

### 8.7 Retry

Yoktur. Aynı iletiyi iki kez göndermek hiç göndermemekten pahalıdır;
yeniden deneme kararı çağıranındır (Telsiz ile aynı ilke).

## 9. Tarayıcı widget'ı (`signalbird.js`)

Üçüncü yüzey: müşterinin sitesine tek `<script>` ile gömülen canlı sohbet +
push kayıt istemcisi. npm paketine girmez; `https://signalbird.io/sdk/v1/signalbird.js`
adresinden servis edilir (`scripts/publish-web.mjs` çıktıyı
`signalbird.web/public/sdk/v1/` altına kopyalar). Şimdilik tek dil (TS → IIFE,
global `Signalbird`); iOS/Android SDK'ları geldiğinde aynı sözleşmeye uyar.

### 9.1 Kimlik

| Başlık | Değer |
|---|---|
| `X-Signalbird-App-Key` | `sbw_pub_…` (uygulama anahtarı; açık, origin kısıtlı) |
| `X-Signalbird-Visitor` | ziyaretçi sırrı — `POST /v1/sdk/chat/session` **yalnız oluşturma anında** döner |

Ziyaretçi `localStorage['sb_visitor']` içinde `{id, secret, appKey, name?, email?}`
olarak saklanır; `appKey` uyuşmazsa yok sayılır. Sunucu `VISITOR_INVALID`
(401) dönerse yerel kimlik silinir ve yeni oturum açılır.

### 9.2 Yükleme akışı

1. `POST /v1/sdk/bootstrap` → `app.chat_enabled` değilse **hiçbir şey çizilmez**.
2. Balon çizilir (Shadow DOM, sayfa CSS'inden izole; `app.chat.color`,
   `position`, `launcher_text`).
3. İlk açılışta ziyaretçi yoksa ve `prechat.name|email` açıksa ön-form; sonra
   `POST /v1/sdk/chat/session`.
4. Konuşma ilk mesajla açılır: `POST /v1/sdk/chat/conversations {body, client_id}`.
5. Polling: panel açıkken 3 s (`?after=<son mesaj id>`; her 5. tur tam liste),
   kapalıyken 20 s ×3 → 60 s ×2 → 180 s; yeni veri merdiveni sıfırlar;
   sekme gizliyken tur atlanır, `visibilitychange`/`online` sıfırlar.

### 9.3 Genel API

```
Signalbird.init({ appKey, baseUrl?, locale?, user?, debug? })
Signalbird.identify({ external_id?, email?, name?, phone?, attributes? })
Signalbird.chat.open() | close() | toggle() | isOpen()
Signalbird.chat.on('unread' | 'open' | 'close', fn) | off(event, fn)
Signalbird.push.register({ token, platform, provider?, external_id?, device_name?, app_version?, locale? })
Signalbird.destroy()
Signalbird.version
```

`<script data-app-key data-base-url? data-locale? data-debug?>` verilirse
widget kendini başlatır. Hiçbir genel çağrı ev sahibi sayfaya **istisna
fırlatmaz**; hata konsola yazılır ve yutulur. `init` öncesi kaydedilen
`on()` dinleyicileri ve `identify()` çağrısı başlatınca uygulanır.

### 9.4 Davranış

- **İyimser gönderim.** Mesaj `client_id` (UUID) ile anında listeye düşer;
  sunucu aynı `client_id` ile var olanı dönerse (200) yerel kopya onunla
  değiştirilir. Başarısızsa kabarcık kırmızıya döner, tıklayınca yeniden dener.
- **Ekler** önce `POST …/{id}/attachments` (multipart `file`) ile yüklenir,
  sonra mesajla gönderilir. Tür süzgeci: `image/*`, pdf, doc/docx, xls/xlsx,
  txt, zip; boyut `app.chat.max_attachment_mb` (varsayılan 10). Sürükle-bırak
  ve panoya yapıştırma desteklenir; en fazla 5 dosya.
- **Yazıyor**: ilk tuşta `is_typing:true`, 2.5 s hareketsizlikte `false`;
  aynı yönde 4 s'den sık gönderilmez. Ajanın yazıyor durumu `agent_typing`
  alanından okunur.
- **Okundu**: panel açık ve sekme görünürken gelen mesajlar için
  `POST …/read {last_message_id}`; ✓ = gönderildi, ✓✓ = teslim/okundu (mavi).
- **Okunmamış**: balon rozeti + sekme gizliyken `document.title` yanıp söner
  + (`app.chat.sound`) WebAudio bip.
- **Düzenle/sil** yalnız kendi mesajı ve 15 dk içinde; **tepki** emoji ile
  toggle; **yanıtla** alıntı gösterir.
- **Puanlama**: "Sohbeti bitir" → 1–5 yıldız + yorum → `rate` + `close`. Ajan
  çözdüyse (`resolved`) panel kapatılırken bir kez sorulur; aynı konuşma için
  tekrar sorulmaz (`localStorage['sb_rated_<id>']`).
- **Çalışma saatleri**: `within_hours=false` ise `offline_message` bandı.
- **Mobil**: ≤640 px'de panel tam ekran. **Dil**: `locale` → `app.chat.locale`
  → `navigator.language`; `tr` dışı her şey `en`.
- **Boyut**: < 40 KB gzip (ölçüm: `gzip -c dist/signalbird.js | wc -c`).
