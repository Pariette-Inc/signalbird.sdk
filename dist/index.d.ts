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
type SbResult$1<T> = {
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
    /**
     * TXT ile doğrulanmış müşteri domaininin id'si — ZORUNLU. Doğrulanmamış
     * domain adına kampanya açılamaz (`DOMAIN_NOT_VERIFIED`).
     */
    domain_id: number;
    /** Hedef: `list_id` VEYA `segment_id` — ikisinden tam biri. */
    list_id?: number;
    segment_id?: number;
    subject?: string;
    body: string;
    template_hash?: string;
    sending_domain_id?: number;
    brand_id?: number;
    /** ISO-8601; verilirse parti `scheduled` açılır. */
    scheduled_at?: string;
    /** E-postada görünen isim; zarf adresi sendsignalbird havuzunda kalır. */
    from_name?: string;
    /** Yanıt adresi (Reply-To). */
    reply_to?: string;
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
interface Paginated$1<T> {
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
    sendEmail(input: SendEmailInput): Promise<SbResult$1<SendResult>>;
    sendSms(input: SendSmsInput): Promise<SbResult$1<SendResult>>;
    /** SMS parça/karakter hesabı — kota harcamaz. */
    previewSms(body: string): Promise<SbResult$1<SmsPreview>>;
    sendPush(input: SendPushInput): Promise<SbResult$1<SendResult>>;
    listContacts(query?: ListContactsQuery): Promise<SbResult$1<Paginated$1<Contact>>>;
    createContact(contact: ContactInput): Promise<SbResult$1<Contact>>;
    updateContact(id: number | string, contact: Partial<ContactInput>): Promise<SbResult$1<Contact>>;
    deleteContact(id: number | string): Promise<SbResult$1<unknown>>;
    /**
     * Toplu kişi yükleme.
     *
     * 1000'lik parçalara bölünür ve SIRAYLA gönderilir (paralel değil: aynı
     * e-posta iki parçada da varsa yarış olmasın). Sonuçlar tek yanıtta
     * birleştirilir. Bir parça başarısız olursa o noktada durulur ve o ana kadar
     * biriken sayımlar `data` içinde döner — çağıran kaç kişinin işlendiğini görür.
     */
    bulkContacts(input: BulkContactsInput): Promise<SbResult$1<BulkContactsResult>>;
    listContactLists(): Promise<SbResult$1<ContactList[] | Paginated$1<ContactList>>>;
    createContactList(input: CreateContactListInput): Promise<SbResult$1<ContactList>>;
    deleteContactList(id: number | string): Promise<SbResult$1<unknown>>;
    listCampaigns(query?: ListCampaignsQuery): Promise<SbResult$1<Paginated$1<Batch> | Batch[]>>;
    createCampaign(input: CreateCampaignInput): Promise<SbResult$1<CampaignCreateResult>>;
    getCampaign(id: number | string): Promise<SbResult$1<CampaignDetail>>;
    cancelCampaign(id: number | string): Promise<SbResult$1<unknown>>;
    listCampaignMessages(id: number | string, query?: ListCampaignMessagesQuery): Promise<SbResult$1<Paginated$1<Message>>>;
    /**
     * Bir kampanyanın tüm mesajlarını sayfa sayfa gezer.
     *
     *   for await (const m of sdk.iterateCampaignMessages(42)) { … }
     *
     * Bir sayfa alınamazsa `SignalbirdError` fırlatır (sessiz yarım liste,
     * "hepsi bu" sanılır — o daha tehlikeli).
     */
    iterateCampaignMessages(id: number | string, query?: Omit<ListCampaignMessagesQuery, 'page'>): AsyncGenerator<Message, void, undefined>;
    listMessages(query?: ListMessagesQuery): Promise<SbResult$1<Paginated$1<Message>>>;
    getMessage(id: string): Promise<SbResult$1<Message>>;
    private request;
    private fail;
}

/** Her metodun döndüğü zarf. Başarısızlık istisna değil, veridir. */
interface SbResult<T = unknown> {
    ok: boolean;
    status: number;
    data?: T;
    code?: string;
    message?: string;
}

/**
 * Yönetim (Management) yüzeyinin tipleri.
 *
 * Alan adları API ile BİREBİR aynıdır (snake_case). SDK yeniden adlandırmaz:
 * müşteri bir alanı belgede görüp kodda başka adla bulursa, kaybettiği zaman
 * SDK'nın kazandırdığı zamandan fazladır.
 */

interface ManagementConfig {
    /** Takım API anahtarı (`sb_…`) — `radio:*`, `chat:*`, `apps:*` scope'larıyla. */
    apiKey: string;
    /** Varsayılan: https://signalbird.io/api */
    baseUrl?: string;
    /** İstek zaman aşımı (ms). Varsayılan 15000. */
    timeout?: number;
    /** Açıksa `SignalbirdError` fırlatılır; varsayılan `false`. */
    throwOnError?: boolean;
    debug?: boolean;
}
/** Sayfalı Laravel yanıtı. */
interface Paginated<T> {
    data: T[];
    current_page?: number;
    last_page?: number;
    per_page?: number;
    total?: number;
}
type RadioLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical';
interface RadioProject {
    id: number;
    name: string;
    slug?: string;
    description?: string | null;
    /** Gizli anahtarın tanınacak kadarı; tamamı yalnız oluşturmada döner. */
    secret_hint?: string | null;
    public_key?: string | null;
    is_active?: boolean;
    channels_count?: number;
    events_count?: number;
    last_event_at?: string | null;
    channels?: RadioChannel[];
}
interface RadioChannel {
    id: number;
    key: string;
    name: string;
    description?: string | null;
    level?: RadioLevel;
    notify_push?: boolean;
    notify_email?: boolean;
    recipient_user_ids?: number[] | null;
    quiet_from?: number | null;
    quiet_to?: number | null;
    dedupe_seconds?: number;
    is_active?: boolean;
    is_auto?: boolean;
}
interface CreateRadioProjectInput {
    name: string;
}
interface UpdateRadioProjectInput {
    name?: string;
    description?: string | null;
    is_active?: boolean;
    /** Tarayıcıdan yazılabilen kanallar ve izinli kökenler. */
    browser_channels?: string[] | null;
    allowed_origins?: string[] | null;
}
interface RadioChannelInput {
    key?: string;
    name?: string;
    description?: string | null;
    level?: RadioLevel;
    notify_push?: boolean;
    notify_email?: boolean;
    recipient_user_ids?: number[] | null;
    quiet_from?: number | null;
    quiet_to?: number | null;
    dedupe_seconds?: number;
    is_active?: boolean;
}
/** Proje açılışı: gizli anahtar YALNIZ burada döner, bir daha okunamaz. */
interface RadioProjectCreated {
    project: RadioProject;
    secret: string;
}
interface RadioEvent {
    id: string;
    channel?: string;
    channel_id?: number;
    project_id?: number;
    message: string;
    level: RadioLevel;
    context?: Record<string, unknown> | null;
    source?: string | null;
    created_at?: string;
}
interface ListRadioEventsQuery {
    project_id?: number;
    channel_id?: number;
    level?: RadioLevel;
    q?: string;
    from?: string;
    to?: string;
    page?: number;
    per_page?: number;
}
type ConversationStatus = 'open' | 'pending' | 'resolved' | 'closed';
interface ChatConversation {
    id: string;
    status: ConversationStatus;
    subject?: string | null;
    priority?: string | null;
    tags?: string[] | null;
    unread_count?: number;
    assigned_user_id?: number | null;
    visitor?: ChatVisitor | null;
    last_message_preview?: string | null;
    last_message_at?: string | null;
    created_at?: string;
}
interface ChatVisitor {
    id: string;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    external_id?: string | null;
    attributes?: Record<string, unknown> | null;
    is_banned?: boolean;
    last_seen_at?: string | null;
}
interface ChatMessage {
    id: string;
    conversation_id?: string;
    sender_type: 'visitor' | 'agent' | 'system';
    sender_id?: number | string | null;
    body?: string | null;
    is_internal?: boolean;
    attachments?: unknown[] | null;
    reply_to_id?: string | null;
    reactions?: Record<string, unknown> | null;
    created_at?: string;
}
interface ListConversationsQuery {
    status?: ConversationStatus | ConversationStatus[];
    assigned_user_id?: number | 'me' | 'none';
    app_id?: number;
    q?: string;
    page?: number;
    per_page?: number;
}
interface ListChatMessagesQuery {
    after?: string;
    before?: string;
    limit?: number;
    /** Ajan tarafı iç notları da okuyabilir; ziyaretçi asla göremez. */
    include_internal?: boolean;
}
interface StartConversationInput {
    /** Ziyaretçi ya da kişi — biri zorunlu. */
    visitor_id?: string;
    contact_id?: number;
    body: string;
    app_id?: number;
}
interface UpdateConversationInput {
    subject?: string | null;
    priority?: string | null;
    tags?: string[] | null;
}
interface ReplyInput {
    body?: string;
    /** İç not: gelen kutusunda görünür, ziyaretçiye ASLA gitmez. */
    is_internal?: boolean;
    reply_to_id?: string | null;
    attachments?: unknown[];
}
interface UpdateVisitorInput {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    attributes?: Record<string, unknown> | null;
}
interface CannedReply {
    id: number;
    shortcut: string;
    title?: string | null;
    body: string;
    usage_count?: number;
}
interface CannedReplyInput {
    shortcut?: string;
    title?: string | null;
    body?: string;
}
type AppPlatform = 'web' | 'ios' | 'android' | 'other';
interface AppRecord {
    id: number;
    name: string;
    platform: AppPlatform;
    /** `sbw_pub_…` — açık anahtar, zaten istemciye gömülür. */
    public_key: string;
    allowed_origins?: string[] | null;
    chat_enabled?: boolean;
    push_enabled?: boolean;
    is_active?: boolean;
    settings?: Record<string, unknown> | null;
    devices_count?: number;
    conversations_count?: number;
}
interface AppInput {
    name?: string;
    platform?: AppPlatform;
    allowed_origins?: string[] | null;
    chat_enabled?: boolean;
    push_enabled?: boolean;
    is_active?: boolean;
    settings?: Record<string, unknown> | null;
}
interface AppDevice {
    id: number;
    /** Maskeli token — tamamı hiçbir zaman dönmez. */
    token_masked?: string;
    platform?: string;
    provider?: string | null;
    device_name?: string | null;
    app_version?: string | null;
    locale?: string | null;
    is_active?: boolean;
    last_seen_at?: string | null;
}
interface ListAppDevicesQuery {
    page?: number;
    per_page?: number;
}
type ChatTriggerEvent = 'conversation.created' | 'visitor.message' | 'no_reply';
interface ChatTriggerRule {
    field: string;
    op: string;
    value?: string | number | boolean | null;
}
interface ChatTriggerAction {
    type: 'reply' | 'internal_note' | 'tag' | 'priority' | 'assign';
    body?: string;
    value?: string;
    user_id?: number;
}
interface ChatTrigger {
    id: number;
    name: string;
    event: ChatTriggerEvent;
    /** Boş = takımın tüm uygulamaları. */
    app_id: number | null;
    conditions: {
        match: 'all' | 'any';
        rules: ChatTriggerRule[];
    };
    actions: ChatTriggerAction[];
    /** Yalnız `no_reply` olayında okunur. */
    delay_seconds: number;
    is_active: boolean;
    priority: number;
    stop_after_match: boolean;
    fired_count: number;
    last_fired_at: string | null;
}
interface ChatTriggerInput {
    name: string;
    event: ChatTriggerEvent;
    app_id?: number | null;
    conditions?: {
        match: 'all' | 'any';
        rules: ChatTriggerRule[];
    };
    actions: ChatTriggerAction[];
    delay_seconds?: number;
    is_active?: boolean;
    priority?: number;
    stop_after_match?: boolean;
}
type ChatReportRange = '7d' | '30d' | '90d';
interface ChatReportAgent {
    user_id: number;
    name: string | null;
    assigned: number;
    replies: number;
    resolved: number;
    median_first_response_s: number | null;
    rating_average: number | null;
    rating_count: number;
}
interface ChatReport {
    range: string;
    since: string;
    volume: {
        total: number;
        open: number;
        resolved: number;
        closed: number;
        unanswered: number;
    };
    /** Ortalama DEĞİL ortanca; veri yoksa `null` döner, 0 değil. */
    first_response: {
        median_s: number | null;
        p90_s: number | null;
        answered: number;
    };
    resolution: {
        median_s: number | null;
        p90_s: number | null;
        resolved: number;
    };
    satisfaction: {
        average: number | null;
        count: number;
        breakdown: Record<string, number>;
    };
    agents: ChatReportAgent[];
}

/**
 * Yönetim (Management) istemcisi — sunucu tarafı.
 *
 * Müşterinin panelde tıklayarak yaptığı her şeyi kodla yapar: Telsiz projesi ve
 * kanalı açar, olay akışını okur, sohbet gelen kutusunu işler, uygulama kaydı
 * ve cihaz listesi yönetir.
 *
 * Bu ADMIN yüzeyi DEĞİLDİR. Anahtar tek bir takıma bağlıdır ve yalnız o takımın
 * kayıtlarına dokunur; başka takımın kaydı 404 döner.
 *
 * Neden ayrı sınıf: Gönderim (`SignalbirdMessaging`) ileti gönderir ve kota
 * harcar; bu istemci yapılandırma değiştirir. Aynı anahtar ailesini kullanırlar
 * (`sb_…`) ama scope'ları ve hata kümeleri farklıdır — tek sınıfta birleşseydi
 * "hangi scope gerekiyordu" sorusu her metotta yeniden sorulurdu.
 *
 * Sözleşme: docs/CONTRACT.md § 10
 */

declare class SignalbirdManagement {
    private readonly http;
    constructor(config: ManagementConfig);
    /** Panelin Telsiz özeti: proje sayısı, günlük hacim, son olaylar. */
    radioSummary(): Promise<SbResult<Record<string, unknown>>>;
    /** Olay akışı — kanal, seviye ve tarihe göre süzülür. */
    radioEvents(query?: ListRadioEventsQuery): Promise<SbResult<Paginated<RadioEvent>>>;
    listRadioProjects(): Promise<SbResult<{
        data: RadioProject[];
    }>>;
    /**
     * Proje açar.
     *
     * Dönen `secret` (`sbr_live_…`) YALNIZ BURADA görünür: sunucuda yalnız
     * SHA-256 özeti saklanır. Kaybedilirse `rotateRadioSecret` ile yenilenir.
     */
    createRadioProject(input: CreateRadioProjectInput): Promise<SbResult<RadioProjectCreated>>;
    getRadioProject(id: number | string): Promise<SbResult<{
        project: RadioProject;
    }>>;
    updateRadioProject(id: number | string, input: UpdateRadioProjectInput): Promise<SbResult<{
        project: RadioProject;
    }>>;
    deleteRadioProject(id: number | string): Promise<SbResult<unknown>>;
    /** Gizli anahtarı yeniler; eski anahtar ANINDA geçersizleşir. */
    rotateRadioSecret(id: number | string): Promise<SbResult<{
        secret: string;
    }>>;
    createRadioChannel(projectId: number | string, input: RadioChannelInput): Promise<SbResult<{
        channel: RadioChannel;
    }>>;
    /**
     * Kanalı günceller. `key` DEĞİŞMEZ — müşterinin kodundaki `log('critical', …)`
     * çağrısı ona bağlıdır; sunucu gönderilse de yok sayar.
     */
    updateRadioChannel(projectId: number | string, channelId: number | string, input: RadioChannelInput): Promise<SbResult<{
        channel: RadioChannel;
    }>>;
    deleteRadioChannel(projectId: number | string, channelId: number | string): Promise<SbResult<unknown>>;
    chatSummary(): Promise<SbResult<Record<string, unknown>>>;
    /** Kısa aralıklı yoklama için: yalnız değişenler + çevrimiçi ajanlar. */
    chatUpdates(): Promise<SbResult<Record<string, unknown>>>;
    listConversations(query?: ListConversationsQuery): Promise<SbResult<Paginated<ChatConversation>>>;
    getConversation(id: string): Promise<SbResult<{
        conversation: ChatConversation;
    }>>;
    /** `after` imleci `cm_…` mesaj kimliğidir; yoklamada tam listeyi çekmez. */
    listConversationMessages(id: string, query?: ListChatMessagesQuery): Promise<SbResult<{
        messages: ChatMessage[];
    }>>;
    /** Proaktif sohbet — ziyaretçi yazmadan ajan başlatır. */
    startConversation(input: StartConversationInput): Promise<SbResult<{
        conversation: ChatConversation;
    }>>;
    updateConversation(id: string, input: UpdateConversationInput): Promise<SbResult<{
        conversation: ChatConversation;
    }>>;
    setConversationStatus(id: string, status: ConversationStatus): Promise<SbResult<{
        conversation: ChatConversation;
    }>>;
    /**
     * Atama atomiktir: `userId` verilmezse çağıran anahtarın sahibine atanır.
     * Başkasına atanmış sohbeti devralmak `chat:write` ister.
     */
    assignConversation(id: string, userId?: number | null): Promise<SbResult<{
        conversation: ChatConversation;
    }>>;
    readConversation(id: string, lastMessageId?: string): Promise<SbResult<unknown>>;
    setTyping(id: string, isTyping: boolean): Promise<SbResult<unknown>>;
    reply(id: string, input: ReplyInput): Promise<SbResult<{
        message: ChatMessage;
    }>>;
    editChatMessage(id: string, messageId: string, body: string): Promise<SbResult<{
        message: ChatMessage;
    }>>;
    deleteChatMessage(id: string, messageId: string): Promise<SbResult<unknown>>;
    /** Tepki açma/kapama — aynı emoji ikinci kez gönderilirse kaldırılır. */
    reactToChatMessage(id: string, messageId: string, emoji: string): Promise<SbResult<{
        message: ChatMessage;
    }>>;
    getVisitor(id: string): Promise<SbResult<{
        visitor: ChatVisitor;
    }>>;
    updateVisitor(id: string, input: UpdateVisitorInput): Promise<SbResult<{
        visitor: ChatVisitor;
    }>>;
    banVisitor(id: string): Promise<SbResult<{
        visitor: ChatVisitor;
    }>>;
    listCannedReplies(): Promise<SbResult<{
        data: CannedReply[];
    }>>;
    createCannedReply(input: CannedReplyInput): Promise<SbResult<{
        reply: CannedReply;
    }>>;
    updateCannedReply(id: number | string, input: CannedReplyInput): Promise<SbResult<{
        reply: CannedReply;
    }>>;
    deleteCannedReply(id: number | string): Promise<SbResult<unknown>>;
    listChatTriggers(): Promise<SbResult<{
        data: ChatTrigger[];
        schema: Record<string, string[]>;
    }>>;
    createChatTrigger(input: ChatTriggerInput): Promise<SbResult<{
        trigger: ChatTrigger;
    }>>;
    updateChatTrigger(id: number | string, input: Partial<ChatTriggerInput>): Promise<SbResult<{
        trigger: ChatTrigger;
    }>>;
    deleteChatTrigger(id: number | string): Promise<SbResult<unknown>>;
    /**
     * Yanıt süresi, çözüm süresi, memnuniyet ve ajan kırılımı.
     * Veri yoksa süreler `null` döner — 0 DEĞİL.
     */
    chatReport(range?: ChatReportRange): Promise<SbResult<ChatReport>>;
    listApps(): Promise<SbResult<AppRecord[]>>;
    /** Yanıttaki `public_key` (`sbw_pub_…`) istemciye gömülür; gizli değildir. */
    createApp(input: AppInput): Promise<SbResult<AppRecord>>;
    getApp(id: number | string): Promise<SbResult<AppRecord>>;
    updateApp(id: number | string, input: AppInput): Promise<SbResult<AppRecord>>;
    deleteApp(id: number | string): Promise<SbResult<unknown>>;
    /** Açık anahtarı yeniler; siteye gömülü eski anahtar ANINDA çalışmaz olur. */
    rotateAppKey(id: number | string): Promise<SbResult<AppRecord>>;
    listAppDevices(id: number | string, query?: ListAppDevicesQuery): Promise<SbResult<Paginated<AppDevice>>>;
}

/**
 * Partner (beşinci yüzey) tipleri.
 *
 * Sözleşme: docs/CONTRACT.md § 12 ve
 * signalbird.api/docs/PARTNER_PLATFORM_2026-08-20.md.
 *
 * Alan adları API ile birebir aynıdır (snake_case) — SDK yeniden adlandırmaz.
 */

interface PartnerConfig {
    /** `sbp_live_…` — sözleşmeli partner anahtarı. Tarayıcıya İNMEZ. */
    apiKey: string;
    baseUrl?: string;
    timeout?: number;
    throwOnError?: boolean;
    debug?: boolean;
}
interface PartnerOwnerInput {
    email: string;
    name?: string;
    /** Partner'ın kendi tarafındaki kullanıcı kimliği. */
    external_id?: string;
    locale?: string;
}
interface CreateCompanyInput {
    /** Partner'ın kendi tarafındaki müşteri kimliği — idempotens anahtarı. */
    external_id: string;
    name: string;
    owner: PartnerOwnerInput;
    team_name?: string;
    link_email?: string;
}
interface PartnerCompany {
    id: number;
    external_id: string;
    name: string;
    status: string;
    billing_managed_by_partner: boolean;
    modules: string[];
    created_at: string | null;
}
interface CreateCompanyResult {
    created: boolean;
    company: PartnerCompany;
    team: {
        id: number | null;
        name: string | null;
    };
    owner: {
        id: number | null;
        email: string | null;
        name: string | null;
    };
    /** YALNIZ ilk oluşturmada döner. Kaybedilirse `rotateKey` yenisini üretir. */
    keys?: {
        api_key: string;
        app_key: string;
    };
}
interface DnsRecord {
    host: string;
    type: string;
    value: string;
}
interface PartnerDomain {
    id: number;
    external_id: string;
    domain: string;
    verified_at: string | null;
    /** `txt` | `partner` — partner beyanı kampanya için YETMEZ. */
    verified_via: string | null;
    can_send_campaigns: boolean;
    is_active: boolean;
}
interface AddDomainInput {
    external_id: string;
    domain: string;
    monitoring?: {
        enabled?: boolean;
        frequency?: number;
    };
}
interface AddDomainResult {
    created: boolean;
    domain: PartnerDomain;
    watcher: {
        id: number;
        frequency: number;
    } | null;
    dns: DnsRecord[];
    note: string;
}
interface VerifyDomainResult {
    verified: boolean;
    domain: PartnerDomain;
    dns: DnsRecord[];
}
interface UptimeIncident {
    started_at: string;
    ended_at: string | null;
    duration_s: number;
    reason: string | null;
}
interface UptimeReport {
    domain?: string;
    external_id?: string;
    monitored?: boolean;
    range: string;
    /** Hiç kontrol yoksa `null` döner — %100 DEĞİL. */
    uptime: number | null;
    avg_response_ms: number | null;
    checks: number;
    status: string | null;
    last_checked_at: string | null;
    incidents: UptimeIncident[];
}
type UptimeRange = '24h' | '7d' | '30d';
interface ModuleEntitlement {
    module: string;
    limits: Record<string, number>;
    source: string;
    expires_at: string | null;
}
interface GrantModuleInput {
    module: string;
    limits?: Record<string, number>;
    /** Aboneliğin bittiği tarih; yenilemede tazelenmezse modül kendi kapanır. */
    expires_at?: string;
    reason?: string;
}
interface PartnerUserInput {
    external_id: string;
    email: string;
    name?: string;
    role?: 'owner' | 'billing' | 'member';
    team_role?: string;
    permissions?: string[];
}
interface PartnerUser {
    id: number;
    external_id: string | null;
    email: string;
    name: string | null;
    role: string | null;
}
type EmbedModule = 'chat' | 'monitoring' | 'campaigns' | 'contacts' | 'radio';
interface EmbedTokenInput {
    user_external_id: string;
    module: EmbedModule;
    locale?: string;
    theme?: 'light' | 'dark';
    accent?: string;
}
interface EmbedToken {
    url: string;
    token: string;
    expires_at: string;
    ttl: number;
}

/**
 * Partner istemcisi — BEŞİNCİ yüzey.
 *
 * Signalbird'ü kendi ürününün içinde satan sözleşmeli platform (veribenim,
 * submitcms) müşterisini bununla sağlar ve yetkilendirir: company + takım +
 * owner açar, domain ekler ve izlemeye alır, uptime okur, modül açar/kapatır,
 * gömme jetonu üretir.
 *
 * **Bu, CLAUDE.md'deki "Admin yüzeyi OLMAYACAK" kuralının bilinçli
 * istisnasıdır** ve istisna olduğu için ayrı anahtar türü taşır. Kural,
 * müşterinin kendi anahtarıyla (`sb_`) şirket açamaması içindi; o kural aynen
 * duruyor. Sözleşmeli partner farklı bir taraftır.
 *
 * Anahtar `sbp_live_…` **asla tarayıcıya inmez**: gömme jetonunu partner'ın
 * kendi sunucusu üretir, tarayıcı yalnız o kısa ömürlü jetonu görür.
 *
 * Sözleşme: docs/CONTRACT.md § 12
 */

declare class SignalbirdPartner {
    private readonly http;
    constructor(config: PartnerConfig);
    /**
     * Company + takım + owner açar. **Idempotenttir**: aynı `external_id` ile
     * ikinci çağrı yeni kayıt açmaz, `created:false` ile var olanı döner.
     * Anahtarlar (`keys`) yalnız ilk oluşturmada gelir.
     */
    createCompany(input: CreateCompanyInput): Promise<SbResult<CreateCompanyResult>>;
    listCompanies(query?: {
        page?: number;
        q?: string;
        per_page?: number;
    }): Promise<SbResult<{
        data: PartnerCompany[];
        meta: Record<string, number>;
    }>>;
    getCompany(externalId: string): Promise<SbResult<{
        company: PartnerCompany;
    }>>;
    updateCompany(externalId: string, input: {
        name?: string;
        is_active?: boolean;
    }): Promise<SbResult<{
        company: PartnerCompany;
    }>>;
    /** Askıya alır — SİLMEZ. Müşterinin izleme ve mesaj geçmişi durur. */
    suspendCompany(externalId: string): Promise<SbResult<{
        company: PartnerCompany;
    }>>;
    rotateKey(externalId: string, type: 'api' | 'app'): Promise<SbResult<{
        type: string;
        key: string;
    }>>;
    /**
     * Domain ekler ve (istenirse) izlemeye alır. Kayıt `verified_via:'partner'`
     * ile doğar: izleme, sohbet ve push için yeter — **e-posta/SMS kampanyası
     * için TXT şarttır**. Yanıttaki `dns` kaydını yayınlayıp `verifyDomain`
     * çağırmak kapıyı açar.
     */
    addDomain(companyExternalId: string, input: AddDomainInput): Promise<SbResult<AddDomainResult>>;
    listDomains(companyExternalId: string): Promise<SbResult<{
        data: PartnerDomain[];
    }>>;
    getDomain(externalId: string): Promise<SbResult<{
        domain: PartnerDomain;
    }>>;
    /** TXT'yi hemen sorgular; eşleşirse domain kampanya kapısından geçer olur. */
    verifyDomain(externalId: string): Promise<SbResult<VerifyDomainResult>>;
    removeDomain(externalId: string): Promise<SbResult<{
        deleted: boolean;
    }>>;
    domainUptime(externalId: string, range?: UptimeRange): Promise<SbResult<UptimeReport>>;
    /** Tek istekte müşterinin tüm domainleri — liste ekranı N+1 atmasın. */
    companyUptime(companyExternalId: string, range?: UptimeRange): Promise<SbResult<{
        range: string;
        data: UptimeReport[];
    }>>;
    listModules(companyExternalId: string): Promise<SbResult<{
        data: ModuleEntitlement[];
    }>>;
    /** "Bu müşteri şu modül için ödeme yaptı, kullanabilir." */
    grantModule(companyExternalId: string, input: GrantModuleInput): Promise<SbResult<ModuleEntitlement>>;
    /** Yalnız partner'ın KENDİ verdiği hakkı geri alır; plan hakkına dokunmaz. */
    revokeModule(companyExternalId: string, module: string): Promise<SbResult<{
        removed: boolean;
    }>>;
    createUser(companyExternalId: string, input: PartnerUserInput): Promise<SbResult<{
        created: boolean;
        user: PartnerUser;
    }>>;
    listUsers(companyExternalId: string): Promise<SbResult<{
        data: PartnerUser[];
    }>>;
    /** Üyeliği kaldırır, kişinin Signalbird hesabını SİLMEZ. */
    removeUser(companyExternalId: string, userExternalId: string): Promise<SbResult<{
        removed: boolean;
    }>>;
    /**
     * Panel ekranını partner sayfasına gömmek için kısa ömürlü jeton üretir.
     * 120 saniye yaşar ve TEK KULLANIMLIKTIR — jeton URL'de gider, log ve
     * `Referer` başlığına düşer.
     */
    createEmbedToken(companyExternalId: string, input: EmbedTokenInput): Promise<SbResult<EmbedToken>>;
}

declare function verifyWebhook(rawBody: string | Uint8Array, signatureHeader: string | null | undefined, secret: string): boolean;

/**
 * @signalbird/sdk — sunucu tarafı giriş noktası.
 *
 * Next.js sunucu bileşenleri, API route'ları, Express/Fastify/NestJS ve düz
 * Node betikleri buradan alır. TARAYICI için `@signalbird/sdk/browser`
 * kullanılır — gizli anahtar istemciye inmez.
 *
 * Üç sunucu istemcisi vardır; anahtarları ve kapıları farklıdır:
 *  - `SignalbirdClient`     → Telsiz (log yazma), `sbr_live_…`
 *  - `SignalbirdMessaging`  → Gönderim (e-posta/SMS/push/kişi/kampanya), `sb_…`
 *  - `SignalbirdManagement` → Yönetim (Telsiz projesi, sohbet gelen kutusu,
 *                             uygulama kaydı), `sb_…` + `radio|chat|apps` scope'ları
 *  - `SignalbirdPartner`    → Partner (müşteri sağlama, modül yetkisi, gömme),
 *                             `sbp_live_…` — yalnız sözleşmeli platformlar
 *
 * Son kullanıcı (ziyaretçi) yüzeyi ayrı giriş noktasındadır:
 * `@signalbird/sdk/app` — ve onun çatı uyarlamaları `/react`, `/vue`,
 * `/angular`, `/react-native`.
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
/**
 * Ortam değişkeninden kurulan paylaşımlı yönetim istemcisi.
 *
 * `SIGNALBIRD_API_KEY` okunur (yoksa `SIGNALBIRD_MESSAGING_KEY` — ikisi de aynı
 * takım anahtarı ailesidir ve çoğu kurulumda tek anahtar kullanılır).
 *
 *   import { management } from '@signalbird/sdk'
 *   await management().createRadioProject({ name: 'ödeme-servisi' })
 */
declare function management(config?: Partial<ManagementConfig>): SignalbirdManagement;
/** Test ve sıcak yeniden yükleme için yönetim istemcisini sıfırlar. */
declare function resetManagement(): void;

export { type AddDomainInput, type AddDomainResult, type AppDevice, type AppInput, type AppPlatform, type AppRecord, type Batch, type BatchResult, type BulkContactsInput, type BulkContactsResult, type CampaignCreateResult, type CampaignDetail, type CannedReply, type CannedReplyInput, type Channel, type ChatConversation, type ChatMessage, type ChatVisitor, type Contact, type ContactInput, type ContactList, type ConversationStatus, type CreateCampaignInput, type CreateCompanyInput, type CreateCompanyResult, type CreateContactListInput, type CreateRadioProjectInput, DEFAULT_BASE_URL, type DnsRecord, type EmbedModule, type EmbedToken, type EmbedTokenInput, type GrantModuleInput, type Level, type ListAppDevicesQuery, type ListCampaignMessagesQuery, type ListCampaignsQuery, type ListChatMessagesQuery, type ListContactsQuery, type ListConversationsQuery, type ListMessagesQuery, type ListRadioEventsQuery, type LogInput, type LogResult, type ManagementConfig, type Message, type MessageClass, type MessagingConfig, type MessagingErrorCode, type ModuleEntitlement, type Paginated$1 as Paginated, type PartnerCompany, type PartnerConfig, type PartnerDomain, type PartnerOwnerInput, type PartnerUser, type PartnerUserInput, type RadioChannel, type RadioChannelInput, type RadioEvent, type RadioLevel, type RadioProject, type RadioProjectCreated, type ReplyInput, type SbResult$1 as SbResult, type SendEmailInput, type SendPushInput, type SendResult, type SendSmsInput, SignalbirdClient, type SignalbirdConfig, SignalbirdError, SignalbirdManagement, SignalbirdMessaging, SignalbirdPartner, type SmsPreview, type StartConversationInput, type UpdateConversationInput, type UpdateRadioProjectInput, type UpdateVisitorInput, type UptimeIncident, type UptimeRange, type UptimeReport, type VerifyDomainResult, management, resetManagement, resetSignalbird, signalbird, verifyWebhook };
