<?php

namespace Signalbird\Sdk;

use Signalbird\Sdk\Management\ManagementClient;
use Signalbird\Sdk\Messaging\MessagingClient;
use Signalbird\Sdk\Partner\PartnerClient;

/**
 * Laravel dışı PHP projeleri için tekil erişim.
 *
 * Laravel kullanıyorsanız `Signalbird\Sdk\Facades\Signalbird` cephesini
 * kullanın — o, servis sağlayıcısı üzerinden yapılandırmayı okur.
 *
 * Telsiz için `Signalbird::info(...)` (statik yönlendirme), Gönderim için
 * `Signalbird::messaging()->sendEmail([...])`, Yönetim için
 * `Signalbird::management()->createRadioProject([...])`.
 */
class Signalbird
{
    private static ?SignalbirdClient $client = null;

    private static ?MessagingClient $messaging = null;

    private static ?ManagementClient $management = null;

    private static ?PartnerClient $partner = null;

    public static function configure(
        string $domainKey,
        ?string $baseUrl = null,
        ?string $source = null,
    ): void {
        self::$client = new SignalbirdClient($domainKey, $baseUrl, $source);
    }

    public static function client(): SignalbirdClient
    {
        if (! self::$client) {
            $key = getenv('SIGNALBIRD_DOMAIN_KEY') ?: '';
            self::$client = new SignalbirdClient(
                $key,
                getenv('SIGNALBIRD_URL') ?: null,
                getenv('SIGNALBIRD_SOURCE') ?: null,
            );
        }

        return self::$client;
    }

    /** Gönderim istemcisini elle yapılandırır (gizli domain anahtarı). */
    public static function configureMessaging(string $domainKey, ?string $baseUrl = null): void
    {
        self::$messaging = new MessagingClient($domainKey, $baseUrl);
    }

    /**
     * Gönderim istemcisi. Yapılandırılmadıysa `SIGNALBIRD_DOMAIN_KEY` ve
     * `SIGNALBIRD_MESSAGING_URL` (yoksa `SIGNALBIRD_URL`) ortam değişkenlerinden okunur.
     */
    public static function messaging(): MessagingClient
    {
        if (! self::$messaging) {
            self::$messaging = new MessagingClient(
                getenv('SIGNALBIRD_DOMAIN_KEY') ?: '',
                (getenv('SIGNALBIRD_MESSAGING_URL') ?: null) ?: (getenv('SIGNALBIRD_URL') ?: null),
            );
        }

        return self::$messaging;
    }

    /** Yönetim istemcisini elle yapılandırır (`sb_…` takım anahtarı). */
    public static function configureManagement(string $domainKey, ?string $baseUrl = null): void
    {
        self::$management = new ManagementClient($domainKey, $baseUrl);
    }

    /**
     * Yönetim istemcisi. Yapılandırılmadıysa `SIGNALBIRD_DOMAIN_KEY` (yoksa
     * `SIGNALBIRD_DOMAIN_KEY` — çoğu kurulumda tek takım anahtarı vardır)
     * ortam değişkeninden okunur.
     */
    public static function management(): ManagementClient
    {
        if (! self::$management) {
            self::$management = new ManagementClient(
                (getenv('SIGNALBIRD_DOMAIN_KEY') ?: null) ?: (getenv('SIGNALBIRD_DOMAIN_KEY') ?: ''),
                (getenv('SIGNALBIRD_MESSAGING_URL') ?: null) ?: (getenv('SIGNALBIRD_URL') ?: null),
            );
        }

        return self::$management;
    }

    /** @param array<int, mixed> $arguments */
    public static function __callStatic(string $method, array $arguments): mixed
    {
        return self::client()->{$method}(...$arguments);
    }

    /** Partner istemcisini elle yapılandırır (gizli domain anahtarı). */
    public static function configurePartner(string $domainKey, ?string $baseUrl = null): void
    {
        self::$partner = new PartnerClient($domainKey, $baseUrl);
    }

    /**
     * Partner istemcisi — YALNIZ sözleşmeli platformlar için. Yapılandırılmadıysa
     * `SIGNALBIRD_DOMAIN_KEY` okunur.
     */
    public static function partner(): PartnerClient
    {
        if (! self::$partner) {
            self::$partner = new PartnerClient(
                getenv('SIGNALBIRD_DOMAIN_KEY') ?: '',
                (getenv('SIGNALBIRD_MESSAGING_URL') ?: null) ?: (getenv('SIGNALBIRD_URL') ?: null),
            );
        }

        return self::$partner;
    }
}
