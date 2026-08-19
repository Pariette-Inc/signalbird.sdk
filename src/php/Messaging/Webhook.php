<?php

namespace Signalbird\Sdk\Messaging;

/**
 * Mesaj olay webhook'larının imza doğrulaması.
 *
 * Signalbird her teslimatı `X-Signalbird-Signature: sha256=<hex>` başlığıyla
 * imzalar: `hex(hmac_sha256(raw_body, secret))`. Doğrulama HAM gövde üzerinde
 * yapılmalıdır — JSON'u ayrıştırıp yeniden serileştirmek anahtar sırasını
 * değiştirir ve imzayı bozar. Laravel'de `$request->getContent()`, düz PHP'de
 * `file_get_contents('php://input')` ham gövdeyi verir.
 *
 * Node karşılığı: src/node/webhook.ts
 */
final class Webhook
{
    public static function verify(string $rawBody, ?string $signatureHeader, string $secret): bool
    {
        if ($signatureHeader === null || $signatureHeader === '' || $secret === '') {
            return false;
        }

        // "sha256=abcd…" — başka algoritma ya da biçim kabul edilmez.
        if (! preg_match('/^\s*sha256=([a-f0-9]+)\s*$/i', $signatureHeader, $match)) {
            return false;
        }

        $expected = hash_hmac('sha256', $rawBody, $secret);
        $provided = strtolower($match[1]);

        // hash_equals sabit zamanlı karşılaştırır; uzunluk farkında da sızıntı yok.
        return hash_equals($expected, $provided);
    }
}
