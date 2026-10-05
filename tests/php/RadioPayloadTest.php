<?php

namespace Signalbird\Sdk\Tests;

use PHPUnit\Framework\TestCase;
use Signalbird\Sdk\RadioPayload;

/**
 * Telsiz gövdesinin sunucuya uygun hâle getirilmesi (2.9.0).
 *
 * İki sessiz kayıp sınanır: 4000 karakteri aşan mesajın bütün toplu paketi
 * 422 ile düşürmesi ve `context` içindeki istisnanın `{}` olarak gitmesi.
 */
class RadioPayloadTest extends TestCase
{
    public function test_kisa_mesaj_degismez(): void
    {
        $this->assertSame('ödeme düştü', RadioPayload::message('ödeme düştü'));
    }

    /** Sınır KARAKTERdir, bayt değil: çok baytlı harf ortadan bölünmemeli. */
    public function test_uzun_mesaj_4000_karaktere_kirpilir(): void
    {
        $message = RadioPayload::message(str_repeat('ğ', 5000));

        $this->assertSame(4000, mb_strlen($message, 'UTF-8'));
        $this->assertTrue(mb_check_encoding($message, 'UTF-8'));
    }

    public function test_context_icindeki_istisna_okunur_diziye_cevrilir(): void
    {
        $previous = new \InvalidArgumentException('iç sebep', 7);
        $context = RadioPayload::context([
            'exception' => new \RuntimeException('ödeme düğümü öldü', 42, $previous),
            'nested' => ['error' => new \LogicException('derinde')],
            'order' => 'S-1234',
        ]);

        $this->assertSame(\RuntimeException::class, $context['exception']['class']);
        $this->assertSame('ödeme düğümü öldü', $context['exception']['message']);
        $this->assertSame(42, $context['exception']['code']);
        $this->assertSame(__FILE__, $context['exception']['file']);
        $this->assertIsInt($context['exception']['line']);
        $this->assertIsList($context['exception']['trace']);
        $this->assertLessThanOrEqual(20, count($context['exception']['trace']));
        $this->assertSame('iç sebep', $context['exception']['previous']['message']);
        $this->assertSame(\LogicException::class, $context['nested']['error']['class']);
        $this->assertSame('S-1234', $context['order']);

        // Asıl iddia: JSON'a çevrildiğinde bilgi `{}` olarak kaybolmaz.
        $this->assertStringContainsString('ödeme düğümü öldü', json_encode($context, JSON_UNESCAPED_UNICODE));
    }

    public function test_bos_context_null_kalir(): void
    {
        $this->assertNull(RadioPayload::context(null));
    }
}
