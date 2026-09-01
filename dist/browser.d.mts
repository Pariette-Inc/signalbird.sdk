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
type Level = 'debug' | 'info' | 'warn' | 'error' | 'critical';
interface BrowserConfig {
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
declare class SignalbirdBrowser {
    private readonly config;
    private queue;
    private timer;
    private readonly baseUrl;
    private readonly maxQueue;
    constructor(config: BrowserConfig);
    log(key: string, message: string, level?: Level, context?: Record<string, unknown>): void;
    info(key: string, message: string, context?: Record<string, unknown>): void;
    warn(key: string, message: string, context?: Record<string, unknown>): void;
    error(key: string, message: string, context?: Record<string, unknown>): void;
    /**
     * Tarayıcıdaki yakalanmamış hataları bağlar.
     *
     * Varsayılan anahtar `browser`dır ve KRİTİK DEĞİLDİR: istemci tarafı kod
     * herkesin elindedir, oradan kritik alarm tetiklemek kötü niyetli birine
     * ekibin telefonunu çaldırma imkânı verirdi. Hangi kanalın kime bildirim
     * göndereceği panelde durur; oradan sessiz bırakılabilir.
     */
    captureErrors(key?: string): () => void;
    flush(): Promise<void>;
    /** Sayfa kapanırken son gönderim. */
    private flushBeacon;
    destroy(): void;
}
/** Uygulama başlangıcında bir kez çağrılır. */
declare function initSignalbird(config: BrowserConfig): SignalbirdBrowser;
/** Kurulmamışsa sessizce yok sayar — log çağrısı uygulamayı çökertmemeli. */
declare function signalbird(): SignalbirdBrowser | null;

export { type BrowserConfig, type Level, SignalbirdBrowser, initSignalbird, signalbird };
