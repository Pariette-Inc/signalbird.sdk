<?php

namespace Signalbird\Sdk\Tests\Messaging;

use PHPUnit\Framework\TestCase;
use Signalbird\Sdk\Messaging\Webhook;

final class WebhookTest extends TestCase
{
    private const SECRET = 'whsec_test_123';

    private const BODY = '{"event":"message.delivered","id":"msg_1","ü":"ğ"}';

    private function sign(string $body, string $secret = self::SECRET): string
    {
        return 'sha256=' . hash_hmac('sha256', $body, $secret);
    }

    public function testValidSignatureIsAccepted(): void
    {
        $this->assertTrue(Webhook::verify(self::BODY, $this->sign(self::BODY), self::SECRET));
    }

    public function testUppercaseHexAndSurroundingWhitespaceAreAccepted(): void
    {
        $header = '  ' . strtoupper($this->sign(self::BODY)) . "\n";
        $header = str_replace('SHA256=', 'sha256=', $header);

        $this->assertTrue(Webhook::verify(self::BODY, $header, self::SECRET));
    }

    public function testTamperedBodyIsRejected(): void
    {
        $this->assertFalse(Webhook::verify(self::BODY . ' ', $this->sign(self::BODY), self::SECRET));
    }

    public function testWrongSecretIsRejected(): void
    {
        $this->assertFalse(Webhook::verify(self::BODY, $this->sign(self::BODY, 'other'), self::SECRET));
    }

    public function testBadPrefixIsRejected(): void
    {
        $hex = hash_hmac('sha256', self::BODY, self::SECRET);

        $this->assertFalse(Webhook::verify(self::BODY, 'sha1=' . $hex, self::SECRET));
        $this->assertFalse(Webhook::verify(self::BODY, $hex, self::SECRET));
        $this->assertFalse(Webhook::verify(self::BODY, 'sha256=' . $hex . 'zz', self::SECRET));
    }

    public function testMissingHeaderOrSecretIsRejected(): void
    {
        $this->assertFalse(Webhook::verify(self::BODY, null, self::SECRET));
        $this->assertFalse(Webhook::verify(self::BODY, '', self::SECRET));
        $this->assertFalse(Webhook::verify(self::BODY, $this->sign(self::BODY), ''));
    }
}
