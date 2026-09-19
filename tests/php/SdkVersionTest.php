<?php

namespace Signalbird\Sdk\Tests;

use PHPUnit\Framework\TestCase;
use Signalbird\Sdk\SdkVersion;
use Signalbird\Sdk\Tests\Messaging\FakeMessagingClient;

/**
 * CONTRACT §14 - sürüm başlığı ve "bir kez uyar".
 */
final class SdkVersionTest extends TestCase
{
    private string $log;

    private string|false $previousLog;

    protected function setUp(): void
    {
        SdkVersion::resetWarning();
        $this->log = tempnam(sys_get_temp_dir(), 'sb-sdk-');
        $this->previousLog = ini_set('error_log', $this->log);
    }

    protected function tearDown(): void
    {
        ini_set('error_log', (string) $this->previousLog);
        @unlink($this->log);
        SdkVersion::resetWarning();
    }

    public function testHeaderLineCarriesPlatformAndLockedVersion(): void
    {
        $this->assertSame('X-Signalbird-Sdk: php/' . SdkVersion::VERSION, SdkVersion::headerLine());

        // Kilitli sürüm: kökteki VERSION ile aynı olmalı (sync-version.mjs yazar).
        $this->assertSame(trim((string) file_get_contents(__DIR__ . '/../../VERSION')), SdkVersion::VERSION);
    }

    public function testCollectorKeepsOnlySdkHeadersLowercased(): void
    {
        $headers = [];
        $collect = SdkVersion::collector($headers);

        foreach (["HTTP/1.1 200 OK\r\n", "Content-Type: application/json\r\n", "Signalbird-Sdk-Status: outdated\r\n", "signalbird-sdk-latest:  2.7.0 \r\n", "\r\n"] as $line) {
            $this->assertSame(strlen($line), $collect(null, $line), 'cURL satır uzunluğunu bekler, yoksa aktarımı keser');
        }

        $this->assertSame(['signalbird-sdk-status' => 'outdated', 'signalbird-sdk-latest' => '2.7.0'], $headers);
    }

    public function testOutdatedResponseWarnsOnceAndDoesNotChangeResult(): void
    {
        $client = (new FakeMessagingClient())
            ->queueJson(200, ['ok' => true], ['signalbird-sdk-status' => 'outdated', 'signalbird-sdk-latest' => '9.0.0'])
            ->queueJson(200, ['ok' => true], ['signalbird-sdk-status' => 'outdated', 'signalbird-sdk-latest' => '9.0.0']);

        $this->assertTrue($client->listContactLists()['ok']);
        $this->assertTrue($client->listContactLists()['ok']);

        $this->assertTrue(SdkVersion::hasWarned());
        $written = (string) file_get_contents($this->log);
        $this->assertSame(1, substr_count($written, '[signalbird]'), 'Uyarı süreç başına bir kez');
        $this->assertStringContainsString('9.0.0', $written);
    }

    public function testCurrentOrMissingStatusStaysSilent(): void
    {
        $client = (new FakeMessagingClient())
            ->queueJson(200, ['ok' => true], ['signalbird-sdk-status' => 'current'])
            ->queueJson(200, ['ok' => true]);

        $client->listContactLists();
        $client->listContactLists();

        $this->assertFalse(SdkVersion::hasWarned());
        $this->assertSame('', (string) file_get_contents($this->log));
    }
}
