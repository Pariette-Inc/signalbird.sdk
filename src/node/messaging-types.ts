/**
 * Gönderim (Messaging) istemcisinin tipleri.
 *
 * Alan adları API ile birebir aynıdır (snake_case) - SDK, sunucunun döndüğünü
 * yeniden adlandırmaz. Böylece API dokümanındaki bir alan SDK'da da aynı adla
 * bulunur ve iki doküman arasında çeviri tablosu gerekmez.
 */

export interface MessagingConfig {
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
export type SbResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; code: string; message: string; data?: unknown };

/** İleti sınıfı - API'de zorunludur ve varsayılanı YOKTUR (hukuki kapı). */
export type MessageClass = 'transactional' | 'commercial';
export type Channel = 'email' | 'sms' | 'push';

// ── Gönderim ────────────────────────────────────────────────────────────

/** E-posta eki - içerik base64; toplam çözülmüş boyut sınırı sunucudadır (7 MB). */
export interface EmailAttachment {
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
export interface SendEmailInput {
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
export interface SendSmsInput {
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
