<?php

namespace Signalbird\Sdk;

use Monolog\Handler\AbstractProcessingHandler;
use Monolog\Level;
use Monolog\LogRecord;

/**
 * Laravel/Monolog kanalı.
 *
 * `config/logging.php` içine:
 *
 *   'signalbird' => [
 *       'driver' => 'monolog',
 *       'handler' => \Signalbird\Sdk\SignalbirdLogHandler::class,
 *       'with' => ['channel' => 'laravel'],
 *   ],
 *
 * Monolog seviyeleri Telsiz seviyelerine eşlenir. `emergency`/`alert` gibi
 * ayrımlar korunmaz: Telsiz'de beş seviye vardır ve fazlası kanal ayarını
 * karmaşıklaştırmaktan başka işe yaramaz.
 */
class SignalbirdLogHandler extends AbstractProcessingHandler
{
    public function __construct(
        private string $channel = 'laravel',
        int|string|Level $level = Level::Error,
        bool $bubble = true,
    ) {
        parent::__construct($level, $bubble);
    }

    protected function write(LogRecord $record): void
    {
        app(SignalbirdClient::class)->log(
            channel: $this->channel,
            message: $record->message,
            level: $this->mapLevel($record->level),
            context: $record->context ?: null,
        );
    }

    private function mapLevel(Level $level): string
    {
        return match (true) {
            $level->value >= Level::Critical->value => 'critical',
            $level->value >= Level::Error->value => 'error',
            $level->value >= Level::Warning->value => 'warn',
            $level->value >= Level::Info->value => 'info',
            default => 'debug',
        };
    }
}
