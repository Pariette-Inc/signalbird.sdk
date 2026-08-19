/**
 * Uygulama (son kullanıcı) yüzeyinin tipleri.
 *
 * Bu yüzey MÜŞTERİNİN MÜŞTERİSİ içindir: ziyaretçi ya da uygulama kullanıcısı.
 * Anahtarı açıktır (`sbw_pub_…`) ve istemciye gömülür; güvenliği gizlilikten
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
    /** Uygulama anahtarı (`sbw_pub_…`). Panelden ya da `createApp` ile alınır. */
    appKey: string;
    /** Varsayılan: https://signalbird.io/api */
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
/** `POST /v1/sdk/bootstrap` yanıtı — widget çizilmeden önceki tek soru. */
interface BootstrapResult {
    app: {
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
        };
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
type MessageSender = 'visitor' | 'agent' | 'system';
interface Message {
    id: string;
    sender_type: MessageSender;
    body?: string | null;
    attachments?: Attachment[] | null;
    reply_to_id?: string | null;
    reactions?: Record<string, string[]> | null;
    delivered_at?: string | null;
    read_at?: string | null;
    edited_at?: string | null;
    created_at?: string;
    /** İyimser gönderimde yerel kopyayı sunucudakiyle eşleştirir. */
    client_id?: string | null;
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
 * Kimlik iki parçadır: açık uygulama anahtarı (`X-Signalbird-App-Key`) ve
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
 * Yoklama merdiveni (penyu deseni): panel açıkken 3 s, kapalıyken 20 s ×3 →
 * 60 s ×2 → 180 s. Yeni veri merdiveni sıfırlar; sekme/uygulama arka plandayken
 * tur atlanır. WebSocket yoktur: imleçli yoklama, bağlantı kopmasında kendi
 * kendini toparlar ve mobil ağda pil yakmaz.
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
    /** Son hatanın kodu — arayüz isterse gösterir, göstermezse yutar. */
    errorCode?: string;
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
    constructor(app: SignalbirdApp, options?: ChatSessionOptions);
    subscribe(listener: ChatListener): () => void;
    snapshot(): ChatState;
    /** Bootstrap + varsa mevcut konuşmayı yükler, sonra yoklamayı başlatır. */
    start(): Promise<void>;
    /** Panel açıldı/kapandı — yoklama hızı buna göre değişir. */
    setActive(active: boolean): void;
    stop(): void;
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
    private schedule;
    private tick;
    private visible;
    private patch;
}

export { type AppConfig, type AppStorage, type Attachment, type BootstrapResult, type ChatListener, ChatSession, type ChatSessionOptions, type ChatState, type Conversation, type ConversationQuery, type DevicePlatform, type IdentifyInput, type Message, type MessageSender, type RegisterDeviceInput, type SbResult, type SendMessageInput, type SessionInput, SignalbirdApp, type StartConversationInput, type Visitor, clientId };
