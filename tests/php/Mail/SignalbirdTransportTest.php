<?php

namespace Signalbird\Sdk\Tests\Mail;

use PHPUnit\Framework\TestCase;
use Signalbird\Sdk\Mail\SignalbirdTransport;
use Signalbird\Sdk\Tests\Messaging\FakeMessagingClient;
use Symfony\Component\Mailer\Envelope;
use Symfony\Component\Mailer\Exception\TransportException;
use Symfony\Component\Mime\Address;
use Symfony\Component\Mime\Email;

/**
 * Laravel posta taşıyıcısı (`MAIL_MAILER=signalbird`).
 *
 * Taşıyıcı, müşterinin uygulamasındaki HER `Mailable`'ın geçtiği yerdir; bir
 * hatası tek bir çağrıyı değil tüm posta akışını bozar. Bu yüzden sınanan şey
 * "gönderiyor mu" değil, **ne gönderdiği**: kaç istek çıkıyor, gövde hangisi,
 * hukuki sınıf ne, hata yutuluyor mu.
 *
 * `symfony/mailer` yalnız `require-dev`'dedir — tüketici Laravel dışındaysa
 * bu sınıf hiç yüklenmez.
 */
final class SignalbirdTransportTest extends TestCase
{
    private function send(Email $email, FakeMessagingClient $client, string $class = 'transactional'): void
    {
        (new SignalbirdTransport($client, $class))->send($email, Envelope::create($email));
    }

    private function baseEmail(): Email
    {
        return (new Email())
            ->from(new Address('gonderen@ornek.com', 'Örnek AŞ'))
            ->to('ahmet@example.com')
            ->subject('Siparişiniz yola çıktı')
            ->html('<p>Kargo takip no: 1234</p>');
    }

    public function testTekAliciTekIstekOlur(): void
    {
        $client = (new FakeMessagingClient())->queueJson(202, ['id' => 'msg_1']);

        $this->send($this->baseEmail(), $client);

        $this->assertCount(1, $client->calls);
        $this->assertSame('POST', $client->calls[0]['method']);
        $this->assertSame('/v1/email/send', $client->calls[0]['path']);

        $body = $client->calls[0]['body'];
        $this->assertSame('ahmet@example.com', $body['to']);
        $this->assertSame('transactional', $body['class']);
        $this->assertSame('Siparişiniz yola çıktı', $body['subject']);
        $this->assertSame('<p>Kargo takip no: 1234</p>', $body['body']);
        $this->assertSame('Örnek AŞ', $body['from_name']);
    }

    public function testHerAliciAyriIstekAlir(): void
    {
        // Signalbird'de her alıcı ayrı bir `message` kaydıdır: açılma, tıklama
        // ve bounce alıcıya bağlıdır. To/Cc/Bcc tek istekte birleştirilseydi
        // bu üç olay kime ait olduğu bilinmeden kaydedilirdi.
        $client = (new FakeMessagingClient())
            ->queueJson(202, ['id' => 'msg_1'])
            ->queueJson(202, ['id' => 'msg_2'])
            ->queueJson(202, ['id' => 'msg_3']);

        $email = $this->baseEmail()->cc('veli@example.com')->bcc('gizli@example.com');

        $this->send($email, $client);

        $this->assertCount(3, $client->calls);
        $this->assertSame(
            ['ahmet@example.com', 'veli@example.com', 'gizli@example.com'],
            array_map(fn (array $call) => $call['body']['to'], $client->calls),
        );
    }

    public function testHtmlYoksaDuzMetinGovdeOlur(): void
    {
        $client = (new FakeMessagingClient())->queueJson(202, []);

        $email = (new Email())
            ->from('gonderen@ornek.com')
            ->to('ahmet@example.com')
            ->subject('Bilgi')
            ->text('Düz metin gövde');

        $this->send($email, $client);

        $this->assertSame('Düz metin gövde', $client->calls[0]['body']['body']);
    }

    public function testReplyToKorunur(): void
    {
        $client = (new FakeMessagingClient())->queueJson(202, []);

        $this->send($this->baseEmail()->replyTo('destek@ornek.com'), $client);

        $this->assertSame('destek@ornek.com', $client->calls[0]['body']['reply_to']);
    }

    public function testSinifYapilandirmadanGelir(): void
    {
        $client = (new FakeMessagingClient())->queueJson(202, []);

        $this->send($this->baseEmail(), $client, 'commercial');

        $this->assertSame('commercial', $client->calls[0]['body']['class']);
    }

    public function testAliciyiOnceSymfonyReddeder(): void
    {
        // Taşıyıcıdaki `alıcı yok` koruması ikinci savunma hattıdır ve normal
        // yoldan ERİŞİLEMEZ: Symfony'nin Mime katmanı To/Cc/Bcc'siz bir
        // iletiyi taşıyıcıya hiç ulaştırmadan reddeder. Bunu burada
        // sabitliyoruz ki ileride biri "ölü kod" diye o korumayı silmesin —
        // taşıyıcı Symfony dışından da çağrılabilir.
        $email = (new Email())->from('gonderen@ornek.com')->subject('Boş')->text('gövde');

        $this->expectException(\Symfony\Component\Mime\Exception\LogicException::class);

        (new SignalbirdTransport(new FakeMessagingClient()))->send(
            $email,
            new Envelope(new Address('gonderen@ornek.com'), [new Address('zarf@ornek.com')]),
        );
    }

    public function testDuzEkPayloadaTasinir(): void
    {
        // 2 Eyl 2026: ek desteği geldi — düğüm multipart/mixed üretir.
        // İçerik base64 taşınır; boyut sınırı sunucudadır (7 MB).
        $client = (new FakeMessagingClient())->queueJson(202, ['id' => 'm_1', 'status' => 'queued']);

        $email = $this->baseEmail()->attach('fatura icerigi', 'fatura.pdf', 'application/pdf');

        $this->send($email, $client);

        $attachments = $client->calls[0]['body']['attachments'] ?? [];
        $this->assertCount(1, $attachments);
        $this->assertSame('fatura.pdf', $attachments[0]['filename']);
        $this->assertSame('application/pdf', $attachments[0]['mime']);
        $this->assertSame(base64_encode('fatura icerigi'), $attachments[0]['content_b64']);
    }

    public function testGomuluIcerikHalaReddedilir(): void
    {
        // CID/inline gömme düğümde yok (multipart/related üretilmiyor);
        // sessizce düşürmek görselin kaybolması demek olurdu.
        $client = new FakeMessagingClient();

        $email = $this->baseEmail()->embed('gorsel bayt', 'logo.png', 'image/png');

        $this->expectException(TransportException::class);
        $this->expectExceptionMessageMatches('/gömülü/u');

        $this->send($email, $client);
    }

    public function testGonderimBasarisizsaHataYutulmaz(): void
    {
        // Laravel'in kuyruk yeniden denemesi ve `failed_jobs` yolu ancak
        // istisna görürse işler; `ok:false` sessizce yutulsaydı posta
        // kaybolur ve hiçbir yerde iz bırakmazdı.
        $client = (new FakeMessagingClient())
            ->queueJson(422, ['code' => 'NO_CONSENT', 'message' => 'Alıcının ticari onayı yok']);

        $this->expectException(TransportException::class);
        $this->expectExceptionMessageMatches('/NO_CONSENT/');

        $this->send($this->baseEmail(), $client);
    }

    public function testTasiyiciAdiSignalbird(): void
    {
        // `config/mail.php` içindeki `'transport' => 'signalbird'` bu ada bağlıdır.
        $this->assertSame('signalbird', (string) new SignalbirdTransport(new FakeMessagingClient()));
    }
}
