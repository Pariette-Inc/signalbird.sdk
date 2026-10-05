<?php

namespace Signalbird\Sdk;

/**
 * Telsiz gövdesini sunucunun kabul edeceği biçime getirir.
 *
 * `SignalbirdClient` içinde değil de ayrı sınıfta durmasının iki sebebi var:
 * `check-parity.mjs` o sınıfın `public function`'larını Telsiz metodu sayar
 * (yardımcı eklemek pariteyi bozardı) ve burada curl'e dokunmadan test
 * edilebilir.
 */
final class RadioPayload
{
    /**
     * API `message`'ı `max:4000` ile doğrular (Laravel → `mb_strlen`, yani
     * karakter). Aşan tek satır 422 alır; toplu gönderimde doğrulama satır
     * satır olmadığı için BÜTÜN paket düşer.
     */
    public const MAX_MESSAGE_LENGTH = 4000;

    /** Normalize edilen bir istisnadan taşınan en fazla yığın çerçevesi. */
    private const TRACE_FRAMES = 20;

    /** İç içe istisna/dizi için derinlik sınırı - kendine başvuran yapıda sonsuz döngü olmasın. */
    private const MAX_DEPTH = 10;

    /** Mesajı 4000 karaktere kırpar (bayt değil: çok baytlı UTF-8 ortadan bölünmez). */
    public static function message(string $message): string
    {
        if (function_exists('mb_strlen')) {
            return mb_strlen($message, 'UTF-8') > self::MAX_MESSAGE_LENGTH
                ? mb_substr($message, 0, self::MAX_MESSAGE_LENGTH, 'UTF-8')
                : $message;
        }

        // mbstring yoksa: geçerli UTF-8'de `u` bayraklı regex karakter sayar.
        // Geçersiz UTF-8'de preg başarısız olur; o zaman bayt kırpması yeter.
        if (strlen($message) <= self::MAX_MESSAGE_LENGTH) {
            return $message;
        }

        return preg_match('/^.{0,' . self::MAX_MESSAGE_LENGTH . '}/us', $message, $match) === 1
            ? $match[0]
            : substr($message, 0, self::MAX_MESSAGE_LENGTH);
    }

    /**
     * `context` içindeki istisnaları okunur diziye çevirir (özyinelemeli).
     *
     * `json_encode` bir Throwable'ı `{}` yazar: Laravel'in `Log::error($m,
     * ['exception' => $e])` deseninde Telsiz'e giden en değerli bilgi -
     * sınıf, dosya, satır, yığın - tamamen kayboluyordu.
     *
     * @param  array<mixed>|null  $context
     * @return array<mixed>|null
     */
    public static function context(?array $context): ?array
    {
        if ($context === null) {
            return null;
        }

        return self::walk($context, 0);
    }

    /** @return array{class: string, message: string, code: int|string, file: string, line: int, trace: list<string>, previous?: array} */
    public static function throwable(\Throwable $e, int $depth = 0): array
    {
        $trace = array_slice(explode("\n", $e->getTraceAsString()), 0, self::TRACE_FRAMES);

        $out = [
            'class' => $e::class,
            'message' => $e->getMessage(),
            'code' => $e->getCode(),
            'file' => $e->getFile(),
            'line' => $e->getLine(),
            'trace' => $trace,
        ];

        // Sarılmış istisna asıl sebebi taşır (QueryException → PDOException).
        if (($previous = $e->getPrevious()) !== null && $depth < self::MAX_DEPTH) {
            $out['previous'] = self::throwable($previous, $depth + 1);
        }

        return $out;
    }

    private static function walk(mixed $value, int $depth): mixed
    {
        if ($value instanceof \Throwable) {
            return self::throwable($value);
        }

        if (! is_array($value)) {
            return $value;
        }

        if ($depth >= self::MAX_DEPTH) {
            return '[Depth]';
        }

        foreach ($value as $key => $item) {
            if ($item instanceof \Throwable || is_array($item)) {
                $value[$key] = self::walk($item, $depth + 1);
            }
        }

        return $value;
    }
}
