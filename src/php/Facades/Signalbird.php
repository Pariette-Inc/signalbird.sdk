<?php

namespace Signalbird\Sdk\Facades;

use Illuminate\Support\Facades\Facade;
use Signalbird\Sdk\Management\ManagementClient;
use Signalbird\Sdk\Messaging\MessagingClient;
use Signalbird\Sdk\Partner\PartnerClient;

/**
 * Telsiz cephesi. Yedi log metodu `SignalbirdClient`'a yönlendirilir;
 * Gönderim (e-posta/SMS/push, kişi, kampanya) için `Signalbird::messaging()`,
 * Yönetim (Telsiz projesi, sohbet gelen kutusu, uygulama) için
 * `Signalbird::management()` konteynerdeki tekili döner.
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
 * @see \Signalbird\Sdk\Management\ManagementClient
 * @see \Signalbird\Sdk\Partner\PartnerClient
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

    /**
     * Yönetim istemcisi. Laravel konteyneri varsa oradaki tekil
     * (`signalbird.management`), yoksa ortam değişkenlerinden kurulan örnek.
     */
    public static function management(): ManagementClient
    {
        return static::$app
            ? static::$app->make(ManagementClient::class)
            : \Signalbird\Sdk\Signalbird::management();
    }

    /**
     * Partner istemcisi — yalnız sözleşmeli platformlar (veribenim, submitcms).
     * Laravel konteyneri varsa oradaki tekil (`signalbird.partner`).
     */
    public static function partner(): PartnerClient
    {
        return static::$app
            ? static::$app->make(PartnerClient::class)
            : \Signalbird\Sdk\Signalbird::partner();
    }
}
