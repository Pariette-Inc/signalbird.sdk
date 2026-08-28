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
import type {
  AppConfig,
  AppStorage,
  BootstrapResult,
  Conversation,
  ConversationQuery,
  IdentifyInput,
  Message,
  RegisterDeviceInput,
  SbResult,
  SendMessageInput,
  SessionInput,
  StartConversationInput,
  Visitor,
} from './types';

const DEFAULT_BASE_URL = 'https://live.signalbird.io/api';
const STORAGE_KEY = 'sb_visitor';

interface StoredVisitor {
  id: string;
  secret: string;
  appKey: string;
  name?: string | null;
  email?: string | null;
}

/** Depo verilmezse: tarayıcıda localStorage, başka yerde bellek. */
function defaultStorage(): AppStorage {
  try {
    if (typeof localStorage !== 'undefined') {
      return {
        getItem: (k) => localStorage.getItem(k),
        setItem: (k, v) => localStorage.setItem(k, v),
        removeItem: (k) => localStorage.removeItem(k),
      };
    }
  } catch {
    // Gizli sekme / kısıtlı iframe — belleğe düş.
  }

  const memory = new Map<string, string>();

  return {
    getItem: (k) => memory.get(k) ?? null,
    setItem: (k, v) => void memory.set(k, v),
    removeItem: (k) => void memory.delete(k),
  };
}

/** RFC 4122 uyumlu olmak zorunda değil; tek işi yerel kopyayı eşlemek. */
export function clientId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    /* yok say */
  }

  return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export class SignalbirdApp {
  private readonly baseUrl: string;
  private readonly storage: AppStorage;
  private readonly timeout: number;
  private readonly doFetch: typeof fetch;
  private visitor: StoredVisitor | null = null;
  private loaded = false;

  constructor(private readonly config: AppConfig) {
    if (!config?.appKey) {
      throw new Error('Signalbird: appKey zorunlu (sbw_pub_…).');
    }

    // Takım anahtarı istemciye gömülürse tüm gönderim yetkisi sızar. Sunucu da
    // reddederdi ama o noktada anahtar çoktan yayınlanmış olurdu.
    if (!config.appKey.startsWith('sbw_pub_')) {
      throw new Error(
        'Signalbird: uygulama istemcisi açık uygulama anahtarı ister (sbw_pub_…). ' +
          'Takım anahtarını (sb_…) istemci koduna KOYMAYIN.'
      );
    }

    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
    this.storage = config.storage ?? defaultStorage();
    this.timeout = config.timeout ?? 10000;
    this.doFetch = config.fetchImpl ?? ((...args) => fetch(...args));
  }

  // ── Kimlik ────────────────────────────────────────────────────────────

  /** Uygulama ayarları: sohbet açık mı, renk, çalışma saati, ön-form. */
  bootstrap(): Promise<SbResult<BootstrapResult>> {
    return this.request('POST', '/v1/sdk/bootstrap', { locale: this.config.locale });
  }

  /**
   * Ziyaretçi oturumu açar ya da mevcut olanı günceller.
   *
   * Sır saklanır; ikinci çağrı aynı ziyaretçiyi tazeler. Sunucu `VISITOR_INVALID`
   * derse yerel kimlik silinir ve bir sonraki çağrı yeni oturum açar.
   */
  async startSession(input: SessionInput = {}): Promise<SbResult<{ visitor: Visitor }>> {
    const result = await this.request<{ visitor: Visitor }>('POST', '/v1/sdk/chat/session', input);

    const visitor = result.data?.visitor;

    if (result.ok && visitor?.id && visitor.secret) {
      await this.storeVisitor({
        id: visitor.id,
        secret: visitor.secret,
        appKey: this.config.appKey,
        name: visitor.name ?? null,
        email: visitor.email ?? null,
      });
    }

    return result;
  }

  /** Oturum açmış kullanıcıyı ziyaretçiye bağlar (kişi kaydı upsert edilir). */
  identify(input: IdentifyInput): Promise<SbResult<{ visitor: Visitor }>> {
    return this.request('POST', '/v1/sdk/identify', input);
  }

  /** Saklanan ziyaretçi kimliği — yoksa `null`. */
  async currentVisitor(): Promise<{ id: string; name?: string | null; email?: string | null } | null> {
    const stored = await this.loadVisitor();

    return stored ? { id: stored.id, name: stored.name, email: stored.email } : null;
  }

  /** Yerel kimliği siler: çıkış yapıldığında çağrılır. Sunucudaki kayıt kalır. */
  async signOut(): Promise<void> {
    this.visitor = null;
    this.loaded = true;
    await this.storage.removeItem(STORAGE_KEY);
  }

  // ── Sohbet ────────────────────────────────────────────────────────────

  listConversations(): Promise<SbResult<{ data: Conversation[] }>> {
    return this.request('GET', '/v1/sdk/chat/conversations');
  }

  getConversation(id: string, query?: ConversationQuery): Promise<SbResult<{ conversation: Conversation }>> {
    return this.request('GET', `/v1/sdk/chat/conversations/${enc(id)}`, undefined, query);
  }

  /**
   * İlk mesajla konuşma açar. Kota burada harcanır — konuşma başına sayılır,
   * mesaj başına değil.
   */
  startConversation(input: StartConversationInput): Promise<SbResult<{ conversation: Conversation; message: Message }>> {
    return this.request('POST', '/v1/sdk/chat/conversations', {
      client_id: clientId(),
      ...input,
    });
  }

  sendMessage(conversationId: string, input: SendMessageInput): Promise<SbResult<{ message: Message }>> {
    return this.request('POST', `/v1/sdk/chat/conversations/${enc(conversationId)}/messages`, {
      client_id: clientId(),
      ...input,
    });
  }

  /** Yalnız kendi mesajı ve gönderimden sonraki 15 dakika içinde. */
  editMessage(conversationId: string, messageId: string, body: string): Promise<SbResult<{ message: Message }>> {
    return this.request(
      'PATCH',
      `/v1/sdk/chat/conversations/${enc(conversationId)}/messages/${enc(messageId)}`,
      { body }
    );
  }

  deleteMessage(conversationId: string, messageId: string): Promise<SbResult<unknown>> {
    return this.request(
      'DELETE',
      `/v1/sdk/chat/conversations/${enc(conversationId)}/messages/${enc(messageId)}`
    );
  }

  /** Aynı emoji ikinci kez gönderilirse tepki kaldırılır. */
  reactToMessage(conversationId: string, messageId: string, emoji: string): Promise<SbResult<{ message: Message }>> {
    return this.request(
      'POST',
      `/v1/sdk/chat/conversations/${enc(conversationId)}/messages/${enc(messageId)}/reactions`,
      { emoji }
    );
  }

  setTyping(conversationId: string, isTyping: boolean): Promise<SbResult<unknown>> {
    return this.request('POST', `/v1/sdk/chat/conversations/${enc(conversationId)}/typing`, {
      is_typing: isTyping,
    });
  }

  markRead(conversationId: string, lastMessageId?: string): Promise<SbResult<unknown>> {
    return this.request('POST', `/v1/sdk/chat/conversations/${enc(conversationId)}/read`, {
      last_message_id: lastMessageId,
    });
  }

  /**
   * Ek dosya yükler; dönen tanımlayıcı `sendMessage`'a `attachments` içinde
   * verilir. İki adım olmasının sebebi: dosya yüklenirken mesaj metni hâlâ
   * yazılıyor olabilir ve yarım kalan yükleme mesaj kaydı yaratmamalı.
   */
  uploadAttachment(conversationId: string, file: unknown, fileName?: string): Promise<SbResult<{ attachment: unknown }>> {
    const form = new FormData();
    form.append('file', file as Blob, fileName);

    return this.request(
      'POST',
      `/v1/sdk/chat/conversations/${enc(conversationId)}/attachments`,
      form
    );
  }

  closeConversation(conversationId: string): Promise<SbResult<{ conversation: Conversation }>> {
    return this.request('POST', `/v1/sdk/chat/conversations/${enc(conversationId)}/close`);
  }

  rateConversation(conversationId: string, rating: number, comment?: string): Promise<SbResult<unknown>> {
    return this.request('POST', `/v1/sdk/chat/conversations/${enc(conversationId)}/rate`, {
      rating,
      comment,
    });
  }

  // ── Push ──────────────────────────────────────────────────────────────

  /**
   * Cihaz token'ını kaydeder. Token'ı almak (FCM/APNs/Web Push izni) ev
   * sahibinin işidir; SDK yalnız iletir — izin diyaloğunu kimin, ne zaman
   * göstereceği ürün kararıdır, kütüphane kararı değil.
   */
  registerDevice(input: RegisterDeviceInput): Promise<SbResult<unknown>> {
    return this.request('POST', '/v1/sdk/devices', input);
  }

  /** Çıkışta çağrılır: kayıt silinmez, kapatılır (geçmiş korunur). */
  unregisterDevice(token: string): Promise<SbResult<unknown>> {
    return this.request('DELETE', `/v1/sdk/devices/${enc(token)}`);
  }

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
  reportPushOpened(messageId: string): Promise<SbResult<unknown>> {
    return this.request('POST', '/v1/sdk/push/opened', { message_id: messageId });
  }

  // ── HTTP ──────────────────────────────────────────────────────────────

  private async request<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    path: string,
    body?: unknown,
    query?: object
  ): Promise<SbResult<T>> {
    const stored = await this.loadVisitor();
    const isForm = typeof FormData !== 'undefined' && body instanceof FormData;

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'X-Signalbird-App-Key': this.config.appKey,
    };

    if (stored?.secret) headers['X-Signalbird-Visitor'] = stored.secret;
    if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';
    if (this.config.locale) headers['X-Locale'] = this.config.locale;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await this.doFetch(this.baseUrl + path + buildQuery(query), {
        method,
        headers,
        body: body === undefined ? undefined : isForm ? (body as BodyInit) : JSON.stringify(body),
        signal: controller.signal,
      });

      const text = await response.text();
      let data: any = null;

      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = text;
      }

      if (response.ok) {
        return { ok: true, status: response.status, data: data as T };
      }

      const code: string =
        (data && typeof data === 'object' && typeof data.code === 'string' && data.code) ||
        (response.status === 422 ? 'VALIDATION_ERROR' : `HTTP_${response.status}`);

      // Sır geçersizse yerel kimliği at: bir sonraki çağrı yeni oturum açar.
      // Aksi hâlde ziyaretçi sonsuza kadar 401 alırdı ve sohbet sessizce ölürdü.
      if (code === 'VISITOR_INVALID' || response.status === 401) {
        await this.signOut();
      }

      if (this.config.debug) {
        console.warn(`[signalbird] ${code} (HTTP ${response.status})`);
      }

      return {
        ok: false,
        status: response.status,
        code,
        message:
          (data && typeof data === 'object' && typeof data.message === 'string' && data.message) ||
          `HTTP ${response.status}`,
        data: data as T,
      };
    } catch (error) {
      const timedOut = error instanceof Error && error.name === 'AbortError';

      if (this.config.debug) {
        console.warn('[signalbird] ulaşılamadı:', error);
      }

      return {
        ok: false,
        status: 0,
        code: timedOut ? 'TIMEOUT' : 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'network error',
      };
    } finally {
      clearTimeout(timer);
    }
  }

  private async loadVisitor(): Promise<StoredVisitor | null> {
    if (this.loaded) return this.visitor;

    this.loaded = true;

    try {
      const raw = await this.storage.getItem(STORAGE_KEY);
      if (!raw) return null;

      const parsed = JSON.parse(raw) as StoredVisitor;

      // Anahtar değiştiyse (uygulama döndürüldü, farklı ortam) kimlik geçersizdir.
      if (!parsed?.secret || parsed.appKey !== this.config.appKey) return null;

      this.visitor = parsed;
    } catch {
      this.visitor = null;
    }

    return this.visitor;
  }

  private async storeVisitor(visitor: StoredVisitor): Promise<void> {
    this.visitor = visitor;
    this.loaded = true;

    try {
      await this.storage.setItem(STORAGE_KEY, JSON.stringify(visitor));
    } catch {
      // Depo yazamıyorsa (kota, gizli sekme) oturum bu sekmede yaşar.
    }
  }
}

function enc(value: string): string {
  return encodeURIComponent(value);
}

function buildQuery(query: object | undefined): string {
  if (!query) return '';

  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query as Record<string, unknown>)) {
    if (value === undefined || value === null) continue;
    params.append(key, String(value));
  }

  const encoded = params.toString();

  return encoded ? `?${encoded}` : '';
}
