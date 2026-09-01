<?php

namespace Signalbird\Sdk\Tests;

use PHPUnit\Framework\TestCase;
use Signalbird\Sdk\RadioChannel;
use Signalbird\Sdk\SignalbirdClient;

/**
 * `Signalbird::radio('kanal')->error(…)` — kanalı bir kez bağla, sonra yaz.
 *
 * Sınanan şey HTTP değil, kanal adının doğru yere gitmesi: şeker katmanı
 * yanlış anahtarı gönderirse hata sessizdir — kayıt başka bir kanala düşer ve
 * kimse fark etmez.
 */
class RadioChannelTest extends TestCase
{
    private function client(): SignalbirdClient
    {
        return new SignalbirdClient('sb_secret_live_'.str_repeat('x', 32));
    }

    public function test_radio_kanal_bagli_yazac_doner(): void
    {
        $this->assertInstanceOf(RadioChannel::class, $this->client()->radio('penyuCritical'));
    }

    /**
     * Kanal adı her seviyede AYNI kalmalı. Şeker katmanının tek işi bu; adı
     * bir metotta kaybederse kayıt yanlış kanala düşer.
     */
    public function test_her_seviye_ayni_kanala_yazar(): void
    {
        $spy = new class ('sb_secret_live_'.str_repeat('x', 32)) extends SignalbirdClient {
            /** @var list<array{0: string, 1: string, 2: ?string}> */
            public array $calls = [];

            public function log(string $key, string $message, ?string $level = null, ?array $context = null): array
            {
                $this->calls[] = [$key, $message, $level];

                return ['ok' => true];
            }
        };

        $channel = $spy->radio('penyuTraffic');

        $channel->debug('d');
        $channel->info('i');
        $channel->warn('w');
        $channel->error('e');
        $channel->critical('c');
        $channel->log('serbest');

        $this->assertCount(6, $spy->calls);

        foreach ($spy->calls as $call) {
            $this->assertSame('penyuTraffic', $call[0]);
        }

        $this->assertSame(
            ['debug', 'info', 'warn', 'error', 'critical', null],
            array_column($spy->calls, 2),
        );
    }

    /** Toplu yazımda kanal her satıra eklenir; çağıran tekrar yazmaz. */
    public function test_toplu_yazimda_kanal_her_satira_eklenir(): void
    {
        $spy = new class ('sb_secret_live_'.str_repeat('x', 32)) extends SignalbirdClient {
            /** @var array<int, mixed> */
            public array $events = [];

            public function batch(array $events): array
            {
                $this->events = $events;

                return ['accepted' => count($events), 'total' => count($events), 'results' => []];
            }
        };

        $spy->radio('penyuInfo')->batch([
            ['message' => 'ilk'],
            ['message' => 'ikinci', 'level' => 'warn'],
        ]);

        $this->assertSame('penyuInfo', $spy->events[0]['key']);
        $this->assertSame('penyuInfo', $spy->events[1]['key']);
        $this->assertSame('warn', $spy->events[1]['level']);
    }
}
