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
        return new MailBuilder(new MessagingClient('sb_secret_live_'.str_repeat('x', 32)));
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

    public function test_kanal_ve_ekler_payloada_girer(): void
    {
        // sendMail('kanal') deseni: modül anahtarı gövdede taşınır, From
        // adresini sunucu kanaldan çözer (2 Eyl 2026).
        $payload = $this->builder()
            ->channel('noReply')
            ->to('ayse@ornek.com')
            ->subject('Makbuz')
            ->body('<p>Makbuzunuz ektedir.</p>')
            ->attach('makbuz.pdf', 'PDFICERIK', 'application/pdf')
            ->attach('fatura.csv', 'a;b;c')
            ->transactional()
            ->payload();

        $this->assertSame('noReply', $payload['module_key']);
        $this->assertSame('<p>Makbuzunuz ektedir.</p>', $payload['body']);
        $this->assertCount(2, $payload['attachments']);
        $this->assertSame('makbuz.pdf', $payload['attachments'][0]['filename']);
        $this->assertSame('application/pdf', $payload['attachments'][0]['mime']);
        $this->assertSame(base64_encode('PDFICERIK'), $payload['attachments'][0]['content_b64']);
        $this->assertArrayNotHasKey('mime', $payload['attachments'][1]);
    }
}
