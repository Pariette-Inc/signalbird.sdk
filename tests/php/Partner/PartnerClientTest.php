<?php

namespace Signalbird\Sdk\Tests\Partner;

use PHPUnit\Framework\TestCase;
use Signalbird\Sdk\Partner\PartnerClient;
use Signalbird\Sdk\SignalbirdException;

/**
 * Partner istemcisi: anahtar türü, yol kurulumu, sorgu dizesi, hata eşlemesi.
 *
 * Uçların doğruluğunu API testleri sınar (`signalbird.api`
 * `PartnerPlatformTest`); buradaki sorular istemciye dair.
 *
 * Sözleşme: docs/CONTRACT.md § 12
 */
final class PartnerClientTest extends TestCase
{
    public function testEmptyKeyThrowsNoKey(): void
    {
        try {
            new PartnerClient('');
            $this->fail('İstisna beklenirdi');
        } catch (SignalbirdException $e) {
            $this->assertSame('NO_KEY', $e->getErrorCode());
        }
    }

    /** Takım anahtarı partner yüzeyinde çalışmaz; kurulumda söylenir. */
    public function testWrongKeyTypeThrows(): void
    {
        foreach (['sb_public_live_abc', 'sb_abc', 'x'] as $key) {
            try {
                new PartnerClient($key);
                $this->fail("İstisna beklenirdi: {$key}");
            } catch (SignalbirdException $e) {
                $this->assertSame('WRONG_KEY_TYPE', $e->getErrorCode());
            }
        }
    }

    public function testCreateCompanyPostsToPartnerRoot(): void
    {
        $client = (new FakePartnerClient())->queueJson(201, ['created' => true]);

        $result = $client->createCompany([
            'external_id' => 'sc_1',
            'name' => 'Acme',
            'owner' => ['email' => 'a@acme.test'],
        ]);

        $this->assertTrue($result['ok']);
        $this->assertSame('POST', $client->lastCall()['method']);
        $this->assertSame('/v1/partner/companies', $client->lastCall()['path']);
        $this->assertSame('sc_1', $client->lastCall()['body']['external_id']);
    }

    /** Dış kimlik yolun içinde gider; URL-kodlanmalı. */
    public function testExternalIdIsUrlEncoded(): void
    {
        $client = (new FakePartnerClient())->queueJson(200, []);

        $client->getCompany('sc/1 2');

        $this->assertSame('/v1/partner/companies/sc%2F1%202', $client->lastCall()['path']);
    }

    public function testDomainUptimeSendsRange(): void
    {
        $client = (new FakePartnerClient())->queueJson(200, ['uptime' => 99.9]);

        $client->domainUptime('d_1', '7d');

        $this->assertSame('/v1/partner/domains/d_1/uptime?range=7d', $client->lastCall()['path']);
    }

    public function testRevokeModuleUsesDelete(): void
    {
        $client = (new FakePartnerClient())->queueJson(200, ['removed' => true]);

        $client->revokeModule('sc_1', 'email');

        $this->assertSame('DELETE', $client->lastCall()['method']);
        $this->assertSame('/v1/partner/companies/sc_1/modules/email', $client->lastCall()['path']);
    }

    /** Sunucunun `code` alanı olduğu gibi taşınır (§8.2 ile aynı eşleme). */
    public function testServerCodeIsPreserved(): void
    {
        $client = (new FakePartnerClient())->queueJson(422, [
            'message' => 'Bu müşteri için tanımlı alan adı sınırına ulaşıldı.',
            'code' => 'PARTNER_DOMAIN_LIMIT',
        ]);

        $result = $client->addDomain('sc_1', ['external_id' => 'd_2', 'domain' => 'x.com']);

        $this->assertFalse($result['ok']);
        $this->assertSame('PARTNER_DOMAIN_LIMIT', $result['code']);
        $this->assertSame(422, $result['status']);
    }

    public function testUnauthorizedWithoutCodeMapsToApiKeyInvalid(): void
    {
        $client = (new FakePartnerClient())->queueJson(401, ['message' => '']);

        $result = $client->listCompanies();

        $this->assertSame('API_KEY_INVALID', $result['code']);
    }
}
