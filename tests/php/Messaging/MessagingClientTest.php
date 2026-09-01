<?php

namespace Signalbird\Sdk\Tests\Messaging;

use PHPUnit\Framework\TestCase;
use Signalbird\Sdk\Messaging\MessagingClient;
use Signalbird\Sdk\SignalbirdException;

final class MessagingClientTest extends TestCase
{
    // ── Kurulum ───────────────────────────────────────────────────────────

    public function testEmptyKeyThrowsNoKey(): void
    {
        try {
            new MessagingClient('');
            $this->fail('İstisna beklenirdi');
        } catch (SignalbirdException $e) {
            $this->assertSame('NO_KEY', $e->getErrorCode());
            $this->assertSame(0, $e->getStatus());
        }
    }

    public function testWrongKeyTypeThrows(): void
    {
        try {
            new MessagingClient('sb_public_live_abc');
            $this->fail('İstisna beklenirdi');
        } catch (SignalbirdException $e) {
            $this->assertSame('WRONG_KEY_TYPE', $e->getErrorCode());
        }

        try {
            new MessagingClient('sb_public_live_abc');
            $this->fail('İstisna beklenirdi');
        } catch (SignalbirdException $e) {
            $this->assertSame('WRONG_KEY_TYPE', $e->getErrorCode());
        }
    }

    public function testLegacyExceptionConstructionStillWorks(): void
    {
        $e = new SignalbirdException('eski çağrı');

        $this->assertSame('eski çağrı', $e->getMessage());
        $this->assertNull($e->getErrorCode());
        $this->assertSame(0, $e->getStatus());
        $this->assertNull($e->getBody());
    }

    // ── Gönderim ──────────────────────────────────────────────────────────

    public function testSendEmailPostsJsonAndReturnsOk(): void
    {
        $sdk = new FakeMessagingClient();
        $sdk->queueJson(202, ['id' => 'msg_1', 'status' => 'queued', 'units' => 1]);

        $input = ['to' => 'a@b.co', 'class' => 'transactional', 'subject' => 'Merhaba', 'body' => 'Selam'];
        $result = $sdk->sendEmail($input);

        $this->assertCount(1, $sdk->calls);
        $this->assertSame('POST', $sdk->calls[0]['method']);
        $this->assertSame('/v1/email/send', $sdk->calls[0]['path']);
        $this->assertSame($input, $sdk->calls[0]['body']);

        $this->assertSame([
            'ok' => true,
            'status' => 202,
            'data' => ['id' => 'msg_1', 'status' => 'queued', 'units' => 1],
            'code' => null,
            'message' => null,
        ], $result);
    }

    public function testPreviewSmsWrapsBody(): void
    {
        $sdk = new FakeMessagingClient();
        $sdk->queueJson(200, ['units' => 2]);

        $result = $sdk->previewSms('uzun mesaj');

        $this->assertSame('POST', $sdk->calls[0]['method']);
        $this->assertSame('/v1/sms/preview', $sdk->calls[0]['path']);
        $this->assertSame(['body' => 'uzun mesaj'], $sdk->calls[0]['body']);
        $this->assertTrue($result['ok']);
        $this->assertSame(2, $result['data']['units']);
    }

    // ── Hata eşleme ───────────────────────────────────────────────────────

    public function testHttpErrorWithCodeIsMapped(): void
    {
        $sdk = new FakeMessagingClient();
        $sdk->queueJson(403, ['message' => 'Kanal kapalı', 'code' => 'CHANNEL_DISABLED']);

        $result = $sdk->sendSms(['to' => '+90', 'class' => 'transactional', 'body' => 'x']);

        $this->assertFalse($result['ok']);
        $this->assertSame(403, $result['status']);
        $this->assertSame('CHANNEL_DISABLED', $result['code']);
        $this->assertSame('Kanal kapalı', $result['message']);
        $this->assertSame(['message' => 'Kanal kapalı', 'code' => 'CHANNEL_DISABLED'], $result['data']);
    }

    public function testValidationErrorWithoutCode(): void
    {
        $sdk = new FakeMessagingClient();
        $sdk->queueJson(422, ['message' => 'The to field is required.', 'errors' => ['to' => ['required']]]);

        $result = $sdk->sendEmail([]);

        $this->assertFalse($result['ok']);
        $this->assertSame(422, $result['status']);
        $this->assertSame('VALIDATION_ERROR', $result['code']);
        $this->assertSame('The to field is required.', $result['message']);
    }

    public function testUnauthorizedAndGenericStatusFallbacks(): void
    {
        $sdk = new FakeMessagingClient();
        $sdk->queueRaw(401, '');
        $sdk->queueRaw(500, '<html>oops</html>');

        $unauth = $sdk->getMessage('m1');
        $this->assertSame('API_KEY_INVALID', $unauth['code']);
        $this->assertSame('HTTP 401', $unauth['message']);
        $this->assertNull($unauth['data']);

        $server = $sdk->getMessage('m2');
        $this->assertSame('HTTP_500', $server['code']);
        $this->assertSame('HTTP 500', $server['message']);
        $this->assertSame('<html>oops</html>', $server['data']);
    }

    public function testNetworkErrorReturnsStatusZero(): void
    {
        $sdk = new FakeMessagingClient();
        $sdk->queueNetworkError('Could not resolve host: signalbird.io');

        $result = $sdk->listMessages();

        $this->assertSame([
            'ok' => false,
            'status' => 0,
            'data' => null,
            'code' => 'NETWORK_ERROR',
            'message' => 'Could not resolve host: signalbird.io',
        ], $result);
    }

    public function testTimeoutIsDistinguished(): void
    {
        $sdk = new FakeMessagingClient();
        $sdk->queueNetworkError('Operation timed out after 15000 milliseconds', CURLE_OPERATION_TIMEOUTED);

        $result = $sdk->listMessages();

        $this->assertSame('TIMEOUT', $result['code']);
        $this->assertSame(0, $result['status']);
    }

    public function testThrowOnErrorThrowsWithDetails(): void
    {
        $sdk = new FakeMessagingClient(throwOnError: true);
        $sdk->queueJson(429, ['message' => 'Kota doldu', 'code' => 'QUOTA_EXCEEDED']);

        try {
            $sdk->sendPush(['to' => 'tok', 'class' => 'commercial', 'subject' => 's', 'body' => 'b']);
            $this->fail('İstisna beklenirdi');
        } catch (SignalbirdException $e) {
            $this->assertSame('QUOTA_EXCEEDED', $e->getErrorCode());
            $this->assertSame(429, $e->getStatus());
            $this->assertSame(['message' => 'Kota doldu', 'code' => 'QUOTA_EXCEEDED'], $e->getBody());
            $this->assertStringContainsString('QUOTA_EXCEEDED', $e->getMessage());
            $this->assertStringContainsString('Kota doldu', $e->getMessage());
        }
    }

    public function testThrowOnErrorAlsoThrowsOnNetworkFailure(): void
    {
        $sdk = new FakeMessagingClient(throwOnError: true);
        $sdk->queueNetworkError();

        $this->expectException(SignalbirdException::class);
        $sdk->listContactLists();
    }

    // ── Kişiler ───────────────────────────────────────────────────────────

    public function testListContactsBuildsQueryAndSkipsNulls(): void
    {
        $sdk = new FakeMessagingClient();
        $sdk->queueJson(200, ['data' => [], 'last_page' => 1]);

        $sdk->listContacts(['page' => 2, 'per_page' => 50, 'q' => null, 'list_id' => null]);

        $this->assertSame('GET', $sdk->calls[0]['method']);
        $this->assertSame('/v1/contacts?page=2&per_page=50', $sdk->calls[0]['path']);
        $this->assertNull($sdk->calls[0]['body']);
    }

    public function testListContactsWithoutQueryHasNoQuestionMark(): void
    {
        $sdk = new FakeMessagingClient();
        $sdk->queueJson(200, ['data' => []]);

        $sdk->listContacts();

        $this->assertSame('/v1/contacts', $sdk->calls[0]['path']);
    }

    public function testQueryArraysAndEncoding(): void
    {
        $sdk = new FakeMessagingClient();
        $sdk->queueJson(200, ['data' => []]);

        $sdk->listMessages(['status' => ['sent', 'failed'], 'q' => 'a b&c']);

        $this->assertSame('/v1/messages?status%5B%5D=sent&status%5B%5D=failed&q=a+b%26c', $sdk->calls[0]['path']);
    }

    public function testUpdateContactUsesPatchWithEncodedId(): void
    {
        $sdk = new FakeMessagingClient();
        $sdk->queueJson(200, ['id' => 7, 'first_name' => 'Ayşe']);

        $result = $sdk->updateContact(7, ['first_name' => 'Ayşe']);

        $this->assertSame('PATCH', $sdk->calls[0]['method']);
        $this->assertSame('/v1/contacts/7', $sdk->calls[0]['path']);
        $this->assertSame(['first_name' => 'Ayşe'], $sdk->calls[0]['body']);
        $this->assertSame('Ayşe', $result['data']['first_name']);

        $sdk->queueJson(200, []);
        $sdk->deleteContact('a/b c');
        $this->assertSame('DELETE', $sdk->calls[1]['method']);
        $this->assertSame('/v1/contacts/a%2Fb%20c', $sdk->calls[1]['path']);
    }

    public function testBulkContactsChunksAndMerges(): void
    {
        $sdk = new FakeMessagingClient();
        $sdk->queueJson(200, ['imported' => 900, 'updated' => 100, 'skipped' => []]);
        $sdk->queueJson(200, ['imported' => 950, 'updated' => 40, 'skipped' => [['email' => 'x@y.z']]]);
        $sdk->queueJson(200, ['imported' => 400, 'updated' => 90, 'skipped' => [['email' => 'q@y.z']]]);

        $contacts = [];
        for ($i = 0; $i < 2500; $i++) {
            $contacts[] = ['email' => "user{$i}@example.com"];
        }

        $result = $sdk->bulkContacts(['contacts' => $contacts, 'list_id' => 3, 'consent_source' => 'import']);

        $this->assertCount(3, $sdk->calls);
        $this->assertSame([1000, 1000, 500], array_map(fn ($c) => count($c['body']['contacts']), $sdk->calls));

        foreach ($sdk->calls as $call) {
            $this->assertSame('POST', $call['method']);
            $this->assertSame('/v1/contacts/bulk', $call['path']);
            $this->assertSame(3, $call['body']['list_id']);
            $this->assertSame('import', $call['body']['consent_source']);
        }

        $this->assertSame('user0@example.com', $sdk->calls[0]['body']['contacts'][0]['email']);
        $this->assertSame('user1000@example.com', $sdk->calls[1]['body']['contacts'][0]['email']);
        $this->assertSame('user2499@example.com', $sdk->calls[2]['body']['contacts'][499]['email']);

        $this->assertTrue($result['ok']);
        $this->assertSame(200, $result['status']);
        $this->assertSame([
            'imported' => 2250,
            'updated' => 230,
            'skipped' => [['email' => 'x@y.z'], ['email' => 'q@y.z']],
        ], $result['data']);
    }

    public function testBulkContactsStopsOnFailureAndReturnsMergedSoFar(): void
    {
        $sdk = new FakeMessagingClient();
        $sdk->queueJson(200, ['imported' => 1000, 'updated' => 0, 'skipped' => []]);
        $sdk->queueJson(422, ['message' => 'Geçersiz e-posta', 'code' => 'INVALID_EMAIL']);

        $contacts = array_fill(0, 2500, ['email' => 'a@b.co']);
        $result = $sdk->bulkContacts(['contacts' => $contacts]);

        $this->assertCount(2, $sdk->calls);
        $this->assertFalse($result['ok']);
        $this->assertSame(422, $result['status']);
        $this->assertSame('INVALID_EMAIL', $result['code']);
        $this->assertSame('Geçersiz e-posta', $result['message']);
        $this->assertSame(['imported' => 1000, 'updated' => 0, 'skipped' => []], $result['data']);
    }

    public function testBulkContactsEmptyReturnsZerosWithoutRequest(): void
    {
        $sdk = new FakeMessagingClient();

        $result = $sdk->bulkContacts(['contacts' => []]);

        $this->assertSame([], $sdk->calls);
        $this->assertSame([
            'ok' => true,
            'status' => 200,
            'data' => ['imported' => 0, 'updated' => 0, 'skipped' => []],
            'code' => null,
            'message' => null,
        ], $result);
    }

    // ── Kampanyalar ───────────────────────────────────────────────────────

    public function testCampaignRoutes(): void
    {
        $sdk = new FakeMessagingClient();
        $sdk->queueJson(201, ['id' => 42]);
        $sdk->queueJson(200, ['id' => 42]);
        $sdk->queueJson(200, ['ok' => true]);
        $sdk->queueJson(200, ['data' => []]);

        $sdk->createCampaign(['name' => 'K', 'channel' => 'email', 'list_id' => 1, 'body' => 'b']);
        $sdk->getCampaign(42);
        $sdk->cancelCampaign(42);
        $sdk->listCampaignMessages(42, ['status' => 'failed', 'page' => 3, 'per_page' => null]);

        $this->assertSame(['POST', '/v1/campaigns'], [$sdk->calls[0]['method'], $sdk->calls[0]['path']]);
        $this->assertSame(['GET', '/v1/campaigns/42'], [$sdk->calls[1]['method'], $sdk->calls[1]['path']]);
        $this->assertSame(['POST', '/v1/campaigns/42/cancel'], [$sdk->calls[2]['method'], $sdk->calls[2]['path']]);
        $this->assertNull($sdk->calls[2]['body']);
        $this->assertSame(
            ['GET', '/v1/campaigns/42/messages?status=failed&page=3'],
            [$sdk->calls[3]['method'], $sdk->calls[3]['path']],
        );
    }

    public function testIterateCampaignMessagesWalksPages(): void
    {
        $sdk = new FakeMessagingClient();
        $sdk->queueJson(200, ['data' => [['id' => 'm1'], ['id' => 'm2']], 'current_page' => 1, 'last_page' => 2]);
        $sdk->queueJson(200, ['data' => [['id' => 'm3']], 'current_page' => 2, 'last_page' => 2]);

        $ids = [];
        foreach ($sdk->iterateCampaignMessages(42, ['status' => 'sent']) as $message) {
            $ids[] = $message['id'];
        }

        $this->assertSame(['m1', 'm2', 'm3'], $ids);
        $this->assertCount(2, $sdk->calls);
        $this->assertSame('/v1/campaigns/42/messages?per_page=100&status=sent&page=1', $sdk->calls[0]['path']);
        $this->assertSame('/v1/campaigns/42/messages?per_page=100&status=sent&page=2', $sdk->calls[1]['path']);
    }

    public function testIterateCampaignMessagesThrowsOnFailedPage(): void
    {
        $sdk = new FakeMessagingClient();
        $sdk->queueJson(200, ['data' => [['id' => 'm1']], 'last_page' => 3]);
        $sdk->queueJson(500, ['message' => 'patladı']);

        $seen = [];

        try {
            foreach ($sdk->iterateCampaignMessages(1) as $message) {
                $seen[] = $message['id'];
            }
            $this->fail('İstisna beklenirdi');
        } catch (SignalbirdException $e) {
            $this->assertSame(['m1'], $seen);
            $this->assertSame('HTTP_500', $e->getErrorCode());
            $this->assertSame(500, $e->getStatus());
        }
    }

    // ── Kök URL ───────────────────────────────────────────────────────────

    public function testPublicSurfaceMatchesNode(): void
    {
        $expected = [
            'sendEmail', 'sendSms', 'previewSms', 'sendPush', 'track',
            'listContacts', 'createContact', 'updateContact', 'deleteContact', 'bulkContacts',
            'listContactLists', 'createContactList', 'deleteContactList',
            'listCampaigns', 'createCampaign', 'getCampaign', 'cancelCampaign',
            'listCampaignMessages', 'iterateCampaignMessages',
            'listMessages', 'getMessage',
        ];

        $reflection = new \ReflectionClass(MessagingClient::class);
        $public = array_values(array_filter(
            array_map(fn (\ReflectionMethod $m) => $m->getName(), $reflection->getMethods(\ReflectionMethod::IS_PUBLIC)),
            fn (string $name) => $name !== '__construct',
        ));

        sort($expected);
        sort($public);
        $this->assertSame($expected, $public);
    }
}
