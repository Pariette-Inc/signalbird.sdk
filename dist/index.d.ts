/**
 * Telsiz (Radio) istemcisinin ortak tipleri.
 *
 * SDK'nın tek işi vardır: bir kanala mesaj yazmak. Bildirimin kime, hangi
 * kanaldan ve hangi saatte gideceği SUNUCUDA, kanal ayarlarında durur —
 * istemci bunu bilmez ve bilmemelidir. Aksi hâlde bildirim kuralını
 * değiştirmek için müşterinin kodunu yeniden yayınlaması gerekirdi.
 */
/** Kanalın seviyesi; verilmezse kanalın kendi varsayılanı geçerlidir. */
type Level = 'debug' | 'info' | 'warn' | 'error' | 'critical';
interface SignalbirdConfig {
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
interface LogInput {
    channel: string;
    message: string;
    level?: Level;
    context?: Record<string, unknown>;
    source?: string;
}
interface LogResult {
    ok: boolean;
    /** Sunucunun döndüğü olay kimliği (rev_…). */
    eventId?: string;
    /** Reddedildiyse sebep: INVALID_KEY, MODULE_DISABLED, LIMIT_REACHED… */
    code?: string;
    status?: number;
}
interface BatchResult {
    accepted: number;
    total: number;
    results: Record<number, {
        ok: boolean;
        eventId?: string;
        code?: string;
    }>;
}
/** `throwOnError: true` iken fırlatılır. */
declare class SignalbirdError extends Error {
    readonly status: number;
    readonly code?: string | undefined;
    constructor(message: string, status: number, code?: string | undefined);
}
declare const DEFAULT_BASE_URL = "https://signalbird.io/api";

/**
 * Telsiz istemcisi (sunucu tarafı).
 *
 * Bağımlılığı yoktur: Node 18+ ile gelen `fetch` kullanılır. Bir log
 * kütüphanesinin kendi bağımlılık zincirini müşterinin projesine taşıması,
 * sürüm çakışmalarının en sinir bozucu kaynağıdır.
 */

declare class SignalbirdClient {
    private readonly config;
    private readonly baseUrl;
    private readonly timeout;
    private readonly throwOnError;
    private readonly debug;
    private readonly source?;
    constructor(config: SignalbirdConfig);
    /** Tek kayıt gönderir. */
    log(input: LogInput): Promise<LogResult>;
    /**
     * Toplu gönderim — 100 kayda kadar.
     *
     * Kısmi başarı normaldir (kota tam ortada dolabilir), o yüzden sonuç tek bir
     * durum değil satır satır döner.
     */
    batch(events: LogInput[]): Promise<BatchResult>;
    debugLog(channel: string, message: string, context?: Record<string, unknown>): Promise<LogResult>;
    info(channel: string, message: string, context?: Record<string, unknown>): Promise<LogResult>;
    warn(channel: string, message: string, context?: Record<string, unknown>): Promise<LogResult>;
    error(channel: string, message: string, context?: Record<string, unknown>): Promise<LogResult>;
    critical(channel: string, message: string, context?: Record<string, unknown>): Promise<LogResult>;
    /**
     * Yakalanmamış hataları Telsiz'e bağlar.
     *
     * Kancayı takıp süreci ÖLDÜRMEYE devam eder: `uncaughtException` sonrası
     * süreci ayakta tutmak, bozuk durumdaki bir uygulamayı çalıştırmaya devam
     * etmek demektir — log göndermek bunu meşrulaştırmaz.
     */
    captureUncaught(channel?: string): () => void;
    private send;
    private request;
}

/**
 * @signalbird/sdk — sunucu tarafı giriş noktası.
 *
 * Next.js sunucu bileşenleri, API route'ları, Express/Fastify/NestJS ve düz
 * Node betikleri buradan alır. TARAYICI için `@signalbird/sdk/browser`
 * kullanılır — gizli anahtar istemciye inmez.
 */

/**
 * Ortam değişkeninden kurulan paylaşımlı istemci.
 *
 * `SIGNALBIRD_KEY` okunur. Uygulamanın her köşesinde istemci kurup anahtarı
 * elden ele taşımak yerine tek çağrı yeter:
 *
 *   import { signalbird } from '@signalbird/sdk'
 *   await signalbird().critical('critical', 'ödeme servisi öldü')
 */
declare function signalbird(config?: Partial<SignalbirdConfig>): SignalbirdClient;
/** Test ve sıcak yeniden yükleme için tekil istemciyi sıfırlar. */
declare function resetSignalbird(): void;

export { type BatchResult, DEFAULT_BASE_URL, type Level, type LogInput, type LogResult, SignalbirdClient, type SignalbirdConfig, SignalbirdError, resetSignalbird, signalbird };
