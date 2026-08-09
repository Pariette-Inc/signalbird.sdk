<?php

namespace Signalbird\Sdk;

use GuzzleHttp\Client;
use GuzzleHttp\Exception\RequestException;

class SignalbirdClient
{
    private Client $http;
    private string $apiKey;

    private const PRODUCTION_URL = 'https://live.signalbird.io/api';
    private const TEST_URL = 'http://localhost/api';

    public function __construct(string $apiKey, string $mode = 'production', int $timeout = 10)
    {
        $this->apiKey = $apiKey;

        $baseUrl = $mode === 'test' ? self::TEST_URL : self::PRODUCTION_URL;

        $this->http = new Client([
            'base_uri' => rtrim($baseUrl, '/') . '/',
            'timeout'  => $timeout,
            'headers'  => [
                'Content-Type' => 'application/json',
                'Accept'       => 'application/json',
            ],
        ]);
    }

    /**
     * @throws SignalbirdException
     */
    public function trigger(string $title, string $message, string $level): array
    {
        try {
            $response = $this->http->post("sdk/log/{$this->apiKey}", [
                'json' => [
                    'title'   => $title,
                    'message' => $message,
                    'level'   => $level,
                ],
            ]);

            return json_decode((string) $response->getBody(), true);
        } catch (RequestException $e) {
            $statusCode = $e->getResponse()?->getStatusCode() ?? 0;
            $body = $e->getResponse() ? (string) $e->getResponse()->getBody() : $e->getMessage();
            $decoded = json_decode($body, true);
            $detail = $decoded['message'] ?? $body;

            throw new SignalbirdException($detail, $statusCode, $decoded);
        }
    }
}
