<?php

namespace Signalbird\Sdk\Tests\Management;

use PHPUnit\Framework\TestCase;
use Signalbird\Sdk\Management\ManagementClient;
use Signalbird\Sdk\SignalbirdException;

/**
 * Yönetim istemcisi: anahtar türü, yol kurulumu, sorgu dizesi ve hata eşlemesi.
 *
 * Uçların doğruluğunu API testleri sınar (`signalbird.api`
 * `ManagementApiTest`); buradaki sorular istemciye dair — doğru yola mı
 * gidiyor, kimliği nasıl kodluyor, hatayı nasıl adlandırıyor.
 */
final class ManagementClientTest extends TestCase
{
    // ── Kurulum ───────────────────────────────────────────────────────────

    public function testEmptyKeyThrowsNoKey(): void
    {
        try {
            new ManagementClient('');
            $this->fail('İstisna beklenirdi');
        } catch (SignalbirdException $e) {
            $this->assertSame('NO_KEY', $e->getErrorCode());
        }
    }

    public function testWrongKeyTypeThrows(): void
    {
        foreach (['sbr_live_abc', 'sbr_pub_abc', 'sbw_pub_abc'] as $key) {
            try {
                new ManagementClient($key);
                $this->fail("İstisna beklenirdi: {$key}");
            } catch (SignalbirdException $e) {
                $this->assertSame('WRONG_KEY_TYPE', $e->getErrorCode());
            }
        }
    }

    // ── Telsiz ────────────────────────────────────────────────────────────

    public function testCreateRadioProjectPostsToProjects(): void
    {
        $client = (new FakeManagementClient())
            ->queueJson(201, ['project' => ['id' => 7, 'name' => 'Ödeme'], 'secret' => 'sbr_live_x']);

        $result = $client->createRadioProject(['name' => 'Ödeme']);

        $this->assertTrue($result['ok']);
        $this->assertSame(201, $result['status']);
        $this->assertSame('sbr_live_x', $result['data']['secret']);
        $this->assertSame('POST', $client->lastCall()['method']);
        $this->assertSame('/v1/radio/projects', $client->lastCall()['path']);
    }

    public function testChannelPathCarriesBothIds(): void
    {
        $client = (new FakeManagementClient())->queueJson(200, ['channel' => ['id' => 3]]);

        $client->updateRadioChannel(7, 3, ['level' => 'error']);

        $this->assertSame('PATCH', $client->lastCall()['method']);
        $this->assertSame('/v1/radio/projects/7/channels/3', $client->lastCall()['path']);
        $this->assertSame(['level' => 'error'], $client->lastCall()['body']);
    }

    public function testEventQueryIsEncoded(): void
    {
        $client = (new FakeManagementClient())->queueJson(200, ['data' => []]);

        $client->radioEvents(['level' => 'critical', 'project_id' => 7, 'q' => 'ödeme hatası', 'page' => null]);

        $path = $client->lastCall()['path'];

        $this->assertStringContainsString('level=critical', $path);
        $this->assertStringContainsString('project_id=7', $path);
        // `null` alan atlanır: "gönderilmedi" ile "boş" aynı şey değil.
        $this->assertStringNotContainsString('page=', $path);
        $this->assertStringContainsString('q=%C3%B6deme+hatas%C4%B1', $path);
    }

    // ── Sohbet ────────────────────────────────────────────────────────────

    public function testReplyPostsToConversationMessages(): void
    {
        $client = (new FakeManagementClient())->queueJson(201, ['message' => ['id' => 'cm_1']]);

        $client->reply('c_abc', ['body' => 'Kargonuz yolda.']);

        $this->assertSame('/v1/chat/conversations/c_abc/messages', $client->lastCall()['path']);
        $this->assertSame(['body' => 'Kargonuz yolda.'], $client->lastCall()['body']);
    }

    public function testAssignSendsNullWhenNoUserGiven(): void
    {
        $client = (new FakeManagementClient())->queueJson(200, ['conversation' => []]);

        $client->assignConversation('c_abc');

        // `null` = "bana ata"; alanın kendisi gönderilmeli, atlanmamalı.
        $this->assertSame(['user_id' => null], $client->lastCall()['body']);
    }

    public function testMessageCursorGoesToQueryString(): void
    {
        $client = (new FakeManagementClient())->queueJson(200, ['messages' => []]);

        $client->listConversationMessages('c_abc', ['after' => 'cm_9', 'include_internal' => true]);

        $path = $client->lastCall()['path'];

        $this->assertStringContainsString('after=cm_9', $path);
        // Boole metne çevrilir; `1` göndermek Laravel'de `true` sayılırdı ama
        // sözleşme diller arasında tek biçimi şart koşuyor.
        $this->assertStringContainsString('include_internal=true', $path);
    }

    // ── Uygulamalar ───────────────────────────────────────────────────────

    public function testRotateAppKeyHitsRotateEndpoint(): void
    {
        $client = (new FakeManagementClient())->queueJson(200, ['public_key' => 'sbw_pub_yeni']);

        $result = $client->rotateAppKey(12);

        $this->assertSame('POST', $client->lastCall()['method']);
        $this->assertSame('/v1/apps/12/rotate-key', $client->lastCall()['path']);
        $this->assertSame('sbw_pub_yeni', $result['data']['public_key']);
    }

    // ── Hata eşlemesi ─────────────────────────────────────────────────────

    public function testScopeErrorKeepsServerCode(): void
    {
        $client = (new FakeManagementClient())
            ->queueJson(403, ['message' => 'Yetki kapsamında değil', 'code' => 'API_KEY_SCOPE']);

        $result = $client->listRadioProjects();

        $this->assertFalse($result['ok']);
        $this->assertSame('API_KEY_SCOPE', $result['code']);
        $this->assertSame(403, $result['status']);
    }

    public function testValidationErrorWithoutCodeBecomesValidationError(): void
    {
        $client = (new FakeManagementClient())
            ->queueJson(422, ['message' => 'The name field is required.', 'errors' => ['name' => ['zorunlu']]]);

        $result = $client->createRadioProject([]);

        $this->assertSame('VALIDATION_ERROR', $result['code']);
    }

    public function testNetworkErrorIsSilentByDefault(): void
    {
        $client = (new FakeManagementClient())->queueNetworkError();

        $result = $client->chatSummary();

        $this->assertFalse($result['ok']);
        $this->assertSame('NETWORK_ERROR', $result['code']);
        $this->assertSame(0, $result['status']);
    }

    public function testThrowOnErrorRaisesWithCodeAndStatus(): void
    {
        $client = (new FakeManagementClient('sb_test_key', null, throwOnError: true))
            ->queueJson(404, ['message' => 'Bulunamadı']);

        try {
            $client->getApp(99);
            $this->fail('İstisna beklenirdi');
        } catch (SignalbirdException $e) {
            $this->assertSame('HTTP_404', $e->getErrorCode());
            $this->assertSame(404, $e->getStatus());
            $this->assertSame(['message' => 'Bulunamadı'], $e->getBody());
        }
    }
}
