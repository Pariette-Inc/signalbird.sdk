/**
 * Widget'ın konuştuğu SDK uçlarının şekilleri (docs/PLATFORM_EXPANSION §4.2).
 *
 * Alanlar sunucuyla birebir (snake_case). Yerel durum alanları `_` ile başlar
 * ve sunucuya asla gönderilmez.
 */

export interface InitOptions {
  appKey: string;
  /** Varsayılan https://live.signalbird.io/api */
  baseUrl?: string;
  /** 'tr' | 'en' — verilmezse uygulama ayarı → navigator.language */
  locale?: string;
  /** Sayfa yüklenirken zaten bilinen kullanıcı (login sonrası). */
  user?: IdentifyInput;
  debug?: boolean;
}

export interface IdentifyInput {
  external_id?: string;
  email?: string;
  name?: string;
  phone?: string;
  attributes?: Record<string, unknown>;
}

export interface PushRegisterInput {
  token: string;
  platform: 'web' | 'ios' | 'android';
  provider?: 'fcm' | 'apns' | 'webpush';
  external_id?: string;
  device_name?: string;
  app_version?: string;
  locale?: string;
}

export interface ChatSettings {
  greeting: string | null;
  offline_message: string | null;
  color: string;
  position: 'left' | 'right';
  launcher_text: string | null;
  prechat: { name: boolean; email: boolean; required: boolean };
  working_hours: unknown;
  push_visitor_on_reply: boolean;
  sound: boolean;
  locale: 'auto' | 'tr' | 'en' | string;
  /**
   * Sohbet sonunda gösterilecek puanlama/yorum bağlantısı (Trustpilot, Google
   * İşletme…). Site sahibi panelden girer.
   *
   * `review_min_rating` bir nezaket kuralı değil ticari bir kuraldır: eşiğin
   * altında puan veren müşteriye bağlantı HİÇ gösterilmez.
   */
  review_url?: string | null;
  review_label?: string | null;
  review_min_rating?: number;
  max_attachment_mb?: number;
  [key: string]: unknown;
}

export interface SdkApp {
  id: number;
  name: string;
  platform: string;
  chat_enabled: boolean;
  push_enabled: boolean;
  chat: ChatSettings;
  max_attachment_mb?: number;
}

/**
 * Ziyaretçinin seçebileceği destek konusu. Sunucu yalnız GÖRÜNÜR konuları
 * yollar; widget listeyi olduğu gibi çizer, kendi süzgeci yoktur.
 */
export interface TopicOption {
  id: number;
  slug: string;
  name: string;
  description?: string | null;
  parent_id?: number | null;
}

export interface Bootstrap {
  app: SdkApp;
  online: boolean;
  within_hours: boolean;
  /** Boşsa ön-formda konu adımı HİÇ çizilmez. */
  topics?: TopicOption[];
  visitor?: { id: string; name?: string | null; email?: string | null; unread?: number } | null;
  conversation?: Conversation | null;
}

export interface Visitor {
  id: string;
  /** Yalnız oluşturma anında döner; localStorage'da saklanır. */
  secret?: string;
  name?: string | null;
  email?: string | null;
}

export type ConversationStatus = 'open' | 'resolved' | 'closed';

export interface Conversation {
  id: string;
  status: ConversationStatus;
  subject?: string | null;
  last_message_at?: string | null;
  last_message_preview?: string | null;
  last_message_sender?: 'visitor' | 'agent' | 'system' | null;
  visitor_unread?: number;
  rating?: number | null;
  assigned_user_id?: number | null;
  agent?: Agent | null;
  [key: string]: unknown;
}

export interface Agent {
  name: string;
  avatar?: string | null;
  online?: boolean;
}

export interface Attachment {
  id: string | number;
  name: string;
  url: string;
  mime: string;
  size: number;
  width?: number;
  height?: number;
}

export interface Message {
  id: string;
  conversation_id?: string;
  sender_type: 'visitor' | 'agent' | 'system';
  sender_id?: string | number | null;
  sender_name?: string | null;
  type: 'text' | 'image' | 'file' | 'system';
  body: string | null;
  /**
   * Anlık çeviri — ziyaretçinin diline (28 Ağu 2026).
   *
   * Ziyaretçi ÇEVİRİYİ okur; orijinal gövde de gelir ama widget onu
   * göstermez. Ajanın Türkçe yazdığını bilmek ziyaretçinin işine yaramaz,
   * bilmesi gereken tek şey kendi dilindeki cevaptır.
   */
  translation?: { lang: string; body: string; source?: string | null } | null;
  attachments: Attachment[] | null;
  reply_to_id?: string | null;
  client_id?: string | null;
  /** `{"👍": ["agent:3", "visitor"]}` */
  reactions?: Record<string, string[]> | null;
  delivered_at?: string | null;
  read_at?: string | null;
  edited_at?: string | null;
  deleted_at?: string | null;
  created_at: string;
  /** Yerel: sunucuya gitti mi */
  _pending?: boolean;
  _failed?: boolean;
  /** Yerel: yüklenmeden önce görsel önizlemesi için */
  _files?: File[];
}

export interface ConversationPayload {
  conversation: Conversation;
  messages: Message[];
  agent_typing?: boolean;
  agent?: Agent | null;
}

export type ApiResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; code: string; message: string; data?: unknown };

export type ChatEvent = 'unread' | 'open' | 'close';
