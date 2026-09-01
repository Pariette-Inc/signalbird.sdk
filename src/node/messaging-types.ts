/**
 * Gönderim (Messaging) istemcisinin tipleri.
 *
 * Alan adları API ile birebir aynıdır (snake_case) — SDK, sunucunun döndüğünü
 * yeniden adlandırmaz. Böylece API dokümanındaki bir alan SDK'da da aynı adla
 * bulunur ve iki doküman arasında çeviri tablosu gerekmez.
 */

export interface MessagingConfig {
  /** Takım API anahtarı (`sb_…`). GİZLİDİR, yalnız sunucuda kullanılır. */
  domainKey: string;
  /** Varsayılan: https://live.signalbird.io/api */
  baseUrl?: string;
  /** İstek zaman aşımı (ms). Varsayılan 15000 — toplu kişi yükleme uzun sürebilir. */
  timeout?: number;
  /** Hata fırlatılsın mı. Varsayılan `false`: `ok:false` + `code` döner. */
  throwOnError?: boolean;
  /** Konsola uyarı yazılsın mı. */
  debug?: boolean;
}

/** Her metodun döndüğü sonuç: ya `ok:true` + `data`, ya `ok:false` + `code`. */
export type SbResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; code: string; message: string; data?: unknown };

/** İleti sınıfı — API'de zorunludur ve varsayılanı YOKTUR (hukuki kapı). */
export type MessageClass = 'transactional' | 'commercial';
export type Channel = 'email' | 'sms' | 'push';

// ── Gönderim ────────────────────────────────────────────────────────────

export interface SendEmailInput {
  to: string;
  class: MessageClass;
  subject: string;
  body?: string;
  template_hash?: string;
  vars?: Record<string, unknown>;
  sending_domain_id?: number;
  contact_id?: number;
}

export interface SendSmsInput {
  to: string;
  class: MessageClass;
  body: string;
  brand_id?: number;
  contact_id?: number;
}

export interface SendPushInput {
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
export interface SendResult {
  id: string;
  status: string;
  units: number;
}

export interface SmsPreview {
  units: number;
  encoding?: string;
  length?: number;
  [key: string]: unknown;
}

// ── Kişiler ─────────────────────────────────────────────────────────────

export interface ContactInput {
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

export interface Contact {
  id: number;
  email: string | null;
  phone: string | null;
  first_name: string | null;
  last_name: string | null;
  attributes: Record<string, unknown> | null;
  [key: string]: unknown;
}

export interface ListContactsQuery {
  q?: string;
  list_id?: number;
  page?: number;
  per_page?: number;
  [key: string]: unknown;
}

export interface BulkContactsInput {
  contacts: ContactInput[];
  list_id?: number;
  consent_source?: string;
  consent_text?: string;
}

export interface BulkContactsResult {
  imported: number;
  updated: number;
  skipped: unknown[];
}

// ── Listeler ────────────────────────────────────────────────────────────

export interface ContactList {
  id: number;
  name: string;
  description: string | null;
  contacts_count?: number;
  [key: string]: unknown;
}

export interface CreateContactListInput {
  name: string;
  description?: string;
}

// ── Kampanyalar ─────────────────────────────────────────────────────────

export interface CreateCampaignInput {
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

export interface Batch {
  id: number;
  name: string;
  channel: Channel;
  status: string;
  [key: string]: unknown;
}

/** 202 Accepted */
export interface CampaignCreateResult {
  batch: Batch;
  class: MessageClass;
  summary: {
    total: number;
    queued: number;
    skipped: number;
    stopped_reason: string | null;
  };
}

export interface CampaignDetail {
  batch: Batch;
  status_breakdown: Record<string, number>;
  jobs: unknown[];
}

export interface ListCampaignsQuery {
  status?: string;
  channel?: Channel;
  page?: number;
  per_page?: number;
  [key: string]: unknown;
}

// ── Mesajlar ────────────────────────────────────────────────────────────

export interface Message {
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

export interface ListMessagesQuery {
  status?: string;
  channel?: Channel;
  batch_id?: number;
  page?: number;
  per_page?: number;
  [key: string]: unknown;
}

export interface ListCampaignMessagesQuery {
  page?: number;
  per_page?: number;
  status?: string;
}

/** Laravel sayfalayıcısı. */
export interface Paginated<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  [key: string]: unknown;
}

/** API'nin döndürebileceği hata kodları (bilinenler). */
export type MessagingErrorCode =
  | 'API_KEY_MISSING'
  | 'API_KEY_INVALID'
  | 'API_KEY_SCOPE'
  | 'API_KEY_IP_BLOCKED'
  | 'API_KEY_NO_TEAM'
  | 'MODULE_DISABLED'
  | 'LIMIT_REACHED'
  | 'OVERAGE_CEILING_REACHED'
  | 'SUPPRESSED'
  | 'NO_CONSENT'
  | 'NO_SENDING_DOMAIN'
  | 'INVALID_PHONE'
  | 'LIST_NOT_FOUND'
  | 'NO_RECIPIENTS'
  | 'ALREADY_FINISHED'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'VALIDATION_ERROR'
  | (string & {});
