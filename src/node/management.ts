/**
 * Yönetim (Management) istemcisi — sunucu tarafı.
 *
 * Müşterinin panelde tıklayarak yaptığı her şeyi kodla yapar: Telsiz projesi ve
 * kanalı açar, olay akışını okur, sohbet gelen kutusunu işler, uygulama kaydı
 * ve cihaz listesi yönetir.
 *
 * Bu ADMIN yüzeyi DEĞİLDİR. Anahtar tek bir takıma bağlıdır ve yalnız o takımın
 * kayıtlarına dokunur; başka takımın kaydı 404 döner.
 *
 * Neden ayrı sınıf: Gönderim (`SignalbirdMessaging`) ileti gönderir ve kota
 * harcar; bu istemci yapılandırma değiştirir. Aynı anahtar ailesini kullanırlar
 * (`sb_…`) ama scope'ları ve hata kümeleri farklıdır — tek sınıfta birleşseydi
 * "hangi scope gerekiyordu" sorusu her metotta yeniden sorulurdu.
 *
 * Sözleşme: docs/CONTRACT.md § 10
 */
import { SbTransport, seg, type SbResult } from './http';
import { DEFAULT_BASE_URL, SignalbirdError } from './types';
import type {
  KeyedModule,
  ModuleKey,
  ModuleKeyInput,
  ModuleKeyLevel,
  NotifyChannel,
  AppDevice,
  CannedReply,
  CannedReplyInput,
  ChatConversation,
  ChatMessage,
  ChatReport,
  ChatReportRange,
  ChatTrigger,
  ChatTriggerInput,
  ChatVisitor,
  ConversationStatus,
  ListAppDevicesQuery,
  ListChatMessagesQuery,
  ListConversationsQuery,
  ListRadioEventsQuery,
  ManagementConfig,
  Paginated,
  RadioEvent,
  ReplyInput,
  StartConversationInput,
  UpdateConversationInput,
  UpdateVisitorInput,
  TeamEmbedTokenInput,
} from './management-types';
import type { EmbedToken } from './partner-types';

export class SignalbirdManagement {
  private readonly http: SbTransport;

  constructor(config: ManagementConfig) {
    if (!config.domainKey) {
      throw new SignalbirdError('Signalbird: domainKey zorunlu.', 0, 'NO_KEY');
    }
    /*
     * Açık anahtar (`sb_public_live_…`) buraya verilirse her istek 403 döner
     * (`SECRET_KEY_REQUIRED`). Kurulumda söylemek, haftalar sonra bulunacak
     * bir hatayı önler.
     */
    if (!config.domainKey.startsWith('sb_secret_live_')) {
      throw new SignalbirdError(
        'Signalbird: bu istemci GİZLİ domain anahtarı ister (sb_secret_live_…). ' +
          'Açık anahtar (sb_public_live_…) yalnız tarayıcı ve mobil içindir.',
        0,
        'WRONG_KEY_TYPE'
      );
    }

    this.http = new SbTransport({
      domainKey: config.domainKey,
      baseUrl: (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, ''),
      timeout: config.timeout ?? 15000,
      throwOnError: config.throwOnError ?? false,
      debug: config.debug ?? false,
    });
  }

  // ── Telsiz: projeler ──────────────────────────────────────────────────

  /** Panelin Telsiz özeti: proje sayısı, günlük hacim, son olaylar. */
  radioSummary(): Promise<SbResult<Record<string, unknown>>> {
    return this.http.request('GET', '/v1/radio/summary');
  }

  /** Olay akışı — kanal, seviye ve tarihe göre süzülür. */
  radioEvents(query?: ListRadioEventsQuery): Promise<SbResult<Paginated<RadioEvent>>> {
    return this.http.request('GET', '/v1/radio/events', undefined, query);
  }

  // ── Modül anahtarları ─────────────────────────────────────────────────
  //
  // Telsiz projesi/kanalı ve uygulama kaydı 1 Eyl 2026'da kaldırıldı
  // (../signalbird.api/docs/KEY_ARCHITECTURE_2026-09-01.md §3). Yerlerini TEK
  // bir uç ailesi aldı: modül anahtarları. Beş modülün (logger, email, sms,
  // push, chat) hepsi aynı gövdeyi kullanır — beş ayrı metot kümesi yazmak,
  // altıncı modül geldiğinde altıncısını yazmak demekti.

  listModuleKeys(
    module: KeyedModule,
    query?: { domain_id?: number }
  ): Promise<SbResult<{ data: ModuleKey[] }>> {
    return this.http.request('GET', `/v1/modules/${seg(module)}/keys`, undefined, query);
  }

  getModuleKey(module: KeyedModule, id: number | string): Promise<SbResult<{ module_key: ModuleKey }>> {
    return this.http.request('GET', `/v1/modules/${seg(module)}/keys/${seg(id)}`);
  }

  /**
   * Kanal açar.
   *
   * `key` verilmezse başlıktan üretilir ve çakışırsa sonuna sayı eklenir —
   * "bu ad alınmış" hatasıyla geri dönmek, CI'da kanal açan bir betiği
   * durdururdu.
   */
  createModuleKey(module: KeyedModule, input: ModuleKeyInput): Promise<SbResult<{ module_key: ModuleKey }>> {
    return this.http.request('POST', `/v1/modules/${seg(module)}/keys`, input);
  }

  /**
   * Kanalı günceller.
   *
   * `key` DEĞİŞTİRİLEBİLİR (eskiden değişmezdi): eski ad 30 gün daha kabul
   * edilir, böylece üretimdeki kod bir sonraki deploya kadar kayıt kaybetmez.
   * `keep_previous: false` ile eski ad anında kapatılır.
   */
  updateModuleKey(
    module: KeyedModule,
    id: number | string,
    input: ModuleKeyInput
  ): Promise<SbResult<{ module_key: ModuleKey }>> {
    return this.http.request('PATCH', `/v1/modules/${seg(module)}/keys/${seg(id)}`, input);
  }

  deleteModuleKey(module: KeyedModule, id: number | string): Promise<SbResult<unknown>> {
    return this.http.request('DELETE', `/v1/modules/${seg(module)}/keys/${seg(id)}`);
  }

  // ── Sohbet: gelen kutusu ──────────────────────────────────────────────

  chatSummary(): Promise<SbResult<Record<string, unknown>>> {
    return this.http.request('GET', '/v1/chat/summary');
  }

  /** Kısa aralıklı yoklama için: yalnız değişenler + çevrimiçi ajanlar. */
  chatUpdates(): Promise<SbResult<Record<string, unknown>>> {
    return this.http.request('GET', '/v1/chat/updates');
  }

  listConversations(
    query?: ListConversationsQuery
  ): Promise<SbResult<Paginated<ChatConversation>>> {
    return this.http.request('GET', '/v1/chat/conversations', undefined, query);
  }

  getConversation(id: string): Promise<SbResult<{ conversation: ChatConversation }>> {
    return this.http.request('GET', `/v1/chat/conversations/${seg(id)}`);
  }

  /** `after` imleci `cm_…` mesaj kimliğidir; yoklamada tam listeyi çekmez. */
  listConversationMessages(
    id: string,
    query?: ListChatMessagesQuery
  ): Promise<SbResult<{ messages: ChatMessage[] }>> {
    return this.http.request('GET', `/v1/chat/conversations/${seg(id)}/messages`, undefined, query);
  }

  /** Proaktif sohbet — ziyaretçi yazmadan ajan başlatır. */
  startConversation(input: StartConversationInput): Promise<SbResult<{ conversation: ChatConversation }>> {
    return this.http.request('POST', '/v1/chat/conversations', input);
  }

  updateConversation(
    id: string,
    input: UpdateConversationInput
  ): Promise<SbResult<{ conversation: ChatConversation }>> {
    return this.http.request('PATCH', `/v1/chat/conversations/${seg(id)}`, input);
  }

  setConversationStatus(
    id: string,
    status: ConversationStatus
  ): Promise<SbResult<{ conversation: ChatConversation }>> {
    return this.http.request('POST', `/v1/chat/conversations/${seg(id)}/status`, { status });
  }

  /**
   * Atama atomiktir: `userId` verilmezse çağıran anahtarın sahibine atanır.
   * Başkasına atanmış sohbeti devralmak `chat:write` ister.
   */
  assignConversation(
    id: string,
    userId?: number | null
  ): Promise<SbResult<{ conversation: ChatConversation }>> {
    return this.http.request('POST', `/v1/chat/conversations/${seg(id)}/assign`, {
      user_id: userId ?? null,
    });
  }

  readConversation(id: string, lastMessageId?: string): Promise<SbResult<unknown>> {
    return this.http.request('POST', `/v1/chat/conversations/${seg(id)}/read`, {
      last_message_id: lastMessageId,
    });
  }

  setTyping(id: string, isTyping: boolean): Promise<SbResult<unknown>> {
    return this.http.request('POST', `/v1/chat/conversations/${seg(id)}/typing`, {
      is_typing: isTyping,
    });
  }

  reply(id: string, input: ReplyInput): Promise<SbResult<{ message: ChatMessage }>> {
    return this.http.request('POST', `/v1/chat/conversations/${seg(id)}/messages`, input);
  }

  editChatMessage(
    id: string,
    messageId: string,
    body: string
  ): Promise<SbResult<{ message: ChatMessage }>> {
    return this.http.request('PATCH', `/v1/chat/conversations/${seg(id)}/messages/${seg(messageId)}`, {
      body,
    });
  }

  deleteChatMessage(id: string, messageId: string): Promise<SbResult<unknown>> {
    return this.http.request(
      'DELETE',
      `/v1/chat/conversations/${seg(id)}/messages/${seg(messageId)}`
    );
  }

  /** Tepki açma/kapama — aynı emoji ikinci kez gönderilirse kaldırılır. */
  reactToChatMessage(
    id: string,
    messageId: string,
    emoji: string
  ): Promise<SbResult<{ message: ChatMessage }>> {
    return this.http.request(
      'POST',
      `/v1/chat/conversations/${seg(id)}/messages/${seg(messageId)}/reactions`,
      { emoji }
    );
  }

  // ── Sohbet: ziyaretçi ve hazır yanıtlar ───────────────────────────────

  getVisitor(id: string): Promise<SbResult<{ visitor: ChatVisitor }>> {
    return this.http.request('GET', `/v1/chat/visitors/${seg(id)}`);
  }

  updateVisitor(id: string, input: UpdateVisitorInput): Promise<SbResult<{ visitor: ChatVisitor }>> {
    return this.http.request('PATCH', `/v1/chat/visitors/${seg(id)}`, input);
  }

  banVisitor(id: string): Promise<SbResult<{ visitor: ChatVisitor }>> {
    return this.http.request('POST', `/v1/chat/visitors/${seg(id)}/ban`);
  }

  listCannedReplies(): Promise<SbResult<{ data: CannedReply[] }>> {
    return this.http.request('GET', '/v1/chat/canned-replies');
  }

  createCannedReply(input: CannedReplyInput): Promise<SbResult<{ reply: CannedReply }>> {
    return this.http.request('POST', '/v1/chat/canned-replies', input);
  }

  updateCannedReply(
    id: number | string,
    input: CannedReplyInput
  ): Promise<SbResult<{ reply: CannedReply }>> {
    return this.http.request('PATCH', `/v1/chat/canned-replies/${seg(id)}`, input);
  }

  deleteCannedReply(id: number | string): Promise<SbResult<unknown>> {
    return this.http.request('DELETE', `/v1/chat/canned-replies/${seg(id)}`);
  }

  // ── Sohbet: tetikleyiciler ────────────────────────────────────────────
  // "Şu olduğunda şunu yap." Kural KAYITTA durur, kodda değil: müşteri
  // davranışı değiştirmek için sürüm çıkarmak zorunda kalmasın.

  listChatTriggers(): Promise<SbResult<{ data: ChatTrigger[]; schema: Record<string, string[]> }>> {
    return this.http.request('GET', '/v1/chat/triggers');
  }

  createChatTrigger(input: ChatTriggerInput): Promise<SbResult<{ trigger: ChatTrigger }>> {
    return this.http.request('POST', '/v1/chat/triggers', input);
  }

  updateChatTrigger(id: number | string, input: Partial<ChatTriggerInput>): Promise<SbResult<{ trigger: ChatTrigger }>> {
    return this.http.request('PATCH', `/v1/chat/triggers/${seg(id)}`, input);
  }

  deleteChatTrigger(id: number | string): Promise<SbResult<unknown>> {
    return this.http.request('DELETE', `/v1/chat/triggers/${seg(id)}`);
  }

  // ── Sohbet: rapor ─────────────────────────────────────────────────────

  /**
   * Yanıt süresi, çözüm süresi, memnuniyet ve ajan kırılımı.
   * Veri yoksa süreler `null` döner — 0 DEĞİL.
   */
  chatReport(range: ChatReportRange = '30d'): Promise<SbResult<ChatReport>> {
    return this.http.request('GET', '/v1/chat/reports', undefined, { range });
  }

  // Uygulama uçları KALDIRILDI (1 Eyl 2026): "uygulama" ayrı bir kayıt
  // değil. Sohbet widget'ı ve push kanalı birer modül anahtarıdır —
  // `listModuleKeys('chat')`, `listModuleKeys('push')`. Anahtar döndürme de
  // yok: döndürülen şey DOMAIN anahtarıdır ve o panelden yönetilir.

  /**
   * Gömme jetonu — Signalbird ekranını KENDİ panelinizde göstermek için.
   *
   * 120 saniye yaşar ve TEK KULLANIMLIKTIR: dönen `url`'i doğrudan bir
   * iframe'e verin, saklamayın. Anahtarın `can_issue_embed` onayı ŞARTTIR —
   * scope sisteminden geriye kalan tek kapı, çünkü jeton 60 dakikalık bir
   * panel oturumuna çevriliyor.
   */
  embedToken(input: TeamEmbedTokenInput): Promise<SbResult<EmbedToken>> {
    return this.http.request('POST', '/v1/embed/tokens', input);
  }

  /** Push kanalına kayıtlı son kullanıcı cihazları (token MASKELİ döner). */
  listModuleKeyDevices(
    module: KeyedModule,
    id: number | string,
    query?: ListAppDevicesQuery
  ): Promise<SbResult<Paginated<AppDevice>>> {
    return this.http.request('GET', `/v1/modules/${seg(module)}/keys/${seg(id)}/devices`, undefined, query);
  }
}
