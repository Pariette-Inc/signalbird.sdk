<?php

namespace Signalbird\Sdk;

/**
 * SDK sürüm bildirimi - CONTRACT §14.
 *
 * Her istek `X-Signalbird-Sdk: php/<sürüm>` taşır. API yanıtta
 * `Signalbird-Sdk-Status` (current | outdated | unsupported) ve
 * `Signalbird-Sdk-Latest` döner; eskiyse süreç başına BİR KEZ `error_log`
 * satırı yazılır. İstisna fırlatılmaz, istek sonucu değişmez.
 *
 * `VERSION` sabiti `scripts/sync-version.mjs` tarafından kökteki VERSION
 * dosyasından yazılır - elle değiştirmeyin.
 */
final class SdkVersion
{
    public const VERSION = '2.7.0';

    public const HEADER = 'X-Signalbird-Sdk';

    private static bool $warned = false;

    /** cURL `CURLOPT_HTTPHEADER` satırı. */
    public static function headerLine(): string
    {
        return self::HEADER . ': php/' . self::VERSION;
    }

    /**
     * `CURLOPT_HEADERFUNCTION` için toplayıcı: yalnız `signalbird-sdk-*`
     * başlıklarını küçük harfli anahtarla `$into`ya yazar.
     *
     * @param  array<string, string>  $into
     */
    public static function collector(array &$into): \Closure
    {
        return static function ($handle, string $line) use (&$into): int {
            $pos = strpos($line, ':');

            if ($pos !== false) {
                $name = strtolower(trim(substr($line, 0, $pos)));

                if (str_starts_with($name, 'signalbird-sdk-')) {
                    $into[$name] = trim(substr($line, $pos + 1));
                }
            }

            return strlen($line);
        };
    }

    /**
     * Yanıt başlıklarına bakar; eskiyse bir kez uyarır.
     *
     * @param  array<string, string>  $headers  küçük harfli anahtarlar
     */
    public static function note(array $headers): void
    {
        if (self::$warned) {
            return;
        }

        $status = $headers['signalbird-sdk-status'] ?? null;

        if ($status !== 'outdated' && $status !== 'unsupported') {
            return;
        }

        self::$warned = true;
        $latest = $headers['signalbird-sdk-latest'] ?? '?';

        error_log($status === 'unsupported'
            ? '[signalbird] Bu SDK sürümü (' . self::VERSION . ") artık desteklenmiyor. Son sürüm: {$latest}. composer update pariette/signalbird"
            : "[signalbird] Yeni SDK sürümü var: {$latest} (kurulu: " . self::VERSION . ').');
    }

    /** Yalnız testler için. */
    public static function hasWarned(): bool
    {
        return self::$warned;
    }

    /** Yalnız testler için. */
    public static function resetWarning(): void
    {
        self::$warned = false;
    }
}
