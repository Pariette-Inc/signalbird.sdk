<?php

namespace Signalbird\Sdk;

use Signalbird\Sdk\Messaging\MessagingClient;

/**
 * Laravel dışı PHP projeleri için tekil erişim.
 *
 * Laravel kullanıyorsanız `Signalbird\Sdk\Facades\Signalbird` cephesini
 * kullanın — o, servis sağlayıcısı üzerinden yapılandırmayı okur.
 *
 * Telsiz için `Signalbird::info(...)` (statik yönlendirme), Gönderim için
 * `Signalbird::messaging()->sendEmail([...])`.
 */
class Signalbird
{
    private static ?SignalbirdClient $client = null;

    private static ?MessagingClient $messaging = null;

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

    /** Gönderim istemcisini elle yapılandırır (`sb_…` takım anahtarı). */
    public static function configureMessaging(string $apiKey, ?string $baseUrl = null): void
    {
        self::$messaging = new MessagingClient($apiKey, $baseUrl);
    }

    /**
     * Gönderim istemcisi. Yapılandırılmadıysa `SIGNALBIRD_MESSAGING_KEY` ve
     * `SIGNALBIRD_MESSAGING_URL` (yoksa `SIGNALBIRD_URL`) ortam değişkenlerinden okunur.
     */
    public static function messaging(): MessagingClient
    {
        if (! self::$messaging) {
            self::$messaging = new MessagingClient(
                getenv('SIGNALBIRD_MESSAGING_KEY') ?: '',
                (getenv('SIGNALBIRD_MESSAGING_URL') ?: null) ?: (getenv('SIGNALBIRD_URL') ?: null),
            );
        }

        return self::$messaging;
    }

    /** @param array<int, mixed> $arguments */
    public static function __callStatic(string $method, array $arguments): mixed
    {
        return self::client()->{$method}(...$arguments);
    }
}
