<?php

namespace Signalbird\Sdk\Tests\Management;

use Signalbird\Sdk\Management\ManagementClient;

/**
 * cURL yerine kuyruğa alınmış yanıtları döner; her `transport()` çağrısını kaydeder.
 *
 * `FakeMessagingClient` ile aynı desen — iki istemci aynı taşıma sözleşmesini
 * paylaşır, testleri de aynı şekilde kurulur.
 */
final class FakeManagementClient extends ManagementClient
{
    /** @var array<int, array{method: string, path: string, body: ?array}> */
    public array $calls = [];

    /** @var array<int, array{status: int, body: ?string, error: ?string, errno: int}> */
    private array $queue = [];

    public function __construct(string $domainKey = 'sb_secret_live_test', ?string $baseUrl = null, bool $throwOnError = false)
    {
        parent::__construct($domainKey, $baseUrl, 15, $throwOnError);
    }

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

    public function queueNetworkError(string $error = 'Could not resolve host', int $errno = CURLE_COULDNT_RESOLVE_HOST): self
    {
        $this->queue[] = ['status' => 0, 'body' => null, 'error' => $error, 'errno' => $errno];

        return $this;
    }

    protected function transport(string $method, string $path, ?array $body): array
    {
        $this->calls[] = ['method' => $method, 'path' => $path, 'body' => $body];

        if ($this->queue === []) {
            throw new \LogicException("FakeManagementClient: kuyrukta yanıt yok ({$method} {$path})");
        }

        return array_shift($this->queue);
    }

    /** @return array{method: string, path: string, body: ?array} */
    public function lastCall(): array
    {
        return $this->calls[count($this->calls) - 1];
    }
}
