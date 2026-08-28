# Signalbird SDK — Diller Arası Davranış Sözleşmesi

Bu belge, `src/` altındaki **her** dil istemcisinin uyması gereken kuralları
tanımlar. Yeni bir dil eklerken tek referans budur; bir kural burada yoksa o
kural yoktur.

## 0. Beş yüzey

| # | Yüzey | Kim kullanır | Anahtar | Diller |
|---|---|---|---|---|
| §1–7 | **Telsiz** (Radio) | müşterinin sunucusu ve sitesi | `sbr_live_…` / `sbr_pub_…` | Node, PHP, Python, Go, .NET, tarayıcı |
| §8 | **Gönderim** (Messaging) | müşterinin sunucusu | `sb_…` | Node, PHP, Python, Go, .NET |
| §10 | **Yönetim** (Management) | müşterinin sunucusu / otomasyonu | `sb_…` + `radio\|chat\|apps` scope'ları | Node, PHP, Python, Go, .NET |
| §11 | **Uygulama** (App) | müşterinin **müşterisi** | `sbw_pub_…` + ziyaretçi sırrı | TypeScript (web/RN), Swift, Kotlin |
| §12 | **Partner** | sözleşmeli platform (veribenim, submitcms) | `sbp_live_…` | Node, PHP, Python, Go, .NET |

İlk üçü **sunucu** yüzeyidir ve gizli anahtar ister. Dördüncüsü **istemci**
yüzeyidir: açık anahtar taşır, yalnız ziyaretçinin KENDİ verisine dokunur ve
mobil uygulamaya gömülür. Beşincisi de sunucu yüzeyidir ama **takımlar
üstüdür** ve yalnız sözleşmeli platformlara verilir (§12).

`scripts/check-parity.mjs` beş kümeyi de denetler; bir dilde olup diğerinde
olmayan metot CI'ı kırar.

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
| Sunucu | `Authorization: Bearer <key>` | `sb_…` (takım) ya da `sbr_live_…` (proje) |
| Tarayıcı | `X-Signalbird-Key: <key>` | `sbr_pub_…` |
| Tarayıcı (yalnız `sendBeacon`) | `?key=<key>` | `sbr_pub_…` |

**Takım anahtarı Telsiz'e de yazar** (28 Ağu 2026, `radio:write` kapsamıyla).
Proje takımdan çözülür: ilk proje kullanılır, hiç yoksa "Varsayılan" adıyla
açılır. Proje anahtarı kalkmadı — birden çok projeyi ayrı ayrı yönetmek
isteyen (ör. ajans) onu kullanmaya devam eder.

**Gizli anahtar sorgu dizesine KONMAZ** ve sunucu bunu reddeder
(`SECRET_KEY_IN_QUERY`): sorgu dizeleri erişim günlüklerine düşer.

Sunucu istemcisi `sbr_pub_` ile başlayan anahtarı kabul etmez ve kurulum
anında hata verir. Sessizce çalışıp kanal kısıtına takılması, hatanın
haftalar sonra fark edilmesi demektir.

## 3. baseUrl

Varsayılan `https://live.signalbird.io/api`. Kullanıcının kendi kurulumu olabileceği
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
| Node | `SignalbirdMessaging` (`signalbird`) |
| PHP | `Signalbird\Sdk\Messaging\MessagingClient` — Laravel: `Signalbird::messaging()` |

### 8.1 Kurucu

| Alan | Varsayılan | Not |
|---|---|---|
| `apiKey` | — | `sb_` ile başlamalı. `sbr_` (Telsiz) ya da `sbw_pub_` (uygulama) verilirse **kurulum anında** `WRONG_KEY_TYPE`; boşsa `NO_KEY` |
| `baseUrl` | `https://live.signalbird.io/api` | sondaki `/` kırpılır |
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
| e-posta | `sendEmail({to, class, subject?, body?, template?, template_id?, template_hash?, vars?, sending_domain_id?, contact_id?, from_name?, reply_to?})` | `POST /v1/email/send` |
| SMS | `sendSms({to, class, body, brand_id?, contact_id?})` · `previewSms(body)` | `POST /v1/sms/send` · `POST /v1/sms/preview` |
| push | `sendPush({to, class, subject, body, vars?, contact_id?})` — `to`: token, `contact:<id>`, `external:<id>` | `POST /v1/push/send` |
| olay | `track({event, contact:{email?|phone?|external_id?}, data?})` — kendi sistemindeki olayı bildirir ve eşleşen otomasyon akışını tetikler; kişi yoksa açılır, `data` şablon değişkeni olur | `POST /v1/events` |
| kişiler | `listContacts(q)` · `createContact(c)` · `updateContact(id, c)` · `deleteContact(id)` · `bulkContacts({contacts[], list_id?, consent_source?, consent_text?})` | `/v1/contacts…` |
| listeler | `listContactLists()` · `createContactList({name, description?})` · `deleteContactList(id)` | `/v1/contact-lists…` |
| kampanyalar | `listCampaigns(q)` · `createCampaign({name, channel, domain_id, list_id?|segment_id?, subject?, body, template_hash?, sending_domain_id?, brand_id?, scheduled_at?, from_name?, reply_to?, metadata?, external_ref?})` — `domain_id` TXT ile doğrulanmış müşteri domaini (zorunlu); hedef liste VEYA segment · `getCampaign(id)` · `cancelCampaign(id)` · `listCampaignMessages(id, q)` · `iterateCampaignMessages(id, q)` (yardımcı, sayfa sayfa gezer) | `/v1/campaigns…` |
| mesajlar | `listMessages(q)` · `getMessage(id)` | `/v1/messages…` |

`class` (`transactional` | `commercial`) zorunludur ve **varsayılanı yoktur** —
hukuki kapı çağıranın elindedir.

**Şablon seçimi** üç biçimde olur ve biri yeterlidir: `template` (panelde
yazan AD, büyük/küçük harfe duyarsız), `template_id` (sayı) ya da
`template_hash` (gövde parmak izi — kampanya yolunda üretilir). Şablon
verildiğinde `subject` ve `body` isteğe bağlıdır: konu şablondan gelir, ama
istekte konu varsa **çağıranınki kazanır**. Bulunamayan şablon 422
`TEMPLATE_NOT_FOUND` döner — yok sayılıp gövdesiz posta gönderilmez.

### 8.3.1 PHP: `Signalbird::mail()`

Laravel kurulumunda aynı uca zincirlenebilir bir yüz vardır:

```php
Signalbird::mail()
    ->to($user->email)
    ->template('Sipariş Onayı')
    ->vars(['ad' => $user->name])
    ->fromName('Penyu Destek')
    ->replyTo('destek@penyu.io')
    ->transactional()
    ->send();
```

`transactional()` / `commercial()` demek **zorunludur** — sınıfın varsayılanı
yoktur. Uygulamanın mevcut `Mailable` sınıfları için bu gerekmez:
`MAIL_MAILER=signalbird` ile hepsi zaten Signalbird'den çıkar (§8.8).

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

### 8.8 Laravel posta taşıyıcısı — `MAIL_MAILER=signalbird`

`config/mail.php` içine tek bir satır:

```php
'signalbird' => ['transport' => 'signalbird'],
```

Bundan sonra uygulamanın **her** `Mailable`'ı (Blade görünümleriyle birlikte)
Signalbird'den çıkar ve orada kayda geçer; hiçbir çağrı yeri değişmez.

İki yolun ayrımı şudur: taşıyıcıda **gövde uygulamada** üretilir,
`Signalbird::mail()`'de **gövde panelde** durur. Onlarca Mailable'ı tek tek
SDK çağrısına çevirmek hem çok iş hem de kaçınılmaz olarak eksik kalır —
biri unutulur ve o posta kayıtlarda hiç görünmez.

Taşıyıcının sınırları:

- **Alıcı başına ayrı istek**: Signalbird'de her alıcı ayrı bir kayıttır
  (açılma/tıklama/bounce alıcıya bağlıdır). Toplu olan kampanyadır.
- **Ek dosya taşınmaz** ve sessizce düşürülmez: `TransportException` fırlatılır.
  Gönderdiğini sandığın fatura hiç gitmesin diye.
- **Sınıf yapılandırmadan gelir** (`SIGNALBIRD_MAIL_CLASS`, varsayılan
  `transactional`). Bu taşıyıcıdan ticari toplu posta çıkmaz.

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

---

## 10. Yönetim (Management) istemcisi

Dördüncü değil **üçüncü sunucu yüzeyi**: müşterinin panelde tıklayarak yaptığı
her şeyi kodla yapar. Telsiz projesi ve kanalı açar, olay akışını okur, sohbet
gelen kutusunu işler, uygulama kaydı ve cihaz listesi yönetir.

**Bu bir ADMIN yüzeyi DEĞİLDİR.** Anahtar tek bir takıma bağlıdır ve yalnız o
takımın kayıtlarına dokunur; başka takımın kaydı 404 döner (varlık sızdırılmaz).
Kullanıcı yönetimi, faturalama, abonelik ve plan işlemleri SDK'da YOKTUR ve
olmayacaktır — onlar panelin ve şirket sahibinin işidir.

| Dil | Sınıf |
|---|---|
| Node | `SignalbirdManagement` (`signalbird`) |
| PHP | `Signalbird\Sdk\Management\ManagementClient` — Laravel: `Signalbird::management()` |
| Python | `signalbird.SignalbirdManagement` |
| Go | `signalbird.Management` |
| .NET | `Signalbird.Sdk.ManagementClient` |

### 10.1 Kurucu

Gönderim istemcisiyle (§8.1) **aynı** kuralları taşır: `sb_` dışı anahtar
kurulum anında `WRONG_KEY_TYPE`, boş anahtar `NO_KEY`; `baseUrl` serbest,
sondaki `/` kırpılır; `timeout` 15 s; `throwOnError` varsayılan `false`.

Gerektirdiği scope'lar (`ApiKey::SCOPES`): `radio:read` · `radio:write` ·
`chat:read` · `chat:write` · `apps:read` · `apps:write`. Yazma scope'u okumayı
kapsar (sunucu tarafında `SCOPE_FALLBACKS`); ikisini ayrı ayrı işaretlemeye
zorlamak, ilk entegrasyonda 403 alıp anahtarı yeniden üretmek demekti.

### 10.2 Sonuç biçimi

§8.2 ile birebir aynıdır — aynı zarf, aynı kod eşlemesi. İki yüzey aynı kapıyı
(`Authorization: Bearer sb_…`) kullanır; hata kodlarının ayrışması müşterinin
tek bir hata işleyicisi yazmasını imkânsız kılardı.

### 10.3 Metot kümesi — 45 metot

Adlar diller arasında birebir aynıdır; her dil kendi yazım geleneğini korur
(`createRadioProject` / `create_radio_project` / `CreateRadioProject` /
`CreateRadioProjectAsync` aynı metottur). Alan adları API ile aynıdır
(snake_case) — SDK yeniden adlandırmaz.

**Telsiz yönetimi (11)**

| Metot | HTTP |
|---|---|
| `radioSummary()` | `GET /v1/radio/summary` |
| `radioEvents(query?)` | `GET /v1/radio/events` |
| `listRadioProjects()` | `GET /v1/radio/projects` |
| `createRadioProject({name})` | `POST /v1/radio/projects` |
| `getRadioProject(id)` | `GET /v1/radio/projects/{id}` |
| `updateRadioProject(id, input)` | `PATCH /v1/radio/projects/{id}` |
| `deleteRadioProject(id)` | `DELETE /v1/radio/projects/{id}` |
| `rotateRadioSecret(id)` | `POST /v1/radio/projects/{id}/rotate` |
| `createRadioChannel(projectId, input)` | `POST …/{id}/channels` |
| `updateRadioChannel(projectId, channelId, input)` | `PATCH …/channels/{cid}` |
| `deleteRadioChannel(projectId, channelId)` | `DELETE …/channels/{cid}` |

Gizli proje anahtarı (`sbr_live_…`) **yalnız** `createRadioProject` ve
`rotateRadioSecret` yanıtında görünür; sunucuda yalnız SHA-256 özeti saklanır.
Kanalın `key` alanı güncellemede DEĞİŞMEZ — müşterinin kodundaki
`log('critical', …)` çağrısı ona bağlıdır ve değiştirmek sessizce yeni kanal
açardı.

**Sohbet — ajan tarafı (27)**

| Metot | HTTP |
|---|---|
| `chatSummary()` · `chatUpdates()` | `GET /v1/chat/summary` · `/updates` |
| `listConversations(query?)` · `getConversation(id)` | `GET /v1/chat/conversations[/{id}]` |
| `listConversationMessages(id, query?)` | `GET …/{id}/messages` |
| `startConversation({visitor_id\|contact_id, body})` | `POST /v1/chat/conversations` |
| `updateConversation(id, input)` · `setConversationStatus(id, status)` | `PATCH …/{id}` · `POST …/{id}/status` |
| `assignConversation(id, userId?)` · `readConversation(id, lastId?)` · `setTyping(id, bool)` | `POST …/{id}/{assign\|read\|typing}` |
| `reply(id, input)` · `editChatMessage(id, mid, body)` · `deleteChatMessage(id, mid)` · `reactToChatMessage(id, mid, emoji)` | `…/{id}/messages…` |
| `getVisitor(id)` · `updateVisitor(id, input)` · `banVisitor(id)` | `/v1/chat/visitors/{id}…` |
| `listCannedReplies()` · `createCannedReply(input)` · `updateCannedReply(id, input)` · `deleteCannedReply(id)` | `/v1/chat/canned-replies…` |
| `listChatTriggers()` · `createChatTrigger(input)` · `updateChatTrigger(id, input)` · `deleteChatTrigger(id)` | `/v1/chat/triggers…` |
| `chatReport(range?)` — `7d` \| `30d` \| `90d` | `GET /v1/chat/reports` |

**Tetikleyiciler** ("şu olduğunda şunu yap") kural kaydıdır: üç olay
(`conversation.created`, `visitor.message`, `no_reply`), koşul listesi ve beş
eylem (`reply`, `internal_note`, `tag`, `priority`, `assign`). Otomatik yanıt
`system` göndericisiyle yazılır, ajan olarak DEĞİL — ajan gibi görünseydi
`first_response_at` damgası yalan söyler ve SLA raporu bozulurdu.

**Rapor** ortalama değil **ortanca + p90** döner ve veri yoksa süreler `null`
olur, `0` değil: "0 saniyede yanıtlıyoruz" rapor ekranındaki en tehlikeli
yalandır.

"Ajan" **anahtarı üreten kullanıcıdır**. Sahipsiz anahtar (miras kayıt) yazma
yapamaz: gelen kutusundaki her satırın bir sahibi olmalı, yoksa liste okunmaz
hâle gelir. `reply` içinde `is_internal: true` verilen mesaj bir iç nottur ve
ziyaretçiye **asla** gitmez.

**Uygulamalar (7)**

| Metot | HTTP |
|---|---|
| `listApps()` · `createApp(input)` · `getApp(id)` · `updateApp(id, input)` · `deleteApp(id)` | `/v1/apps…` |
| `rotateAppKey(id)` | `POST /v1/apps/{id}/rotate-key` |
| `listAppDevices(id, query?)` | `GET /v1/apps/{id}/devices` |

`rotateAppKey` eski açık anahtarı **anında** geçersizleştirir: siteye gömülü
snippet güncellenene kadar widget çalışmaz. Cihaz listesinde token **maskeli**
döner; tamamı hiçbir zaman dönmez.

### 10.4 Gömme jetonu — kendi panelinizde Signalbird ekranı

| Metot | HTTP |
|---|---|
| `embedToken(input)` | `POST /v1/embed/tokens` |

Girdi: `module` (`chat` · `monitoring` · `campaigns` · `contacts` · `radio` ·
`messages` · `topics` · `members`), `user_id?`, `locale?`, `theme?`, `accent?`.
Dönen `url` doğrudan bir `<iframe>`'e verilir (ya da `signalbird/embed` yüzeyi
kullanılır, §13).

Üç kural:

- **120 saniye ve TEK KULLANIM.** Jeton URL'de gider; `Referer` başlığına ve
  sunucu loglarına düşer. Saklanmaz, istendiği an kullanılır.
- **Anahtar `embed:issue` kapsamı ister** ve bu kapsam geri-uyum listesinde
  yoktur. Sebebi: jeton 60 dakikalık bir **panel oturumuna** çevrilir ve o
  oturum, seçilen kullanıcının panelde yapabildiği her şeyi yapar. Dar
  kapsamlı bir anahtarın bunu üretebilmesi, kapsam kısıtını tek çağrıyla
  aşmak olurdu.
- **`user_id` takımın üyesi olmalıdır**; verilmezse anahtarın sahibi kullanılır.
  Yetkiler kişinin kendi yetkileridir, anahtarın değil.

Partner yüzeyindeki karşılığı `createEmbedToken` (§12): tek fark kimliğin
`user_external_id` ile verilmesidir.

### 10.5 Retry

Yoktur (§8.7 ile aynı ilke). Bir kanalı iki kez açmak ya da bir mesajı iki kez
göndermek, hiç yapmamaktan pahalıdır.

---

## 11. Uygulama (App) istemcisi — son kullanıcı

Müşterinin **müşterisi** için: canlı sohbet ve push cihaz kaydı. Açık uygulama
anahtarı (`sbw_pub_…`) taşır ve istemciye gömülür; güvenliği gizlilikten değil
kısıttan gelir — yalnız izinli kökenden çalışır ve yalnız ziyaretçinin KENDİ
verisine dokunur. Gönderim yapmaz, kişi listesi okumaz, kota harcamaz (konuşma
açmak hariç).

| Dil | Sınıf | Giriş |
|---|---|---|
| TypeScript | `SignalbirdApp`, `ChatSession` | `signalbird/app` |
| React / Next.js | `SignalbirdProvider`, `useChat` | `signalbird/react` |
| Vue 3 | `signalbirdPlugin`, `useChat` | `signalbird/vue` |
| Angular | `SignalbirdService`, `provideSignalbird` | `signalbird/angular` |
| React Native / Expo | `useNativeChat`, `asyncStorageAdapter` | `signalbird/react-native` |
| Swift (iOS) | `SignalbirdApp` | SPM `Signalbird` |
| Kotlin (Android) | `SignalbirdApp` | Maven `io.signalbird:signalbird-sdk` |
| Kod yazmadan | global `Signalbird` | `<script src=…/sdk/v1/signalbird.js>` (§9) |

### 11.1 Kimlik ve saklama

İki başlık: `X-Signalbird-App-Key: sbw_pub_…` ve `X-Signalbird-Visitor: <sır>`.
Sır **yalnız** `startSession` yanıtında döner.

Her dil bir **saklama katmanı** ister ve bu isteğe bağlı değildir: sır cihazda
kalmazsa kullanıcı uygulamayı her açtığında sohbet geçmişini kaybeder.

| Dil | Varsayılan | Değiştirilebilir |
|---|---|---|
| TypeScript (web) | `localStorage` | `storage` seçeneği |
| React Native | — (verilmesi ZORUNLU) | `asyncStorageAdapter(AsyncStorage)` |
| Swift | `UserDefaults` | `SignalbirdStorage` uyarlaması (ör. Keychain) |
| Kotlin | bellek (yalnız test için) | `SharedPreferences` sarmalayıcısı |

Saklanan kayıt `{id, secret, appKey}` taşır. **`appKey` uyuşmazsa kayıt yok
sayılır**: uygulama anahtarı döndürüldüğünde eski sırla yapılan her çağrı 401
alırdı ve sohbet sessizce ölürdü. Sunucu `VISITOR_INVALID` (401) dönerse yerel
kimlik silinir ve bir sonraki çağrı yeni oturum açar.

### 11.2 Metot kümesi — 18 metot

| Metot | HTTP |
|---|---|
| `bootstrap()` | `POST /v1/sdk/bootstrap` |
| `startSession(input?)` · `identify(input)` · `signOut()` | `POST /v1/sdk/chat/session` · `/v1/sdk/identify` · (yerel) |
| `listConversations()` · `getConversation(id, {after?, limit?})` | `GET /v1/sdk/chat/conversations[/{id}]` |
| `startConversation({body, client_id})` · `sendMessage(convId, input)` | `POST …/conversations[/{id}/messages]` |
| `editMessage` · `deleteMessage` · `reactToMessage` | `…/{id}/messages/{mid}[…/reactions]` |
| `setTyping(id, bool)` · `markRead(id, lastId?)` | `POST …/{id}/typing` · `…/{id}/read` |
| `closeConversation(id)` · `rateConversation(id, rating, comment?)` | `POST …/{id}/close` · `…/{id}/rate` |
| `registerDevice(input)` · `unregisterDevice(token)` | `POST /v1/sdk/devices` · `DELETE …/{token}` |
| `reportPushOpened(messageId)` | `POST /v1/sdk/push/opened` — bildirime dokunuldu; push'ta açılmayı YALNIZCA uygulama bilir (FCM/APNs "teslim ettim" der, "dokunuldu" demez). Bildirim yükündeki `data.sb_message_id` geri gönderilir |

`uploadAttachment` **sözleşmede yoktur**: dosya her platformda farklı bir tip
ister (`Blob` / `Data` / `Uri`) ve tek imzada birleşmiyor. Desteklendiği dilde
o dilin belgesinde durur.

### 11.3 Sohbet oturumu (`ChatSession`) — yalnız TypeScript

Ham uçların üstünde bir durum katmanı: mesaj listesi, okunmamış sayısı, yazıyor
durumu, iyimser gönderim ve yoklama merdiveni. React, Vue, Angular ve React
Native uyarlamaları **bu sınıfa abone olur** — dördünde aynı mantığı yeniden
yazmak, dört ayrı hata takımı üretmek demekti.

- **İyimser gönderim.** Mesaj `client_id` ile listeye ANINDA düşer; sunucu
  cevabı gelince yerel kopya onunla değiştirilir, başarısızsa `failed`
  işaretlenir.
- **Yoklama merdiveni** (§9.2 ile aynı): panel açıkken 3 s, kapalıyken
  20 s ×3 → 60 s ×2 → 180 s. Yeni veri merdiveni sıfırlar; arka plandaki
  sekme/uygulama tur atlar. WebSocket yoktur — imleçli yoklama bağlantı
  kopmasında kendi kendini toparlar ve mobil ağda pil yakmaz.
- **İmleç yalnız sunucu kimliğidir.** İyimser kayıtlar `after=` imlecine
  girmez; girseydi sunucu onları tanımaz ve liste boş dönerdi.

### 11.4 Hata davranışı

Hiçbir metot istisna FIRLATMAZ (kurucudaki anahtar denetimi hariç). Sohbet
balonunun hatası müşterinin ödeme sayfasını çökertmemeli — §9'daki widget
kuralının aynısı, artık dört dilde geçerli.

---

## 12. Partner istemcisi

**Beşinci yüzey.** Signalbird'ü kendi ürününün içinde satan sözleşmeli platform
(veribenim, submitcms) müşterisini bununla sağlar ve yetkilendirir.

| Dil | Sınıf |
|---|---|
| Node | `SignalbirdPartner` (`signalbird`) |
| PHP | `Signalbird\Sdk\Partner\PartnerClient` — Laravel: `Signalbird::partner()` |
| Python | `signalbird.SignalbirdPartner` |
| Go | `signalbird.Partner` |
| .NET | `Signalbird.Sdk.PartnerClient` |

Sunucu sözleşmesi: `signalbird.api/docs/PARTNER_PLATFORM_2026-08-20.md`.

### 12.1 Neden kuralın istisnası

`CLAUDE.md` "Admin yüzeyi OLMAYACAK: kullanıcı yönetimi, faturalama, abonelik,
plan, şirket/takım CRUD" der. Partner yüzeyi bunu **bilerek** deler.

Kural, müşterinin kendi anahtarıyla (`sb_…`) şirket açamaması içindi ve o kural
aynen duruyor: `sb_` anahtarı hâlâ tek takıma bağlıdır. Partner **farklı bir
taraftır** — sözleşmesi vardır, müşterisini kendi panelinden yönetir ve
Signalbird onun için bir alt sistemdir. Bu yüzden ayrı anahtar türü, ayrı
tablo, ayrı kapı taşır.

Partner **süper yönetici DEĞİLDİR**: yalnız KENDİ açtığı company'lere erişir;
başka partnerin ya da self-servis müşterinin kaydı **404** döner.

### 12.2 Kurucu

Gönderim (§8.1) ile aynı kurallar: `sbp_live_` dışı anahtar kurulum anında
`WRONG_KEY_TYPE`, boş anahtar `NO_KEY`; `baseUrl` serbest, sondaki `/` kırpılır;
`timeout` 15 s; `throwOnError` varsayılan `false`. Zarf ve kod eşlemesi §8.2 ile
birebir aynıdır.

Anahtar **tarayıcıya İNMEZ**. Gömme jetonunu partner'ın kendi sunucusu üretir;
tarayıcı yalnız o kısa ömürlü jetonu görür (§12.5).

### 12.3 Metot kümesi — 23 metot

| Alan | Metot |
|---|---|
| müşteri | `createCompany(input)` · `listCompanies(q?)` · `getCompany(ext)` · `updateCompany(ext, input)` · `suspendCompany(ext)` · `rotateKey(ext, 'api'\|'app')` |
| domain | `addDomain(companyExt, input)` · `listDomains(companyExt)` · `getDomain(ext)` · `verifyDomain(ext)` · `removeDomain(ext)` |
| izleme | `domainUptime(ext, range?)` · `companyUptime(companyExt, range?)` |
| modül | `listModules(companyExt)` · `grantModule(companyExt, input)` · `revokeModule(companyExt, module)` |
| kullanıcı | `createUser(companyExt, input)` · `listUsers(companyExt)` · `removeUser(companyExt, userExt)` |
| mesaj | `listMessages(companyExt, query?)` · `getMessage(companyExt, messageId)` · `messageSummary(companyExt, range?)` |
| gömme | `createEmbedToken(companyExt, input)` |

`range`: `24h` \| `7d` \| `30d` (uptime'da varsayılan `24h`, mesaj özetinde `7d`).

Mesaj uçları **salt okurdur** ve partner yüzeyinin tek okuma kümesidir
(signalbird.api/docs/MESSAGING_UNIFICATION_2026-08-25.md §5.1). Alıcı MASKELİ
döner, gövde hiç dönmez — gövde zaten saklanmıyor (`template_hash` + `vars`).

### 12.4 Idempotens

Her yazma işlemi partner'ın kendi kimliğiyle (`external_id`) yapılır ve
**idempotenttir**: aynı kimlikle ikinci çağrı yeni kayıt açmaz, `created:false`
ile var olanı döner. Partner'ın webhook'u iki kez tetiklenebilir, kuyruğu
yeniden deneyebilir — SDK bunu gizlemez, sunucu garanti eder.

`createCompany` yanıtındaki `keys` (`api_key`, `app_key`) **yalnız ilk
oluşturmada** gelir. Kaybedilirse `rotateKey` yenisini üretir; eskisini geri
veren yol yoktur.

### 12.5 Gömme jetonu

`createEmbedToken` 120 saniye yaşayan, **tek kullanımlık** bir jeton döner.
Tarayıcı `url` alanını `<iframe>`e koyar; panel ekranı partner'ın sayfasında
kabuğu olmadan çizilir.

Kısa ömür ve tek kullanım isteğe bağlı değildir: jeton URL'de gider, yani
tarayıcı geçmişine, sunucu loglarına ve `Referer` başlığına düşer.

### 12.6 TXT kuralı

`addDomain` ile açılan domain `verified_via:'partner'` ile doğar. Bu **izleme,
sohbet ve push** için yeter; **e-posta/SMS kampanyası** için yetmez
(`can_send_campaigns:false`). Yanıttaki `dns` kaydını yayınlayıp
`verifyDomain` çağırmak kapıyı açar.

Gerekçe: gönderim zarfı Signalbird havuzundan çıkar, yani itibar bizimdir.
"Bu domain adına gönderebilir" kararı partner'ın beyanına bırakılamaz.

### 12.7 Retry

Yoktur — §8.7 ile aynı ilke.

---

## 13. Gömme (Embed) yüzeyi — `signalbird/embed`

**Altıncı yüzey ve tek TARAYICI yüzeyi.** Partner, Signalbird panel ekranını
KENDİ panelinin içinde çalıştırır; ekranı yeniden yazmaz.

KARAR 2026-08-27 (Ahmet): *"submitcms paneline chat modülü yazmayalım, SDK
içinde doğrudan chat modülünü render edecek bir yapı geliştirelim; nereye
çakarsak orda çalışsın, Stripe sanal posu gibi."* Sonuç: ev sahibi bir `<div>`
verir, SDK gerisini yapar.

| Ortam | Erişim |
|---|---|
| npm | `import { createEmbed } from 'signalbird/embed'` |
| `<script>` | `Signalbird.embed({...})` (widget betiği; `init()` gerekmez) |

Diğer dillerde karşılığı **yoktur ve olmayacaktır**: bu yüzey DOM'a bağlıdır.
Sunucu tarafının payı jeton üretmektir (§12.5, `createEmbedToken`).

### 13.1 Sözleşme

```ts
const handle = createEmbed({
  module: 'chat',            // chat | monitoring | campaigns | contacts | radio | messages
  mint,                      // () => Promise<{url}>  — EV SAHİBİNİN SUNUCUSU
  theme: 'auto',             // auto | light | dark   (auto: ev sahibi sayfayı izler)
  locale: 'tr',
  accent: '#4f46e5',
  height: 'auto',            // 'auto' | number(px)
  minHeight: 640,
})

await handle.mount('#sb-chat')
```

`handle`: `mount(target)` · `refresh()` · `setTheme(t)` · `destroy()` ·
`on(event, fn)` / `off(...)` — olaylar `ready`, `error`, `height`.

### 13.2 Jetonu SDK üretmez

`mint` ev sahibinin kendi ucudur ve partner anahtarı orada kalır. SDK yalnız
sonucu okur; `{url}`, `{data:{url}}` ve düz string kabul edilir (partner'ın API
zarfını soyması gerekmesin diye).

Jeton **tek kullanımlıktır**: her `mount()` / `refresh()` / `setTheme()` YENİ
jeton alır. `url` seçeneği doğrudan verilirse yalnız ilk kurulum çalışır.

### 13.3 Yükseklik ve köken

Gömülü ekran `postMessage` ile `signalbird:ready` ve `signalbird:height`
bildirir. SDK gönderen çerçeveyi `event.source` ile doğrular — sayfadaki başka
bir iframe çerçeveyi büyütemez. `height:'auto'` bildirilen yüksekliği uygular,
`minHeight`in altına inmez.

### 13.4 Modül kapısı SDK'da DEĞİLDİR

Müşterinin o modülü satın alıp almadığını ev sahibinin satış kaydı bilir;
Signalbird de kendi yetki kaydını (`MODULE_DISABLED`, 403) uygular. SDK
üçüncü bir kapı koymaz, `mint` hatasının mesajını gösterir.
