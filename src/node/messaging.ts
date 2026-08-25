/**
 * Gönderim (Messaging) istemcisi — sunucu tarafı.
 *
 * Takım API anahtarıyla (`sb_…`) e-posta/SMS/push gönderir, kişi ve liste
 * yönetir, kampanya açar, mesaj durumlarını okur. Telsiz istemcisinden
 * (`SignalbirdClient`) ayrıdır: farklı anahtar, farklı kapı, farklı kota.
 *
 * Bağımlılığı yoktur (Node 18+ `fetch`). Retry yoktur: aynı iletiyi iki kez
 * göndermek, hiç göndermemekten pahalıdır — yeniden deneme kararı çağıranındır.
 *
 * Sözleşme: docs/CONTRACT.md § 8
 */
import { DEFAULT_BASE_URL, SignalbirdError } from './types';
import type {
  Batch,
  BulkContactsInput,
  BulkContactsResult,
  CampaignCreateResult,
  CampaignDetail,
  Contact,
  ContactInput,
  ContactList,
  CreateCampaignInput,
  CreateContactListInput,
  ListCampaignMessagesQuery,
  ListCampaignsQuery,
  ListContactsQuery,
  ListMessagesQuery,
  Message,
  MessagingConfig,
  Paginated,
  SbResult,
  SendEmailInput,
  SendPushInput,
  SendResult,
  SendSmsInput,
  SmsPreview,
} from './messaging-types';

/** Toplu kişi yüklemede tek istekteki üst sınır (API tarafı da bunu kabul eder). */
const BULK_CHUNK = 1000;

type Query = object | undefined;

export class SignalbirdMessaging {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly throwOnError: boolean;
  private readonly debug: boolean;

  constructor(config: MessagingConfig) {
    if (!config.apiKey) {
      throw new SignalbirdError('Signalbird: apiKey zorunlu.', 0, 'NO_KEY');
    }

    // Telsiz (`sbr_`) ya da uygulama (`sbw_pub_`) anahtarı buraya verilirse
    // her istek 401 döner; baştan söylemek haftalar sonra bulunacak hatayı önler.
    if (!config.apiKey.startsWith('sb_')) {
      throw new SignalbirdError(
        'Signalbird: gönderim istemcisi takım API anahtarı ister (sb_…). ' +
          'Telsiz (sbr_…) ve uygulama (sbw_pub_…) anahtarları burada çalışmaz.',
        0,
        'WRONG_KEY_TYPE'
      );
    }

    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
    this.timeout = config.timeout ?? 15000;
    this.throwOnError = config.throwOnError ?? false;
    this.debug = config.debug ?? false;
  }

  // ── Gönderim ──────────────────────────────────────────────────────────

  sendEmail(input: SendEmailInput): Promise<SbResult<SendResult>> {
    return this.request('POST', '/v1/email/send', input);
  }

  sendSms(input: SendSmsInput): Promise<SbResult<SendResult>> {
    return this.request('POST', '/v1/sms/send', input);
  }

  /**
   * Otomasyon olayı — kendi sisteminizdeki bir olayı bildirir ve eşleşen
   * akışı tetikler (§11). Signalbird olayın anlamını bilmez; adı sizindir.
   */
  track(input: {
    event: string;
    contact: { email?: string; phone?: string; external_id?: string; first_name?: string; last_name?: string };
    data?: Record<string, unknown>;
  }): Promise<SbResult<{ enrolled: number; canceled: number; contact_id: number }>> {
    return this.request('POST', '/v1/events', input);
  }

  /** SMS parça/karakter hesabı — kota harcamaz. */
  previewSms(body: string): Promise<SbResult<SmsPreview>> {
    return this.request('POST', '/v1/sms/preview', { body });
  }

  sendPush(input: SendPushInput): Promise<SbResult<SendResult>> {
    return this.request('POST', '/v1/push/send', input);
  }

  // ── Kişiler ───────────────────────────────────────────────────────────

  listContacts(query?: ListContactsQuery): Promise<SbResult<Paginated<Contact>>> {
    return this.request('GET', '/v1/contacts', undefined, query);
  }

  createContact(contact: ContactInput): Promise<SbResult<Contact>> {
    return this.request('POST', '/v1/contacts', contact);
  }

  updateContact(id: number | string, contact: Partial<ContactInput>): Promise<SbResult<Contact>> {
    return this.request('PATCH', `/v1/contacts/${encodeURIComponent(id)}`, contact);
  }

  deleteContact(id: number | string): Promise<SbResult<unknown>> {
    return this.request('DELETE', `/v1/contacts/${encodeURIComponent(id)}`);
  }

  /**
   * Toplu kişi yükleme.
   *
   * 1000'lik parçalara bölünür ve SIRAYLA gönderilir (paralel değil: aynı
   * e-posta iki parçada da varsa yarış olmasın). Sonuçlar tek yanıtta
   * birleştirilir. Bir parça başarısız olursa o noktada durulur ve o ana kadar
   * biriken sayımlar `data` içinde döner — çağıran kaç kişinin işlendiğini görür.
   */
  async bulkContacts(input: BulkContactsInput): Promise<SbResult<BulkContactsResult>> {
    const merged: BulkContactsResult = { imported: 0, updated: 0, skipped: [] };
    const { contacts, ...rest } = input;
    let status = 200;

    if (contacts.length === 0) {
      return { ok: true, status, data: merged };
    }

    for (let offset = 0; offset < contacts.length; offset += BULK_CHUNK) {
      const chunk = contacts.slice(offset, offset + BULK_CHUNK);
      const result = await this.request<BulkContactsResult>('POST', '/v1/contacts/bulk', {
        ...rest,
        contacts: chunk,
      });

      if (!result.ok) {
        return { ...result, data: merged };
      }

      status = result.status;
      merged.imported += Number(result.data?.imported ?? 0);
      merged.updated += Number(result.data?.updated ?? 0);
      if (Array.isArray(result.data?.skipped)) {
        merged.skipped.push(...result.data.skipped);
      }
    }

    return { ok: true, status, data: merged };
  }

  // ── Listeler ──────────────────────────────────────────────────────────

  listContactLists(): Promise<SbResult<ContactList[] | Paginated<ContactList>>> {
    return this.request('GET', '/v1/contact-lists');
  }

  createContactList(input: CreateContactListInput): Promise<SbResult<ContactList>> {
    return this.request('POST', '/v1/contact-lists', input);
  }

  deleteContactList(id: number | string): Promise<SbResult<unknown>> {
    return this.request('DELETE', `/v1/contact-lists/${encodeURIComponent(id)}`);
  }

  // ── Kampanyalar ───────────────────────────────────────────────────────

  listCampaigns(query?: ListCampaignsQuery): Promise<SbResult<Paginated<Batch> | Batch[]>> {
    return this.request('GET', '/v1/campaigns', undefined, query);
  }

  createCampaign(input: CreateCampaignInput): Promise<SbResult<CampaignCreateResult>> {
    return this.request('POST', '/v1/campaigns', input);
  }

  getCampaign(id: number | string): Promise<SbResult<CampaignDetail>> {
    return this.request('GET', `/v1/campaigns/${encodeURIComponent(id)}`);
  }

  cancelCampaign(id: number | string): Promise<SbResult<unknown>> {
    return this.request('POST', `/v1/campaigns/${encodeURIComponent(id)}/cancel`);
  }

  listCampaignMessages(
    id: number | string,
    query?: ListCampaignMessagesQuery
  ): Promise<SbResult<Paginated<Message>>> {
    return this.request('GET', `/v1/campaigns/${encodeURIComponent(id)}/messages`, undefined, query);
  }

  /**
   * Bir kampanyanın tüm mesajlarını sayfa sayfa gezer.
   *
   *   for await (const m of sdk.iterateCampaignMessages(42)) { … }
   *
   * Bir sayfa alınamazsa `SignalbirdError` fırlatır (sessiz yarım liste,
   * "hepsi bu" sanılır — o daha tehlikeli).
   */
  async *iterateCampaignMessages(
    id: number | string,
    query: Omit<ListCampaignMessagesQuery, 'page'> = {}
  ): AsyncGenerator<Message, void, undefined> {
    let page = 1;

    while (true) {
      const result = await this.listCampaignMessages(id, { per_page: 100, ...query, page });

      if (!result.ok) {
        throw new SignalbirdError(`Signalbird: ${result.code}`, result.status, result.code, result.data);
      }

      for (const message of result.data.data ?? []) {
        yield message;
      }

      if (page >= (result.data.last_page ?? 1) || (result.data.data ?? []).length === 0) {
        return;
      }

      page++;
    }
  }

  // ── Mesajlar ──────────────────────────────────────────────────────────

  listMessages(query?: ListMessagesQuery): Promise<SbResult<Paginated<Message>>> {
    return this.request('GET', '/v1/messages', undefined, query);
  }

  getMessage(id: string): Promise<SbResult<Message>> {
    return this.request('GET', `/v1/messages/${encodeURIComponent(id)}`);
  }

  // ── HTTP ──────────────────────────────────────────────────────────────

  private async request<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    path: string,
    body?: unknown,
    query?: Query
  ): Promise<SbResult<T>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);
    const url = this.baseUrl + path + buildQuery(query);

    let status = 0;
    let data: any;

    try {
      const response = await fetch(url, {
        method,
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      status = response.status;
      const text = await response.text();
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = text;
      }

      if (response.ok) {
        return { ok: true, status, data: data as T };
      }
    } catch (error) {
      const timedOut = error instanceof Error && error.name === 'AbortError';
      const code = timedOut ? 'TIMEOUT' : 'NETWORK_ERROR';
      const message = error instanceof Error ? error.message : 'network error';

      return this.fail(0, code, message, undefined);
    } finally {
      clearTimeout(timer);
    }

    // HTTP hatası: API `{message, code}` döner; Laravel doğrulama hatası
    // `{message, errors}` döner (kodsuz) — onu VALIDATION_ERROR sayarız.
    const code: string =
      (data && typeof data === 'object' && typeof data.code === 'string' && data.code) ||
      (status === 422 ? 'VALIDATION_ERROR' : status === 401 ? 'API_KEY_INVALID' : `HTTP_${status}`);
    const message: string =
      (data && typeof data === 'object' && typeof data.message === 'string' && data.message) ||
      `HTTP ${status}`;

    return this.fail(status, code, message, data);
  }

  private fail<T>(status: number, code: string, message: string, data: unknown): SbResult<T> {
    if (this.throwOnError) {
      throw new SignalbirdError(`Signalbird: ${code} — ${message}`, status, code, data);
    }

    if (this.debug) {
      console.warn(`[signalbird] ${code} (HTTP ${status}): ${message}`);
    }

    return { ok: false, status, code, message, data };
  }
}

/** `undefined`/`null` alanlar atlanır; diziler `key[]=` biçiminde gider. */
function buildQuery(query: Query): string {
  if (!query) return '';

  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query as Record<string, unknown>)) {
    if (value === undefined || value === null) continue;

    if (Array.isArray(value)) {
      for (const item of value) params.append(`${key}[]`, String(item));
    } else {
      params.append(key, String(value));
    }
  }

  const encoded = params.toString();

  return encoded ? `?${encoded}` : '';
}
