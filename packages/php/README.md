# signalbird/sdk

Signalbird PHP SDK. Laravel ve vanilla PHP projelerinizden log, uyarı ve bildirim gönderin.

## Kurulum

```bash
composer require signalbird/sdk
```

## Laravel Kurulumu

Paket, Laravel'in **package auto-discovery** özelliği ile otomatik olarak kayıt edilir. Ekstra yapılandırma gerekmez.

Config dosyasını yayınlamak için:

```bash
php artisan vendor:publish --tag=signalbird-config
```

`.env` dosyanıza API anahtarınızı ekleyin:

```env
SIGNALBIRD_API_KEY=sb_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## Kullanım — Laravel (Facade)

```php
use Signalbird\Sdk\Facades\Signalbird;

// Bilgi
Signalbird::info('Kullanıcı kaydı', 'Yeni kullanıcı oluşturuldu: ahmet@ornek.com');

// Uyarı
Signalbird::warn('Disk doluluk', 'Disk kullanımı %85 seviyesine ulaştı');

// Hata
Signalbird::error('DB Hatası', 'MySQL bağlantısı kurulamadı');

// Kritik (sesli + yüksek öncelikli push)
Signalbird::critical('Servis Çöktü', 'Ödeme servisi yanıt vermiyor');

// Onay / Başarı
Signalbird::confirm('Deploy Tamamlandı', 'v2.1.0 canlı ortama alındı');

// Debug
Signalbird::debug('Cache Miss', 'Ürün listesi cache\'de bulunamadı');

// Özel seviye
Signalbird::send('Özel Başlık', 'Mesaj', 'warn');
```

## Kullanım — Laravel (Dependency Injection)

```php
use Signalbird\Sdk\Signalbird;

class OrderController extends Controller
{
    public function __construct(private Signalbird $st) {}

    public function store(Request $request)
    {
        // ... sipariş işlemleri

        $this->st->confirm('Yeni Sipariş', "Sipariş #{$order->id} oluşturuldu");
    }
}
```

## Kullanım — Vanilla PHP

```php
require 'vendor/autoload.php';

use Signalbird\Sdk\Signalbird;

$st = new Signalbird('sb_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');

$st->error('Kritik Hata', 'Sunucu belleği doldu');
$st->confirm('Yedek Tamamlandı', 'Veritabanı yedeği başarıyla alındı');
```

## Gerçek Dünya Örnekleri

### Exception Handler (Laravel)

```php
// app/Exceptions/Handler.php
use Signalbird\Sdk\Facades\Signalbird;

public function register(): void
{
    $this->reportable(function (Throwable $e) {
        if ($this->shouldReport($e)) {
            Signalbird::error(
                get_class($e),
                $e->getMessage() . ' — ' . $e->getFile() . ':' . $e->getLine()
            );
        }
    });
}
```

### Queue Job Başarı/Başarısız

```php
use Signalbird\Sdk\Facades\Signalbird;

class ProcessPaymentJob implements ShouldQueue
{
    public function handle(): void
    {
        // ... ödeme işlemi
        Signalbird::confirm('Ödeme İşlendi', "Sipariş #{$this->orderId} ödeme başarılı");
    }

    public function failed(Throwable $e): void
    {
        Signalbird::critical('Ödeme Başarısız', "Sipariş #{$this->orderId}: {$e->getMessage()}");
    }
}
```

### Scheduled Task Takibi

```php
// routes/console.php
use Signalbird\Sdk\Facades\Signalbird;

Schedule::call(function () {
    // ... görev
    Signalbird::info('Cron Çalıştı', 'Günlük rapor oluşturuldu');
})->daily();
```

## Log Seviyeleri

| Seviye     | Kullanım                              | Push Önceliği |
|------------|---------------------------------------|---------------|
| `info`     | Bilgilendirme, başarı logları         | Normal        |
| `warn`     | Dikkat gerektiren durumlar            | Normal        |
| `error`    | Hatalar, başarısız işlemler           | Yüksek        |
| `critical` | Sistem çöküşleri, acil durumlar       | Kritik (sesli)|
| `confirm`  | Onay, tamamlama bildirimleri          | Normal        |
| `debug`    | Geliştirme amaçlı loglar              | Normal        |

## Hata Yönetimi

```php
use Signalbird\Sdk\SignalbirdException;

try {
    Signalbird::error('Test', 'Mesaj');
} catch (SignalbirdException $e) {
    echo $e->getMessage();    // API hata mesajı
    echo $e->statusCode;      // HTTP durum kodu
    var_dump($e->details);    // API yanıt detayları
}
```

## Gereksinimler

- PHP 8.1+
- guzzlehttp/guzzle ^7.0

## Lisans

MIT
