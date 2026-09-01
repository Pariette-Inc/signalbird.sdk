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
        foreach (['sb_public_live_abc', 'sbr_live_abc', 'x'] as $key) {
            try {
                new ManagementClient($key);
                $this->fail("İstisna beklenirdi: {$key}");
            } catch (SignalbirdException $e) {
                $this->assertSame('WRONG_KEY_TYPE', $e->getErrorCode());
            }
        }
    }

    // ── Telsiz ────────────────────────────────────────────────────────────

    /**
     * Kanal açmak MODÜL yoluna gider ve anahtar (`key`) yanıtta döner.
     *
     * Eskiden burada proje açılıyor ve gizli bir `secret` dönüyordu; proje
     * kavramı 1 Eyl 2026'da kalktı ve kanalın sırrı yok — sır domain
     * anahtarındadır (KEY_ARCHITECTURE §2).
     */
    public function testCreateModuleKeyPostsToModulePath(): void
    {
        $client = (new FakeManagementClient())
            ->queueJson(201, ['module_key' => ['id' => 7, 'key' => 'kritikApiHatasi']]);

        $result = $client->createModuleKey('logger', ['title' => 'Kritik API hatası']);

        $this->assertTrue($result['ok']);
        $this->assertSame(201, $result['status']);
        $this->assertSame('kritikApiHatasi', $result['data']['module_key']['key']);
        $this->assertSame('POST', $client->lastCall()['method']);
        $this->assertSame('/v1/modules/logger/keys', $client->lastCall()['path']);
    }

    /**
     * Ad DEĞİŞTİRİLEBİLİR: eski ad 30 gün daha kabul edilir, böylece
     * üretimdeki kod bir sonraki deploya kadar kayıt kaybetmez.
     */
    public function testModuleKeyRenameKeepsPreviousName(): void
    {
        $client = (new FakeManagementClient())
            ->queueJson(200, ['module_key' => ['id' => 3, 'key' => 'yeniAd', 'previous_key' => 'eskiAd']]);

        $client->updateModuleKey('logger', 3, ['key' => 'yeniAd']);

        $this->assertSame('PATCH', $client->lastCall()['method']);
        $this->assertSame('/v1/modules/logger/keys/3', $client->lastCall()['path']);
        $this->assertSame(['key' => 'yeniAd'], $client->lastCall()['body']);
    }

    public function testEventQueryIsEncoded(): void
    {
        $client = (new FakeManagementClient())->queueJson(200, ['data' => []]);

        $client->radioEvents(['level' => 'critical', 'module_key_id' => 7, 'q' => 'ödeme hatası', 'page' => null]);

        $path = $client->lastCall()['path'];

        $this->assertStringContainsString('level=critical', $path);
        $this->assertStringContainsString('module_key_id=7', $path);
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

    /** Push kanalının cihaz listesi modül yolundan okunur. */
    public function testModuleKeyDevicesPathCarriesModuleAndId(): void
    {
        $client = (new FakeManagementClient())->queueJson(200, ['data' => []]);

        $client->listModuleKeyDevices('push', 12);

        $this->assertSame('GET', $client->lastCall()['method']);
        $this->assertSame('/v1/modules/push/keys/12/devices', $client->lastCall()['path']);
    }

    // ── Hata eşlemesi ─────────────────────────────────────────────────────

    public function testScopeErrorKeepsServerCode(): void
    {
        $client = (new FakeManagementClient())
            ->queueJson(403, ['message' => 'Bu uç gizli anahtar ister', 'code' => 'SECRET_KEY_REQUIRED']);

        $result = $client->listModuleKeys('logger');

        $this->assertFalse($result['ok']);
        $this->assertSame('SECRET_KEY_REQUIRED', $result['code']);
        $this->assertSame(403, $result['status']);
    }

    public function testValidationErrorWithoutCodeBecomesValidationError(): void
    {
        $client = (new FakeManagementClient())
            ->queueJson(422, ['message' => 'The name field is required.', 'errors' => ['name' => ['zorunlu']]]);

        $result = $client->createModuleKey('logger', []);

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
        $client = (new FakeManagementClient('sb_secret_live_test', null, throwOnError: true))
            ->queueJson(404, ['message' => 'Bulunamadı']);

        try {
            $client->getModuleKey('chat', 99);
            $this->fail('İstisna beklenirdi');
        } catch (SignalbirdException $e) {
            $this->assertSame('HTTP_404', $e->getErrorCode());
            $this->assertSame(404, $e->getStatus());
            $this->assertSame(['message' => 'Bulunamadı'], $e->getBody());
        }
    }
}
