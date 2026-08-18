<?php

namespace Signalbird\Sdk\Facades;

use Illuminate\Support\Facades\Facade;

/**
 * @method static array log(string $channel, string $message, ?string $level = null, ?array $context = null)
 * @method static array debug(string $channel, string $message, ?array $context = null)
 * @method static array info(string $channel, string $message, ?array $context = null)
 * @method static array warn(string $channel, string $message, ?array $context = null)
 * @method static array error(string $channel, string $message, ?array $context = null)
 * @method static array critical(string $channel, string $message, ?array $context = null)
 * @method static array batch(array $events)
 *
 * @see \Signalbird\Sdk\SignalbirdClient
 */
class Signalbird extends Facade
{
    protected static function getFacadeAccessor(): string
    {
        return 'signalbird';
    }
}
