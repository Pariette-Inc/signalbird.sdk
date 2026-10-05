/**
 * Telsiz (Radio) istemcisinin ortak tipleri.
 *
 * SDK'nın tek işi vardır: bir kanala mesaj yazmak. Bildirimin kime, hangi
 * kanaldan ve hangi saatte gideceği SUNUCUDA, kanal ayarlarında durur -
 * istemci bunu bilmez ve bilmemelidir. Aksi hâlde bildirim kuralını
 * değiştirmek için müşterinin kodunu yeniden yayınlaması gerekirdi.
 */
/** Kanalın seviyesi; verilmezse kanalın kendi varsayılanı geçerlidir. */
type Level = 'debug' | 'info' | 'warn' | 'error' | 'critical';
interface SignalbirdConfig {
    /**
     * Gizli domain anahtarı (`sb_secret_live_…`) - `SIGNALBIRD_DOMAIN_KEY`.
     *
     * Bu anahtar GİZLİDİR ve tarayıcıya gömülemez: sunucu `Origin` başlığı taşıyan
     * istekleri reddeder (401 `SECRET_KEY_IN_BROWSER`). Tarayıcı için
     * `signalbird/browser` ve açık anahtar (`sb_public_live_…`) kullanılır.
     *
     * v2 (1 Eyl 2026): eskiden `apiKey` idi ve yüzey başına ayrı bir anahtar
     * ailesi vardı (`sbr_live_`, `sb_`, `sbw_pub_`, `sbp_live_`). Hepsi tek
     * anahtara indi - sözleşme:
     * ../signalbird.api/docs/KEY_ARCHITECTURE_2026-09-01.md
     */
    domainKey: string;
    /** Varsayılan: https://live.signalbird.io/api */
    baseUrl?: string;
    /** Her olaya eklenen köken adı (sunucu adı, servis adı). */
    source?: string;
    /** İstek zaman aşımı (ms). Varsayılan 5000 - log göndermek isteği bekletmemeli. */
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
    /**
     * Modül anahtarı - panelde açtığınız kanalın adı (`penyuSatisBildirimi`).
     *
     * Gizli DEĞİLDİR ve kodun içinde durur: domain anahtarı olmadan hiçbir işe
     * yaramaz. Tanımsız bir ad gönderirseniz kanal SESSİZ olarak açılır - kayıt
     * düşmez, ama bildirim de gitmez; kuralı panelden siz koyarsınız.
     */
    key: string;
    message: string;
    level?: Level;
    context?: Record<string, unknown>;
    source?: string;
}
interface LogResult {
    ok: boolean;
    /** Sunucunun döndüğü olay kimliği (rev_…). */
    eventId?: string;
    /** Reddedildiyse sebep: DOMAIN_KEY_INVALID, MODULE_DISABLED, MODULE_KEY_DISABLED, LIMIT_REACHED… */
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
    /** Sunucunun ham yanıt gövdesi (varsa) - gönderim istemcisi doldurur. */
    readonly body?: unknown | undefined;
    constructor(message: string, status: number, code?: string | undefined, 
    /** Sunucunun ham yanıt gövdesi (varsa) - gönderim istemcisi doldurur. */
    body?: unknown | undefined);
}
declare const DEFAULT_BASE_URL = "https://live.signalbird.io/api";

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
    /**
     * Kanalı bağlar ve yazacı döner.
     *
     *     signalbird().radio('penyuCritical').error('Ödeme düğümü öldü', ctx)
     *
     * Kanal adını her satırda tekrar etmemek için; `log()`'un kısaltmasıdır.
     * Sözdizimi şekeridir, yeni bir yüzey değil.
     */
    radio(key: string): {
        log: (message: string, level?: Level, context?: Record<string, unknown>) => Promise<LogResult>;
        debug: (message: string, context?: Record<string, unknown>) => Promise<LogResult>;
        info: (message: string, context?: Record<string, unknown>) => Promise<LogResult>;
        warn: (message: string, context?: Record<string, unknown>) => Promise<LogResult>;
        error: (message: string, context?: Record<string, unknown>) => Promise<LogResult>;
        critical: (message: string, context?: Record<string, unknown>) => Promise<LogResult>;
    };
    /**
     * Tek kayıt gönderir.
     *
     * `message` 4000 kod noktasına kırpılır (API sınırı; aşan satır 422 alırdı)
     * ve `context` güvenli kopyaya çevrilir: döngüsel nesne ya da BigInt artık
     * `NETWORK_ERROR` gibi görünen bir istisnaya dönüşmez.
     */
    log(input: LogInput): Promise<LogResult>;
    /**
     * Toplu gönderim - 100 kayda kadar.
     *
     * Kısmi başarı normaldir (kota tam ortada dolabilir), o yüzden sonuç tek bir
     * durum değil satır satır döner.
     *
     * Doğrulama ise satır satır DEĞİLDİR: tek bir geçersiz satır (4000'i aşan
     * mesaj) bütün paketi 422 ile düşürür. Bu yüzden kırpma burada da yapılır.
     */
    batch(events: LogInput[]): Promise<BatchResult>;
    debugLog(key: string, message: string, context?: Record<string, unknown>): Promise<LogResult>;
    info(key: string, message: string, context?: Record<string, unknown>): Promise<LogResult>;
    warn(key: string, message: string, context?: Record<string, unknown>): Promise<LogResult>;
    error(key: string, message: string, context?: Record<string, unknown>): Promise<LogResult>;
    critical(key: string, message: string, context?: Record<string, unknown>): Promise<LogResult>;
    /**
     * Kimlik doğrulama hash'i (CONTRACT §15.2) - sohbet/push ziyaretçisinin
     * `external_id`'sini GÜVENİLİR kılar.
     *
     *     identity_hash = hex(HMAC-SHA256(hex(SHA-256(secretKey)), externalId))
     *
     * Anahtar gizli anahtarın kendisi değil SHA-256 özetidir: sunucu anahtarı
     * düz saklamaz. Hash sunucuda üretilir, sayfaya `external_id` ile birlikte
     * yazılır; gizli anahtar istemciye İNMEZ.
     */
    identityHash(externalId: string): string;
    /**
     * Yakalanmamış hataları Telsiz'e bağlar.
     *
     * Kancayı takıp süreci ÖLDÜRMEYE devam eder: `uncaughtException` sonrası
     * süreci ayakta tutmak, bozuk durumdaki bir uygulamayı çalıştırmaya devam
     * etmek demektir - log göndermek bunu meşrulaştırmaz.
     */
    captureUncaught(key?: string): () => void;
    private send;
    private request;
}

/**
 * Gönderim (Messaging) istemcisinin tipleri.
 *
 * Alan adları API ile birebir aynıdır (snake_case) - SDK, sunucunun döndüğünü
 * yeniden adlandırmaz. Böylece API dokümanındaki bir alan SDK'da da aynı adla
 * bulunur ve iki doküman arasında çeviri tablosu gerekmez.
 */
interface MessagingConfig {
    /** Gizli domain anahtarı (`sb_secret_live_…`). Yalnız sunucuda kullanılır. */
    domainKey: string;
    /** Varsayılan: https://live.signalbird.io/api */
    baseUrl?: string;
    /** İstek zaman aşımı (ms). Varsayılan 15000 - toplu kişi yükleme uzun sürebilir. */
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
/** İleti sınıfı - API'de zorunludur ve varsayılanı YOKTUR (hukuki kapı). */
type MessageClass = 'transactional' | 'commercial';
type Channel = 'email' | 'sms' | 'push';
/** E-posta eki - içerik base64; toplam çözülmüş boyut sınırı sunucudadır (7 MB). */
interface EmailAttachment {
    filename: string;
    mime?: string;
    /** Dosya içeriği, base64. */
    content_b64: string;
}
/**
 * `POST /v1/email/send` gövdesi - alanlar API doğrulamasıyla birebir
 * (signalbird.api `Api\V1\MessagingController::sendEmail`).
 *
 * İçerik iki yoldan gelir: ya `subject` + `body`, ya panelde tanımlı bir
 * şablon (`template` adıyla ya da `template_id` ile). Şablon verilmediyse
 * `subject` ve `body` ZORUNLUDUR (API: `required_without_all:template_id,template`);
 * verildiyse ikisi de şablondan gelir ve istenirse ezilebilir.
 *
 * Tip bilerek arayüz olarak kaldı (birleşim tipi değil): kullanıcı kodunda
 * `extends SendEmailInput` yazan herkes kırılırdı.
 */
interface SendEmailInput {
    /** Alıcı e-posta adresi. */
    to: string;
    /** Zorunlu, varsayılanı yok: işlemsel ile ticari arasındaki fark hukukidir. */
    class: MessageClass;
    /** Konu (en fazla 255). Şablon yoksa zorunlu. */
    subject?: string;
    /** Gövde - HTML ya da düz metin. Şablon yoksa zorunlu. */
    body?: string;
    /** Panelde tanımlı şablonun ADI (en fazla 190). Ad tercih edilir: şablon yeniden yaratılsa da kod değişmez. */
    template?: string;
    /** Panelde tanımlı şablonun kimliği. */
    template_id?: number;
    /** Şablon/gövde değişkenleri - `{{ad}}` yerine geçer. */
    vars?: Record<string, unknown>;
    /**
     * GÖNDERİCİ KANALI: panelde adresle birlikte açılan `email` modül anahtarı
     * (`noReply`). From adresini kanal seçer - PHP'deki
     * `Signalbird::sendMail('noReply')` karşılığı. Kanala adres bağlanmamışsa
     * 422 `SENDER_NOT_CONFIGURED`; tanımsız kanal `MODULE_KEY_NOT_FOUND`.
     */
    module_key?: string;
    /** Belirli bir doğrulanmış gönderen alan adından çıksın. */
    sending_domain_id?: number;
    /** Gönderen ADRES seçimi (destek@…); alan adını da belirler. `module_key` verilirse kanalınki geçerlidir. */
    sending_address_id?: number;
    /** Signalbird'deki kişi kaydı - açılma/tıklama geçmişi ona yazılsın. */
    contact_id?: number;
    /** Görünen gönderen adı (en fazla 120). Zarf adresi değil. */
    from_name?: string;
    /** "Yanıtla" adresi. */
    reply_to?: string;
    /** En fazla 5 ek. */
    attachments?: EmailAttachment[];
    /**
     * @deprecated API bu alanı hiç okumaz ve SDK onu GÖNDERMEZ (2.9.0). Şablon
     * için `template` (ad) ya da `template_id` kullanın. Yalnız eski kodun tip
     * denetiminde kırılmaması için tanımlı; başka bir alana eşlenmez.
     */
    template_hash?: string;
}
/**
 * `POST /v1/sms/send` gövdesi - alanlar API doğrulamasıyla birebir
 * (signalbird.api `Api\V1\MessagingController::sendSms`).
 *
 * İçerik ya `body` ya da panelde tanımlı bir şablondur (`template` adıyla ya
 * da `template_id` ile). Şablon verilmediyse `body` ZORUNLUDUR (API:
 * `required_without_all:template_id,template`).
 *
 * E-postanın aksine SMS ucunda gönderici KANALI (`module_key`) yoktur;
 * gönderen adı `sender` ile seçilir.
 */
interface SendSmsInput {
    /** Alıcı telefon (en fazla 20). Sunucu normalize eder; geçersizse 422 `INVALID_PHONE`. */
    to: string;
    /** Zorunlu, varsayılanı yok: işlemsel ile ticari arasındaki fark hukukidir. */
    class: MessageClass;
    /** Mesaj metni (en fazla 1600). Şablon yoksa zorunlu. */
    body?: string;
    /** Panelde tanımlı şablonun ADI (en fazla 190). */
    template?: string;
    /** Panelde tanımlı şablonun kimliği. */
    template_id?: number;
    /** Şablon/gövde değişkenleri - `{{ad}}` yerine geçer. */
    vars?: Record<string, unknown>;
    /** Marka (SMS başlığı/kotası bu markadan). */
    brand_id?: number;
    /** Signalbird'deki kişi kaydı. */
    contact_id?: number;
    /** Onaylı SMS gönderici adı (en fazla 11). Verilmezse şirketin varsayılanı. */
    sender?: string;
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
     * TXT ile doğrulanmış müşteri domaininin id'si - ZORUNLU. Doğrulanmamış
     * domain adına kampanya açılamaz (`DOMAIN_NOT_VERIFIED`).
     */
    domain_id: number;
    /** Hedef: `list_id` VEYA `segment_id` - ikisinden tam biri. */
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
    private readonly domainKey;
    private readonly baseUrl;
    private readonly timeout;
    private readonly throwOnError;
    private readonly debug;
    constructor(config: MessagingConfig);
    sendEmail(input: SendEmailInput): Promise<SbResult$1<SendResult>>;
    sendSms(input: SendSmsInput): Promise<SbResult$1<SendResult>>;
    /**
     * Otomasyon olayı - kendi sisteminizdeki bir olayı bildirir ve eşleşen
     * akışı tetikler (§11). Signalbird olayın anlamını bilmez; adı sizindir.
     */
    track(input: {
        event: string;
        contact: {
            email?: string;
            phone?: string;
            external_id?: string;
            first_name?: string;
            last_name?: string;
        };
        data?: Record<string, unknown>;
    }): Promise<SbResult$1<{
        enrolled: number;
        canceled: number;
        contact_id: number;
    }>>;
    /** SMS parça/karakter hesabı - kota harcamaz. */
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
     * biriken sayımlar `data` içinde döner - çağıran kaç kişinin işlendiğini görür.
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
     * "hepsi bu" sanılır - o daha tehlikeli).
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
 * Partner (beşinci yüzey) tipleri.
 *
 * Sözleşme: docs/CONTRACT.md § 12 ve
 * signalbird.api/docs/PARTNER_PLATFORM_2026-08-20.md.
 *
 * Alan adları API ile birebir aynıdır (snake_case) - SDK yeniden adlandırmaz.
 */

interface PartnerConfig {
    /** `sb_secret_live_…` - gizli domain anahtarı. Tarayıcıya İNMEZ. */
    domainKey: string;
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
    /** Partner'ın kendi tarafındaki müşteri kimliği - idempotens anahtarı. */
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
    /** `txt` | `partner` - partner beyanı kampanya için YETMEZ. */
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
    /** Hiç kontrol yoksa `null` döner - %100 DEĞİL. */
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
type EmbedModule = 'chat' | 'monitoring' | 'campaigns' | 'contacts' | 'radio' | 'messages' | 'topics' | 'members';
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

interface ManagementConfig {
    /** Gizli domain anahtarı (`sb_secret_live_…`). Scope yoktur (v2); yalnız gömme jetonu ayrı onay ister. */
    domainKey: string;
    /** Varsayılan: https://live.signalbird.io/api */
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
/** Modül anahtarı taşıyan modüller (`monitoring`/`servers` taşımaz). */
type KeyedModule = 'logger' | 'email' | 'sms' | 'push' | 'chat';
type ModuleKeyLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical';
/** Bildirim kanalı - seçim KANAL düzeyindedir, kişi başına değil. */
type NotifyChannel = 'push' | 'email';
/**
 * Modül anahtarı - kodun içine gömülen kanal adı.
 *
 * Gizli DEĞİLDİR: domain anahtarı olmadan hiçbir işe yaramaz. Domain
 * anahtarına referans da VERMEZ - anahtar yenilendiğinde bu kayıtlar
 * bozulmasın diye (KEY_ARCHITECTURE §2).
 */
interface ModuleKey {
    id: number;
    module: KeyedModule;
    key: string;
    title: string;
    /** Ad değiştiyse eskisi bu tarihe kadar kabul edilir. */
    previous_key: string | null;
    previous_key_until: string | null;
    domain_id: number | null;
    level: ModuleKeyLevel;
    icon: string | null;
    color: string | null;
    notify: NotifyChannel[];
    /** Boş = takımın tamamı. */
    recipient_user_ids: number[];
    quiet_from: number | null;
    quiet_to: number | null;
    dedupe_seconds: number;
    config: Record<string, unknown> | null;
    /** İlk çağrıda kendiliğinden açıldıysa işaretlidir ve SESSİZDİR. */
    is_auto: boolean;
    is_active: boolean;
    last_used_at: string | null;
    usage_count: number;
    conversations_count?: number | null;
    devices_count?: number | null;
    created_at: string;
}
interface ModuleKeyInput {
    title?: string;
    /** Verilmezse başlıktan üretilir; çakışırsa sonuna sayı eklenir. */
    key?: string | null;
    /** Ad değişiminde eski adı 30 gün kabul et (varsayılan `true`). */
    keep_previous?: boolean;
    domain_id?: number | null;
    level?: ModuleKeyLevel;
    icon?: string | null;
    color?: string | null;
    notify?: NotifyChannel[];
    recipient_user_ids?: number[];
    quiet_from?: number | null;
    quiet_to?: number | null;
    dedupe_seconds?: number;
    config?: Record<string, unknown> | null;
    is_active?: boolean;
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
    /** Ziyaretçi ya da kişi - biri zorunlu. */
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
interface AppDevice {
    id: number;
    /** Maskeli token - tamamı hiçbir zaman dönmez. */
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
 * Gömme jetonu isteği - MÜŞTERİNİN kendi paneli için.
 *
 * Partner sürümünden (`EmbedTokenInput`) tek farkı kimliğin nasıl verildiği:
 * partner kendi sistemindeki dış kimliği (`user_external_id`) yollar, müşteri
 * ise kendi takımındaki kullanıcıyı (`user_id`). Boş bırakılırsa anahtarın
 * sahibi kullanılır.
 */
interface TeamEmbedTokenInput {
    module: EmbedModule;
    user_id?: number | string;
    locale?: string;
    theme?: 'light' | 'dark';
    accent?: string;
}

/**
 * Yönetim (Management) istemcisi - sunucu tarafı.
 *
 * Müşterinin panelde tıklayarak yaptığı her şeyi kodla yapar: Telsiz projesi ve
 * kanalı açar, olay akışını okur, sohbet gelen kutusunu işler, uygulama kaydı
 * ve cihaz listesi yönetir.
 *
 * Bu ADMIN yüzeyi DEĞİLDİR. Anahtar tek bir takıma bağlıdır ve yalnız o takımın
 * kayıtlarına dokunur; başka takımın kaydı 404 döner.
 *
 * Neden ayrı sınıf: Gönderim (`SignalbirdMessaging`) ileti gönderir ve kota
 * harcar; bu istemci yapılandırma değiştirir. Aynı gizli domain anahtarını
 * (`sb_secret_live_…`) kullanırlar ama hata kümeleri farklıdır - tek sınıfta
 * birleşseydi her metotta "bu kod hangi yüzeyin" sorusu sorulurdu.
 *
 * Sözleşme: docs/CONTRACT.md § 10
 */

declare class SignalbirdManagement {
    private readonly http;
    constructor(config: ManagementConfig);
    /** Panelin Telsiz özeti: proje sayısı, günlük hacim, son olaylar. */
    radioSummary(): Promise<SbResult<Record<string, unknown>>>;
    /** Olay akışı - kanal, seviye ve tarihe göre süzülür. */
    radioEvents(query?: ListRadioEventsQuery): Promise<SbResult<Paginated<RadioEvent>>>;
    listModuleKeys(module: KeyedModule, query?: {
        domain_id?: number;
    }): Promise<SbResult<{
        data: ModuleKey[];
    }>>;
    getModuleKey(module: KeyedModule, id: number | string): Promise<SbResult<{
        module_key: ModuleKey;
    }>>;
    /**
     * Kanal açar.
     *
     * `key` verilmezse başlıktan üretilir ve çakışırsa sonuna sayı eklenir -
     * "bu ad alınmış" hatasıyla geri dönmek, CI'da kanal açan bir betiği
     * durdururdu.
     */
    createModuleKey(module: KeyedModule, input: ModuleKeyInput): Promise<SbResult<{
        module_key: ModuleKey;
    }>>;
    /**
     * Kanalı günceller.
     *
     * `key` DEĞİŞTİRİLEBİLİR (eskiden değişmezdi): eski ad 30 gün daha kabul
     * edilir, böylece üretimdeki kod bir sonraki deploya kadar kayıt kaybetmez.
     * `keep_previous: false` ile eski ad anında kapatılır.
     */
    updateModuleKey(module: KeyedModule, id: number | string, input: ModuleKeyInput): Promise<SbResult<{
        module_key: ModuleKey;
    }>>;
    deleteModuleKey(module: KeyedModule, id: number | string): Promise<SbResult<unknown>>;
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
    /** Proaktif sohbet - ziyaretçi yazmadan ajan başlatır. */
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
    /** Tepki açma/kapama - aynı emoji ikinci kez gönderilirse kaldırılır. */
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
     * Veri yoksa süreler `null` döner - 0 DEĞİL.
     */
    chatReport(range?: ChatReportRange): Promise<SbResult<ChatReport>>;
    /**
     * Gömme jetonu - Signalbird ekranını KENDİ panelinizde göstermek için.
     *
     * 120 saniye yaşar ve TEK KULLANIMLIKTIR: dönen `url`'i doğrudan bir
     * iframe'e verin, saklamayın. Anahtarın `can_issue_embed` onayı ŞARTTIR -
     * scope sisteminden geriye kalan tek kapı, çünkü jeton 60 dakikalık bir
     * panel oturumuna çevriliyor.
     */
    embedToken(input: TeamEmbedTokenInput): Promise<SbResult<EmbedToken>>;
    /** Push kanalına kayıtlı son kullanıcı cihazları (token MASKELİ döner). */
    listModuleKeyDevices(module: KeyedModule, id: number | string, query?: ListAppDevicesQuery): Promise<SbResult<Paginated<AppDevice>>>;
}

/**
 * Partner istemcisi - BEŞİNCİ yüzey.
 *
 * Signalbird'ü kendi ürününün içinde satan sözleşmeli platform (veribenim,
 * submitcms) müşterisini bununla sağlar ve yetkilendirir: company + takım +
 * owner açar, domain ekler ve izlemeye alır, uptime okur, modül açar/kapatır,
 * gömme jetonu üretir.
 *
 * **Bu, CLAUDE.md'deki "Admin yüzeyi OLMAYACAK" kuralının bilinçli
 * istisnasıdır** ve istisna olduğu için ayrı anahtar türü taşır. Kural,
 * müşterinin kendi anahtarıyla şirket açamaması içindi; o kural aynen
 * duruyor. Sözleşmeli partner farklı bir taraftır.
 *
 * Gizli anahtar **asla tarayıcıya inmez**: gömme jetonunu partner'ın
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
    /** Askıya alır - SİLMEZ. Müşterinin izleme ve mesaj geçmişi durur. */
    suspendCompany(externalId: string): Promise<SbResult<{
        company: PartnerCompany;
    }>>;
    rotateKey(externalId: string, type: 'api' | 'app'): Promise<SbResult<{
        type: string;
        key: string;
    }>>;
    /**
     * Domain ekler ve (istenirse) izlemeye alır. Kayıt `verified_via:'partner'`
     * ile doğar: izleme, sohbet ve push için yeter - **e-posta/SMS kampanyası
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
    /** Tek istekte müşterinin tüm domainleri - liste ekranı N+1 atmasın. */
    companyUptime(companyExternalId: string, range?: UptimeRange): Promise<SbResult<{
        range: string;
        data: UptimeReport[];
    }>>;
    listMessages(companyExternalId: string, query?: Record<string, string | number | undefined>): Promise<SbResult<unknown>>;
    getMessage(companyExternalId: string, messageId: string): Promise<SbResult<unknown>>;
    messageSummary(companyExternalId: string, range?: string): Promise<SbResult<unknown>>;
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
     * 120 saniye yaşar ve TEK KULLANIMLIKTIR - jeton URL'de gider, log ve
     * `Referer` başlığına düşer.
     */
    createEmbedToken(companyExternalId: string, input: EmbedTokenInput): Promise<SbResult<EmbedToken>>;
}

declare function verifyWebhook(rawBody: string | Uint8Array, signatureHeader: string | null | undefined, secret: string): boolean;

/**
 * signalbird - sunucu tarafı giriş noktası.
 *
 * Next.js sunucu bileşenleri, API route'ları, Express/Fastify/NestJS ve düz
 * Node betikleri buradan alır. TARAYICI için `signalbird/browser`
 * kullanılır - gizli anahtar istemciye inmez.
 *
 * Sunucu istemcilerinin HEPSİ aynı gizli domain anahtarını (`sb_secret_live_…`)
 * kullanır; ayrım anahtarda değil, kapıdadır:
 *  - `SignalbirdClient`     → Telsiz (log yazma)
 *  - `SignalbirdMessaging`  → Gönderim (e-posta/SMS/push/kişi/kampanya)
 *  - `SignalbirdManagement` → Yönetim (olay akışı, modül anahtarları, sohbet
 *                             gelen kutusu)
 *  - `SignalbirdPartner`    → Partner (müşteri sağlama, modül yetkisi, gömme),
 *                             gizli anahtar - yalnız sözleşmeli platformlar
 *
 * Son kullanıcı (ziyaretçi) yüzeyi ayrı giriş noktasındadır:
 * `signalbird/app` - ve onun çatı uyarlamaları `/react`, `/vue`,
 * `/angular`, `/react-native`.
 */

/**
 * Ortam değişkeninden kurulan paylaşımlı istemci.
 *
 * `SIGNALBIRD_DOMAIN_KEY` okunur. Uygulamanın her köşesinde istemci kurup
 * anahtarı elden ele taşımak yerine tek çağrı yeter:
 *
 *   import { signalbird } from 'signalbird'
 *   await signalbird().critical('kritikApiHatasi', 'ödeme servisi öldü')
 */
declare function signalbird(config?: Partial<SignalbirdConfig>): SignalbirdClient;
/** Test ve sıcak yeniden yükleme için tekil istemciyi sıfırlar. */
declare function resetSignalbird(): void;
/**
 * Ortam değişkeninden kurulan paylaşımlı yönetim istemcisi.
 *
 * `SIGNALBIRD_DOMAIN_KEY` okunur - Telsiz ve Gönderim ile aynı gizli domain
 * anahtarı (`sb_secret_live_…`).
 *
 *   import { management } from 'signalbird'
 *   await management().createModuleKey('logger', { title: 'Kritik API hatası' })
 */
declare function management(config?: Partial<ManagementConfig>): SignalbirdManagement;
/** Test ve sıcak yeniden yükleme için yönetim istemcisini sıfırlar. */
declare function resetManagement(): void;

export { type AddDomainInput, type AddDomainResult, type AppDevice, type AppPlatform, type Batch, type BatchResult, type BulkContactsInput, type BulkContactsResult, type CampaignCreateResult, type CampaignDetail, type CannedReply, type CannedReplyInput, type Channel, type ChatConversation, type ChatMessage, type ChatVisitor, type Contact, type ContactInput, type ContactList, type ConversationStatus, type CreateCampaignInput, type CreateCompanyInput, type CreateCompanyResult, type CreateContactListInput, DEFAULT_BASE_URL, type DnsRecord, type EmailAttachment, type EmbedModule, type EmbedToken, type EmbedTokenInput, type GrantModuleInput, type Level, type ListAppDevicesQuery, type ListCampaignMessagesQuery, type ListCampaignsQuery, type ListChatMessagesQuery, type ListContactsQuery, type ListConversationsQuery, type ListMessagesQuery, type ListRadioEventsQuery, type LogInput, type LogResult, type ManagementConfig, type Message, type MessageClass, type MessagingConfig, type MessagingErrorCode, type ModuleEntitlement, type Paginated$1 as Paginated, type PartnerCompany, type PartnerConfig, type PartnerDomain, type PartnerOwnerInput, type PartnerUser, type PartnerUserInput, type RadioEvent, type RadioLevel, type ReplyInput, type SbResult$1 as SbResult, type SendEmailInput, type SendPushInput, type SendResult, type SendSmsInput, SignalbirdClient, type SignalbirdConfig, SignalbirdError, SignalbirdManagement, SignalbirdMessaging, SignalbirdPartner, type SmsPreview, type StartConversationInput, type TeamEmbedTokenInput, type UpdateConversationInput, type UpdateVisitorInput, type UptimeIncident, type UptimeRange, type UptimeReport, type VerifyDomainResult, management, resetManagement, resetSignalbird, signalbird, verifyWebhook };
