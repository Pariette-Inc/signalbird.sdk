<?php

namespace Signalbird\Sdk;

use Monolog\Handler\AbstractProcessingHandler;
use Monolog\Level;
use Monolog\LogRecord;

/**
 * Laravel/Monolog kanalı — uygulamanın log akışı Telsiz'e.
 *
 * `config/logging.php` içine:
 *
 *   'signalbird' => [
 *       'driver' => 'monolog',
 *       'handler' => \Signalbird\Sdk\SignalbirdLogHandler::class,
 *       'with' => ['channel' => 'laravel', 'level' => 'info'],
 *   ],
 *
 * Sonra `LOG_STACK=single,signalbird`. Mevcut `Log::error()` satırları
 * değişmeden çalışır; ayrı bir çağrı yazılmaz.
 *
 * ── TOPLANIR, İSTEK SONUNDA TEK SEFERDE GİDER ─────────────────────────────
 *
 * Her satırı anında POST etmek, tek bir isteği onlarca HTTP çağrısına
 * çevirirdi: `debug` seviyesinde bu, sayfanın kendisinden uzun sürer.
 * Kayıtlar bellekte birikir ve istek biterken `batch()` ile tek çağrıda
 * gönderilir (Monolog `close()`'u kapanışta çağırır).
 *
 * Arka plan iş parçacığı YOKTUR (SDK kuralı): gönderim yine aynı istek
 * içinde, ama bir kez olur. Tampon 100'e ulaşırsa erken boşalır — Telsiz'in
 * toplu ucu bir çağrıda en fazla 100 olay alır.
 *
 * ── HATA YUTULUR ──────────────────────────────────────────────────────────
 *
 * Log gönderememek, asıl işin (ödeme, kayıt) çökmesi için geçerli bir sebep
 * değildir. `SignalbirdClient` zaten `throwOnError=false` ile kurulur; burada
 * ayrıca yakalanır ki istemci fırlatacak biçimde kurulmuş olsa bile kapanış
 * sırasında istek patlamasın.
 */
class SignalbirdLogHandler extends AbstractProcessingHandler
{
    /** Telsiz'in toplu ucunun tek çağrıda aldığı en fazla olay. */
    private const FLUSH_AT = 100;

    /** @var list<array{channel: string, message: string, level: string, context: ?array}> */
    private array $buffer = [];

    public function __construct(
        private string $channel = 'laravel',
        int|string|Level $level = Level::Error,
        bool $bubble = true,
    ) {
        parent::__construct($level, $bubble);
    }

    protected function write(LogRecord $record): void
    {
        $this->buffer[] = [
            'channel' => $this->channel,
            'message' => $record->message,
            'level' => $this->mapLevel($record->level),
            'context' => $record->context ?: null,
        ];

        if (count($this->buffer) >= self::FLUSH_AT) {
            $this->flush();
        }
    }

    /** Monolog kapanışta çağırır; `Log::` kullanan her istekte bir kez çalışır. */
    public function close(): void
    {
        $this->flush();

        parent::close();
    }

    public function flush(): void
    {
        if ($this->buffer === []) {
            return;
        }

        // Tampon ÖNCE boşaltılır: gönderim patlarsa aynı satırlar bir daha
        // denenmesin. Kaybolan log, sonsuz döngüde tekrarlanan logdan iyidir.
        $events = $this->buffer;
        $this->buffer = [];

        try {
            app(SignalbirdClient::class)->batch($events);
        } catch (\Throwable) {
            // Sessiz: log gönderememek isteği öldürmez.
        }
    }

    public function __destruct()
    {
        $this->flush();
    }

    /**
     * Monolog seviyeleri Telsiz seviyelerine eşlenir. `emergency`/`alert` gibi
     * ayrımlar korunmaz: Telsiz'de beş seviye vardır ve fazlası kanal ayarını
     * karmaşıklaştırmaktan başka işe yaramaz.
     */
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
