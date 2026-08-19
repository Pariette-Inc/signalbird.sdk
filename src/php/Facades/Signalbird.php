<?php

namespace Signalbird\Sdk\Facades;

use Illuminate\Support\Facades\Facade;
use Signalbird\Sdk\Messaging\MessagingClient;

/**
 * Telsiz cephesi. Yedi log metodu `SignalbirdClient`'a yönlendirilir;
 * Gönderim (e-posta/SMS/push, kişi, kampanya) için `Signalbird::messaging()`
 * konteynerdeki `MessagingClient` tekilini döner.
 *
 * @method static array log(string $channel, string $message, ?string $level = null, ?array $context = null)
 * @method static array debug(string $channel, string $message, ?array $context = null)
 * @method static array info(string $channel, string $message, ?array $context = null)
 * @method static array warn(string $channel, string $message, ?array $context = null)
 * @method static array error(string $channel, string $message, ?array $context = null)
 * @method static array critical(string $channel, string $message, ?array $context = null)
 * @method static array batch(array $events)
 *
 * @see \Signalbird\Sdk\SignalbirdClient
 * @see \Signalbird\Sdk\Messaging\MessagingClient
 */
class Signalbird extends Facade
{
    protected static function getFacadeAccessor(): string
    {
        return 'signalbird';
    }

    /**
     * Gönderim istemcisi. Laravel konteyneri varsa oradaki tekil
     * (`signalbird.messaging`), yoksa ortam değişkenlerinden kurulan örnek.
     */
    public static function messaging(): MessagingClient
    {
        return static::$app
            ? static::$app->make(MessagingClient::class)
            : \Signalbird\Sdk\Signalbird::messaging();
    }
}
