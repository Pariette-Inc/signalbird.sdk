/**
 * Mesaj olay webhook'larının imza doğrulaması.
 *
 * Signalbird her teslimatı `X-Signalbird-Signature: sha256=<hex>` başlığıyla
 * imzalar: `hex(hmac_sha256(raw_body, secret))`. Doğrulama HAM gövde üzerinde
 * yapılmalıdır — JSON'u ayrıştırıp yeniden serileştirmek anahtar sırasını
 * değiştirir ve imzayı bozar. Express'te `express.raw()` ya da `verify`
 * kancasıyla ham gövdeyi saklayın.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

export function verifyWebhook(
  rawBody: string | Uint8Array,
  signatureHeader: string | null | undefined,
  secret: string
): boolean {
  if (!signatureHeader || !secret) return false;

  // "sha256=abcd…" — başka algoritma ya da biçim kabul edilmez.
  const match = /^\s*sha256=([a-f0-9]+)\s*$/i.exec(signatureHeader);
  if (!match) return false;

  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const provided = match[1].toLowerCase();

  // Uzunluk farkı, `timingSafeEqual`in fırlatmaması için önce elenir; uzunluk
  // zaten sabit (64) olduğundan zamanlama sızıntısı yaratmaz.
  if (provided.length !== expected.length) return false;

  return timingSafeEqual(Buffer.from(provided, 'utf8'), Buffer.from(expected, 'utf8'));
}
