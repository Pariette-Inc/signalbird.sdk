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

/** Gizli domain anahtarının öneki — sunucu tarafı. */
export const SECRET_PREFIX = 'sb_secret_live_';

/** Açık domain anahtarının öneki — tarayıcı ve mobil. */
export const PUBLIC_PREFIX = 'sb_public_live_';

export interface SignalbirdConfig {
  /**
   * Gizli domain anahtarı (`sb_secret_live_…`) — `SIGNALBIRD_DOMAIN_KEY`.
   *
   * Bu anahtar GİZLİDİR ve tarayıcıya gömülemez: sunucu `Origin` başlığı taşıyan
   * istekleri reddeder (401 `SECRET_KEY_IN_BROWSER`). Tarayıcı için
   * `signalbird/browser` ve açık anahtar (`sb_public_live_…`) kullanılır.
   *
   * v2 (1 Eyl 2026): eskiden `apiKey` idi ve yüzey başına ayrı bir anahtar
   * ailesi vardı (`sbr_live_`, `sb_`, `sbw_pub_`, `sbp_live_`). Hepsi tek
   * anahtara indi — sözleşme:
   * ../signalbird.api/docs/KEY_ARCHITECTURE_2026-09-01.md
   */
  domainKey: string;

  /** Varsayılan: https://live.signalbird.io/api */
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
  /**
   * Modül anahtarı — panelde açtığınız kanalın adı (`penyuSatisBildirimi`).
   *
   * Gizli DEĞİLDİR ve kodun içinde durur: domain anahtarı olmadan hiçbir işe
   * yaramaz. Tanımsız bir ad gönderirseniz kanal SESSİZ olarak açılır — kayıt
   * düşmez, ama bildirim de gitmez; kuralı panelden siz koyarsınız.
   */
  key: string;
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
    readonly code?: string,
    /** Sunucunun ham yanıt gövdesi (varsa) — gönderim istemcisi doldurur. */
    readonly body?: unknown
  ) {
    super(message);
    this.name = 'SignalbirdError';
  }
}

export const DEFAULT_BASE_URL = 'https://live.signalbird.io/api';
