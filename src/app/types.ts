/**
 * Uygulama (son kullanıcı) yüzeyinin tipleri.
 *
 * Bu yüzey MÜŞTERİNİN MÜŞTERİSİ içindir: ziyaretçi ya da uygulama kullanıcısı.
 * Anahtarı açıktır (`sb_public_live_…`) ve istemciye gömülür; güvenliği gizlilikten
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
export interface TopicOption {
  id: number;
  slug: string;
  name: string;
  description?: string | null;
  parent_id?: number | null;
}

/** `POST /v1/sdk/bootstrap` yanıtı — widget çizilmeden önceki tek soru. */
export interface BootstrapResult {
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
  realtime?: { enabled: boolean; url?: string };
}

export interface BootstrapChannel {
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

/** `bot` = kanal ajanı (yapay zekâ). Okuyan taraf için ajan gibi ele alınır. */
export type MessageSender = 'visitor' | 'agent' | 'bot' | 'system';

export interface MessageOption {
  label: string;
  value?: string;
  url?: string;
}

export interface MessageMeta {
  ai?: boolean;
  agent_name?: string | null;
  /** Dokunulabilir seçenekler: `url` varsa aç, yoksa `value ?? label` gönder. */
  options?: MessageOption[];
  [key: string]: unknown;
}

export interface Message {
  id: string;
  sender_type: MessageSender;
  /** Sunucu kartı: ajan ya da bot (`bot:true`), sistemde null. */
  agent?: { id: number | null; name: string; avatar_url?: string | null; bot?: boolean } | null;
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
