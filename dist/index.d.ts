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
    /** Sunucunun ham yanıt gövdesi (varsa) — gönderim istemcisi doldurur. */
    readonly body?: unknown | undefined;
    constructor(message: string, status: number, code?: string | undefined, 
    /** Sunucunun ham yanıt gövdesi (varsa) — gönderim istemcisi doldurur. */
    body?: unknown | undefined);
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
 * Gönderim (Messaging) istemcisinin tipleri.
 *
 * Alan adları API ile birebir aynıdır (snake_case) — SDK, sunucunun döndüğünü
 * yeniden adlandırmaz. Böylece API dokümanındaki bir alan SDK'da da aynı adla
 * bulunur ve iki doküman arasında çeviri tablosu gerekmez.
 */
interface MessagingConfig {
    /** Takım API anahtarı (`sb_…`). GİZLİDİR, yalnız sunucuda kullanılır. */
    apiKey: string;
    /** Varsayılan: https://signalbird.io/api */
    baseUrl?: string;
    /** İstek zaman aşımı (ms). Varsayılan 15000 — toplu kişi yükleme uzun sürebilir. */
    timeout?: number;
    /** Hata fırlatılsın mı. Varsayılan `false`: `ok:false` + `code` döner. */
    throwOnError?: boolean;
    /** Konsola uyarı yazılsın mı. */
    debug?: boolean;
}
/** Her metodun döndüğü sonuç: ya `ok:true` + `data`, ya `ok:false` + `code`. */
type SbResult<T> = {
    ok: true;
    status: number;
    data: T;
} | {
    ok: false;
    status: number;
    code: string;
    message: string;
    data?: unknown;
};
/** İleti sınıfı — API'de zorunludur ve varsayılanı YOKTUR (hukuki kapı). */
type MessageClass = 'transactional' | 'commercial';
type Channel = 'email' | 'sms' | 'push';
interface SendEmailInput {
    to: string;
    class: MessageClass;
    subject: string;
    body?: string;
    template_hash?: string;
    vars?: Record<string, unknown>;
    sending_domain_id?: number;
    contact_id?: number;
}
interface SendSmsInput {
    to: string;
    class: MessageClass;
    body: string;
    brand_id?: number;
    contact_id?: number;
}
interface SendPushInput {
    /** Cihaz token'ı, `contact:<id>` ya da `external:<external_id>`. */
    to: string;
    class: MessageClass;
    subject: string;
    body: string;
    /** `data` (FCM data yükü), `image`, `url`. */
    vars?: Record<string, unknown>;
    contact_id?: number;
}
/** 202 Accepted */
interface SendResult {
    id: string;
    status: string;
    units: number;
}
interface SmsPreview {
    units: number;
    encoding?: string;
    length?: number;
    [key: string]: unknown;
}
interface ContactInput {
    email?: string;
    phone?: string;
    first_name?: string;
    last_name?: string;
    attributes?: Record<string, unknown>;
    list_ids?: number[];
    consent_source?: string;
    consent_text?: string;
    [key: string]: unknown;
}
interface Contact {
    id: number;
    email: string | null;
    phone: string | null;
    first_name: string | null;
    last_name: string | null;
    attributes: Record<string, unknown> | null;
    [key: string]: unknown;
}
interface ListContactsQuery {
    q?: string;
    list_id?: number;
    page?: number;
    per_page?: number;
    [key: string]: unknown;
}
interface BulkContactsInput {
    contacts: ContactInput[];
    list_id?: number;
    consent_source?: string;
    consent_text?: string;
}
interface BulkContactsResult {
    imported: number;
    updated: number;
    skipped: unknown[];
}
interface ContactList {
    id: number;
    name: string;
    description: string | null;
    contacts_count?: number;
    [key: string]: unknown;
}
interface CreateContactListInput {
    name: string;
    description?: string;
}
interface CreateCampaignInput {
    name: string;
    channel: Channel;
    list_id: number;
    subject?: string;
    body: string;
    template_hash?: string;
    sending_domain_id?: number;
    brand_id?: number;
    /** ISO-8601; verilirse parti `scheduled` açılır. */
    scheduled_at?: string;
    metadata?: Record<string, unknown>;
    external_ref?: string;
}
interface Batch {
    id: number;
    name: string;
    channel: Channel;
    status: string;
    [key: string]: unknown;
}
/** 202 Accepted */
interface CampaignCreateResult {
    batch: Batch;
    class: MessageClass;
    summary: {
        total: number;
        queued: number;
        skipped: number;
        stopped_reason: string | null;
    };
}
interface CampaignDetail {
    batch: Batch;
    status_breakdown: Record<string, number>;
    jobs: unknown[];
}
interface ListCampaignsQuery {
    status?: string;
    channel?: Channel;
    page?: number;
    per_page?: number;
    [key: string]: unknown;
}
interface Message {
    id: string;
    channel: Channel;
    class: MessageClass;
    /** Maskeli alıcı (`a***@example.com`). */
    recipient: string;
    subject: string | null;
    status: string;
    status_label: string;
    units: number;
    last_code: string | null;
    queued_at: string | null;
    sent_at: string | null;
    delivered_at: string | null;
    first_opened_at: string | null;
    first_clicked_at: string | null;
    contact_id: number | null;
    external_ref: string | null;
    batch_id: number | null;
}
interface ListMessagesQuery {
    status?: string;
    channel?: Channel;
    batch_id?: number;
    page?: number;
    per_page?: number;
    [key: string]: unknown;
}
interface ListCampaignMessagesQuery {
    page?: number;
    per_page?: number;
    status?: string;
}
/** Laravel sayfalayıcısı. */
interface Paginated<T> {
    data: T[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    [key: string]: unknown;
}
/** API'nin döndürebileceği hata kodları (bilinenler). */
type MessagingErrorCode = 'API_KEY_MISSING' | 'API_KEY_INVALID' | 'API_KEY_SCOPE' | 'API_KEY_IP_BLOCKED' | 'API_KEY_NO_TEAM' | 'MODULE_DISABLED' | 'LIMIT_REACHED' | 'OVERAGE_CEILING_REACHED' | 'SUPPRESSED' | 'NO_CONSENT' | 'NO_SENDING_DOMAIN' | 'INVALID_PHONE' | 'LIST_NOT_FOUND' | 'NO_RECIPIENTS' | 'ALREADY_FINISHED' | 'NETWORK_ERROR' | 'TIMEOUT' | 'VALIDATION_ERROR' | (string & {});

declare class SignalbirdMessaging {
    private readonly apiKey;
    private readonly baseUrl;
    private readonly timeout;
    private readonly throwOnError;
    private readonly debug;
    constructor(config: MessagingConfig);
    sendEmail(input: SendEmailInput): Promise<SbResult<SendResult>>;
    sendSms(input: SendSmsInput): Promise<SbResult<SendResult>>;
    /** SMS parça/karakter hesabı — kota harcamaz. */
    previewSms(body: string): Promise<SbResult<SmsPreview>>;
    sendPush(input: SendPushInput): Promise<SbResult<SendResult>>;
    listContacts(query?: ListContactsQuery): Promise<SbResult<Paginated<Contact>>>;
    createContact(contact: ContactInput): Promise<SbResult<Contact>>;
    updateContact(id: number | string, contact: Partial<ContactInput>): Promise<SbResult<Contact>>;
    deleteContact(id: number | string): Promise<SbResult<unknown>>;
    /**
     * Toplu kişi yükleme.
     *
     * 1000'lik parçalara bölünür ve SIRAYLA gönderilir (paralel değil: aynı
     * e-posta iki parçada da varsa yarış olmasın). Sonuçlar tek yanıtta
     * birleştirilir. Bir parça başarısız olursa o noktada durulur ve o ana kadar
     * biriken sayımlar `data` içinde döner — çağıran kaç kişinin işlendiğini görür.
     */
    bulkContacts(input: BulkContactsInput): Promise<SbResult<BulkContactsResult>>;
    listContactLists(): Promise<SbResult<ContactList[] | Paginated<ContactList>>>;
    createContactList(input: CreateContactListInput): Promise<SbResult<ContactList>>;
    deleteContactList(id: number | string): Promise<SbResult<unknown>>;
    listCampaigns(query?: ListCampaignsQuery): Promise<SbResult<Paginated<Batch> | Batch[]>>;
    createCampaign(input: CreateCampaignInput): Promise<SbResult<CampaignCreateResult>>;
    getCampaign(id: number | string): Promise<SbResult<CampaignDetail>>;
    cancelCampaign(id: number | string): Promise<SbResult<unknown>>;
    listCampaignMessages(id: number | string, query?: ListCampaignMessagesQuery): Promise<SbResult<Paginated<Message>>>;
    /**
     * Bir kampanyanın tüm mesajlarını sayfa sayfa gezer.
     *
     *   for await (const m of sdk.iterateCampaignMessages(42)) { … }
     *
     * Bir sayfa alınamazsa `SignalbirdError` fırlatır (sessiz yarım liste,
     * "hepsi bu" sanılır — o daha tehlikeli).
     */
    iterateCampaignMessages(id: number | string, query?: Omit<ListCampaignMessagesQuery, 'page'>): AsyncGenerator<Message, void, undefined>;
    listMessages(query?: ListMessagesQuery): Promise<SbResult<Paginated<Message>>>;
    getMessage(id: string): Promise<SbResult<Message>>;
    private request;
    private fail;
}

declare function verifyWebhook(rawBody: string | Uint8Array, signatureHeader: string | null | undefined, secret: string): boolean;

/**
 * @signalbird/sdk — sunucu tarafı giriş noktası.
 *
 * Next.js sunucu bileşenleri, API route'ları, Express/Fastify/NestJS ve düz
 * Node betikleri buradan alır. TARAYICI için `@signalbird/sdk/browser`
 * kullanılır — gizli anahtar istemciye inmez.
 *
 * İki istemci vardır ve anahtarları farklıdır:
 *  - `SignalbirdClient`    → Telsiz (log), `sbr_live_…`
 *  - `SignalbirdMessaging` → Gönderim (e-posta/SMS/push/kişi/kampanya), `sb_…`
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

export { type Batch, type BatchResult, type BulkContactsInput, type BulkContactsResult, type CampaignCreateResult, type CampaignDetail, type Channel, type Contact, type ContactInput, type ContactList, type CreateCampaignInput, type CreateContactListInput, DEFAULT_BASE_URL, type Level, type ListCampaignMessagesQuery, type ListCampaignsQuery, type ListContactsQuery, type ListMessagesQuery, type LogInput, type LogResult, type Message, type MessageClass, type MessagingConfig, type MessagingErrorCode, type Paginated, type SbResult, type SendEmailInput, type SendPushInput, type SendResult, type SendSmsInput, SignalbirdClient, type SignalbirdConfig, SignalbirdError, SignalbirdMessaging, type SmsPreview, resetSignalbird, signalbird, verifyWebhook };
