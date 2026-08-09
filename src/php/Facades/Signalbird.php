<?php

namespace Signalbird\Sdk\Facades;

use Illuminate\Support\Facades\Facade;

/**
 * @method static array info(string $title, string $message)
 * @method static array warn(string $title, string $message)
 * @method static array error(string $title, string $message)
 * @method static array critical(string $title, string $message)
 * @method static array confirm(string $title, string $message)
 * @method static array debug(string $title, string $message)
 * @method static array send(string $title, string $message, string $level = 'info')
 *
 * @see \Signalbird\Sdk\Signalbird
 */
class Signalbird extends Facade
{
    protected static function getFacadeAccessor(): string
    {
        return 'signalbird';
    }
}
