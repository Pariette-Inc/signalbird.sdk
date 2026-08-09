<?php

namespace Signalbird\Sdk;

use Illuminate\Support\ServiceProvider;

class SignalbirdServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->mergeConfigFrom(__DIR__ . '/../config/signalbird.php', 'signalbird');

        $this->app->singleton(Signalbird::class, function ($app) {
            $config = $app['config']['signalbird'];

            return new Signalbird(
                apiKey:  $config['api_key'] ?? '',
                mode:    $config['mode'] ?? 'production',
                timeout: $config['timeout'] ?? 10,
            );
        });

        $this->app->alias(Signalbird::class, 'signalbird');
    }

    public function boot(): void
    {
        if ($this->app->runningInConsole()) {
            $this->publishes([
                __DIR__ . '/../config/signalbird.php' => config_path('signalbird.php'),
            ], 'signalbird-config');
        }
    }
}
