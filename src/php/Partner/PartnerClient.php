<?php

namespace Signalbird\Sdk\Partner;

use Signalbird\Sdk\SignalbirdException;

/**
 * Partner istemcisi — BEŞİNCİ yüzey.
 *
 * Signalbird'ü kendi ürününün içinde satan sözleşmeli platform (veribenim,
 * submitcms) müşterisini bununla sağlar ve yetkilendirir.
 *
 * **CLAUDE.md'deki "Admin yüzeyi OLMAYACAK" kuralının bilinçli istisnasıdır**
 * ve istisna olduğu için ayrı anahtar türü taşır (`sbp_live_…`). Kural,
 * müşterinin kendi anahtarıyla (`sb_`) şirket açamaması içindi; o kural aynen
 * duruyor.
 *
 * Node karşılığı: src/node/partner.ts — davranış birebir aynıdır.
 * Sözleşme: docs/CONTRACT.md § 12
 */
class PartnerClient
{
    public const DEFAULT_BASE_URL = 'https://live.signalbird.io/api';

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

        if (! str_starts_with($apiKey, 'sbp_live_')) {
            throw new SignalbirdException(
                'Signalbird: partner istemcisi partner anahtarı ister (sbp_live_…). '
                . 'Takım (sb_…), Telsiz (sbr_…) ve uygulama (sbw_pub_…) anahtarları burada çalışmaz.',
                'WRONG_KEY_TYPE',
                0,
            );
        }

        $this->baseUrl = rtrim($baseUrl ?: self::DEFAULT_BASE_URL, '/');
    }

    // ── Müşteri ───────────────────────────────────────────────────────────

    /**
     * Company + takım + owner açar. **Idempotenttir**: aynı `external_id` ile
     * ikinci çağrı `created:false` ile var olanı döner ve anahtarları TEKRAR
     * DÖNMEZ.
     *
     * @param array<string, mixed> $input
     */
    public function createCompany(array $input): array
    {
        return $this->request('POST', '/v1/partner/companies', $input);
    }

    /** @param array<string, mixed> $query */
    public function listCompanies(array $query = []): array
    {
        return $this->request('GET', '/v1/partner/companies', null, $query);
    }

    public function getCompany(string $externalId): array
    {
        return $this->request('GET', '/v1/partner/companies/' . rawurlencode($externalId));
    }

    /** @param array<string, mixed> $input */
    public function updateCompany(string $externalId, array $input): array
    {
        return $this->request('PATCH', '/v1/partner/companies/' . rawurlencode($externalId), $input);
    }

    /** Askıya alır — SİLMEZ. */
    public function suspendCompany(string $externalId): array
    {
        return $this->request('DELETE', '/v1/partner/companies/' . rawurlencode($externalId));
    }

    public function rotateKey(string $externalId, string $type): array
    {
        return $this->request(
            'POST',
            '/v1/partner/companies/' . rawurlencode($externalId) . '/keys/rotate',
            ['type' => $type],
        );
    }

    // ── Domain ────────────────────────────────────────────────────────────

    /**
     * Domain ekler ve (istenirse) izlemeye alır. Kayıt `verified_via:'partner'`
     * ile doğar: e-posta/SMS kampanyası için TXT şarttır — yanıttaki `dns`
     * kaydını yayınlayıp `verifyDomain` çağırmak kapıyı açar.
     *
     * @param array<string, mixed> $input
     */
    public function addDomain(string $companyExternalId, array $input): array
    {
        return $this->request(
            'POST',
            '/v1/partner/companies/' . rawurlencode($companyExternalId) . '/domains',
            $input,
        );
    }

    public function listDomains(string $companyExternalId): array
    {
        return $this->request('GET', '/v1/partner/companies/' . rawurlencode($companyExternalId) . '/domains');
    }

    public function getDomain(string $externalId): array
    {
        return $this->request('GET', '/v1/partner/domains/' . rawurlencode($externalId));
    }

    public function verifyDomain(string $externalId): array
    {
        return $this->request('POST', '/v1/partner/domains/' . rawurlencode($externalId) . '/verify');
    }

    public function removeDomain(string $externalId): array
    {
        return $this->request('DELETE', '/v1/partner/domains/' . rawurlencode($externalId));
    }

    public function domainUptime(string $externalId, string $range = '24h'): array
    {
        return $this->request(
            'GET',
            '/v1/partner/domains/' . rawurlencode($externalId) . '/uptime',
            null,
            ['range' => $range],
        );
    }

    /** Tek istekte müşterinin tüm domainleri — liste ekranı N+1 atmasın. */
    public function companyUptime(string $companyExternalId, string $range = '24h'): array
    {
        return $this->request(
            'GET',
            '/v1/partner/companies/' . rawurlencode($companyExternalId) . '/uptime',
            null,
            ['range' => $range],
        );
    }

    // ── Mesaj günlüğü ─────────────────────────────────────────────────────
    //
    // Salt okur. Partner kendi panelinde "gönderdiğimiz her şeyin durumu"
    // ekranını çizsin diye (MESSAGING_UNIFICATION_2026-08-25.md §5.1).
    // Alıcı MASKELİ döner, gövde hiç dönmez — gövde zaten saklanmıyor.

    /** @param array<string,mixed> $query channel, status, class, external_ref, q, from, to, per_page */
    public function listMessages(string $companyExternalId, array $query = []): array
    {
        return $this->request(
            'GET',
            '/v1/partner/companies/' . rawurlencode($companyExternalId) . '/messages',
            null,
            $query,
        );
    }

    /** Tek mesaj + olay zaman çizelgesi (kuyruk → gitti → açıldı → tıklandı). */
    public function getMessage(string $companyExternalId, string $messageId): array
    {
        return $this->request(
            'GET',
            '/v1/partner/companies/' . rawurlencode($companyExternalId) . '/messages/' . rawurlencode($messageId),
        );
    }

    /** Kanal bazlı özet: gönderilen / teslim / açılan / tıklanan. */
    public function messageSummary(string $companyExternalId, string $range = '7d'): array
    {
        return $this->request(
            'GET',
            '/v1/partner/companies/' . rawurlencode($companyExternalId) . '/message-summary',
            null,
            ['range' => $range],
        );
    }

    // ── Modül yetkisi ─────────────────────────────────────────────────────

    public function listModules(string $companyExternalId): array
    {
        return $this->request('GET', '/v1/partner/companies/' . rawurlencode($companyExternalId) . '/modules');
    }

    /**
     * "Bu müşteri şu modül için ödeme yaptı, kullanabilir."
     *
     * @param array<string, mixed> $input
     */
    public function grantModule(string $companyExternalId, array $input): array
    {
        return $this->request(
            'POST',
            '/v1/partner/companies/' . rawurlencode($companyExternalId) . '/modules',
            $input,
        );
    }

    /** Yalnız partner'ın KENDİ verdiği hakkı geri alır; plan hakkına dokunmaz. */
    public function revokeModule(string $companyExternalId, string $module): array
    {
        return $this->request(
            'DELETE',
            '/v1/partner/companies/' . rawurlencode($companyExternalId) . '/modules/' . rawurlencode($module),
        );
    }

    // ── Kullanıcı ─────────────────────────────────────────────────────────

    /** @param array<string, mixed> $input */
    public function createUser(string $companyExternalId, array $input): array
    {
        return $this->request(
            'POST',
            '/v1/partner/companies/' . rawurlencode($companyExternalId) . '/users',
            $input,
        );
    }

    public function listUsers(string $companyExternalId): array
    {
        return $this->request('GET', '/v1/partner/companies/' . rawurlencode($companyExternalId) . '/users');
    }

    /** Üyeliği kaldırır, kişinin Signalbird hesabını SİLMEZ. */
    public function removeUser(string $companyExternalId, string $userExternalId): array
    {
        return $this->request(
            'DELETE',
            '/v1/partner/companies/' . rawurlencode($companyExternalId)
                . '/users/' . rawurlencode($userExternalId),
        );
    }

    // ── Gömme ─────────────────────────────────────────────────────────────

    /**
     * Panel ekranını partner sayfasına gömmek için kısa ömürlü jeton üretir
     * (120 sn, tek kullanımlık). Anahtar tarayıcıya inmesin diye bu çağrı
     * partner'ın SUNUCUSUNDAN yapılır.
     *
     * @param array<string, mixed> $input
     */
    public function createEmbedToken(string $companyExternalId, array $input): array
    {
        return $this->request(
            'POST',
            '/v1/partner/companies/' . rawurlencode($companyExternalId) . '/embed',
            $input,
        );
    }

    // ── Taşıma ────────────────────────────────────────────────────────────

    /**
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
            return ['ok' => true, 'status' => $status, 'data' => $data, 'code' => null, 'message' => null];
        }

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

    /** @return array{ok: bool, status: int, data: mixed, code: ?string, message: ?string} */
    private function fail(int $status, string $code, string $message, mixed $data): array
    {
        if ($this->throwOnError) {
            throw SignalbirdException::fromResponse($code, $status, $message, $data);
        }

        return ['ok' => false, 'status' => $status, 'data' => $data, 'code' => $code, 'message' => $message];
    }

    /** @param array<string, mixed> $query */
    private static function buildQuery(array $query): string
    {
        $pairs = [];

        foreach ($query as $key => $value) {
            if ($value === null) {
                continue;
            }

            if (is_array($value)) {
                foreach ($value as $item) {
                    $pairs[] = rawurlencode((string) $key) . '[]=' . rawurlencode((string) $item);
                }

                continue;
            }

            if (is_bool($value)) {
                $value = $value ? 'true' : 'false';
            }

            $pairs[] = rawurlencode((string) $key) . '=' . rawurlencode((string) $value);
        }

        return $pairs === [] ? '' : '?' . implode('&', $pairs);
    }
}
