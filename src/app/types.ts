/**
 * Uygulama (son kullanıcı) yüzeyinin tipleri.
 *
 * Bu yüzey MÜŞTERİNİN MÜŞTERİSİ içindir: ziyaretçi ya da uygulama kullanıcısı.
 * Anahtarı açıktır (`sbw_pub_…`) ve istemciye gömülür; güvenliği gizlilikten
 * değil kısıttan gelir — yalnız izinli kökenden çalışır ve yalnız ziyaretçinin
 * KENDİ verisine dokunur.
 */

export interface SbResult<T = unknown> {
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
export interface AppStorage {
  getItem(key: string): Promise<string | null> | string | null;
  setItem(key: string, value: string): Promise<void> | void;
  removeItem(key: string): Promise<void> | void;
}

export interface AppConfig {
  /** Uygulama anahtarı (`sbw_pub_…`). Panelden ya da `createApp` ile alınır. */
  appKey: string;
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
export interface TopicOption {
  id: number;
  slug: string;
  name: string;
  description?: string | null;
  parent_id?: number | null;
}

/** `POST /v1/sdk/bootstrap` yanıtı — widget çizilmeden önceki tek soru. */
export interface BootstrapResult {
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
      prechat?: { name?: boolean; email?: boolean };
    };
  };
  /** Boşsa konu adımı hiç gösterilmez. */
  topics?: TopicOption[];
}

export interface Visitor {
  id: string;
  /** Ziyaretçi sırrı — YALNIZ oturum açılışında döner, sonra saklanır. */
  secret?: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  external_id?: string | null;
  unread_count?: number;
}

export interface SessionInput {
  name?: string;
  email?: string;
  phone?: string;
  external_id?: string;
  attributes?: Record<string, unknown>;
  page_url?: string;
}

export interface IdentifyInput {
  external_id?: string;
  email?: string;
  name?: string;
  phone?: string;
  attributes?: Record<string, unknown>;
}

export type MessageSender = 'visitor' | 'agent' | 'system';

export interface Message {
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
  /**
   * Anlık çeviri — ziyaretçinin diline. Arayüz varsa bunu gösterir; orijinal
   * `body`'de durmaya devam eder.
   */
  translation?: { lang: string; body: string; source?: string | null } | null;
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

export interface Attachment {
  id?: string;
  name?: string;
  url?: string;
  mime?: string;
  size?: number;
}

export interface Conversation {
  id: string;
  status: string;
  subject?: string | null;
  unread_count?: number;
  agent_typing?: boolean;
  within_hours?: boolean;
  last_message_at?: string | null;
  messages?: Message[];
}

export interface StartConversationInput {
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

export interface SendMessageInput {
  body?: string;
  client_id?: string;
  reply_to_id?: string | null;
  attachments?: unknown[];
}

export interface ConversationQuery {
  /** `cm_…` imleci — yalnız bundan sonrakiler döner. */
  after?: string;
  limit?: number;
}

export type DevicePlatform = 'ios' | 'android' | 'web';

export interface RegisterDeviceInput {
  token: string;
  platform: DevicePlatform;
  provider?: 'fcm' | 'apns' | 'webpush' | string;
  external_id?: string;
  device_name?: string;
  app_version?: string;
  locale?: string;
}
