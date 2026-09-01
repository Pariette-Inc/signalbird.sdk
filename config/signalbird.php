<?php

return [

    /*
    |--------------------------------------------------------------------------
    | TEK ANAHTAR — `SIGNALBIRD_DOMAIN_KEY`
    |--------------------------------------------------------------------------
    | Sözleşme: ../signalbird.api/docs/KEY_ARCHITECTURE_2026-09-01.md
    |
    | KARAR 1 Eyl 2026 (Ahmet): dört anahtar ailesi (`sb_`, `sbr_*`,
    | `sbw_pub_`, `sbp_live_`) ve 17 elemanlı scope listesi kaldırıldı.
    | Geriye TEK kavram kaldı: alan adının anahtarı.
    |
    | Gizli anahtar (`sb_secret_live_…`) bu dosyanın okuduğu tek şeydir ve
    | kurulumun TAMAMIDIR: gönderim (e-posta/SMS/push), kişi ve kampanya,
    | yönetim (sohbet, kanal, domain) ve Telsiz log yazımı aynı anahtarla
    | çalışır. Yüzey başına ayrı anahtar YOKTUR — 28 Ağu 2026'da "bir tane
    | signalbird anahtarı yeterli olmalı" denmişti; artık gerçekten öyle.
    |
    | Panel → Alan adları → [alan adı] → Anahtarlar. Anahtar bir kez görünür;
    | kaybedilirse yenisi üretilir ve eskisi iptal edilir (sayı sınırsızdır).
    */
    'domain_key' => env('SIGNALBIRD_DOMAIN_KEY', ''),

    /*
    | Tarayıcıya/mobile inen AÇIK anahtar (`sb_public_live_…`).
    |
    | PHP tarafında yalnız görünüme (Blade'e gömülen widget etiketi) gerekir;
    | sunucu istemcileri bunu KULLANMAZ ve verilirse reddeder.
    */
    'public_key' => env('SIGNALBIRD_PUBLIC_KEY', ''),

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

    /* Gönderim istek zaman aşımı (sn). Toplu kişi yükleme uzun sürebilir. */
    'messaging_timeout' => env('SIGNALBIRD_MESSAGING_TIMEOUT', 15),

    /*
    | Posta taşıyıcısı (`MAIL_MAILER=signalbird`) hangi ileti sınıfını
    | kullansın. Hukuki kapı: `commercial` iletide RFC 8058 çıkış zorunludur ve
    | onu kampanya yolu üretir — bu taşıyıcıdan işlemsel posta çıkar.
    */
    'mail_class' => env('SIGNALBIRD_MAIL_CLASS', 'transactional'),

];
