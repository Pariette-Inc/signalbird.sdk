<?php

namespace Signalbird\Sdk;

use RuntimeException;

class SignalbirdException extends RuntimeException
{
    public function __construct(
        string $message,
        public readonly int $statusCode = 0,
        public readonly mixed $details = null
    ) {
        parent::__construct($message, $statusCode);
    }
}
