<?php

namespace Signalbird\Sdk;

use Illuminate\Support\ServiceProvider;
use Monolog\Logger;
use Signalbird\Sdk\Messaging\MessagingClient;

/**
 * Laravel entegrasyonu.
 *
 * Üç şey sağlar:
 *  1. `Signalbird` cephesi — konteynerden çözülen istemci.
 *  2. `signalbird` log kanalı — `Log::channel('signalbird')` ya da
 *     `LOG_STACK=single,signalbird` ile Laravel'in kendi log akışını Telsiz'e
 *     bağlar. Ayrı bir çağrı yazmadan mevcut `Log::error()` satırları çalışır.
 *  3. `signalbird.messaging` — Gönderim istemcisi (`MessagingClient`) tekili;
 *     `Signalbird::messaging()` ile erişilir.
 */
class SignalbirdServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->mergeConfigFrom(__DIR__ . '/../../config/signalbird.php', 'signalbird');

        $this->app->singleton(SignalbirdClient::class, function ($app) {
            $config = $app['config']['signalbird'];

            return new SignalbirdClient(
                apiKey: (string) $config['key'],
                baseUrl: $config['url'] ?? null,
                source: $config['source'] ?? null,
                timeout: (int) ($config['timeout'] ?? 5),
                throwOnError: (bool) ($config['throw_on_error'] ?? false),
            );
        });

        $this->app->alias(SignalbirdClient::class, 'signalbird');

        // Gönderim istemcisi: ayrı anahtar, ayrı kök. `Signalbird::messaging()`
        // cephe metodu bu tekil örneği çözer.
        $this->app->singleton(MessagingClient::class, function ($app) {
            $config = $app['config']['signalbird'];

            return new MessagingClient(
                apiKey: (string) ($config['messaging_key'] ?? ''),
                baseUrl: ($config['messaging_url'] ?? null) ?: ($config['url'] ?? null),
                timeout: (int) ($config['messaging_timeout'] ?? 15),
                throwOnError: (bool) ($config['throw_on_error'] ?? false),
            );
        });

        $this->app->alias(MessagingClient::class, 'signalbird.messaging');
    }

    public function boot(): void
    {
        if ($this->app->runningInConsole()) {
            $this->publishes([
                __DIR__ . '/../../config/signalbird.php' => config_path('signalbird.php'),
            ], 'signalbird-config');
        }
    }
}
