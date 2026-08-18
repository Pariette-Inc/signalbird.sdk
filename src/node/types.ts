/**
 * Telsiz (Radio) istemcisinin ortak tipleri.
 *
 * SDK'nın tek işi vardır: bir kanala mesaj yazmak. Bildirimin kime, hangi
 * kanaldan ve hangi saatte gideceği SUNUCUDA, kanal ayarlarında durur —
 * istemci bunu bilmez ve bilmemelidir. Aksi hâlde bildirim kuralını
 * değiştirmek için müşterinin kodunu yeniden yayınlaması gerekirdi.
 */

/** Kanalın seviyesi; verilmezse kanalın kendi varsayılanı geçerlidir. */
export type Level = 'debug' | 'info' | 'warn' | 'error' | 'critical';

export interface SignalbirdConfig {
  /**
   * Sunucu anahtarı (`sbr_live_…`).
   *
   * Bu anahtar GİZLİDİR ve tarayıcıya gömülemez: sunucu `Origin` başlığı taşıyan
   * istekleri reddeder. Tarayıcı için `@signalbird/sdk/browser` ve açık anahtar
   * (`sbr_pub_…`) kullanılır.
   */
  apiKey: string;

  /** Varsayılan: https://signalbird.io/api */
  baseUrl?: string;

  /** Her olaya eklenen köken adı (sunucu adı, servis adı). */
  source?: string;

  /** İstek zaman aşımı (ms). Varsayılan 5000 — log göndermek isteği bekletmemeli. */
  timeout?: number;

  /**
   * Hata fırlatılsın mı. Varsayılan `false`.
   *
   * Log göndermek uygulamanın ASIL işi değildir: telsiz erişilemezse müşterinin
   * ödeme akışı çökmemelidir. Varsayılan davranış sessizce yutup `ok: false`
   * dönmektir; geliştirme sırasında `throwOnError: true` ile açılabilir.
   */
  throwOnError?: boolean;

  /** Konsola uyarı yazılsın mı (varsayılan: NODE_ENV !== 'production'). */
  debug?: boolean;
}

export interface LogInput {
  channel: string;
  message: string;
  level?: Level;
  context?: Record<string, unknown>;
  source?: string;
}

export interface LogResult {
  ok: boolean;
  /** Sunucunun döndüğü olay kimliği (rev_…). */
  eventId?: string;
  /** Reddedildiyse sebep: INVALID_KEY, MODULE_DISABLED, LIMIT_REACHED… */
  code?: string;
  status?: number;
}

export interface BatchResult {
  accepted: number;
  total: number;
  results: Record<number, { ok: boolean; eventId?: string; code?: string }>;
}

/** `throwOnError: true` iken fırlatılır. */
export class SignalbirdError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string
  ) {
    super(message);
    this.name = 'SignalbirdError';
  }
}

export const DEFAULT_BASE_URL = 'https://signalbird.io/api';
