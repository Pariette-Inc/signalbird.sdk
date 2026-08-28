<?php

namespace Signalbird\Sdk\Messaging;

use Signalbird\Sdk\SignalbirdException;

/**
 * Gönderim (Messaging) istemcisi — sunucu tarafı.
 *
 * Takım API anahtarıyla (`sb_…`) e-posta/SMS/push gönderir, kişi ve liste
 * yönetir, kampanya açar, mesaj durumlarını okur. Telsiz istemcisinden
 * (`SignalbirdClient`) ayrıdır: farklı anahtar, farklı kapı, farklı kota.
 *
 * Guzzle'a bağımlı DEĞİLDİR: cURL uzantısı her PHP kurulumunda vardır. Retry
 * yoktur: aynı iletiyi iki kez göndermek, hiç göndermemekten pahalıdır —
 * yeniden deneme kararı çağıranındır.
 *
 * Her metot aynı biçimde döner:
 *   ['ok' => bool, 'status' => int, 'data' => mixed|null, 'code' => ?string, 'message' => ?string]
 * Başarıda `code`/`message` null'dur; hatada `data` sunucunun çözümlenmiş
 * hata gövdesini taşıyabilir. `throwOnError` açıksa hata yerine
 * `SignalbirdException` fırlatılır.
 *
 * Node karşılığı: src/node/messaging.ts — davranış birebir aynıdır.
 * Sözleşme: docs/CONTRACT.md § 8
 */
class MessagingClient
{
    public const DEFAULT_BASE_URL = 'https://live.signalbird.io/api';

    /** Toplu kişi yüklemede tek istekteki üst sınır (API tarafı da bunu kabul eder). */
    public const BULK_CHUNK = 1000;

    private string $baseUrl;

    public function __construct(
        private string $apiKey,
        ?string $baseUrl = null,
        private int $timeout = 15,
        private bool $throwOnError = false,
    ) {
        if ($apiKey === '') {
            throw new SignalbirdException('Signalbird: apiKey zorunlu.', 'NO_KEY', 0);
        }

        // Telsiz (`sbr_`) ya da uygulama (`sbw_pub_`) anahtarı buraya verilirse
        // her istek 401 döner; baştan söylemek haftalar sonra bulunacak hatayı önler.
        if (! str_starts_with($apiKey, 'sb_')) {
            throw new SignalbirdException(
                'Signalbird: gönderim istemcisi takım API anahtarı ister (sb_…). '
                . 'Telsiz (sbr_…) ve uygulama (sbw_pub_…) anahtarları burada çalışmaz.',
                'WRONG_KEY_TYPE',
                0,
            );
        }

        $this->baseUrl = rtrim($baseUrl ?: self::DEFAULT_BASE_URL, '/');
    }

    // ── Gönderim ──────────────────────────────────────────────────────────

    /** @param array<string, mixed> $input */
    public function sendEmail(array $input): array
    {
        return $this->request('POST', '/v1/email/send', $input);
    }

    /** @param array<string, mixed> $input */
    public function sendSms(array $input): array
    {
        return $this->request('POST', '/v1/sms/send', $input);
    }

    /**
     * Otomasyon olayı — kendi sisteminizdeki bir olayı Signalbird'e bildirir
     * ve eşleşen akışı tetikler (docs/MESSAGING_UNIFICATION §11).
     *
     * Signalbird olayın ne anlama geldiğini BİLMEZ: `cart_abandoned`,
     * `signup`, `page_abandoned` — adı sizin verdiğinizdir. Kişi kaydı yoksa
     * açılır; `data` şablon değişkeni olur.
     *
     * @param  array<string,mixed>  $input  event, contact{email|phone|external_id}, data
     */
    public function track(array $input): array
    {
        return $this->request('POST', '/v1/events', $input);
    }

    /** SMS parça/karakter hesabı — kota harcamaz. */
    public function previewSms(string $body): array
    {
        return $this->request('POST', '/v1/sms/preview', ['body' => $body]);
    }

    /** @param array<string, mixed> $input */
    public function sendPush(array $input): array
    {
        return $this->request('POST', '/v1/push/send', $input);
    }

    // ── Kişiler ───────────────────────────────────────────────────────────

    /** @param array<string, mixed> $query */
    public function listContacts(array $query = []): array
    {
        return $this->request('GET', '/v1/contacts', null, $query);
    }

    /** @param array<string, mixed> $contact */
    public function createContact(array $contact): array
    {
        return $this->request('POST', '/v1/contacts', $contact);
    }

    /** @param array<string, mixed> $contact */
    public function updateContact(int|string $id, array $contact): array
    {
        return $this->request('PATCH', '/v1/contacts/' . rawurlencode((string) $id), $contact);
    }

    public function deleteContact(int|string $id): array
    {
        return $this->request('DELETE', '/v1/contacts/' . rawurlencode((string) $id));
    }

    /**
     * Toplu kişi yükleme.
     *
     * 1000'lik parçalara bölünür ve SIRAYLA gönderilir (paralel değil: aynı
     * e-posta iki parçada da varsa yarış olmasın). Sonuçlar tek yanıtta
     * birleştirilir. Bir parça başarısız olursa o noktada durulur ve o ana kadar
     * biriken sayımlar `data` içinde döner — çağıran kaç kişinin işlendiğini görür.
     *
     * @param array{contacts: array<int, array<string, mixed>>, list_id?: int, consent_source?: string, consent_text?: string} $input
     */
    public function bulkContacts(array $input): array
    {
        $merged = ['imported' => 0, 'updated' => 0, 'skipped' => []];
        $contacts = array_values($input['contacts'] ?? []);
        $rest = $input;
        unset($rest['contacts']);
        $status = 200;

        if ($contacts === []) {
            return $this->success($status, $merged);
        }

        foreach (array_chunk($contacts, self::BULK_CHUNK) as $chunk) {
            $result = $this->request('POST', '/v1/contacts/bulk', $rest + ['contacts' => $chunk]);

            if (! $result['ok']) {
                $result['data'] = $merged;

                return $result;
            }

            $status = $result['status'];
            $data = is_array($result['data']) ? $result['data'] : [];
            $merged['imported'] += (int) ($data['imported'] ?? 0);
            $merged['updated'] += (int) ($data['updated'] ?? 0);
            if (isset($data['skipped']) && is_array($data['skipped'])) {
                $merged['skipped'] = array_merge($merged['skipped'], array_values($data['skipped']));
            }
        }

        return $this->success($status, $merged);
    }

    // ── Listeler ──────────────────────────────────────────────────────────

    public function listContactLists(): array
    {
        return $this->request('GET', '/v1/contact-lists');
    }

    /** @param array<string, mixed> $input */
    public function createContactList(array $input): array
    {
        return $this->request('POST', '/v1/contact-lists', $input);
    }

    public function deleteContactList(int|string $id): array
    {
        return $this->request('DELETE', '/v1/contact-lists/' . rawurlencode((string) $id));
    }

    // ── Kampanyalar ───────────────────────────────────────────────────────

    /** @param array<string, mixed> $query */
    public function listCampaigns(array $query = []): array
    {
        return $this->request('GET', '/v1/campaigns', null, $query);
    }

    /** @param array<string, mixed> $input */
    public function createCampaign(array $input): array
    {
        return $this->request('POST', '/v1/campaigns', $input);
    }

    public function getCampaign(int|string $id): array
    {
        return $this->request('GET', '/v1/campaigns/' . rawurlencode((string) $id));
    }

    public function cancelCampaign(int|string $id): array
    {
        return $this->request('POST', '/v1/campaigns/' . rawurlencode((string) $id) . '/cancel');
    }

    /** @param array<string, mixed> $query */
    public function listCampaignMessages(int|string $id, array $query = []): array
    {
        return $this->request('GET', '/v1/campaigns/' . rawurlencode((string) $id) . '/messages', null, $query);
    }

    /**
     * Yardımcı: bir kampanyanın tüm mesajlarını sayfa sayfa gezer.
     *
     *   foreach ($sdk->iterateCampaignMessages(42) as $m) { … }
     *
     * Bir sayfa alınamazsa `SignalbirdException` fırlatır (sessiz yarım liste,
     * "hepsi bu" sanılır — o daha tehlikeli). `page` sorgudan yok sayılır;
     * `per_page` verilmezse 100'dür.
     *
     * @param  array<string, mixed>  $query
     * @return \Generator<int, array<string, mixed>>
     */
    public function iterateCampaignMessages(int|string $id, array $query = []): \Generator
    {
        $page = 1;

        while (true) {
            $result = $this->listCampaignMessages($id, array_merge(['per_page' => 100], $query, ['page' => $page]));
            if (! $result['ok']) {
                throw SignalbirdException::fromResponse(
                    (string) $result['code'],
                    (int) $result['status'],
                    (string) ($result['message'] ?? ''),
                    $result['data'],
                );
            }

            $payload = is_array($result['data']) ? $result['data'] : [];
            $rows = isset($payload['data']) && is_array($payload['data']) ? $payload['data'] : [];

            foreach ($rows as $message) {
                yield $message;
            }

            if ($page >= (int) ($payload['last_page'] ?? 1) || $rows === []) {
                return;
            }

            $page++;
        }
    }

    // ── Mesajlar ──────────────────────────────────────────────────────────

    /** @param array<string, mixed> $query */
    public function listMessages(array $query = []): array
    {
        return $this->request('GET', '/v1/messages', null, $query);
    }

    public function getMessage(string $id): array
    {
        return $this->request('GET', '/v1/messages/' . rawurlencode($id));
    }

    // ── HTTP ──────────────────────────────────────────────────────────────

    /**
     * URL/sorgu kurar, `transport()` çağırır, JSON çözer, hata eşler.
     *
     * @param  array<string, mixed>|null  $body
     * @param  array<string, mixed>  $query
     * @return array{ok: bool, status: int, data: mixed, code: ?string, message: ?string}
     */
    private function request(string $method, string $path, ?array $body = null, array $query = []): array
    {
        $raw = $this->transport($method, $path . self::buildQuery($query), $body);

        $status = (int) ($raw['status'] ?? 0);
        $errno = (int) ($raw['errno'] ?? 0);
        $error = $raw['error'] ?? null;

        if ($raw['body'] === null && ($errno !== 0 || $error)) {
            $code = $errno === CURLE_OPERATION_TIMEOUTED ? 'TIMEOUT' : 'NETWORK_ERROR';

            return $this->fail(0, $code, (string) ($error ?: 'network error'), null);
        }

        $text = (string) ($raw['body'] ?? '');
        $data = null;

        if ($text !== '') {
            $decoded = json_decode($text, true);
            $data = json_last_error() === JSON_ERROR_NONE ? $decoded : $text;
        }

        if ($status >= 200 && $status < 300) {
            return $this->success($status, $data);
        }

        // HTTP hatası: API `{message, code}` döner; Laravel doğrulama hatası
        // `{message, errors}` döner (kodsuz) — onu VALIDATION_ERROR sayarız.
        $code = is_array($data) && isset($data['code']) && is_string($data['code']) && $data['code'] !== ''
            ? $data['code']
            : ($status === 422 ? 'VALIDATION_ERROR' : ($status === 401 ? 'API_KEY_INVALID' : "HTTP_{$status}"));
        $message = is_array($data) && isset($data['message']) && is_string($data['message']) && $data['message'] !== ''
            ? $data['message']
            : "HTTP {$status}";

        return $this->fail($status, $code, $message, $data);
    }

    /**
     * Ham HTTP taşıması (cURL). Testler bu metodu ezerek sahte yanıt döner.
     *
     * @param  array<string, mixed>|null  $body
     * @return array{status: int, body: ?string, error: ?string, errno: int}
     */
    protected function transport(string $method, string $path, ?array $body): array
    {
        $headers = [
            'Accept: application/json',
            'Authorization: Bearer ' . $this->apiKey,
        ];

        $options = [
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => $this->timeout,
            CURLOPT_CONNECTTIMEOUT => $this->timeout,
        ];

        if ($body !== null) {
            $headers[] = 'Content-Type: application/json';
            $options[CURLOPT_POSTFIELDS] = json_encode($body, JSON_UNESCAPED_UNICODE);
        }

        $options[CURLOPT_HTTPHEADER] = $headers;

        $handle = curl_init($this->baseUrl . $path);
        curl_setopt_array($handle, $options);

        $response = curl_exec($handle);
        $status = (int) curl_getinfo($handle, CURLINFO_HTTP_CODE);
        $errno = curl_errno($handle);
        $error = curl_error($handle);
        curl_close($handle);

        return [
            'status' => $status,
            'body' => $response === false ? null : (string) $response,
            'error' => $error !== '' ? $error : null,
            'errno' => $errno,
        ];
    }

    private function success(int $status, mixed $data): array
    {
        return ['ok' => true, 'status' => $status, 'data' => $data, 'code' => null, 'message' => null];
    }

    private function fail(int $status, string $code, string $message, mixed $data): array
    {
        if ($this->throwOnError) {
            throw SignalbirdException::fromResponse($code, $status, $message, $data);
        }

        return ['ok' => false, 'status' => $status, 'data' => $data, 'code' => $code, 'message' => $message];
    }

    /**
     * `null` alanlar atlanır; diziler `key[]=` biçiminde gider. Kodlama
     * `http_build_query` ile aynıdır (RFC 1738: boşluk `+`).
     *
     * @param array<string, mixed> $query
     */
    private static function buildQuery(array $query): string
    {
        $pairs = [];

        foreach ($query as $key => $value) {
            if ($value === null) {
                continue;
            }

            if (is_array($value)) {
                foreach ($value as $item) {
                    $pairs[] = urlencode($key . '[]') . '=' . urlencode(self::stringify($item));
                }
            } else {
                $pairs[] = urlencode((string) $key) . '=' . urlencode(self::stringify($value));
            }
        }

        return $pairs === [] ? '' : '?' . implode('&', $pairs);
    }

    private static function stringify(mixed $value): string
    {
        if (is_bool($value)) {
            return $value ? 'true' : 'false';
        }

        return (string) $value;
    }
}
