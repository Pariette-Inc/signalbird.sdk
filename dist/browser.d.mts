/**
 * signalbird/browser — tarayıcı istemcisi.
 *
 * Ayrı bir giriş noktası olmasının sebebi teknik değil, GÜVENLİKTİR: sunucu
 * anahtarı istemciye gömülemez ve sunucu `Origin` başlığı taşıyan bir istekte
 * onu zaten reddeder. Tarayıcı, açık anahtarı (`sbr_pub_…`) kullanır ve
 * güvenliği gizlilikten değil kısıttan gelir — yalnız izinli alan adlarından
 * ve yalnız izin verilen kanallara yazabilir.
 *
 * React, Vue, Angular ve düz JS aynı istemciyi kullanır; çatıya özel sarmalayıcı
 * yoktur çünkü gereken tek şey bir fonksiyon çağrısıdır.
 */
type Level = 'debug' | 'info' | 'warn' | 'error' | 'critical';
interface BrowserConfig {
    /** Açık anahtar (`sbr_pub_…`). Gizli anahtar BURAYA YAZILMAZ. */
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
    log(channel: string, message: string, level?: Level, context?: Record<string, unknown>): void;
    info(channel: string, message: string, context?: Record<string, unknown>): void;
    warn(channel: string, message: string, context?: Record<string, unknown>): void;
    error(channel: string, message: string, context?: Record<string, unknown>): void;
    /**
     * Tarayıcıdaki yakalanmamış hataları bağlar.
     *
     * Kritik kanala YAZMAZ: istemci tarafı kod herkesin elindedir, oradan
     * kritik alarm tetiklemek kötü niyetli birine ekibin telefonunu çaldırma
     * imkânı verirdi. Sunucu zaten `browser_channels` ile bunu kısıtlar.
     */
    captureErrors(channel?: string): () => void;
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
