<?php

return [

    /*
    | Sunucu anahtarı (`sbr_live_…`). Telsiz panelinden proje açıldığında
    | BİR KEZ gösterilir; kaybedilirse yenilenir, geri okunamaz.
    */
    'key' => env('SIGNALBIRD_KEY', ''),

    /* Kendi kurulumunuz varsa API kökü. */
    'url' => env('SIGNALBIRD_URL', 'https://signalbird.io/api'),

    /* Her kayda eklenen köken adı — hangi sunucudan geldiği. */
    'source' => env('SIGNALBIRD_SOURCE', env('APP_ENV')),

    'timeout' => env('SIGNALBIRD_TIMEOUT', 5),

    /*
    | Hata fırlatılsın mı. Üretimde KAPALI kalmalı: log gönderememek, asıl
    | işin (ödeme, kayıt) çökmesi için geçerli bir sebep değildir.
    */
    'throw_on_error' => env('SIGNALBIRD_THROW', false),

    /*
    | Yönetim (Management) takım API anahtarı (`sb_…`) — `radio:*`, `chat:*`,
    | `apps:*` scope'larıyla. Boşsa `messaging_key` kullanılır; çoğu kurulumda
    | tek takım anahtarı vardır ve iki yüzeyi de o taşır.
    */
    'api_key' => env('SIGNALBIRD_API_KEY', ''),

    /*
    | Gönderim (Messaging) takım API anahtarı (`sb_…`). E-posta/SMS/push,
    | kişi ve kampanya uçları bu anahtarla çalışır; Telsiz anahtarından ayrıdır.
    */
    'messaging_key' => env('SIGNALBIRD_MESSAGING_KEY', ''),

    /* Gönderim API kökü. Boşsa `url` kullanılır. */
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
