/**
 * Yönetim (Management) yüzeyinin tipleri.
 *
 * Alan adları API ile BİREBİR aynıdır (snake_case). SDK yeniden adlandırmaz:
 * müşteri bir alanı belgede görüp kodda başka adla bulursa, kaybettiği zaman
 * SDK'nın kazandırdığı zamandan fazladır.
 */
import type { SbResult } from './http';

export type { SbResult };

export interface ManagementConfig {
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
export interface Paginated<T> {
  data: T[];
  current_page?: number;
  last_page?: number;
  per_page?: number;
  total?: number;
}

// ── Telsiz ─────────────────────────────────────────────────────────────

export type RadioLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical';

export interface RadioProject {
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

export interface RadioChannel {
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

export interface CreateRadioProjectInput {
  name: string;
}

export interface UpdateRadioProjectInput {
  name?: string;
  description?: string | null;
  is_active?: boolean;
  /** Tarayıcıdan yazılabilen kanallar ve izinli kökenler. */
  browser_channels?: string[] | null;
  allowed_origins?: string[] | null;
}

export interface RadioChannelInput {
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
export interface RadioProjectCreated {
  project: RadioProject;
  secret: string;
}

export interface RadioEvent {
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

export interface ListRadioEventsQuery {
  project_id?: number;
  channel_id?: number;
  level?: RadioLevel;
  q?: string;
  from?: string;
  to?: string;
  page?: number;
  per_page?: number;
}

// ── Sohbet (ajan tarafı) ───────────────────────────────────────────────

export type ConversationStatus = 'open' | 'pending' | 'resolved' | 'closed';

export interface ChatConversation {
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

export interface ChatVisitor {
  id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  external_id?: string | null;
  attributes?: Record<string, unknown> | null;
  is_banned?: boolean;
  last_seen_at?: string | null;
}

export interface ChatMessage {
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

export interface ListConversationsQuery {
  status?: ConversationStatus | ConversationStatus[];
  assigned_user_id?: number | 'me' | 'none';
  app_id?: number;
  q?: string;
  page?: number;
  per_page?: number;
}

export interface ListChatMessagesQuery {
  after?: string;
  before?: string;
  limit?: number;
  /** Ajan tarafı iç notları da okuyabilir; ziyaretçi asla göremez. */
  include_internal?: boolean;
}

export interface StartConversationInput {
  /** Ziyaretçi ya da kişi — biri zorunlu. */
  visitor_id?: string;
  contact_id?: number;
  body: string;
  app_id?: number;
}

export interface UpdateConversationInput {
  subject?: string | null;
  priority?: string | null;
  tags?: string[] | null;
}

export interface ReplyInput {
  body?: string;
  /** İç not: gelen kutusunda görünür, ziyaretçiye ASLA gitmez. */
  is_internal?: boolean;
  reply_to_id?: string | null;
  attachments?: unknown[];
}

export interface UpdateVisitorInput {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  attributes?: Record<string, unknown> | null;
}

export interface CannedReply {
  id: number;
  shortcut: string;
  title?: string | null;
  body: string;
  usage_count?: number;
}

export interface CannedReplyInput {
  shortcut?: string;
  title?: string | null;
  body?: string;
}

// ── Uygulamalar ────────────────────────────────────────────────────────

export type AppPlatform = 'web' | 'ios' | 'android' | 'other';

export interface AppRecord {
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

export interface AppInput {
  name?: string;
  platform?: AppPlatform;
  allowed_origins?: string[] | null;
  chat_enabled?: boolean;
  push_enabled?: boolean;
  is_active?: boolean;
  settings?: Record<string, unknown> | null;
}

export interface AppDevice {
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

export interface ListAppDevicesQuery {
  page?: number;
  per_page?: number;
}
