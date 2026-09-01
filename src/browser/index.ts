/**
 * signalbird/browser — tarayıcı istemcisi.
 *
 * Ayrı bir giriş noktası olmasının sebebi teknik değil, GÜVENLİKTİR: sunucu
 * anahtarı istemciye gömülemez ve sunucu `Origin` başlığı taşıyan bir istekte
 * onu zaten reddeder. Tarayıcı, açık anahtarı (`sb_public_live_…`) kullanır ve
 * güvenliği gizlilikten değil kısıttan gelir: yalnız izinli alan adlarından
 * çalışır ve Origin taşımayan istekte reddedilir (`ORIGIN_REQUIRED`).
 *
 * React, Vue, Angular ve düz JS aynı istemciyi kullanır; çatıya özel sarmalayıcı
 * yoktur çünkü gereken tek şey bir fonksiyon çağrısıdır.
 */
export type Level = 'debug' | 'info' | 'warn' | 'error' | 'critical';

export interface BrowserConfig {
  /** Açık anahtar (`sb_public_live_…`). Gizli anahtar BURAYA YAZILMAZ. */
  publicKey: string;
  baseUrl?: string;
  source?: string;
  /**
   * Kayıtlar tek tek değil, toplu gider. Kullanıcının tarayıcısından saniyede
   * onlarca istek çıkarmak hem yavaş hem pahalıdır.
   */
  flushIntervalMs?: number;
  maxQueue?: number;
  debug?: boolean;
}

interface QueuedEvent {
  key: string;
  message: string;
  level?: Level;
  context?: Record<string, unknown>;
  source?: string;
}

const DEFAULT_BASE_URL = 'https://live.signalbird.io/api';

export class SignalbirdBrowser {
  private queue: QueuedEvent[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly baseUrl: string;
  private readonly maxQueue: number;

  constructor(private readonly config: BrowserConfig) {
    if (!config.publicKey?.startsWith('sb_public_live_')) {
      throw new Error(
        'Signalbird: tarayıcı istemcisi açık anahtar ister (sb_public_live_…). ' +
          'Gizli anahtarı (sb_secret_live_…) istemci koduna KOYMAYIN.'
      );
    }

    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
    this.maxQueue = config.maxQueue ?? 50;

    if (typeof window !== 'undefined') {
      this.timer = setInterval(() => void this.flush(), config.flushIntervalMs ?? 3000);

      // Sekme kapanırken kuyruk boşaltılır. `sendBeacon` sayfa ölürken bile
      // gider; normal fetch yarıda kesilirdi.
      window.addEventListener('pagehide', () => this.flushBeacon());
    }
  }

  log(key: string, message: string, level?: Level, context?: Record<string, unknown>): void {
    this.queue.push({ key, message, level, context, source: this.config.source });

    // Kuyruk dolduysa beklemeden gönder: bellekte sonsuza kadar biriktirmek,
    // logu hiç göndermemekten kötüdür.
    if (this.queue.length >= this.maxQueue) {
      void this.flush();
    }
  }

  info(key: string, message: string, context?: Record<string, unknown>) {
    this.log(key, message, 'info', context);
  }

  warn(key: string, message: string, context?: Record<string, unknown>) {
    this.log(key, message, 'warn', context);
  }

  error(key: string, message: string, context?: Record<string, unknown>) {
    this.log(key, message, 'error', context);
  }

  /**
   * Tarayıcıdaki yakalanmamış hataları bağlar.
   *
   * Varsayılan anahtar `browser`dır ve KRİTİK DEĞİLDİR: istemci tarafı kod
   * herkesin elindedir, oradan kritik alarm tetiklemek kötü niyetli birine
   * ekibin telefonunu çaldırma imkânı verirdi. Hangi kanalın kime bildirim
   * göndereceği panelde durur; oradan sessiz bırakılabilir.
   */
  captureErrors(key = 'browser'): () => void {
    const onError = (event: ErrorEvent) => {
      this.error(key, event.message, {
        file: event.filename,
        line: event.lineno,
        column: event.colno,
        url: window.location.href,
      });
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      this.error(key, String(event.reason), { url: window.location.href });
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);

    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }

  async flush(): Promise<void> {
    if (this.queue.length === 0) return;

    const batch = this.queue.splice(0, 100);

    try {
      await fetch(`${this.baseUrl}/v1/radio/log/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Signalbird-Key': this.config.publicKey,
        },
        body: JSON.stringify({ events: batch }),
        keepalive: true,
      });
    } catch (error) {
      if (this.config.debug) {
        console.warn('[signalbird] gönderilemedi', error);
      }
      // Kayıtlar geri konur ama kuyruk sınırı aşılmaz: ağ uzun süre kapalıysa
      // sekme belleği şişmemeli.
      this.queue = [...batch, ...this.queue].slice(0, this.maxQueue);
    }
  }

  /** Sayfa kapanırken son gönderim. */
  private flushBeacon(): void {
    if (this.queue.length === 0 || typeof navigator === 'undefined') return;

    const blob = new Blob(
      [JSON.stringify({ events: this.queue.splice(0, 100) })],
      { type: 'application/json' }
    );

    // sendBeacon özel başlık taşıyamaz; anahtar sorgu dizesinden gider.
    navigator.sendBeacon?.(
      `${this.baseUrl}/v1/radio/log/batch?k=${encodeURIComponent(this.config.publicKey)}`,
      blob
    );
  }

  destroy(): void {
    if (this.timer) clearInterval(this.timer);
    void this.flush();
  }
}

let singleton: SignalbirdBrowser | null = null;

/** Uygulama başlangıcında bir kez çağrılır. */
export function initSignalbird(config: BrowserConfig): SignalbirdBrowser {
  singleton = new SignalbirdBrowser(config);
  return singleton;
}

/** Kurulmamışsa sessizce yok sayar — log çağrısı uygulamayı çökertmemeli. */
export function signalbird(): SignalbirdBrowser | null {
  return singleton;
}
