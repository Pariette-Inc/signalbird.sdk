<?php

namespace Signalbird\Sdk;

use Illuminate\Support\ServiceProvider;
use Monolog\Logger;
use Illuminate\Support\Facades\Mail;
use Signalbird\Sdk\Mail\SignalbirdTransport;
use Signalbird\Sdk\Management\ManagementClient;
use Signalbird\Sdk\Messaging\MessagingClient;
use Signalbird\Sdk\Partner\PartnerClient;

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
 *  4. `signalbird.management` — Yönetim istemcisi (`ManagementClient`) tekili;
 *     `Signalbird::management()` ile erişilir. Telsiz projesi, sohbet gelen
 *     kutusu ve uygulama kaydı buradan yönetilir.
 *  5. `signalbird.partner` — Partner istemcisi (`PartnerClient`) tekili;
 *     yalnız sözleşmeli platformlar (veribenim, submitcms) içindir.
 *  6. `signalbird` posta taşıyıcısı — `MAIL_MAILER=signalbird` ile uygulamanın
 *     HER e-postası Signalbird üzerinden gider ve orada kayda geçer.
 */
class SignalbirdServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->mergeConfigFrom(__DIR__ . '/../../config/signalbird.php', 'signalbird');

        $this->app->singleton(SignalbirdClient::class, function ($app) {
            $config = $app['config']['signalbird'];

            return new SignalbirdClient(
                domainKey: (string) ($config['domain_key'] ?? ''),
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
                domainKey: (string) ($config['domain_key'] ?? ''),
                baseUrl: ($config['messaging_url'] ?? null) ?: ($config['url'] ?? null),
                timeout: (int) ($config['messaging_timeout'] ?? 15),
                throwOnError: (bool) ($config['throw_on_error'] ?? false),
            );
        });

        $this->app->alias(MessagingClient::class, 'signalbird.messaging');

        // Yönetim istemcisi Gönderim ile AYNI anahtar ailesini kullanır
        // (`sb_…`) ama farklı scope'lar ister. Ayrı bir anahtar tanımlanmadıysa
        // gönderim anahtarına düşer — çoğu kurulumda tek anahtar vardır.
        $this->app->singleton(ManagementClient::class, function ($app) {
            $config = $app['config']['signalbird'];

            return new ManagementClient(
                domainKey: (string) ($config['domain_key'] ?? ''),
                baseUrl: ($config['messaging_url'] ?? null) ?: ($config['url'] ?? null),
                timeout: (int) ($config['messaging_timeout'] ?? 15),
                throwOnError: (bool) ($config['throw_on_error'] ?? false),
            );
        });

        $this->app->alias(ManagementClient::class, 'signalbird.management');

        // Partner istemcisi: takımlar üstü, ayrı anahtar ailesi (gizli domain anahtarı).
        // Anahtar tanımlı değilse kurucu `NO_KEY` fırlatır — bu bilinçlidir;
        // partner olmayan kurulum bu tekili hiç çözmez.
        $this->app->singleton(PartnerClient::class, function ($app) {
            $config = $app['config']['signalbird'];

            return new PartnerClient(
                domainKey: (string) ($config['domain_key'] ?? ''),
                baseUrl: ($config['messaging_url'] ?? null) ?: ($config['url'] ?? null),
                timeout: (int) ($config['messaging_timeout'] ?? 15),
                throwOnError: (bool) ($config['throw_on_error'] ?? false),
            );
        });

        $this->app->alias(PartnerClient::class, 'signalbird.partner');
    }

    public function boot(): void
    {
        // `MAIL_MAILER=signalbird` ile uygulamanın her Mailable'ı buradan
        // geçer; hiçbir Mailable sınıfı değişmez. `config/mail.php` içine
        //   'signalbird' => ['transport' => 'signalbird']
        // satırı eklenir.
        Mail::extend('signalbird', function (array $config) {
            return new SignalbirdTransport(
                $this->app->make(MessagingClient::class),
                (string) ($config['class'] ?? config('signalbird.mail_class', 'transactional')),
                // Gönderici kanalı: mailer tanımındaki 'channel' (KODA yazılır,
                // env değil), yoksa config('signalbird.mail_channel').
                ($config['channel'] ?? config('signalbird.mail_channel')) ?: null,
            );
        });

        if ($this->app->runningInConsole()) {
            $this->publishes([
                __DIR__ . '/../../config/signalbird.php' => config_path('signalbird.php'),
            ], 'signalbird-config');
        }
    }
}
