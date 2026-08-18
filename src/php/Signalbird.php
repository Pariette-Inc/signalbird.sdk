<?php

namespace Signalbird\Sdk;

/**
 * Laravel dışı PHP projeleri için tekil erişim.
 *
 * Laravel kullanıyorsanız `Signalbird\Sdk\Facades\Signalbird` cephesini
 * kullanın — o, servis sağlayıcısı üzerinden yapılandırmayı okur.
 */
class Signalbird
{
    private static ?SignalbirdClient $client = null;

    public static function configure(
        string $apiKey,
        ?string $baseUrl = null,
        ?string $source = null,
    ): void {
        self::$client = new SignalbirdClient($apiKey, $baseUrl, $source);
    }

    public static function client(): SignalbirdClient
    {
        if (! self::$client) {
            $key = getenv('SIGNALBIRD_KEY') ?: '';
            self::$client = new SignalbirdClient(
                $key,
                getenv('SIGNALBIRD_URL') ?: null,
                getenv('SIGNALBIRD_SOURCE') ?: null,
            );
        }

        return self::$client;
    }

    /** @param array<int, mixed> $arguments */
    public static function __callStatic(string $method, array $arguments): mixed
    {
        return self::client()->{$method}(...$arguments);
    }
}
