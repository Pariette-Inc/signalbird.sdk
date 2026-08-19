<?php

namespace Signalbird\Sdk;

/**
 * SDK'nın tek istisna türü.
 *
 * `\Exception::$code` tamsayıdır; API'nin döndürdüğü metin kodlar
 * (`VALIDATION_ERROR`, `API_KEY_INVALID`, …) ayrı bir alanda tutulur ve
 * `getErrorCode()` ile okunur. `new SignalbirdException('mesaj')` biçimindeki
 * eski çağrılar aynen çalışmaya devam eder.
 */
class SignalbirdException extends \RuntimeException
{
    private ?string $errorCode;

    private int $status;

    private mixed $body;

    public function __construct(
        string $message = '',
        ?string $code = null,
        int $status = 0,
        mixed $body = null,
        ?\Throwable $previous = null,
    ) {
        parent::__construct($message, 0, $previous);

        $this->errorCode = $code;
        $this->status = $status;
        $this->body = $body;
    }

    /** API/SDK hata kodu (`NETWORK_ERROR`, `HTTP_500`, `WRONG_KEY_TYPE`, …). */
    public function getErrorCode(): ?string
    {
        return $this->errorCode;
    }

    /** HTTP durum kodu; ağ hatasında 0. */
    public function getStatus(): int
    {
        return $this->status;
    }

    /** Sunucunun çözümlenmiş ham yanıt gövdesi (varsa). */
    public function getBody(): mixed
    {
        return $this->body;
    }

    /** Başarısız bir API yanıtından istisna üretir. */
    public static function fromResponse(string $code, int $status, string $message, mixed $body = null): self
    {
        return new self("Signalbird: {$code} — {$message}", $code, $status, $body);
    }
}
