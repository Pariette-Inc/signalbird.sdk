<?php

return [
    /*
    |--------------------------------------------------------------------------
    | API Key
    |--------------------------------------------------------------------------
    | Signalbird panelinden oluşturduğunuz SDK API anahtarı.
    | Ortam değişkeni: SIGNALBIRD_API_KEY
    */
    'api_key' => env('SIGNALBIRD_API_KEY', ''),

    /*
    |--------------------------------------------------------------------------
    | Mod
    |--------------------------------------------------------------------------
    | 'production' → https://live.signalbird.io/api
    | 'test'       → http://localhost/api
    */
    'mode' => env('SIGNALBIRD_MODE', 'production'),

    /*
    |--------------------------------------------------------------------------
    | Timeout
    |--------------------------------------------------------------------------
    | HTTP isteği için saniye cinsinden zaman aşımı.
    */
    'timeout' => env('SIGNALBIRD_TIMEOUT', 10),
];
