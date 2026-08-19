<?php

namespace Signalbird\Sdk\Tests\Messaging;

use Signalbird\Sdk\Messaging\MessagingClient;

/**
 * cURL yerine kuyruğa alınmış yanıtları döner; her `transport()` çağrısını kaydeder.
 */
final class FakeMessagingClient extends MessagingClient
{
    /** @var array<int, array{method: string, path: string, body: ?array}> */
    public array $calls = [];

    /** @var array<int, array{status: int, body: ?string, error: ?string, errno: int}> */
    private array $queue = [];

    public function __construct(string $apiKey = 'sb_test_key', ?string $baseUrl = null, bool $throwOnError = false)
    {
        parent::__construct($apiKey, $baseUrl, 15, $throwOnError);
    }

    /** JSON gövdeli HTTP yanıtı kuyruğa ekler. */
    public function queueJson(int $status, mixed $payload): self
    {
        $this->queue[] = [
            'status' => $status,
            'body' => $payload === null ? '' : json_encode($payload, JSON_UNESCAPED_UNICODE),
            'error' => null,
            'errno' => 0,
        ];

        return $this;
    }

    /** Ham (ör. JSON olmayan) gövdeli yanıt kuyruğa ekler. */
    public function queueRaw(int $status, string $body): self
    {
        $this->queue[] = ['status' => $status, 'body' => $body, 'error' => null, 'errno' => 0];

        return $this;
    }

    /** cURL hatası kuyruğa ekler. */
    public function queueNetworkError(string $error = 'Could not resolve host', int $errno = CURLE_COULDNT_RESOLVE_HOST): self
    {
        $this->queue[] = ['status' => 0, 'body' => null, 'error' => $error, 'errno' => $errno];

        return $this;
    }

    protected function transport(string $method, string $path, ?array $body): array
    {
        $this->calls[] = ['method' => $method, 'path' => $path, 'body' => $body];

        if ($this->queue === []) {
            throw new \LogicException("FakeMessagingClient: kuyrukta yanıt yok ({$method} {$path})");
        }

        return array_shift($this->queue);
    }
}
