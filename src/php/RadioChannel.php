<?php

namespace Signalbird\Sdk;

/**
 * Bir kanala bağlanmış Telsiz yazacı.
 *
 * `Signalbird::radio('penyuCritical')->error('…', $context)`
 *
 * NEDEN VAR: kanal adı çağrının HER satırında tekrar edilmek zorundaydı
 * (`Signalbird::error('penyuCritical', …)`) ve aynı kanala arka arkaya üç
 * kayıt yazan kodda üç kez yazılıyordu. Adı bir kez bağlamak hem okunur hem
 * de yanlış kanala yazma ihtimalini düşürür.
 *
 * SÖZDİZİMİ ŞEKERİDİR, yeni bir yüzey değil: her metot `SignalbirdClient`
 * üzerindeki karşılığına gider. Bu yüzden diller arası parite denetiminden
 * muaftır (bkz. docs/CONTRACT.md § 4).
 */
final class RadioChannel
{
    public function __construct(
        private readonly SignalbirdClient $client,
        private readonly string $key,
    ) {}

    /**
     * Seviyeyi kendin verirsin; vermezsen KANALIN varsayılanı geçerlidir —
     * istemci burada bir varsayılan uydurmaz.
     *
     * @param  array<string, mixed>|null  $context
     * @return array{ok: bool, event_id?: string, code?: string}
     */
    public function log(string $message, ?string $level = null, ?array $context = null): array
    {
        return $this->client->log($this->key, $message, $level, $context);
    }

    /** @param array<string, mixed>|null $context */
    public function debug(string $message, ?array $context = null): array
    {
        return $this->client->debug($this->key, $message, $context);
    }

    /** @param array<string, mixed>|null $context */
    public function info(string $message, ?array $context = null): array
    {
        return $this->client->info($this->key, $message, $context);
    }

    /** @param array<string, mixed>|null $context */
    public function warn(string $message, ?array $context = null): array
    {
        return $this->client->warn($this->key, $message, $context);
    }

    /** @param array<string, mixed>|null $context */
    public function error(string $message, ?array $context = null): array
    {
        return $this->client->error($this->key, $message, $context);
    }

    /**
     * Kritik seviye kanalın sessiz saatlerini DELER — gece ölen servis
     * sabahı bekleyemez. Bu kural sunucudadır, istemci yalnız seviyeyi söyler.
     *
     * @param  array<string, mixed>|null  $context
     */
    public function critical(string $message, ?array $context = null): array
    {
        return $this->client->critical($this->key, $message, $context);
    }

    /**
     * Aynı kanala toplu yazım.
     *
     * @param  list<array{message: string, level?: ?string, context?: ?array}>  $events
     * @return array{accepted: int, total: int, results: array<int, mixed>}
     */
    public function batch(array $events): array
    {
        return $this->client->batch(array_map(
            fn (array $event) => ['key' => $this->key] + $event,
            $events,
        ));
    }
}
