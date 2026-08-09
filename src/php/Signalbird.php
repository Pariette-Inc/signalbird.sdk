<?php

namespace Signalbird\Sdk;

class Signalbird
{
    private SignalbirdClient $client;

    public function __construct(string $apiKey, string $mode = 'production', int $timeout = 10)
    {
        $this->client = new SignalbirdClient($apiKey, $mode, $timeout);
    }

    /**
     * Bilgi bildirimi gönder.
     */
    public function info(string $title, string $message): array
    {
        return $this->client->trigger($title, $message, 'info');
    }

    /**
     * Uyarı bildirimi gönder.
     */
    public function warn(string $title, string $message): array
    {
        return $this->client->trigger($title, $message, 'warn');
    }

    /**
     * Hata bildirimi gönder.
     */
    public function error(string $title, string $message): array
    {
        return $this->client->trigger($title, $message, 'error');
    }

    /**
     * Kritik alarm gönder (sesli + yüksek öncelikli push).
     */
    public function critical(string $title, string $message): array
    {
        return $this->client->trigger($title, $message, 'critical');
    }

    /**
     * Onay/başarı bildirimi gönder.
     */
    public function confirm(string $title, string $message): array
    {
        return $this->client->trigger($title, $message, 'confirm');
    }

    /**
     * Debug bildirimi gönder.
     */
    public function debug(string $title, string $message): array
    {
        return $this->client->trigger($title, $message, 'debug');
    }

    /**
     * Özel seviyede bildirim gönder.
     */
    public function send(string $title, string $message, string $level = 'info'): array
    {
        return $this->client->trigger($title, $message, $level);
    }
}
