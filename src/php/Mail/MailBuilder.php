<?php

namespace Signalbird\Sdk\Mail;

use Signalbird\Sdk\Messaging\MessagingClient;
use Signalbird\Sdk\SignalbirdException;

/**
 * `Signalbird::mail()` — okunur bir e-posta gönderimi.
 *
 * KARAR 2026-08-29 (Ahmet): "`Mail::` sınıfını kullanmaktansa Signalbird SDK
 * içindeki mail gönderim fonksiyonuyla gönderim gerçekleşsin. Bu fonksiyonun
 * içinde şablon seçimi dahil seçilebilecek her şey olmalı."
 *
 * ── NE ZAMAN BU, NE ZAMAN `Mail::` ────────────────────────────────────────
 *
 * İki yol vardır ve ikisi de Signalbird'den çıkar:
 *
 *   • `MAIL_MAILER=signalbird` — uygulamanın MEVCUT Mailable'ları (Blade
 *     görünümleri, şifre sıfırlama, fatura) hiç değişmeden buradan geçer.
 *     Gövde uygulamada üretilir.
 *
 *   • `Signalbird::mail()` — gövde SIGNALBIRD'DE durur: panelden düzenlenen
 *     şablon, değişkenler, gönderen adı. Metni değiştirmek için dağıtım
 *     gerekmez; pazarlama ekibi panelden düzenler.
 *
 * Şablonla gönderimin asıl kazancı budur. Aynı metni koda gömmek, her
 * düzeltmede bir sürüm çıkarmak demektir.
 *
 * ── SINIF ZORUNLUDUR, VARSAYILANI YOKTUR ──────────────────────────────────
 *
 * `transactional` (işlemsel) ile `commercial` (ticari) arasındaki fark hukukî
 * bir farktır: ticari iletide alıcı onayı ve tek tıkla çıkış zorunludur.
 * Varsayılan koysaydık, birileri kampanyayı işlemsel diye gönderirdi.
 * Bu yüzden `transactional()` ya da `commercial()` demek şarttır.
 *
 * Kullanım:
 *
 *   Signalbird::mail()
 *       ->to('ayse@ornek.com')
 *       ->template('Sipariş Onayı')          // panelde tanımlı ad ya da id
 *       ->vars(['ad' => 'Ayşe', 'no' => 'S-1234'])
 *       ->fromName('Penyu Destek')
 *       ->replyTo('destek@penyu.io')
 *       ->transactional()
 *       ->send();
 *
 * Şablonsuz da çalışır: `->subject(…)->html('<p>…</p>')`.
 */
class MailBuilder
{
    /** @var array<string,mixed> */
    private array $payload = [];

    public function __construct(private readonly MessagingClient $client) {}

    // ── Alıcı ────────────────────────────────────────────────────────────

    public function to(string $email): self
    {
        return $this->with('to', $email);
    }

    /**
     * Signalbird'deki KİŞİ kaydı — açılma/tıklama ve bastırma geçmişi ona
     * yazılsın. Kişi yoksa adresten açılır; bu alan yalnız eşleştirmeyi
     * kesinleştirir.
     */
    public function contact(int|string $id): self
    {
        return $this->with('contact_id', $id);
    }

    // ── İçerik ───────────────────────────────────────────────────────────

    public function subject(string $subject): self
    {
        return $this->with('subject', $subject);
    }

    /** Gövde — HTML ya da düz metin. Şablon kullanılıyorsa gerekmez. */
    public function html(string $body): self
    {
        return $this->with('body', $body);
    }

    /** `html()` ile aynı — `sendMail('kanal')->body(…)` okunuşu için. */
    public function body(string $body): self
    {
        return $this->html($body);
    }

    /**
     * GÖNDERİCİ KANALI (2 Eyl 2026): panelde adresle birlikte açılan `email`
     * modül anahtarı. From adresini kanal seçer — Telsiz'in `radio('kanal')`
     * deseniyle aynı; yeni anahtar üretilmez, domain anahtarı kimliktir.
     *
     *   Signalbird::sendMail('noReply')->to(…)->subject(…)->body(…)->send();
     */
    public function channel(string $key): self
    {
        return $this->with('module_key', $key);
    }

    // ── Ekler ────────────────────────────────────────────────────────────

    /**
     * Dosya eki — ham içerikle. İçerik base64'e çevrilip API'ye taşınır;
     * toplam çözülmüş boyut sınırı sunucudadır (7 MB, ATTACHMENTS_TOO_LARGE).
     *
     *   ->attach('makbuz.pdf', $pdfBytes, 'application/pdf')
     */
    public function attach(string $filename, string $content, ?string $mime = null): self
    {
        $attachments = $this->payload['attachments'] ?? [];
        $attachments[] = array_filter([
            'filename' => $filename,
            'mime' => $mime,
            'content_b64' => base64_encode($content),
        ], fn ($v) => $v !== null);

        return $this->with('attachments', $attachments);
    }

    /** Dosya eki — diskteki yoldan. Ad verilmezse dosya adı kullanılır. */
    public function attachFile(string $path, ?string $filename = null, ?string $mime = null): self
    {
        $content = @file_get_contents($path);

        if ($content === false) {
            throw new SignalbirdException("Signalbird: ek okunamadı — {$path}", 'ATTACHMENT_UNREADABLE', 0);
        }

        return $this->attach($filename ?: basename($path), $content, $mime ?: (mime_content_type($path) ?: null));
    }

    /**
     * Panelde tanımlı şablon — ADIYLA ya da kimliğiyle.
     *
     * Ad tercih edilir: şablonu silip yeniden yaratsanız bile kodunuz
     * değişmez. Eşleşme büyük/küçük harfe duyarsızdır.
     */
    public function template(int|string $nameOrId): self
    {
        return is_int($nameOrId)
            ? $this->with('template_id', $nameOrId)
            : $this->with('template', $nameOrId);
    }

    /**
     * Şablon değişkenleri — `{{ad}}` yerine geçecek değerler.
     *
     * @param  array<string,mixed>  $vars
     */
    public function vars(array $vars): self
    {
        return $this->with('vars', $vars);
    }

    // ── Kimlik ───────────────────────────────────────────────────────────

    /**
     * Görünen gönderen adı. ZARF ADRESİ DEĞİL: postanın çıktığı adres
     * Signalbird'ün doğrulanmış havuzunda kalır — itibar oranın gönderim
     * geçmişine bağlıdır ve onu çağırana bırakmayız.
     */
    public function fromName(string $name): self
    {
        return $this->with('from_name', $name);
    }

    /** Alıcı "yanıtla" dediğinde gidecek adres. */
    public function replyTo(string $email): self
    {
        return $this->with('reply_to', $email);
    }

    /** Belirli bir doğrulanmış gönderen alan adından çıksın. */
    public function sendingDomain(int $id): self
    {
        return $this->with('sending_domain_id', $id);
    }

    // ── Hukukî sınıf ─────────────────────────────────────────────────────

    /** Kullanıcının kendi eylemine karşılık gelen posta (şifre, fatura, bildirim). */
    public function transactional(): self
    {
        return $this->with('class', 'transactional');
    }

    /**
     * Pazarlama iletisi. Alıcı onayı ve tek tıkla çıkış zorunludur; ikisini de
     * Signalbird uygular ve onaysız alıcıya gönderim yapmaz.
     */
    public function commercial(): self
    {
        return $this->with('class', 'commercial');
    }

    // ── Gönder ───────────────────────────────────────────────────────────

    /**
     * @return array{ok: bool, status: int, code?: string, message?: string, data?: mixed}
     *
     * SONUÇ DÖNER, İSTİSNA FIRLATMAZ (istemci `throwOnError` ile
     * kurulmadıysa): kota dolduğu için gitmeyen bir bildirim, asıl işin
     * (sipariş, kayıt) çökmesi için geçerli bir sebep değildir. Çağıran
     * `ok`'a bakıp kendi kararını verir.
     */
    public function send(): array
    {
        foreach (['to', 'class'] as $required) {
            if (! isset($this->payload[$required])) {
                throw new SignalbirdException(
                    $required === 'class'
                        ? 'Signalbird: ileti sınıfı zorunlu — transactional() ya da commercial() deyin.'
                        : 'Signalbird: alıcı zorunlu — to() deyin.',
                    'INVALID_INPUT',
                    0,
                );
            }
        }

        $hasTemplate = isset($this->payload['template']) || isset($this->payload['template_id']);

        // Şablon varsa konu da gövde de ondan gelir. Yoksa ikisi de gerekir:
        // konusuz posta spam kutusuna, gövdesiz posta çöpe gider.
        if (! $hasTemplate && ! isset($this->payload['body'], $this->payload['subject'])) {
            throw new SignalbirdException(
                'Signalbird: şablon seçin (template) ya da konu ve gövde verin (subject + html).',
                'INVALID_INPUT',
                0,
            );
        }

        return $this->client->sendEmail($this->payload);
    }

    /** Gönderilecek gövde — hata ayıklama ve test için. */
    public function payload(): array
    {
        return $this->payload;
    }

    private function with(string $key, mixed $value): self
    {
        $this->payload[$key] = $value;

        return $this;
    }
}
