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

];
