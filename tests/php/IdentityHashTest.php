<?php

namespace Signalbird\Sdk\Tests;

use PHPUnit\Framework\TestCase;
use Signalbird\Sdk\Signalbird;
use Signalbird\Sdk\SignalbirdClient;

/**
 * CONTRACT §15.2 - kimlik doğrulama hash'i.
 *
 * Vektör sözleşmedekiyle aynıdır; Node, Python, Go ve .NET aynı çıktıyı
 * üretmek zorundadır (sunucu yalnız anahtarın SHA-256 özetini saklar).
 */
final class IdentityHashTest extends TestCase
{
    private const SECRET = 'sb_secret_live_example0000000000';

    private const EXPECTED = 'b802f38c59cb0f0c9283d6a8091c692c6c70db549acab1083c630426e2916258';

    public function testKnownVector(): void
    {
        $client = new SignalbirdClient(self::SECRET);

        $this->assertSame(self::EXPECTED, $client->identityHash('user_42'));
    }

    public function testKeyIsTheSha256HexOfTheSecretNotTheSecretItself(): void
    {
        $client = new SignalbirdClient(self::SECRET);

        $this->assertNotSame(hash_hmac('sha256', 'user_42', self::SECRET), $client->identityHash('user_42'));
        $this->assertSame(64, strlen($client->identityHash('başka-kullanıcı')));
        $this->assertMatchesRegularExpression('/^[0-9a-f]{64}$/', $client->identityHash(''));
    }

    public function testStaticAccessForwardsToClient(): void
    {
        Signalbird::configure(self::SECRET);

        $this->assertSame(self::EXPECTED, Signalbird::identityHash('user_42'));
    }
}
