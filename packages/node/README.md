# @signalbird/sdk

Official **Node.js / TypeScript SDK** for Signalbird. Send log notifications directly from your projects using a single package.

## Installation

```bash
npm install @signalbird/sdk
```

## Quick Start

```typescript
import { Signalbird } from '@signalbird/sdk'

const sb = new Signalbird({
  apiKey: 'sb_your_api_key_here',
})
```

The `apiKey` is the **SDK API key** you create from the Signalbird dashboard under **SDK Keys**.

> API URLs are fixed and cannot be changed:
> - **Production:** `live.signalbird.io/api`
> - **Test:** `localhost/api`

---

## Methods

All methods accept a `{ title, message }` payload and return a `TriggerResponse`.

### `sb.info(payload)`

Send an informational notification.

```typescript
await sb.info({
  title: 'Deploy Tamamlandı',
  message: 'v1.4.2 production ortamına başarıyla deploy edildi.',
})
```

### `sb.warn(payload)`

Send a warning notification.

```typescript
await sb.warn({
  title: 'Yüksek Bellek Kullanımı',
  message: 'Bellek kullanımı %83 seviyesine ulaştı.',
})
```

### `sb.error(payload)`

Send an error notification. Marked as important.

```typescript
await sb.error({
  title: 'Veritabanı Hatası',
  message: 'MySQL bağlantısı kurulamadı: Connection refused',
})
```

### `sb.critical(payload)`

Send a critical alert. Marked as important — use for urgent failures.

```typescript
await sb.critical({
  title: 'SERVİS ÇÖKTÜ',
  message: 'Ödeme servisi 3 dakikadır yanıt vermiyor.',
})
```

### `sb.confirm(payload)`

Send a confirmation/success notification.

```typescript
await sb.confirm({
  title: 'Sipariş Onaylandı',
  message: '#1234 numaralı sipariş ödendi ve işleme alındı.',
})
```

### `sb.debug(payload)`

Send a debug notification (development use).

```typescript
await sb.debug({
  title: 'Request Log',
  message: 'POST /api/orders - 342ms - 200 OK',
})
```

### `sb.send(payload)`

Send a notification with a custom level.

```typescript
await sb.send({
  title: 'Özel Bildirim',
  message: 'İstediğiniz bir mesaj.',
  level: 'info', // 'info' | 'warn' | 'error' | 'critical' | 'confirm' | 'debug'
})
```

---

## Configuration

```typescript
const sb = new Signalbird({
  apiKey: 'sb_xxxxx',      // Required — incoming webhook API key
  mode: 'production',         // Optional — 'production' (default) or 'test'
  timeout: 10000,             // Optional — request timeout in ms (default: 10000)
})
```

---

## Error Handling

```typescript
import { SignalbirdError } from '@signalbird/sdk'

try {
  await sb.error({
    title: 'Kritik Hata',
    message: 'Bir şeyler ters gitti.',
  })
} catch (err) {
  if (err instanceof SignalbirdError) {
    console.error(`[${err.statusCode}] ${err.message}`)
  }
}
```

---

## Real-World Examples

### Express.js — Global Error Handler

```typescript
import express from 'express'
import { Signalbird } from '@signalbird/sdk'

const sb = new Signalbird({ apiKey: process.env.SIGNALBIRD_API_KEY! })

app.use(async (err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  await sb.error({
    title: 'Uygulama Hatası',
    message: `${req.method} ${req.path} — ${err.message}`,
  })
  res.status(500).json({ error: 'Internal Server Error' })
})
```

### Cron Job — Sonuç Bildirimi

```typescript
import { Signalbird } from '@signalbird/sdk'

const sb = new Signalbird({ apiKey: process.env.SIGNALBIRD_API_KEY! })

async function dailyBackup() {
  try {
    await runBackup()
    await sb.confirm({
      title: 'Günlük Yedek Alındı',
      message: `${new Date().toLocaleDateString('tr-TR')} tarihli yedek başarıyla tamamlandı.`,
    })
  } catch (err) {
    await sb.critical({
      title: 'Yedekleme Başarısız',
      message: String(err),
    })
  }
}
```

### Next.js — API Route Error Tracking

```typescript
// app/api/payments/route.ts
import { Signalbird } from '@signalbird/sdk'

const sb = new Signalbird({ apiKey: process.env.SIGNALBIRD_API_KEY! })

export async function POST(req: Request) {
  try {
    const result = await processPayment(await req.json())
    await sb.confirm({
      title: 'Ödeme Başarılı',
      message: `Sipariş #${result.orderId} ödendi.`,
    })
    return Response.json(result)
  } catch (err) {
    await sb.error({
      title: 'Ödeme Hatası',
      message: String(err),
    })
    return Response.json({ error: 'Payment failed' }, { status: 500 })
  }
}
```

---

## Log Levels

| Method | Level | Önem | Kullanım |
|--------|-------|------|---------|
| `info` | info | Normal | Başarılı işlemler, deploy, genel bilgi |
| `warn` | warn | Normal | Eşik aşımları, potansiyel sorunlar |
| `error` | error | **Önemli** | Hata durumları, exception'lar |
| `critical` | critical | **Önemli** | Servis çöküşleri, acil müdahale gerektiren durumlar |
| `confirm` | confirm | Normal | Onaylar, başarılı ödeme, tamamlanan görevler |
| `debug` | debug | Normal | Geliştirme ve test amaçlı |

> `error` ve `critical` seviyeleri **önemli** olarak işaretlenir ve push bildirim önceliği yükseltilir.

---

## Build & Publish

```bash
npm run build        # tsup ile ESM + CJS + DTS
npm version patch    # versiyon artır
npm publish          # npm'e yayınla
```
