<?php

namespace Signalbird\Sdk\Mail;

use Signalbird\Sdk\Messaging\MessagingClient;
use Symfony\Component\Mailer\SentMessage;
use Symfony\Component\Mailer\Transport\AbstractTransport;
use Symfony\Component\Mime\Address;
use Symfony\Component\Mime\Email;
use Symfony\Component\Mime\MessageConverter;
use Symfony\Component\Mailer\Exception\TransportException;

/**
 * Laravel posta taşıyıcısı — uygulamanın HER e-postası Signalbird üzerinden.
 *
 * Sözleşme: signalbird.api/docs/PARTNER_PLATFORM_2026-08-20.md § 7.
 *
 * Neden var: müşterinin uygulamasında onlarca `Mailable` sınıfı olur (davet,
 * rapor, form bildirimi, DSAR…). Bunları tek tek SDK çağrısına çevirmek hem
 * çok iş hem de kaçınılmaz olarak eksik kalır — biri unutulur ve o posta
 * Signalbird kayıtlarında hiç görünmez. Taşıyıcı katmanına inince tek satır
 * konfigürasyon (`MAIL_MAILER=signalbird`) yeter, hiçbir Mailable değişmez.
 *
 * Kararlar:
 *  - Alıcı başına AYRI istek: Signalbird'de her alıcı ayrı bir `message`
 *    kaydıdır (açılma/tıklama/bounce alıcıya bağlıdır). Toplu olan kampanyadır.
 *  - Varsayılan sınıf `transactional`. Bu taşıyıcıdan ticari toplu posta
 *    ÇIKMAZ; kampanya kendi ucundan gider ve RFC 8058 çıkış bağlantısını
 *    kontrol düzlemi ekler.
 *  - Hata YUTULMAZ: `TransportException` fırlatılır ki Laravel kendi hata
 *    yolunu (kuyruk yeniden denemesi, failed_jobs) işletebilsin.
 *  - Zarf adresi Signalbird havuzundan çıkar; `From` görünen adı ve `Reply-To`
 *    korunur. Gönderen alan adını çağıran seçemez — itibar bizimdir.
 */
class SignalbirdTransport extends AbstractTransport
{
    /**
     * @param  string  $class  `transactional` | `commercial` — hukuki kapı,
     *                         varsayılanı yoktur diye config'ten açıkça gelir.
     */
    public function __construct(
        private readonly MessagingClient $client,
        private readonly string $class = 'transactional',
        private readonly ?string $channel = null,
    ) {
        parent::__construct();
    }

    protected function doSend(SentMessage $message): void
    {
        $email = MessageConverter::toEmail($message->getOriginalMessage());

        $recipients = array_merge($email->getTo(), $email->getCc(), $email->getBcc());

        if ($recipients === []) {
            throw new TransportException('Signalbird: iletide alıcı yok.');
        }

        $payload = [
            'class' => $this->class,
            'subject' => $email->getSubject() ?? '',
            'body' => $this->body($email),
        ];

        /*
         * GÖNDERİCİ KANALI (2 Eyl 2026): From adresini kanal seçer — Telsiz'in
         * radio('kanal') modeli. `config/mail.php` içinde
         *   'signalbird' => ['transport' => 'signalbird', 'channel' => 'noreply']
         * KODA yazılır (kanal adı sırlardan değildir, env gerektirmez).
         * Kanalsız kurulum eskisi gibi varsayılan gönderen adrese düşer.
         */
        if ($this->channel !== null && $this->channel !== '') {
            $payload['module_key'] = $this->channel;
        }

        if ($fromName = $this->fromName($email)) {
            $payload['from_name'] = $fromName;
        }

        if ($replyTo = $this->firstAddress($email->getReplyTo())) {
            $payload['reply_to'] = $replyTo;
        }

        /*
         * Ekler (2 Eyl 2026): düz ekler taşınır — base64 olarak API'ye gider,
         * mesajla saklanır ve düğüm MIME'a döker. Toplam boyut sınırı sunucuda
         * (7 MB çözülmüş, ATTACHMENTS_TOO_LARGE).
         *
         * CID/inline gömme HÂLÂ taşınmaz (multipart/related düğümde yok);
         * sessizce düşürmek görselin kaybolması demek olurdu — açıkça reddedilir.
         * Gömülü görsel yerine barındırılmış https adresi kullanın.
         */
        $attachments = [];

        foreach ($email->getAttachments() as $part) {
            if (strtolower((string) $part->getDisposition()) === 'inline') {
                throw new TransportException(
                    'Signalbird: gömülü (CID/inline) içerik taşınmıyor; görseli barındırıp '
                    . 'HTML gövdede https adresiyle kullanın. Düz dosya ekleri desteklenir.'
                );
            }

            $attachments[] = [
                'filename' => $part->getFilename() ?: 'ek',
                'mime' => $part->getMediaType().'/'.$part->getMediaSubtype(),
                'content_b64' => base64_encode($part->getBody()),
            ];
        }

        if ($attachments !== []) {
            $payload['attachments'] = $attachments;
        }

        foreach ($recipients as $recipient) {
            $result = $this->client->sendEmail($payload + ['to' => $recipient->getAddress()]);

            if (! ($result['ok'] ?? false)) {
                throw new TransportException(sprintf(
                    'Signalbird: e-posta gönderilemedi (%s) — %s',
                    $result['code'] ?? 'UNKNOWN',
                    $result['message'] ?? 'bilinmeyen hata',
                ));
            }
        }
    }

    /**
     * HTML varsa o gider; yoksa düz metin. Signalbird tarafında gövde tek
     * alandır ve HTML kabul eder — düz metin de geçerli bir gövdedir.
     */
    private function body(Email $email): string
    {
        $html = $email->getHtmlBody();

        if (is_resource($html)) {
            $html = stream_get_contents($html) ?: null;
        }

        if (is_string($html) && $html !== '') {
            return $html;
        }

        $text = $email->getTextBody();

        if (is_resource($text)) {
            $text = stream_get_contents($text) ?: '';
        }

        return (string) $text;
    }

    private function fromName(Email $email): ?string
    {
        $from = $email->getFrom();

        return $from === [] ? null : ($from[0]->getName() ?: null);
    }

    /** @param  array<int, Address>  $addresses */
    private function firstAddress(array $addresses): ?string
    {
        return $addresses === [] ? null : $addresses[0]->getAddress();
    }

    public function __toString(): string
    {
        return 'signalbird';
    }
}
