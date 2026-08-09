type LogLevel = 'info' | 'warn' | 'error' | 'critical' | 'confirm' | 'debug';
interface SignalbirdConfig {
    /** Signalbird panelinden oluşturduğunuz SDK API anahtarı (sb_...) */
    apiKey: string;
    /** Ortam seçimi. Varsayılan: 'production' */
    mode?: 'production' | 'test';
    /** İstek zaman aşımı (ms). Varsayılan: 10000 */
    timeout?: number;
}
interface LogPayload {
    /** Bildirim başlığı */
    title: string;
    /** Bildirim mesajı */
    message: string;
}
interface SendPayload extends LogPayload {
    /** Log seviyesi */
    level: LogLevel;
}
interface TriggerResponse {
    message: string;
    data: {
        title: string;
        message: string;
        level: string;
    };
}
declare class SignalbirdError extends Error {
    statusCode: number;
    details?: any | undefined;
    constructor(message: string, statusCode: number, details?: any | undefined);
}

declare class Signalbird {
    private client;
    constructor(config: SignalbirdConfig);
    /** Bilgilendirme bildirimi gönder */
    info(payload: LogPayload): Promise<TriggerResponse>;
    /** Uyarı bildirimi gönder */
    warn(payload: LogPayload): Promise<TriggerResponse>;
    /** Hata bildirimi gönder */
    error(payload: LogPayload): Promise<TriggerResponse>;
    /** Kritik hata bildirimi gönder (acil bildirim) */
    critical(payload: LogPayload): Promise<TriggerResponse>;
    /** Onay/başarı bildirimi gönder */
    confirm(payload: LogPayload): Promise<TriggerResponse>;
    /** Debug bildirimi gönder */
    debug(payload: LogPayload): Promise<TriggerResponse>;
    /** Özel seviyede bildirim gönder */
    send(payload: SendPayload): Promise<TriggerResponse>;
}

declare class SignalbirdClient {
    private http;
    readonly apiKey: string;
    constructor(config: SignalbirdConfig);
    trigger(title: string, message: string, level: string): Promise<TriggerResponse>;
}

export { type LogLevel, type LogPayload, type SendPayload, Signalbird, SignalbirdClient, type SignalbirdConfig, SignalbirdError, type TriggerResponse };
