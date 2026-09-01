# Geliştirme Kaydı — signalbird.sdk

## 2026-09-01 — v2.1.1: `RadioChannel` sahtelenebilir oldu

`final class RadioChannel` idi ve Mockery final sınıfı sahteleyemiyor. Sonuç:
`Signalbird::radio('x')->error(…)` çağıran HER müşterinin testi kırılıyordu —
"sahtele" diyemedikleri için ya gerçek HTTP isteği atacaklar ya da o kod yolunu
hiç test etmeyeceklerdi. penyu.api'de `SignalDualWriteTest` tam olarak buna
takıldı (`Mockery\Exception: … is marked final and its methods cannot be
replaced`).

`final` kaldırıldı. Bir kütüphanenin kendisini test edilemez yapması,
kapatılmasından daha pahalıya mal olur.

## 2026-09-01 — v2.1.0: `radio()` kanal bağlama

Sözleşme: `docs/CONTRACT.md` § 1.1.

```php
Signalbird::radio('penyuCritical')->error('Ödeme düğümü öldü', $ctx);
```
```ts
signalbird().radio('penyuCritical').error('Ödeme düğümü öldü', ctx)
```

NEDEN: bu sözdizimi 1 Eyl 2026 anahtar sözleşmesinde ve panelin kopyala-yapıştır
kod örneğinde YAZIYORDU ama SDK'da karşılığı yoktu — müşteri panelde kopyala
düğmesine basınca çalışmayan kod alıyordu. Var olan tek biçim
`Signalbird::error('penyuCritical', 'mesaj', $ctx)` idi; kanal adı her satırda
tekrar ediliyordu.

Sözdizimi şekeridir: her metot `log()`'a gider, gövde değişmez. Bu yüzden
diller arası parite denetiminden muaf (`check-parity.mjs` → `ignored`), PHP ve
TypeScript'te var. Python/Go/.NET/Swift/Kotlin'de seviye kısayolları kanalı
zaten ilk argüman olarak alıyor.

Yeni: `src/php/RadioChannel.php`, `SignalbirdClient::radio()`,
`Facades\Signalbird::radio()`, node `SignalbirdClient.radio()`.
Test: `tests/php/RadioChannelTest.php` — kanal adının her seviyede aynı
kaldığını sınar; kaybolursa kayıt yanlış kanala düşer ve hata sessizdir.

## 2026-09-01 — v2.0.0: tek anahtar (domain key + module key)

Sözleşme: `docs/CONTRACT.md` §0–2, §10 · platform:
`../signalbird.api/docs/KEY_ARCHITECTURE_2026-09-01.md`.

**KIRICI SÜRÜM.** Dört anahtar ailesi (`sbr_live_`, `sbr_pub_`, `sb_`,
`sbw_pub_`, `sbp_live_`) ve 17 elemanlı scope listesi kaldırıldı. Beş yüzeyin
tamamı tek anahtar kullanır.

| Eski | Yeni |
|---|---|
| `apiKey` / `api_key` / `APIKey` | `domainKey` / `domain_key` / `DomainKey` |
| `appKey` (App, widget, react/vue/angular/RN) | `publicKey` |
| `SIGNALBIRD_KEY`, `SIGNALBIRD_API_KEY`, `SIGNALBIRD_MESSAGING_KEY`, `SIGNALBIRD_PARTNER_KEY` | `SIGNALBIRD_DOMAIN_KEY` |
| `Authorization: Bearer` | `X-Signalbird-Key` (Bearer da kabul) |
| `X-Signalbird-App-Key` | `X-Signalbird-Key` + `X-Signalbird-Module-Key` |
| Telsiz gövdesinde `channel` | `key` (modül anahtarı) |
| `data-app-key="sbw_pub_…"` | `data-key="sb_public_live_…" data-channel="destek"` |
| `config/signalbird.php` → `key`, `api_key`, `messaging_key`, `partner_key` | tek alan: `domain_key` |

**Yönetim yüzeyi 45 → 36 metot.** Telsiz projesi/kanalı (9) ve uygulama (7)
metotları silindi; yerlerine modül anahtarı metotları (6) geldi:
`listModuleKeys` · `getModuleKey` · `createModuleKey` · `updateModuleKey` ·
`deleteModuleKey` · `listModuleKeyDevices`. `module` ∈ logger·email·sms·push·chat.

Davranış değişikliği: modül anahtarının `key` alanı artık **değiştirilebilir**
(v1'de değişmezdi). Eski ad 30 gün daha kabul edilir, böylece üretimdeki kod
bir sonraki deploya kadar kayıt kaybetmez.

Anahtar türü denetimi tek kurala indi: sunucu istemcileri `sb_secret_live_`
ister, istemci yüzeyi `sb_public_live_`. Yanlış tür KURULUMDA yakalanır —
açık anahtar sunucuda `ORIGIN_REQUIRED` alır ve sebebi log'da görünmez.

Node · PHP · Python · Go · .NET · Swift · Kotlin · tarayıcı · widget · React ·
Vue · Angular · React Native: hepsi güncellendi, parite korundu.

## 2026-08-31 — Ön-form kararı ziyaretçi KAYDINA değil, BİLİNİYOR OLMASINA bakıyor

Widget'ın ön-formu (ad/e-posta) `!this.store.visitor` koşuluyla kapanıyordu:
ziyaretçi kaydı varsa form gösterilmiyordu. Oysa sayfa ziyaretçiyi yalnızca
kendi damgasıyla (`external_id`) tanıtmışsa kayıt VARDIR ama kim olduğu hâlâ
bilinmez — o kişiye form gösterilmeliydi, gösterilmiyordu ve e-postası bir daha
hiç sorulmuyordu.

Bu, sayfanın her ziyaretçiyi baştan `identify` etmesini mümkün kılıyor
(penyu'nun `client_uid` damgası): kayıt açılıyor ama misafirin e-postası yine
soruluyor.

`src/widget/chat.ts` · `decideView()` — davranış: adı ya da e-postası bilinen
(sayfadan gelen kimlikte ya da kayıtlı ziyaretçide) kişiye form gösterilmez;
ikisi de yoksa gösterilir.

**Widget'ın yeniden yayımlanması gerekir** — bu değişiklik `sdk/v1/signalbird.js`
paketinin içinde.

> Her sürüm ve API değişikliğinden sonra güncellenir. En yeni bölüm en üstte.

## 2026-08-30 — Balon modu, çekmece düzeni, dile göre metinler (v1.9.0)

Üç ayar sunucudan gelir, widget yalnız uygular:

| Ayar | Değerler | Davranış |
|---|---|---|
| `launcher_mode` | `always` (varsayılan) / `manual` | `manual`: balon hiç çizilmez, sohbeti sitenin kendi düğmesi `Signalbird.chat.open()` ile açar. Sohbet başlayınca balon GÖRÜNÜR olur (pencere kapatılırsa ajanın yanıtı balonda ışık ve sesle görünsün), ziyaretçi sohbeti BİTİRİNCE yeniden gizlenir. |
| `layout` | `bubble` (varsayılan) / `sidebar` | `sidebar`: ekran boyu, kenara yaslı çekmece. Taşıma ve boyutlandırma o modda kapalı. |
| `texts` | `{tr: {greeting…}, en: {…}}` | Çözüm SUNUCUDA (`App::chatSettingsFor`); widget'a tek dilli alanlar dolu gelir. |

Balon gizleme, ziyaretçinin `dismiss` kararından AYRI bir sınıfla yapılır
(`.no-ln` ve `.hidden`): biri site sahibinin ayarı, diğeri ziyaretçinin
cihazındaki tercihi. Aynı bayrağa bindirilseydi ziyaretçi balonu bir kez
kapattığında site ayarı da bozulurdu.

Sunucu tarafı: ziyaretçinin bitirdiği konuşmaya ajan artık yazamıyor
(409 `CONVERSATION_ENDED_BY_VISITOR`), yani balonun gizlenmesiyle sunucunun
davranışı birbirini tutuyor.

## 2026-08-29 (4. tur) — Çeviri yetiştiğinde ekran güncelleniyor (v1.8.1)

Ajan Türkçe yazdı, müşteriye önce Türkçesi düştü, İngilizce çevirisi ancak
sayfa yenilenince geldi. İki sebep üst üste binmişti:

1. Çeviri kaydedilince kimse haber vermiyordu (asenkron; mesaj çeviriyi
   bilerek beklemiyor).
2. Haber verilse bile istemcinin turu İMLEÇLİ: `?after=<son mesaj>` zaten
   görülmüş bir mesajı bir daha getirmez, dolayısıyla metnin değişmesi hiç
   görülmez.

Sunucu artık `chat.message` yayınını `updated: true, reason: 'translation'`
ile tekrarlıyor; widget ve `ChatSession` bu işareti görünce o turu imleçsiz
atıyor. Soketi olmayan yol için widget'ta zaten olan "her 5. turda tam liste"
kuralı yeterli.

## 2026-08-29 (3. tur) — Canlı bağlantı `app` yüzeyine de geldi

Soket istemcisi `src/widget/socket.ts`ten `src/shared/socket.ts`e taşındı ve
artık `ChatSession` de kullanıyor. Mobil (penyu, React Native) canlıya geçti;
widget canlıya geçtiğinde mobil geride kalmıştı ve saniyede istek atmaya devam
ediyordu.

Yayın haber taşır, veri taşımaz: soketten gelen olay yalnız "yeni bir şey var"
der, mesaj her zaman kendi yetkimizle yeniden çekilir. Yoklama kaldırılmadı,
yavaşladı — bağlıyken açık panelde 45 s, kapalıyken merdivenin son basamağı.

`socketAuth(socketId, channel)` sözleşmeye (§11) girdi; TS, Swift ve Kotlin'de
var. Soket İSTEMCİSİ sözleşmede değil: mobil diller kendi WebSocket katmanını
kullanır, imzayı veren uç ise her dilde çağrılabilmeli.

`ChatSession`'a `reset()` ve `state.settings` eklendi; React/Vue/Angular/RN
uyarlamaları da açıyor. Kapanmış konuşma artık `refresh()`te benimsenmiyor ve
ekran yeniden görünür olduğunda sıfırlanıyor — widget'takiyle aynı kural.

## 2026-08-29 (2. tur) — Widget yeniden tasarım, marka yönetimi, çeviri düzeltmesi

**Çeviri yanlış tarafa gösteriliyordu (canlı hata).** `message.translation`
hedef dile çevrilmiş metindir ve hedef, mesajı OKUYACAK tarafın dilidir; hem
widget hem panel bunu koşulsuz basıyordu. Sonuç: ziyaretçi kendi yazdığı
İngilizce cümleyi, sayfayı tazeledikten sonra Türkçeye çevrilmiş buluyordu.
Artık her arayüz yalnız KARŞI tarafın mesajında çeviriyi gösteriyor. Sunucuda
ikinci kapı: sağlayıcı kaynak dili hedefle aynı bildirirse çeviri hiç
saklanmıyor ve dil ziyaretçiye yazılıyor — ikisi de Türkçe konuşuyorsa sistem
bir kez sorup susuyor.

**Kapanmış konuşma geri açılmıyor.** Ziyaretçi sohbeti bitirip paneli yeniden
açtığında "bu sohbet kapatıldı" bandıyla okunabilen ama yazılamayan bir ekran
geliyordu. Artık sıfırdan başlıyor; yoklama da yalnız `open` konuşmayı
benimsiyor (eski `|| items[0]` düşürüldü).

**Widget yeniden tasarlandı.** Başlık artık renk bloğu değil: marka rengi
üstteki hatta, avatar halkasında, gönder düğmesinde ve ziyaretçi balonunda.
Soğuk eğimli nötrler, koyu tema, işletim sistemi arayüz yazı tipleri (dışarıdan
font YÜKLENMEZ — müşterinin CSP'si ve sayfa hızı), yeni odak halkaları,
"Signalbird ile" yerine kuş + kelime işaretinden oluşan imza.

**Panel ölçüsü ve konumu ziyaretçinin.** Başlık sürüklenerek taşınır, dış üst
köşedeki tutamakla boyutlandırılır; `localStorage['sb_geometry']`'de saklanır,
ekran küçüldüyse atılır. Mobilde kapalı.

**Marka panelden yönetiliyor:** `chat.logo_url`, `chat.theme`
(`light|dark|auto`), `chat.launcher_icon` (`bird|chat|logo`). Gömme etiketine
hiçbir şey yazılmaz.

Widget 22.9 KB gzip (önce 20.3 KB).

## 2026-08-29 — Gömme jetonu takım anahtarıyla, şablonla mail, sohbet bitişi

**Yönetim yüzeyine `embedToken`** (46. metot). Signalbird ekranını MÜŞTERİNİN
kendi panelinde göstermek partnerliğe özgü bir ayrıcalık değil; artık takım
anahtarıyla da jeton alınıyor. Kapsam ayrı: `embed:issue` — jeton 60 dakikalık
bir panel oturumuna çevrildiği için dar kapsamlı bir anahtarın bunu üretmesi
kapsam kısıtını tek çağrıyla aşmak olurdu.

**`Signalbird::mail()`** (PHP): zincirlenebilir e-posta — şablon (ad ya da id),
değişkenler, gönderen adı, yanıt adresi, hukukî sınıf. Sınıf zorunlu, varsayılanı
yok. Mevcut Mailable'lar için gerekmez: `MAIL_MAILER=signalbird` zaten hepsini
Signalbird'den geçiriyor. Sunucu tarafında `template`/`template_id` artık
gerçekten çalışıyor (doğrulanıp sessizce atılıyordu).

**Widget** (29 Ağu kararları): balonda Signalbird kuşu; balonu tamamen gizleyen
`x` (widget sökülmez, gizlenir — `chat.open()` geri getirir); kimliği bilinen
ziyaretçiye ön-form çizilmez; bitiş ekranında puanlama bağlantısı (eşik ve
adres sunucudan); ziyaretçi yalnız fotoğraf yükler.

## 2026-08-28 (2. tur) — Ziyaretçi konu seçimi

`bootstrap` yanıtındaki `topics[]` iki yüzeyde de karşılık buldu:

- **Widget**: ön-formda konu seçici. Konu HER ZAMAN isteğe bağlıdır (ön-form
  zorunlu olsa bile): konusunu bilmeyen ziyaretçiyi kapıda tutmak, gelmeyecek
  bir mesaj demektir. Seçim ilk konuşma açılırken gönderilir — form doldurulup
  hiç yazılmadan kapatılabilir.
- **App yüzeyi** (`ChatSession`): `state.topics`, `setTopic(slug)`;
  `startConversation` konuyu taşır. Konuşma açıldıktan sonra `setTopic`
  etkisizdir — ziyaretçinin kendi konuşmasını yeniden sınıflandırması atamayı
  bozardı.

## 2026-08-28 — Tek anahtar + üretim adresi pakete taşındı

`.env` artık tek satır: `SIGNALBIRD_KEY=sb_…`. Gönderim ve yönetim istemcileri
bu anahtara düşer (`SIGNALBIRD_MESSAGING_KEY` / `SIGNALBIRD_API_KEY` isteğe
bağlı kaldı — yalnız bir sunucunun yetkisini daraltmak için). Telsiz istemcisi
de aynı anahtarı taşır: kontrol düzlemi 28 Ağu'da takım anahtarıyla log
yazımını açtı.

**Varsayılan kök `https://live.signalbird.io/api` oldu** — 10 dilde birden
(node, php, python, go, dotnet, swift, kotlin, tarayıcı, app, widget) ve Laravel
config'inde. Eski varsayılan (`signalbird.io/api`) pazarlama sitesine bakıyordu;
adresi yazmayan her kurulum sessizce 404 alıyordu. `SIGNALBIRD_URL` yalnız
kendi kurulumu/sandbox için kaldı.

README "İki anahtar, iki paket" bölümü "Tek anahtar" olarak yeniden yazıldı;
`docs/CONTRACT.md § 2` takım anahtarını kimlik tablosuna aldı.

## 2026-08-27 — Gömme (embed) yüzeyi — v1.6.0

Altıncı yüzey ve tek TARAYICI yüzeyi: partner, Signalbird panel ekranını kendi
panelinin içinde çalıştırır. Ekran kopyalanmaz; çalışan ekranın kendisi gelir.

| Giriş | Kullanım |
|---|---|
| `signalbird/embed` (npm) | `createEmbed({module, mint}).mount('#kap')` |
| `signalbird.js` (script) | `Signalbird.embed({module, mint}).mount('#kap')` |

`mount` · `refresh` · `setTheme` · `destroy` · `on('ready'|'error'|'height')`.
Jetonu SDK üretmez: `mint` ev sahibinin ucudur, partner anahtarı sunucuda kalır.
Yükseklik `postMessage` ile gelir ve gönderen `event.source` ile doğrulanır;
iframe `sandbox` + `referrerpolicy` ile kurulur (top-navigation YOK).

Sözleşme: `docs/CONTRACT.md § 13`. Diğer dillerde karşılığı yoktur (DOM yüzeyi).

## Packagist yayın hazırlığı — 2026-08-21

npm `signalbird@1.4.0` yayınlandı. Packagist tarafına geçerken paketin
**tüketiciye ne indirdiği** ölçüldü ve üç engel çıktı.

### 1. Etiket yanlış paket adını taşıyor

`v1.4.0` etiketi `b5134c7` commit'ine bakıyor; o commit'in `composer.json`
adı hâlâ **`signalbird/sdk`**. Ad değişikliği (`pariette/signalbird`) bir
sonraki commit'te (`df50a8f`) geldi.

Packagist paket adını kayıttan değil **her etiketin kendi composer.json**'ından
okur; ayrışırsa o sürümü sessizce yok sayar. `pariette/signalbird` kaydedilse
paket **yalnız `dev-main`** olarak görünür, `^1.4` kısıtı hiçbir şey çözmezdi.

CI'ya denetim eklendi: etiketli derlemede `composer.json` adı
`pariette/signalbird` değilse durur.

### 2. Tüketici 43 MB derleme çıktısı indirecekti

`.build/` (Swift, **1301 dosya**), `.gradle/` (18) ve `bin/` (4) commit'lenmiş
ve `v1.4.0` etiketine girmişti. Ölçüm:

| | Dosya |
|---|--:|
| Etiketteki izlenen dosya | 1475 |
| Tüketicinin indireceği (önce) | **1340** |
| Bunun gerçek PHP kaynağı | 11 |
| Tüketicinin indireceği (sonra) | **15** · 140 KB |

**Kritik ayrım:** `composer.json` → `archive.exclude` bunu tek başına
ÇÖZMEZ. Genel Packagist, GitHub-tabanlı bir paketin "dist" adresi olarak
GitHub zipball'ını verir; onu `git archive` üretir ve yalnız `.gitattributes`
`export-ignore` kurallarını uygular. `archive.exclude` sadece
`composer archive` ve Satis içindir.

Yapılanlar:

- **`.gitattributes` eklendi** — diğer dillerin kaynağı, manifestleri, derleme
  çıktıları, testler ve geliştirme dosyaları `export-ignore`. Ölçüldü:
  zipball 2310 girdiden 24'e (15 dosya + 9 dizin) düştü.
- `.gitignore` += `.build/`, `.gradle/`, `.kotlin/`, `bin/`, `build/`, `obj/`,
  `__pycache__/`.
- `archive.exclude` += aynı yollar — ikinci kalkan; biri unutulursa diğeri tutar.
- CI'ya iki adım: her iki arşivi de ölçen sızıntı/boyut denetimi (500 KB tavan)
  ve "derleme çıktısı depoya girmiş mi" bekçisi.

Artefaktların index'ten çıkarılması **commit'lenmedi** — komut aşağıda.

### 3. Yeni PHP sınıfları denetlenmiyordu

`Partner\PartnerClient` ve `Mail\SignalbirdTransport` CI'nın autoload
listesinde yoktu.

Eklerken çıktı: `SignalbirdLogHandler`, `Mail\SignalbirdTransport`,
`SignalbirdServiceProvider` ve `Facades\Signalbird` ata sınıflarını
`suggest` paketlerden alır (monolog, symfony/mailer, illuminate/support).
`class_exists` çağırmak bunları zorla yükler ve Laravel dışı bir ortamda
**fatal error** verir — CI'yı ortamın kurulumuna bağlardı. Liste ikiye ayrıldı:
bağımlılıksız çekirdek `class_exists` ile, ata sınıfı dışarıda olanlar dosya +
sınıf adı denetimiyle (sözdizimi `php -l` zaten bakıyor).

- `symfony/mailer` **`require-dev`**'e eklendi (tüketiciyi etkilemez): taşıyıcı
  artık CI'da gerçekten yükleniyor ve test edilebiliyor.
- **`SignalbirdTransportTest` yazıldı** (9 test) — taşıyıcının hiç testi yoktu,
  oysa `MAIL_MAILER=signalbird` diyen müşterinin HER postası oradan geçiyor.
  Sınananlar: alıcı başına ayrı istek (To/Cc/Bcc), HTML→metin gövde seçimi,
  `from_name`/`reply_to` taşınması, hukuki sınıfın config'ten gelmesi, ek
  varsa açık hata, `ok:false` durumunda `TransportException` (yutulmaz).

Bir gözlem: taşıyıcının kendi "alıcı yok" koruması normal yoldan
**erişilemez** — Symfony Mime katmanı To/Cc/Bcc'siz iletiyi taşıyıcıya hiç
ulaştırmaz. Koruma yine de duruyor (taşıyıcı Symfony dışından da çağrılabilir)
ve test bu davranışı sabitliyor ki kimse "ölü kod" diye silmesin.

### Yayın öncesi kalan adımlar

```
git rm -r --cached .build .gradle bin
git add -A && git commit -m "Packagist hazırlığı: export-ignore, artefakt temizliği, taşıyıcı testleri"
# sürüm kararı (aşağı bak) → etiket → push --tags
# packagist.org/packages/submit → https://github.com/Pariette-Inc/signalbird.sdk
# GitHub → Settings → Webhooks → Packagist (otomatik güncelleme)
```

**Sürüm kararı:** `v1.4.0` etiketi yanlış paket adını taşıdığı için olduğu gibi
yayınlanamaz. İki yol var: etiketi HEAD'e taşımak (npm 1.4.0 ile aynı numara
korunur ama yayımlanmış bir etiket yeniden yazılır) ya da `1.4.1` kesip npm'e
de aynı numarayı yayınlamak (sürüm kilidi kuralı bozulmaz).

## Yayın adları — 2026-08-21

| Kayıt defteri | Ad | Durum |
|---|---|---|
| npm | `signalbird` (kapsamsız) | ad müsait, yayınlanmadı |
| Packagist | `pariette/signalbird` | ad müsait, kaydedilmedi |
| PyPI | `signalbird` | ad müsait, yayınlanmadı |
| Go | `github.com/Pariette-Inc/signalbird.sdk` | modül yolu depo adresidir, değiştirilemez |
| NuGet | `Signalbird.Sdk` | değişmedi |
| Maven | `io.signalbird:signalbird-sdk` | değişmedi |

npm'de kapsam kaldırıldı: `@signalbird/sdk` → `signalbird`, alt girişler
`signalbird/browser` · `/app` · `/react` · `/vue` · `/angular` · `/react-native`.

Composer'da **tek kelimelik ad mümkün değil**: Packagist paket adları zorunlu
olarak `satıcı/paket` biçiminde. `pariette/signalbird` seçildi.

PHP ad uzayı (`Signalbird\Sdk\…`) ve Kotlin paket yolu (`io.signalbird.sdk`)
DEĞİŞMEDİ — paket adından bağımsızdırlar, değiştirmek her tüketicinin kodunu
kırardı.

> **Tüketiciler henüz eski adda.** `veribenim.api` ve `submit.api`
> `signalbird/sdk`'yi GitHub VCS girdisiyle çekiyor. Composer paket adını
> UZAKTAKİ depodan okuduğu için yeni ad ancak bu depo push edildikten sonra
> çözülebilir; erken çevirmek deploy'u kırardı. Yayından sonra iki repoda da:
> `composer require pariette/signalbird:^1.4 && composer remove signalbird/sdk`

## 1.4.0 — 2026-08-21 · Partner beş dilde, sohbet tetikleyicileri ve raporu

### Partner yüzeyi tamamlandı

1.3.0'da yalnız Node ve PHP vardı; artık **Python, Go ve .NET** de aynı 20
metodu sunuyor (`SignalbirdPartner` / `signalbird.Partner` /
`Signalbird.Sdk.PartnerClient`). `check-parity.mjs` beş yüzeyin beşini de beş
dilde denetliyor.

### Yönetim yüzeyi 40 → 45 metot

Sunucudaki sohbet eksikleri kapandı; SDK geride kalmasın diye aynı gün eklendi:

- `listChatTriggers` `createChatTrigger` `updateChatTrigger` `deleteChatTrigger`
- `chatReport(range)` — `7d` | `30d` | `90d`

Tetikleyici = "şu olduğunda şunu yap" kural kaydı: üç olay
(`conversation.created`, `visitor.message`, `no_reply`), koşul listesi, beş
eylem. Rapor ortalama değil **ortanca + p90** döner ve veri yoksa süreler
`null` olur — `0` değil.

Beş dile birden yazıldı (node, php, python, go, dotnet).

## 1.3.0 — 2026-08-20 · Partner yüzeyi + Signalbird posta taşıyıcısı

Sözleşme: `docs/CONTRACT.md` §12 ve
`../signalbird.api/docs/PARTNER_PLATFORM_2026-08-20.md`.

### Beşinci yüzey: Partner

`SignalbirdPartner` (node) / `Signalbird\Sdk\Partner\PartnerClient` (php),
Laravel'de `Signalbird::partner()`. Anahtar `sbp_live_…`; `sb_`/`sbr_`/`sbw_pub_`
kurulum anında `WRONG_KEY_TYPE`.

20 metot: `createCompany` `listCompanies` `getCompany` `updateCompany`
`suspendCompany` `rotateKey` · `addDomain` `listDomains` `getDomain`
`verifyDomain` `removeDomain` · `domainUptime` `companyUptime` · `listModules`
`grantModule` `revokeModule` · `createUser` `listUsers` `removeUser` ·
`createEmbedToken`.

Bu yüzey `CLAUDE.md`'deki "Admin yüzeyi OLMAYACAK" kuralının **bilinçli
istisnasıdır** — gerekçesi CONTRACT §12.1'de yazılı. Kural `sb_` anahtarı için
aynen duruyor.

`scripts/check-parity.mjs` artık **beş** yüzey denetliyor (Partner: node + php).

### Posta taşıyıcısı

`Signalbird\Sdk\Mail\SignalbirdTransport` + sağlayıcıda `Mail::extend`.
`MAIL_MAILER=signalbird` ile uygulamanın HER `Mailable`'ı
`POST /v1/email/send` üzerinden gider ve Signalbird'de kayda geçer; hiçbir
Mailable sınıfı değişmez. Alıcı başına ayrı istek (Signalbird'de her alıcı ayrı
`message` kaydıdır). `From` görünen adı ve `Reply-To` korunur, zarf adresi
havuzda kalır. Hata yutulmaz (`TransportException`). **Ek gönderimi henüz
yok** — sessizce düşürmek yerine açıkça hata verir.

Yeni konfig: `signalbird.partner_key`, `signalbird.mail_class`.

## 2026-08-19 — Yönetim yüzeyi + yedi yeni dil (v1.2.0)

İstek tek cümleydi: *"müşteri ile ilgili her zerre kod SDK üzerinden
desteklensin — admin değil, müşterinin kendi projesini yönetmesi."* Paket üç
yüzeyden **dörde**, iki dilden **on iki giriş noktasına** çıktı.

| Yüzey | Yeni mi | Anahtar | Diller |
|---|---|---|---|
| Telsiz | — | `sbr_live_` / `sbr_pub_` | Node, PHP, **Python**, **Go**, **.NET**, **Swift**, **Kotlin**, tarayıcı |
| Gönderim | — | `sb_` | Node, PHP, **Python**, **Go**, **.NET** |
| **Yönetim** | ✔ 40 metot | `sb_` + `radio\|chat\|apps` scope | Node, PHP, Python, Go, .NET |
| **Uygulama** | ✔ 17 metot | `sbw_pub_` + ziyaretçi sırrı | **TypeScript**, **Swift**, **Kotlin** (+ React, Vue, Angular, React Native uyarlamaları) |

**API tarafı (signalbird.api)**

Panel uçları anahtarla erişilebilir hâle geldi; gövde değil KAPI eklendi:

- `ApiKey::SCOPES` += `radio:read|write`, `chat:read|write`, `apps:read|write`.
  `SCOPE_FALLBACKS` ile yazma scope'u okumayı kapsar — ikisini ayrı ayrı
  işaretlemeye zorlamak, ilk entegrasyonda 403 alıp anahtarı yeniden üretmek
  demekti.
- Yeni rota grupları: `/v1/radio/{summary,events,projects…}`, `/v1/apps…`,
  `/v1/chat/…` — hepsi `api-key:<scope>` ile korunuyor. Panel rotaları
  (`/v1/panel/*`) aynen duruyor.
- `RadioPanelController`, `AppController` ve `ChatPanelController::team()`
  artık `api_key_team` niteliğini önce okuyor (`ContactController` deseni).
- Sohbette "ajan" **anahtarı üreten kullanıcıdır** (`ChatPanelController::actor`).
  Sahipsiz miras anahtar yazma yapamaz: gelen kutusundaki her satırın bir
  sahibi olmalı. `canManage` anahtar modunda scope'a bakar — anahtarı üreten
  kişi sonradan yetkisini kaybederse entegrasyon durmasın.
- Testler: `ManagementApiTest` (10), `Chat/ChatAgentKeyTest` (7). Panel
  regresyonu için 82 test yeşil.

**SDK tarafı**

- **Yönetim istemcisi** (`SignalbirdManagement` / `ManagementClient`) — Gönderim
  ile aynı anahtar ailesi ama ayrı sınıf: biri ileti gönderip kota harcar,
  diğeri yapılandırma değiştirir. Tek sınıfta birleşseydi "hangi scope
  gerekiyordu" sorusu her metotta yeniden sorulurdu.
- **Uygulama istemcisi** (`SignalbirdApp`) — son kullanıcı yüzeyi. Tek gövde;
  platform farkı iki noktada toplandı ve ikisi de dışarıdan veriliyor:
  `storage` ve `fetch`. React/Vue/Angular/React Native uyarlamaları bu sınıfın
  ÜSTÜNE oturur, kopyası değildir.
- **`ChatSession`** — çatısız durum katmanı: iyimser gönderim, yoklama
  merdiveni, okunmamış sayısı, yazıyor durumu. Dört çatı buna abone olur;
  dördünde ayrı yazmak dört ayrı hata takımı üretirdi.
- **Angular dekoratör kullanmıyor.** `@Injectable()` yazsaydık paketin
  derlenmesi Angular sürümüne bağlanırdı; düz sınıf + `provideSignalbird()`
  fabrikası sürümden bağımsızdır.
- **Kotlin'de PATCH.** Android'in `HttpURLConnection`'ı PATCH bilmez; istek
  POST + `X-HTTP-Method-Override: PATCH` ile gider (Symfony/Laravel bunu
  yerleşik destekler — `Request::getMethod()`).
- **Swift'te aktör yok.** Aktör olsaydı başlık kurulumu (her istekte sırrı
  okumak) yalıtımı delmek zorunda kalır ve Swift 6'da derlenmezdi. Paylaşılan
  durum tek bir kilitli kutuda (`VisitorStore`).
- **Bağımlılık eklenmedi.** Python `urllib`, Go standart kütüphane, .NET
  `HttpClient` (+ yalnız DI uzantısında `Microsoft.Extensions.Http`), Swift
  `URLSession`, Kotlin `HttpURLConnection` + `org.json`. Tek istisna Kotlin'de
  coroutines ve o da her Android projesinde zaten var.
- **Ziyaretçi sırrı `appKey` ile mühürlü.** Anahtar döndürülürse saklanan
  kimlik yok sayılır; aksi hâlde eski sırla her çağrı 401 alır ve sohbet
  sessizce ölürdü.

**Parite.** `check-parity.mjs` artık dört küme × beş dil denetliyor ve dil
başına ad normalizasyonu yapıyor (`send_email` ↔ `SendEmail` ↔ `sendEmail`).
Bir dilin yazım geleneğini bozmak, paritenin kazandırdığından fazlasını
götürürdü. Toplam: Telsiz 7, Gönderim 20, Yönetim 40, Uygulama 17.

**Manifestler kökte.** `pyproject.toml`, `go.mod`, `Package.swift`,
`build.gradle.kts`, `Signalbird.Sdk.csproj` eklendi; `sync-version.mjs` artık
JSON olmayan manifestlerin sürüm satırını da yazıyor ve bulamazsa **hata
veriyor** — sessizce geçmek, bir paketin eski sürümle yayınlanması demekti.

**Yapılmayanlar:** Gönderim yüzeyi mobil dillerde yok (gizli anahtar telefona
gömülmez); `uploadAttachment` sözleşmede yok (dosya tipi her platformda farklı);
WebSocket taşıyıcısı yok.

## 2026-08-19 — Gönderim istemcisi + canlı sohbet widget'ı (v1.1.0)

Platform genişlemesi (`signalbird.api/docs/PLATFORM_EXPANSION_2026-08-19.md` §3).
Paket artık üç yüzey taşır; Telsiz istemcisine dokunulmadı.

| Yüzey | Giriş noktası | Kimlik | Uçlar |
|---|---|---|---|
| Gönderim — Node | `signalbird` → `SignalbirdMessaging`, `verifyWebhook` | `Authorization: Bearer sb_…` | `POST /v1/email/send`, `/v1/sms/send`, `/v1/sms/preview`, `/v1/push/send`; `GET/POST /v1/contacts`, `PATCH/DELETE /v1/contacts/{id}`, `POST /v1/contacts/bulk`; `GET/POST /v1/contact-lists`, `DELETE /v1/contact-lists/{id}`; `GET/POST /v1/campaigns`, `GET /v1/campaigns/{id}`, `POST /v1/campaigns/{id}/cancel`, `GET /v1/campaigns/{id}/messages`; `GET /v1/messages`, `GET /v1/messages/{id}` |
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
| `signalbird` (Node 18+) | `Authorization: Bearer sbr_live_…` | `POST /api/v1/radio/log`, `POST /api/v1/radio/log/batch` |
| `signalbird/browser` | `X-Signalbird-Key: sbr_pub_…` (+ `Origin`) | aynı uçlar; sekme kapanışında `?key=` sorgu parametresiyle `sendBeacon` |
| `pariette/signalbird` (PHP/Laravel) | `Authorization: Bearer sbr_live_…` | aynı uçlar |

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
