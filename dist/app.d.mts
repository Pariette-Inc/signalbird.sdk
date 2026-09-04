/**
 * Uygulama (son kullanıcı) yüzeyinin tipleri.
 *
 * Bu yüzey MÜŞTERİNİN MÜŞTERİSİ içindir: ziyaretçi ya da uygulama kullanıcısı.
 * Anahtarı açıktır (`sb_public_live_…`) ve istemciye gömülür; güvenliği gizlilikten
 * değil kısıttan gelir — yalnız izinli kökenden çalışır ve yalnız ziyaretçinin
 * KENDİ verisine dokunur.
 */
interface SbResult<T = unknown> {
    ok: boolean;
    status: number;
    data?: T;
    code?: string;
    message?: string;
}
/**
 * Ziyaretçi kimliğinin saklandığı yer.
 *
 * Tarayıcıda `localStorage`, React Native'de `AsyncStorage`, sunucu tarafı
 * testte bellek. Arayüz eşzamansızdır çünkü mobil depolar öyledir; eşzamanlı
 * tanımlansaydı React Native uyarlaması mümkün olmazdı.
 */
interface AppStorage {
    getItem(key: string): Promise<string | null> | string | null;
    setItem(key: string, value: string): Promise<void> | void;
    removeItem(key: string): Promise<void> | void;
}
interface AppConfig {
    /**
     * Uygulamanın platformu (4 Eyl 2026). Konuşma açılırken `source` olarak
     * gider; gelen kutusu "Web" yerine iOS/Android gösterir. React Native'de
     * `Platform.OS` verilir; verilmezse sunucu kanalın platformuna düşer.
     */
    platform?: 'ios' | 'android' | 'web';
    /**
     * Açık domain anahtarı (`sb_public_live_…`) — KİMLİĞİ doğrular.
     *
     * Panel → Alan adları → [alan adı] → Anahtarlar. Web anahtarı yalnız izinli
     * kökenlerden, mobil anahtarı yalnız Origin taşımayan isteklerden çalışır.
     */
    publicKey: string;
    /**
     * Sohbet kanalı — `chat` modülünün anahtarı (`destek`). DAVRANIŞI seçer:
     * hangi widget ayarı, hangi gelen kutusu.
     *
     * Anahtardan AYRIDIR ve bu bilinçlidir (1 Eyl 2026): domain anahtarını
     * yenilediğinizde kanal adı değişmez, yani kodunuz aynı kalır.
     */
    chatKey?: string;
    /** Push kanalı — `push` modülünün anahtarı. Cihaz kaydı için gerekir. */
    pushKey?: string;
    /** Varsayılan: https://live.signalbird.io/api */
    baseUrl?: string;
    /** `tr` ya da `en`; verilmezse uygulamanın ayarı, sonra cihazın dili. */
    locale?: string;
    /** Ziyaretçi sırrının saklandığı yer. Varsayılan: web'de localStorage, yoksa bellek. */
    storage?: AppStorage;
    /** İstek zaman aşımı (ms). Varsayılan 10000. */
    timeout?: number;
    /** Açıksa konsola yazar. */
    debug?: boolean;
    /** Özel `fetch` (React Native polyfill, test sahtesi). */
    fetchImpl?: typeof fetch;
}
/**
 * Ziyaretçinin seçebileceği destek konusu ("Konu → [ilgililer]").
 * Sunucu yalnız görünür konuları yollar; istemci süzgeç uygulamaz.
 */
interface TopicOption {
    id: number;
    slug: string;
    name: string;
    description?: string | null;
    parent_id?: number | null;
}
/** `POST /v1/sdk/bootstrap` yanıtı — widget çizilmeden önceki tek soru. */
interface BootstrapResult {
    /**
     * Sözleşme adı `channel` (1 Eyl 2026); `app` eski sunucular için okunur.
     * 3 Eyl'e kadar yalnız `app` okunuyordu ve yeni sunucuda mobil sohbet
     * "kapalı" görünüyordu.
     */
    channel?: BootstrapChannel;
    /** @deprecated eski sunucu alanı; `channel` yoksa okunur. */
    app?: BootstrapChannel;
    /** Boşsa konu adımı hiç gösterilmez. */
    topics?: TopicOption[];
    /** Mevcut açık konuşma (varsa) — ChatSession ilk listelemeyi atlar. */
    conversation?: Conversation | null;
    /**
     * Canlı bağlantı — YALNIZ ADRES. Anahtar ya da sır taşımaz: bağlanan taraf
     * hiçbir şey göremez, odaya girmek imza ister ve imzayı
     * `POST /v1/sdk/chat/socket/auth` verir.
     *
     * `enabled:false` ise yoklamayla çalışılır; canlı bağlantı bir
     * İYİLEŞTİRMEDİR, onsuz da sistem tamdır.
     */
    realtime?: {
        enabled: boolean;
        url?: string;
    };
}
interface BootstrapChannel {
    id: number;
    name: string;
    chat_enabled: boolean;
    push_enabled: boolean;
    locale?: string;
    within_hours?: boolean;
    offline_message?: string | null;
    chat?: {
        color?: string;
        position?: string;
        launcher_text?: string;
        welcome_message?: string;
        max_attachment_mb?: number;
        sound?: boolean;
        locale?: string;
        prechat?: {
            name?: boolean;
            email?: boolean;
        };
        /**
         * Sohbet sonu puanlama bağlantısı (Trustpilot, Google İşletme…).
         *
         * `review_min_rating` bir nezaket kuralı değil TİCARİ bir kuraldır:
         * eşiğin altında puan veren müşteriye bağlantı HİÇ gösterilmez.
         * Memnun olmamış müşteriyi halka açık bir puanlama sitesine yollamak
         * kendi ayağımıza sıkmaktır.
         */
        review_url?: string | null;
        review_label?: string | null;
        review_min_rating?: number;
        /** Marka: logo, tema, balon ikonu (29 Ağu 2026). */
        logo_url?: string | null;
        theme?: 'light' | 'dark' | 'auto';
        launcher_icon?: 'bird' | 'chat' | 'logo';
    };
}
interface Visitor {
    id: string;
    /** Ziyaretçi sırrı — YALNIZ oturum açılışında döner, sonra saklanır. */
    secret?: string;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    external_id?: string | null;
    unread_count?: number;
}
interface SessionInput {
    name?: string;
    email?: string;
    phone?: string;
    external_id?: string;
    attributes?: Record<string, unknown>;
    page_url?: string;
}
interface IdentifyInput {
    external_id?: string;
    email?: string;
    name?: string;
    phone?: string;
    attributes?: Record<string, unknown>;
}
/** `bot` = kanal ajanı (yapay zekâ). Okuyan taraf için ajan gibi ele alınır. */
type MessageSender = 'visitor' | 'agent' | 'bot' | 'system';
interface MessageOption {
    label: string;
    value?: string;
    url?: string;
}
interface MessageMeta {
    ai?: boolean;
    agent_name?: string | null;
    /** Dokunulabilir seçenekler: `url` varsa aç, yoksa `value ?? label` gönder. */
    options?: MessageOption[];
    [key: string]: unknown;
}
interface Message {
    id: string;
    sender_type: MessageSender;
    /** Sunucu kartı: ajan ya da bot (`bot:true`), sistemde null. */
    agent?: {
        id: number | null;
        name: string;
        avatar_url?: string | null;
        bot?: boolean;
    } | null;
    body?: string | null;
    attachments?: Attachment[] | null;
    meta?: MessageMeta | null;
    reply_to_id?: string | null;
    reactions?: Record<string, string[]> | null;
    delivered_at?: string | null;
    read_at?: string | null;
    edited_at?: string | null;
    created_at?: string;
    /**
     * Anlık çeviri — ziyaretçinin diline. Arayüz varsa bunu gösterir; orijinal
     * `body`'de durmaya devam eder.
     */
    translation?: {
        lang: string;
        body: string;
        source?: string | null;
    } | null;
    /** İyimser gönderimde yerel kopyayı sunucudakiyle eşleştirir. */
    client_id?: string | null;
    /**
     * Gönderilemedi (`ChatSession` yazar, sunucu DÖNMEZ).
     *
     * Tip listede yoktu ama oturum bu alanı yazıyordu: arayüz "gitmedi" hâlini
     * çizmek istediğinde tipi zorlamak (`as`) zorunda kalıyordu. Bekleyen mesaj
     * ayrıca işaretlenmez — sunucu yanıtı gelene kadar `id` ile `client_id`
     * aynıdır ve bu, "henüz yolda" demenin en ucuz yoludur.
     */
    failed?: boolean;
}
interface Attachment {
    id?: string;
    name?: string;
    url?: string;
    mime?: string;
    size?: number;
}
interface Conversation {
    id: string;
    status: string;
    subject?: string | null;
    unread_count?: number;
    agent_typing?: boolean;
    within_hours?: boolean;
    last_message_at?: string | null;
    messages?: Message[];
}
interface StartConversationInput {
    body: string;
    /** İyimser gönderim anahtarı: aynı `client_id` ikinci kez konuşma AÇMAZ. */
    client_id?: string;
    attachments?: unknown[];
    page_url?: string;
    /**
     * Destek konusu — id ya da slug. Seçim SUNUCUDA doğrulanır; geçersizse
     * konuşma yine açılır, konu yok sayılır.
     */
    topic?: string | number;
}
interface SendMessageInput {
    body?: string;
    client_id?: string;
    reply_to_id?: string | null;
    attachments?: unknown[];
}
interface ConversationQuery {
    /** `cm_…` imleci — yalnız bundan sonrakiler döner. */
    after?: string;
    limit?: number;
}
type DevicePlatform = 'ios' | 'android' | 'web';
interface RegisterDeviceInput {
    token: string;
    platform: DevicePlatform;
    provider?: 'fcm' | 'apns' | 'webpush' | string;
    external_id?: string;
    device_name?: string;
    app_version?: string;
    locale?: string;
}

/**
 * Uygulama istemcisi — son kullanıcı tarafı (sohbet + push kaydı).
 *
 * Tek bir sınıf; tarayıcı, React Native, Electron ve test aynı gövdeyi kullanır.
 * Platform farkı iki noktada toplanmıştır ve ikisi de dışarıdan verilir:
 * `storage` (ziyaretçi sırrı nerede durur) ve `fetchImpl`. Çatıya özel sarmalayıcı
 * yazmak yerine bunu seçtik — React, Vue, Angular ve RN uyarlamaları bu sınıfın
 * ÜSTÜNE oturur, kopyası değildir.
 *
 * Kimlik iki parçadır: açık domain anahtarı (`X-Signalbird-Key`) ve
 * ziyaretçi sırrı (`X-Signalbird-Visitor`). Sır yalnız oturum açılışında döner;
 * kaybolursa yeni oturum açılır ve geçmiş konuşmalar görünmez — bu yüzden
 * saklama katmanı zorunludur, isteğe bağlı değil.
 *
 * Hiçbir metot istisna fırlatmaz: sohbet balonunun hatası müşterinin ödeme
 * sayfasını çökertmemeli. Sonuç her zaman `{ok, status, …}` zarfıdır.
 *
 * Sözleşme: docs/CONTRACT.md § 11
 */

/** RFC 4122 uyumlu olmak zorunda değil; tek işi yerel kopyayı eşlemek. */
declare function clientId(): string;
declare class SignalbirdApp {
    private readonly config;
    private readonly baseUrl;
    private readonly storage;
    private readonly timeout;
    private readonly doFetch;
    private visitor;
    private loaded;
    constructor(config: AppConfig);
    /** Uygulama ayarları: sohbet açık mı, renk, çalışma saati, ön-form. */
    bootstrap(): Promise<SbResult<BootstrapResult>>;
    /**
     * Canlı bağlantı kanalı için imza.
     *
     * Ziyaretçinin oturumu yoktur; hangi kanalı dinleyebileceğine SUNUCU karar
     * verir ve yalnız kendi `visitor.<id>` kanalını imzalar. Soket servisi
     * kimseyi tanımaz, yalnız imzayı doğrular.
     */
    socketAuth(socketId: string, channel: string): Promise<SbResult<{
        auth: string;
        at: number;
    }>>;
    /**
     * Ziyaretçi oturumu açar ya da mevcut olanı günceller.
     *
     * Sır saklanır; ikinci çağrı aynı ziyaretçiyi tazeler. Sunucu `VISITOR_INVALID`
     * derse yerel kimlik silinir ve bir sonraki çağrı yeni oturum açar.
     */
    startSession(input?: SessionInput): Promise<SbResult<{
        visitor: Visitor;
    }>>;
    /** Oturum açmış kullanıcıyı ziyaretçiye bağlar (kişi kaydı upsert edilir). */
    identify(input: IdentifyInput): Promise<SbResult<{
        visitor: Visitor;
    }>>;
    /** Saklanan ziyaretçi kimliği — yoksa `null`. */
    currentVisitor(): Promise<{
        id: string;
        name?: string | null;
        email?: string | null;
    } | null>;
    /** Yerel kimliği siler: çıkış yapıldığında çağrılır. Sunucudaki kayıt kalır. */
    signOut(): Promise<void>;
    listConversations(): Promise<SbResult<{
        data: Conversation[];
    }>>;
    getConversation(id: string, query?: ConversationQuery): Promise<SbResult<{
        conversation: Conversation;
        messages?: Message[];
        agent_typing?: boolean;
        online?: boolean;
        within_hours?: boolean;
    }>>;
    /**
     * İlk mesajla konuşma açar. Kota burada harcanır — konuşma başına sayılır,
     * mesaj başına değil.
     */
    startConversation(input: StartConversationInput): Promise<SbResult<{
        conversation: Conversation;
        message: Message;
    }>>;
    sendMessage(conversationId: string, input: SendMessageInput): Promise<SbResult<{
        message: Message;
    }>>;
    /** Yalnız kendi mesajı ve gönderimden sonraki 15 dakika içinde. */
    editMessage(conversationId: string, messageId: string, body: string): Promise<SbResult<{
        message: Message;
    }>>;
    deleteMessage(conversationId: string, messageId: string): Promise<SbResult<unknown>>;
    /** Aynı emoji ikinci kez gönderilirse tepki kaldırılır. */
    reactToMessage(conversationId: string, messageId: string, emoji: string): Promise<SbResult<{
        message: Message;
    }>>;
    setTyping(conversationId: string, isTyping: boolean): Promise<SbResult<unknown>>;
    markRead(conversationId: string, lastMessageId?: string): Promise<SbResult<unknown>>;
    /**
     * Ek dosya yükler; dönen tanımlayıcı `sendMessage`'a `attachments` içinde
     * verilir. İki adım olmasının sebebi: dosya yüklenirken mesaj metni hâlâ
     * yazılıyor olabilir ve yarım kalan yükleme mesaj kaydı yaratmamalı.
     */
    uploadAttachment(conversationId: string, file: unknown, fileName?: string): Promise<SbResult<{
        attachment: unknown;
    }>>;
    closeConversation(conversationId: string): Promise<SbResult<{
        conversation: Conversation;
    }>>;
    rateConversation(conversationId: string, rating: number, comment?: string): Promise<SbResult<unknown>>;
    /**
     * Cihaz token'ını kaydeder. Token'ı almak (FCM/APNs/Web Push izni) ev
     * sahibinin işidir; SDK yalnız iletir — izin diyaloğunu kimin, ne zaman
     * göstereceği ürün kararıdır, kütüphane kararı değil.
     */
    registerDevice(input: RegisterDeviceInput): Promise<SbResult<unknown>>;
    /** Çıkışta çağrılır: kayıt silinmez, kapatılır (geçmiş korunur). */
    unregisterDevice(token: string): Promise<SbResult<unknown>>;
    /**
     * Bildirime dokunuldu — açılma damgası.
     *
     * Push'ta açılmayı YALNIZCA uygulama bilir: FCM/APNs "teslim ettim" der,
     * "kullanıcı dokundu" demez. Bildirim yükündeki `data.sb_message_id`
     * değerini buraya geri gönderin.
     *
     * ```ts
     * // React Native / Expo — bildirime dokunma işleyicisinde
     * const id = response.notification.request.content.data?.sb_message_id
     * if (id) await sb.reportPushOpened(String(id))
     * ```
     *
     * Bilinmeyen kimlikte de başarılı döner: uygulamanın yeniden denemesi
     * gereksiz olsun.
     */
    reportPushOpened(messageId: string): Promise<SbResult<unknown>>;
    private request;
    private loadVisitor;
    private storeVisitor;
}

/**
 * Sohbet oturumu — çatısız durum yönetimi.
 *
 * `SignalbirdApp` ham uçları verir; burası bir sohbet ekranının gerçekten
 * ihtiyaç duyduğu şeyi verir: mesaj listesi, okunmamış sayısı, yazıyor durumu,
 * iyimser gönderim ve yoklama merdiveni. React/Vue/Angular/React Native
 * uyarlamaları bu sınıfa abone olur — üçünde de aynı mantığı yeniden yazmak,
 * üç ayrı hata takımı üretmek demekti.
 *
 * ── CANLI BAĞLANTI + YOKLAMA ──────────────────────────────────────────────
 *
 * 29 Ağu 2026'ya kadar burada yalnız yoklama vardı ve mobil, widget canlıya
 * geçtikten sonra da saniyede istek atmaya devam etti. Artık aynı soket
 * istemcisi (`../shared/socket`) burada da çalışıyor.
 *
 * YAYIN HABER TAŞIR, VERİ TAŞIMAZ: soketten gelen olay yalnız "yeni bir şey
 * var" der; mesajın kendisi HER ZAMAN kendi yetkimizle yeniden çekilir. Aksi
 * hâlde yayın kanalına düşen bir hata, okuma yetkisi olmayan birine mesaj
 * gövdesi göstermeye dönüşürdü.
 *
 * YOKLAMA KALDIRILMAZ, YAVAŞLAR. Bağlantı kurulduğunda panel açıkken 3 s
 * yerine 45 s, kapalıyken merdivenin son basamağı kullanılır: soket düşerse
 * ya da bir olay kaybolursa konuşma yine ilerler. Emniyet ağını sırf gereksiz
 * göründüğü için sökmek, düştüğünüz gün onu aramak demektir.
 *
 * Yoklama merdiveni (penyu deseni): panel açıkken 3 s, kapalıyken 20 s ×3 →
 * 60 s ×2 → 180 s. Yeni veri merdiveni sıfırlar; uygulama arka plandayken tur
 * atlanır.
 */

interface ChatState {
    /** Sohbet bu uygulamada açık mı (`bootstrap` cevabı). */
    enabled: boolean;
    loading: boolean;
    conversation: Conversation | null;
    messages: Message[];
    unread: number;
    agentTyping: boolean;
    withinHours: boolean;
    /**
     * Ziyaretçinin seçebileceği destek konuları (boşsa konu adımı çizilmez).
     * Seçimi `setTopic()` taşır; ilk konuşma açılırken gönderilir.
     */
    topics: TopicOption[];
    /** Seçili konu (slug) — ilk konuşmayla birlikte gider. */
    topic: string | null;
    /** Son hatanın kodu — arayüz isterse gösterir, göstermezse yutar. */
    errorCode?: string;
    /**
     * Uygulamanın sohbet ayarları (renk, logo, tema, puanlama bağlantısı…).
     *
     * Ekran bunları PANELDEN alır, kendi içine gömmez: müşteri rengini ya da
     * puanlama adresini değiştirdiğinde yeni sürüm yayınlamak gerekmesin.
     */
    settings: BootstrapChannel['chat'] | null;
}
type ChatListener = (state: ChatState) => void;
interface ChatSessionOptions {
    /** Panel açık mı — yoklama hızını belirler. */
    active?: boolean;
    /** Arka plandayken tur atlanır; varsayılan: `document.visibilityState`. */
    isVisible?: () => boolean;
    /** Açılışta oturum kurulurken kullanılacak ziyaretçi bilgisi. */
    visitor?: SessionInput;
}
declare class ChatSession {
    private readonly app;
    private readonly options;
    private state;
    private listeners;
    private timer;
    private step;
    private active;
    private stopped;
    private polling;
    private socket;
    private live;
    /**
     * Bir sonraki `refresh()` İMLEÇSİZ olsun mu.
     *
     * "Var olan mesaj değişti" haberi geldiğinde açılır: imleçli çekim
     * (`?after=<son mesaj>`) o mesajı bir daha getirmez, dolayısıyla çeviri ya
     * da düzenleme ekrana hiç yansımaz.
     */
    private forceFull;
    constructor(app: SignalbirdApp, options?: ChatSessionOptions);
    subscribe(listener: ChatListener): () => void;
    snapshot(): ChatState;
    /** Bootstrap + varsa mevcut konuşmayı yükler, sonra yoklamayı başlatır. */
    start(): Promise<void>;
    /** Panel açıldı/kapandı — yoklama hızı buna göre değişir. */
    setActive(active: boolean): void;
    /**
     * Konuşmayı bırakır; sonraki mesaj YENİ bir konuşma açar.
     *
     * Ekranın "yeni sohbet" düğmesi de bunu çağırır. Sunucuda hiçbir şey
     * silinmez — yalnız bu oturumun neye baktığı değişir.
     */
    reset(): void;
    stop(): void;
    /** Canlı bağlantı kurulu mu — arayüz isterse gösterir (zorunlu değil). */
    get isLive(): boolean;
    /** Ön-form gönderildiğinde ya da uygulama kullanıcıyı tanıdığında. */
    openSession(input: SessionInput): Promise<SbResult<unknown>>;
    /**
     * Mesaj gönderir. Konuşma yoksa açar.
     *
     * İyimser: mesaj listeye ANINDA düşer, `client_id` ile eşlenir. Sunucu
     * cevabı gelince yerel kopya onunla değiştirilir; başarısızsa `failed`
     * işaretlenir ve arayüz "yeniden dene" gösterebilir.
     */
    send(body: string, attachments?: unknown[]): Promise<SbResult<unknown>>;
    /**
     * Ziyaretçinin konu seçimi. Konuşma AÇILDIKTAN sonra çağrılırsa etkisizdir:
     * açılmış konuşmanın konusunu ajan panelden değiştirir — ziyaretçiye kendi
     * konuşmasını yeniden sınıflandırma yetkisi vermek, atamayı da bozardı.
     */
    setTopic(slug: string | null): void;
    /** İlk tuşta `true`, 2.5 s hareketsizlikte `false` — çağıran zamanlar. */
    typing(isTyping: boolean): void;
    /** Görülen son mesaja kadar okundu işaretler. */
    markRead(): Promise<void>;
    close(rating?: number, comment?: string): Promise<void>;
    /** Sunucudaki durumu çeker; imleç varsa yalnız yenileri ister. */
    refresh(): Promise<void>;
    private applyConversation;
    /** İyimser kayıtlar sunucu kimliği taşımaz; imleç yalnız gerçek kimliktir. */
    private lastServerMessageId;
    private markFailed;
    /**
     * Ziyaretçinin kendi kanalına bağlanır (`visitor.<id>`).
     *
     * Kanal ziyaretçi kimliği kurulduktan SONRA bilinir; ilk mesajla kimlik
     * doğduğunda `refresh()` üzerinden yeniden denenir. Bağlantı kurulamazsa
     * hiçbir şey olmaz: yoklama zaten çalışıyor.
     */
    private openSocket;
    /** Ziyaretçi kimliği varsa kendi kanalına katılır; yoksa sessizce döner. */
    private joinVisitorChannel;
    private schedule;
    private tick;
    private visible;
    private patch;
}

export { type AppConfig, type AppStorage, type Attachment, type BootstrapResult, type ChatListener, ChatSession, type ChatSessionOptions, type ChatState, type Conversation, type ConversationQuery, type DevicePlatform, type IdentifyInput, type Message, type MessageSender, type RegisterDeviceInput, type SbResult, type SendMessageInput, type SessionInput, SignalbirdApp, type StartConversationInput, type Visitor, clientId };
