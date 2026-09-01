<?php

namespace Signalbird\Sdk\Management;

use Signalbird\Sdk\SignalbirdException;

/**
 * Yönetim (Management) istemcisi — sunucu tarafı.
 *
 * Müşterinin panelde tıklayarak yaptığı her şeyi kodla yapar: Telsiz projesi ve
 * kanalı açar, olay akışını okur, sohbet gelen kutusunu işler, uygulama kaydı
 * ve cihaz listesi yönetir.
 *
 * Bu ADMIN yüzeyi DEĞİLDİR. Anahtar tek bir takıma bağlıdır ve yalnız o takımın
 * kayıtlarına dokunur; başka takımın kaydı 404 döner.
 *
 * Guzzle'a bağımlı DEĞİLDİR (cURL). Retry yoktur. Zarf Gönderim istemcisiyle
 * birebir aynıdır:
 *   ['ok' => bool, 'status' => int, 'data' => mixed|null, 'code' => ?string, 'message' => ?string]
 *
 * Node karşılığı: src/node/management.ts — metot adları birebir aynıdır
 * (`scripts/check-parity.mjs` denetler).
 * Sözleşme: docs/CONTRACT.md § 10
 */
class ManagementClient
{
    public const DEFAULT_BASE_URL = 'https://live.signalbird.io/api';

    private string $baseUrl;

    public function __construct(
        private string $domainKey,
        ?string $baseUrl = null,
        private int $timeout = 15,
        private bool $throwOnError = false,
    ) {
        if ($domainKey === '') {
            throw new SignalbirdException('Signalbird: domainKey zorunlu.', 'NO_KEY', 0);
        }

        /*
         * Açık anahtar buraya verilirse her istek 403 `SECRET_KEY_REQUIRED`
         * döner. Kurulumda söylemek, haftalar sonra bulunacak hatayı önler.
         */
        if (! str_starts_with($domainKey, 'sb_secret_live_')) {
            throw new SignalbirdException(
                'Signalbird: bu istemci GİZLİ domain anahtarı ister (sb_secret_live_…). '
                . 'Açık anahtar (sb_public_live_…) yalnız tarayıcı ve mobil içindir.',
                'WRONG_KEY_TYPE',
                0,
            );
        }

        $this->baseUrl = rtrim($baseUrl ?: self::DEFAULT_BASE_URL, '/');
    }

    // ── Telsiz: projeler ──────────────────────────────────────────────────

    public function radioSummary(): array
    {
        return $this->request('GET', '/v1/radio/summary');
    }

    /** @param array<string, mixed> $query */
    public function radioEvents(array $query = []): array
    {
        return $this->request('GET', '/v1/radio/events', null, $query);
    }

    // ── Modül anahtarları ─────────────────────────────────────────────
    //
    // Telsiz projesi/kanalı ve uygulama kaydı 1 Eyl 2026'da kaldırıldı
    // (../signalbird.api/docs/KEY_ARCHITECTURE_2026-09-01.md §3). Beş modülün
    // (logger, email, sms, push, chat) hepsi aynı gövdeyi kullanır.

    /** @return array{ok: bool, status: int, data: mixed, code: ?string} */
    public function listModuleKeys(string $module, array $query = []): array
    {
        return $this->request('GET', '/v1/modules/' . self::seg($module) . '/keys', null, $query);
    }

    /** @return array{ok: bool, status: int, data: mixed, code: ?string} */
    public function getModuleKey(string $module, int|string $id): array
    {
        return $this->request('GET', '/v1/modules/' . self::seg($module) . '/keys/' . self::seg($id));
    }

    /**
     * Kanal açar. `key` verilmezse başlıktan üretilir; çakışırsa sonuna sayı
     * eklenir — "bu ad alınmış" hatası CI'da kanal açan betiği durdururdu.
     *
     * @param  array<string, mixed>  $input
     * @return array{ok: bool, status: int, data: mixed, code: ?string}
     */
    public function createModuleKey(string $module, array $input): array
    {
        return $this->request('POST', '/v1/modules/' . self::seg($module) . '/keys', $input);
    }

    /**
     * Kanalı günceller. `key` DEĞİŞTİRİLEBİLİR: eski ad 30 gün daha kabul
     * edilir, böylece üretimdeki kod bir sonraki deploya kadar kayıt
     * kaybetmez. `keep_previous: false` eski adı anında kapatır.
     *
     * @param  array<string, mixed>  $input
     * @return array{ok: bool, status: int, data: mixed, code: ?string}
     */
    public function updateModuleKey(string $module, int|string $id, array $input): array
    {
        return $this->request('PATCH', '/v1/modules/' . self::seg($module) . '/keys/' . self::seg($id), $input);
    }

    /** @return array{ok: bool, status: int, data: mixed, code: ?string} */
    public function deleteModuleKey(string $module, int|string $id): array
    {
        return $this->request('DELETE', '/v1/modules/' . self::seg($module) . '/keys/' . self::seg($id));
    }

    /**
     * Push kanalına kayıtlı son kullanıcı cihazları (token MASKELİ döner).
     *
     * @param  array<string, mixed>  $query
     * @return array{ok: bool, status: int, data: mixed, code: ?string}
     */
    public function listModuleKeyDevices(string $module, int|string $id, array $query = []): array
    {
        return $this->request('GET', '/v1/modules/' . self::seg($module) . '/keys/' . self::seg($id) . '/devices', null, $query);
    }

    public function chatSummary(): array
    {
        return $this->request('GET', '/v1/chat/summary');
    }

    /** Kısa aralıklı yoklama için: yalnız değişenler + çevrimiçi ajanlar. */
    public function chatUpdates(): array
    {
        return $this->request('GET', '/v1/chat/updates');
    }

    /** @param array<string, mixed> $query */
    public function listConversations(array $query = []): array
    {
        return $this->request('GET', '/v1/chat/conversations', null, $query);
    }

    public function getConversation(string $id): array
    {
        return $this->request('GET', '/v1/chat/conversations/' . self::seg($id));
    }

    /**
     * `after` imleci `cm_…` mesaj kimliğidir; yoklamada tam listeyi çekmez.
     *
     * @param array<string, mixed> $query
     */
    public function listConversationMessages(string $id, array $query = []): array
    {
        return $this->request('GET', '/v1/chat/conversations/' . self::seg($id) . '/messages', null, $query);
    }

    /**
     * Proaktif sohbet — ziyaretçi yazmadan ajan başlatır.
     *
     * Ziyaretçi üç yoldan adreslenebilir: `visitor_id` (Signalbird kimliği),
     * `contact_id` ya da `external_id` (entegre eden tarafın kendi damgası).
     * Çoğu entegrasyon `visitor_id`'yi bilmez — o kimliği yalnızca tarayıcıdaki
     * sohbet oturumu görür — bu yüzden `external_id` pratikte en kullanışlı
     * olanıdır. Aynı damgaya sahip birden çok ziyaretçi varsa EN SON görülen
     * seçilir.
     *
     * @param array<string, mixed> $input
     */
    public function startConversation(array $input): array
    {
        return $this->request('POST', '/v1/chat/conversations', $input);
    }

    /** @param array<string, mixed> $input */
    public function updateConversation(string $id, array $input): array
    {
        return $this->request('PATCH', '/v1/chat/conversations/' . self::seg($id), $input);
    }

    public function setConversationStatus(string $id, string $status): array
    {
        return $this->request('POST', '/v1/chat/conversations/' . self::seg($id) . '/status', ['status' => $status]);
    }

    /**
     * Atama atomiktir: `userId` verilmezse çağıran anahtarın sahibine atanır.
     * Başkasına atanmış sohbeti devralmak `chat:write` ister.
     */
    public function assignConversation(string $id, int|null $userId = null): array
    {
        return $this->request('POST', '/v1/chat/conversations/' . self::seg($id) . '/assign', ['user_id' => $userId]);
    }

    public function readConversation(string $id, ?string $lastMessageId = null): array
    {
        return $this->request('POST', '/v1/chat/conversations/' . self::seg($id) . '/read', [
            'last_message_id' => $lastMessageId,
        ]);
    }

    public function setTyping(string $id, bool $isTyping): array
    {
        return $this->request('POST', '/v1/chat/conversations/' . self::seg($id) . '/typing', [
            'is_typing' => $isTyping,
        ]);
    }

    /** @param array<string, mixed> $input */
    public function reply(string $id, array $input): array
    {
        return $this->request('POST', '/v1/chat/conversations/' . self::seg($id) . '/messages', $input);
    }

    public function editChatMessage(string $id, string $messageId, string $body): array
    {
        return $this->request(
            'PATCH',
            '/v1/chat/conversations/' . self::seg($id) . '/messages/' . self::seg($messageId),
            ['body' => $body],
        );
    }

    public function deleteChatMessage(string $id, string $messageId): array
    {
        return $this->request(
            'DELETE',
            '/v1/chat/conversations/' . self::seg($id) . '/messages/' . self::seg($messageId),
        );
    }

    /** Tepki açma/kapama — aynı emoji ikinci kez gönderilirse kaldırılır. */
    public function reactToChatMessage(string $id, string $messageId, string $emoji): array
    {
        return $this->request(
            'POST',
            '/v1/chat/conversations/' . self::seg($id) . '/messages/' . self::seg($messageId) . '/reactions',
            ['emoji' => $emoji],
        );
    }

    // ── Sohbet: ziyaretçi ve hazır yanıtlar ───────────────────────────────

    public function getVisitor(string $id): array
    {
        return $this->request('GET', '/v1/chat/visitors/' . self::seg($id));
    }

    /** @param array<string, mixed> $input */
    public function updateVisitor(string $id, array $input): array
    {
        return $this->request('PATCH', '/v1/chat/visitors/' . self::seg($id), $input);
    }

    public function banVisitor(string $id): array
    {
        return $this->request('POST', '/v1/chat/visitors/' . self::seg($id) . '/ban');
    }

    public function listCannedReplies(): array
    {
        return $this->request('GET', '/v1/chat/canned-replies');
    }

    /** @param array<string, mixed> $input */
    public function createCannedReply(array $input): array
    {
        return $this->request('POST', '/v1/chat/canned-replies', $input);
    }

    /** @param array<string, mixed> $input */
    public function updateCannedReply(int|string $id, array $input): array
    {
        return $this->request('PATCH', '/v1/chat/canned-replies/' . self::seg($id), $input);
    }

    public function deleteCannedReply(int|string $id): array
    {
        return $this->request('DELETE', '/v1/chat/canned-replies/' . self::seg($id));
    }

    // ── Sohbet: tetikleyiciler ────────────────────────────────────────────
    // "Şu olduğunda şunu yap." Kural KAYITTA durur, kodda değil.

    public function listChatTriggers(): array
    {
        return $this->request('GET', '/v1/chat/triggers');
    }

    /** @param array<string, mixed> $input */
    public function createChatTrigger(array $input): array
    {
        return $this->request('POST', '/v1/chat/triggers', $input);
    }

    /** @param array<string, mixed> $input */
    public function updateChatTrigger(int|string $id, array $input): array
    {
        return $this->request('PATCH', '/v1/chat/triggers/' . self::seg($id), $input);
    }

    public function deleteChatTrigger(int|string $id): array
    {
        return $this->request('DELETE', '/v1/chat/triggers/' . self::seg($id));
    }

    // ── Sohbet: rapor ─────────────────────────────────────────────────────

    /**
     * Yanıt süresi, çözüm süresi, memnuniyet ve ajan kırılımı.
     * Veri yoksa süreler `null` döner — 0 DEĞİL.
     *
     * @param string $range `7d` | `30d` | `90d`
     */
    public function chatReport(string $range = '30d'): array
    {
        return $this->request('GET', '/v1/chat/reports', null, ['range' => $range]);
    }

    // ── Uygulamalar ───────────────────────────────────────────────────────

    // Uygulama uçları KALDIRILDI (1 Eyl 2026): sohbet widget'ı ve push kanalı
    // birer modül anahtarıdır — `listModuleKeys('chat')`, `listModuleKeys('push')`.

    public function embedToken(array $input): array
    {
        return $this->request('POST', '/v1/embed/tokens', $input);
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
            'X-Signalbird-Key: ' . $this->domainKey,
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
     * `null` alanlar atlanır; diziler `key[]=` biçiminde gider.
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

    /** Yol parçası — kimlikler URL'e gömülmeden önce kodlanır. */
    private static function seg(int|string $value): string
    {
        return rawurlencode((string) $value);
    }
}
