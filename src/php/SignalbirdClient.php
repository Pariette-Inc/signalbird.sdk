<?php

namespace Signalbird\Sdk;

/**
 * Telsiz istemcisi (PHP / sunucu tarafı).
 *
 * Guzzle'a bağımlı DEĞİLDİR: cURL uzantısı her PHP kurulumunda vardır ve bir
 * log kütüphanesinin müşterinin projesine HTTP istemcisi sürümü dayatması,
 * sürüm çakışmalarının en sık sebebidir.
 *
 * Varsayılan davranış SESSİZ HATA'dır: telsiz erişilemezse müşterinin ödeme
 * akışı çökmemeli. `throwOnError` ile geliştirme sırasında açılabilir.
 */
class SignalbirdClient
{
    public const LEVELS = ['debug', 'info', 'warn', 'error', 'critical'];

    private string $baseUrl;

    public function __construct(
        private string $domainKey,
        ?string $baseUrl = null,
        private ?string $source = null,
        private int $timeout = 5,
        private bool $throwOnError = false,
    ) {
        if ($domainKey === '') {
            throw new SignalbirdException('Signalbird: anahtar boş.');
        }

        /*
         * Yanlış anahtar türü KURULUMDA yakalanır, ilk istekte değil.
         * Açık anahtar sunucuda `ORIGIN_REQUIRED` alır ve sebebi log'da
         * görünmez; haftalar sonra fark etmektense burada durmak yeğdir.
         */
        if (! str_starts_with($domainKey, 'sb_secret_live_')) {
            throw new SignalbirdException(
                'Signalbird: bu istemci GİZLİ domain anahtarı ister (sb_secret_live_…). '
                . 'Açık anahtar (sb_public_live_…) yalnız tarayıcı ve mobil içindir.'
            );
        }

        $this->baseUrl = rtrim($baseUrl ?: 'https://live.signalbird.io/api', '/');
    }

    /**
     * Bir kanala kayıt gönderir.
     *
     * @param  array<string, mixed>|null  $context
     * @return array{ok: bool, event_id?: string, code?: string}
     */
    public function log(string $key, string $message, ?string $level = null, ?array $context = null): array
    {
        return $this->post('/v1/radio/log', array_filter([
            'key' => $key,
            'message' => $message,
            'level' => $level,
            'context' => $context,
            'source' => $this->source,
        ], fn ($value) => $value !== null));
    }

    /**
     * Toplu gönderim (en fazla 100).
     *
     * @param  array<int, array{key: string, message: string, level?: string, context?: array}>  $events
     * @return array{accepted: int, total: int, results: array}
     */
    public function batch(array $events): array
    {
        $payload = array_map(function (array $event) {
            return array_filter([
                'key' => $event['key'],
                'message' => $event['message'],
                'level' => $event['level'] ?? null,
                'context' => $event['context'] ?? null,
                'source' => $event['source'] ?? $this->source,
            ], fn ($value) => $value !== null);
        }, array_slice($events, 0, 100));

        $response = $this->post('/v1/radio/log/batch', ['events' => $payload]);

        return [
            'accepted' => (int) ($response['accepted'] ?? 0),
            'total' => (int) ($response['total'] ?? count($events)),
            'results' => $response['results'] ?? [],
        ];
    }

    public function debug(string $key, string $message, ?array $context = null): array
    {
        return $this->log($key, $message, 'debug', $context);
    }

    public function info(string $key, string $message, ?array $context = null): array
    {
        return $this->log($key, $message, 'info', $context);
    }

    public function warn(string $key, string $message, ?array $context = null): array
    {
        return $this->log($key, $message, 'warn', $context);
    }

    public function error(string $key, string $message, ?array $context = null): array
    {
        return $this->log($key, $message, 'error', $context);
    }

    public function critical(string $key, string $message, ?array $context = null): array
    {
        return $this->log($key, $message, 'critical', $context);
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    private function post(string $path, array $payload): array
    {
        $handle = curl_init($this->baseUrl . $path);

        curl_setopt_array($handle, [
            CURLOPT_POST => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => $this->timeout,
            CURLOPT_CONNECTTIMEOUT => $this->timeout,
            CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE),
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'Accept: application/json',
                'X-Signalbird-Key: ' . $this->domainKey,
            ],
        ]);

        $body = curl_exec($handle);
        $status = (int) curl_getinfo($handle, CURLINFO_HTTP_CODE);
        $error = curl_error($handle);
        curl_close($handle);

        if ($body === false) {
            if ($this->throwOnError) {
                throw new SignalbirdException("Signalbird: bağlanılamadı ({$error})", 'NETWORK_ERROR', 0);
            }

            return ['ok' => false, 'code' => 'NETWORK_ERROR'];
        }

        $decoded = json_decode((string) $body, true) ?: [];

        if ($status >= 400) {
            $code = $decoded['code'] ?? 'UNKNOWN';

            if ($this->throwOnError) {
                throw new SignalbirdException("Signalbird: {$code} (HTTP {$status})", (string) $code, $status, $decoded);
            }

            return ['ok' => false, 'code' => $code];
        }

        return $decoded + ['ok' => true];
    }
}
