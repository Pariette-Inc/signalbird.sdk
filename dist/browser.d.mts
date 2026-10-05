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
    /**
     * Kanalı bağlar ve yazacı döner - sunucu istemcisindeki `radio()` ile aynı
     * deyim (CONTRACT §1.1):
     *
     *     sb.radio('sepet').error('sepet güncellenemedi', { cartId })
     *
     * `critical` BİLEREK yoktur: istemci kodu herkesin elindedir ve oradan
     * kritik alarm (sessiz saatleri delen bildirim) tetiklemek, kötü niyetli
     * birine ekibin telefonunu çaldırma imkânı verirdi. Gerekirse
     * `log(key, msg, 'critical')` hâlâ yazılabilir; kanal ayarı panelde durur.
     */
    radio(key: string): {
        debug: (message: string, context?: Record<string, unknown>) => void;
        info: (message: string, context?: Record<string, unknown>) => void;
        warn: (message: string, context?: Record<string, unknown>) => void;
        error: (message: string, context?: Record<string, unknown>) => void;
    };
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
/** Kurulmamışsa sessizce yok sayar - log çağrısı uygulamayı çökertmemeli. */
declare function signalbird(): SignalbirdBrowser | null;

export { type BrowserConfig, type Level, SignalbirdBrowser, initSignalbird, signalbird };
