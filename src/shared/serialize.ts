/**
 * Telsiz gövdesini sunucunun kabul edeceği biçime getiren yardımcılar.
 *
 * Node ve tarayıcı istemcisi ortak kullanır. Sınıf metodu DEĞİL, modül
 * fonksiyonudur: `check-parity.mjs` istemci sınıfının girintili metotlarını
 * sayar ve buraya eklenen bir yardımcı Telsiz paritesini bozardı.
 */

/**
 * API `message` alanını `max:4000` ile doğrular (Laravel → `mb_strlen`, yani
 * KOD NOKTASI). Sınırı aşan tek satır 422 alır ve toplu gönderimde bütün
 * paketi düşürür - 99 sağlam log bir uzun yığın izi yüzünden kaybolurdu.
 */
export const MAX_MESSAGE_LENGTH = 4000;

/**
 * Mesajı 4000 kod noktasına kırpar.
 *
 * `.slice(0, 4000)` UTF-16 birimi sayar ve bir emoji'nin (vekil çift) ortasından
 * kesebilir; tek kalan vekil `\ud83d` olarak gider ve PHP `json_decode` bütün
 * gövdeyi reddeder - düzeltmeye çalıştığımız hatanın aynısı. `Array.from` kod
 * noktası üzerinden yürür; pahalıdır, bu yüzden yalnız sınır aşıldığında çalışır.
 */
export function truncateMessage(message: string): string {
  const text = typeof message === 'string' ? message : String(message);

  if (text.length <= MAX_MESSAGE_LENGTH) {
    return text;
  }

  return Array.from(text).slice(0, MAX_MESSAGE_LENGTH).join('');
}

/**
 * `context`'i JSON'a güvenle çevrilebilir bir kopyaya dönüştürür.
 *
 * `JSON.stringify` döngüsel nesnede (ör. `req`, Mongoose belgesi) ve
 * `BigInt`'te İSTİSNA fırlatır. Node'da bu istisna isteğin içinde
 * yakalanıp `NETWORK_ERROR` diye raporlanıyordu - asıl sebep görünmüyordu.
 * Tarayıcıda daha kötüsü: başarısız toplu gönderim kuyruğa geri konur, aynı
 * satır her 3 saniyede tekrar patlar ve arkasındaki bütün loglar takılı kalırdı.
 *
 *  - döngüsel başvuru → `"[Circular]"` (yalnız ATA zinciri sayılır: aynı nesneye
 *    iki kardeş alandan başvurmak döngü değildir ve korunur)
 *  - `Error` → `{name, message, stack}` (JSON'da `{}` olurdu, yani bilgi kaybı)
 *  - `BigInt` → string
 *  - `toJSON` taşıyan nesne (Date vb.) → onun çıktısı
 *  - erişimde fırlatan getter → `"[Unserializable]"`
 */
export function toJsonSafe(value: unknown): unknown {
  const ancestors: object[] = [];

  const walk = (current: unknown): unknown => {
    if (typeof current === 'bigint') {
      return current.toString();
    }

    // Fonksiyon, symbol ve undefined olduğu gibi kalır: JSON.stringify onları
    // zaten atar (dizide null yapar); burada ayrıca karar vermeye gerek yok.
    if (current === null || typeof current !== 'object') {
      return current;
    }

    if (ancestors.includes(current)) {
      return '[Circular]';
    }

    if (current instanceof Error) {
      return { name: current.name, message: current.message, stack: current.stack };
    }

    const withToJson = current as { toJSON?: () => unknown };

    if (typeof withToJson.toJSON === 'function') {
      try {
        ancestors.push(current);
        return walk(withToJson.toJSON());
      } catch {
        return '[Unserializable]';
      } finally {
        ancestors.pop();
      }
    }

    ancestors.push(current);

    try {
      if (Array.isArray(current)) {
        return current.map((item) => walk(item));
      }

      const out: Record<string, unknown> = {};

      for (const key of Object.keys(current)) {
        let item: unknown;

        try {
          item = (current as Record<string, unknown>)[key];
        } catch {
          item = '[Unserializable]';
        }

        out[key] = walk(item);
      }

      return out;
    } finally {
      ancestors.pop();
    }
  };

  return walk(value);
}

/** `context` verilmediyse `undefined` kalır (gövdeye hiç girmez). */
export function safeContext(context?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (context === undefined || context === null) {
    return undefined;
  }

  return toJsonSafe(context) as Record<string, unknown>;
}
