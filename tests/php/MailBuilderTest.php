<?php

namespace Signalbird\Sdk\Tests;

use PHPUnit\Framework\TestCase;
use Signalbird\Sdk\Mail\MailBuilder;
use Signalbird\Sdk\Messaging\MessagingClient;
use Signalbird\Sdk\SignalbirdException;

/**
 * `Signalbird::mail()` — zincirlenebilir e-posta gönderimi.
 *
 * Sınanan değişmezler:
 *  - ileti SINIFI zorunludur, varsayılanı yoktur (hukukî kapı)
 *  - şablon ya da (konu + gövde): biri olmadan gönderim yok
 *  - şablon adla da kimlikle de seçilebilir
 */
class MailBuilderTest extends TestCase
{
    /** İstek atmayan istemci: yalnız gövdenin şeklini sınıyoruz. */
    private function builder(): MailBuilder
    {
        return new MailBuilder(new MessagingClient('sb_'.str_repeat('x', 32)));
    }

    public function test_sinif_zorunlu(): void
    {
        $this->expectException(SignalbirdException::class);
        $this->expectExceptionMessageMatches('/ileti sınıfı zorunlu/');

        $this->builder()->to('ayse@ornek.com')->subject('K')->html('<p>G</p>')->send();
    }

    public function test_alici_zorunlu(): void
    {
        $this->expectException(SignalbirdException::class);
        $this->expectExceptionMessageMatches('/alıcı zorunlu/');

        $this->builder()->transactional()->subject('K')->html('<p>G</p>')->send();
    }

    public function test_sablon_ya_da_govde_gerekli(): void
    {
        $this->expectException(SignalbirdException::class);
        $this->expectExceptionMessageMatches('/şablon seçin/');

        $this->builder()->to('ayse@ornek.com')->transactional()->send();
    }

    public function test_sablon_adiyla_ve_kimlikle_secilir(): void
    {
        $byName = $this->builder()
            ->to('ayse@ornek.com')
            ->template('Sipariş Onayı')
            ->vars(['ad' => 'Ayşe'])
            ->fromName('Penyu')
            ->replyTo('destek@penyu.io')
            ->transactional()
            ->payload();

        $this->assertSame('Sipariş Onayı', $byName['template']);
        $this->assertArrayNotHasKey('template_id', $byName);
        $this->assertSame(['ad' => 'Ayşe'], $byName['vars']);
        $this->assertSame('Penyu', $byName['from_name']);
        $this->assertSame('destek@penyu.io', $byName['reply_to']);
        $this->assertSame('transactional', $byName['class']);

        $byId = $this->builder()->to('a@b.c')->template(12)->commercial()->payload();

        $this->assertSame(12, $byId['template_id']);
        $this->assertArrayNotHasKey('template', $byId);
        $this->assertSame('commercial', $byId['class']);
    }
}
