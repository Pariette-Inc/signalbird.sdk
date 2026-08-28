<?php

return [

    /*
    |--------------------------------------------------------------------------
    | TEK ANAHTAR — `SIGNALBIRD_KEY`
    |--------------------------------------------------------------------------
    | KARAR 2026-08-28 (Ahmet): "2-3 farklı kayıt eklemek istemiyorum, bir tane
    | signalbird anahtarı yeterli olmalı."
    |
    | Takım anahtarı (`sb_…`) kurulumun tamamıdır: gönderim (e-posta/SMS/push),
    | kişi ve kampanya, yönetim (sohbet, uygulama, domain) ve Telsiz log yazımı
    | aynı anahtarla çalışır. Kapsamlar anahtarın kendisindedir; panelde
    | üretilirken seçilir.
    |
    | Aşağıdaki yüzeye özel anahtarlar İSTEĞE BAĞLIDIR: yalnız bir yüzeyi dar
    | kapsamlı ayrı bir anahtara bağlamak isteyen doldurur (ör. log yazan sunucu
    | gönderim yapamasın). Boşsa hepsi bu anahtara düşer.
    */
    'key' => env('SIGNALBIRD_KEY', ''),

    /*
    | API kökü. Üretim adresi paketin İÇİNDEDİR; uygulamanın `.env`'i onu
    | tekrar etmez. Yalnız kendi kurulumu (self-hosted) ya da sandbox kullanan
    | doldurur.
    */
    'url' => env('SIGNALBIRD_URL', 'https://live.signalbird.io/api'),

    /* Her kayda eklenen köken adı — hangi sunucudan geldiği. */
    'source' => env('SIGNALBIRD_SOURCE', env('APP_ENV')),

    'timeout' => env('SIGNALBIRD_TIMEOUT', 5),

    /*
    | Hata fırlatılsın mı. Üretimde KAPALI kalmalı: log gönderememek, asıl
    | işin (ödeme, kayıt) çökmesi için geçerli bir sebep değildir.
    */
    'throw_on_error' => env('SIGNALBIRD_THROW', false),

    /*
    | Yönetim (Management) yüzeyi için AYRI anahtar — `radio:*`, `chat:*`,
    | `apps:*` kapsamlarıyla. Boşsa `SIGNALBIRD_KEY` kullanılır.
    */
    'api_key' => env('SIGNALBIRD_API_KEY') ?: env('SIGNALBIRD_MESSAGING_KEY') ?: env('SIGNALBIRD_KEY', ''),

    /*
    | Gönderim (Messaging) yüzeyi için AYRI anahtar. Boşsa `SIGNALBIRD_KEY`
    | kullanılır — normal kurulumda bu satır hiç doldurulmaz.
    */
    'messaging_key' => env('SIGNALBIRD_MESSAGING_KEY') ?: env('SIGNALBIRD_KEY', ''),

    /* Gönderim için ayrı kök (nadiren gerekir). Boşsa `url` kullanılır. */
    'messaging_url' => env('SIGNALBIRD_MESSAGING_URL'),

    /* Gönderim istek zaman aşımı (sn). Toplu kişi yükleme uzun sürebilir. */
    'messaging_timeout' => env('SIGNALBIRD_MESSAGING_TIMEOUT', 15),


    /*
    | Partner anahtarı (`sbp_live_…`) — YALNIZ sözleşmeli platformlar için
    | (veribenim, submitcms). Müşteri sağlama, modül yetkisi ve gömme jetonu
    | bu anahtarla yapılır. Tarayıcıya İNMEZ.
    */
    'partner_key' => env('SIGNALBIRD_PARTNER_KEY', ''),

    /*
    | Posta taşıyıcısı (`MAIL_MAILER=signalbird`) hangi ileti sınıfını
    | kullansın. Hukuki kapı: `commercial` iletide RFC 8058 çıkış zorunludur ve
    | onu kampanya yolu üretir — bu taşıyıcıdan işlemsel posta çıkar.
    */
    'mail_class' => env('SIGNALBIRD_MAIL_CLASS', 'transactional'),

];
