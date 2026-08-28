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
  AppDevice,
  AppInput,
  AppRecord,
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
  CreateRadioProjectInput,
  ListAppDevicesQuery,
  ListChatMessagesQuery,
  ListConversationsQuery,
  ListRadioEventsQuery,
  ManagementConfig,
  Paginated,
  RadioChannel,
  RadioChannelInput,
  RadioEvent,
  RadioProject,
  RadioProjectCreated,
  ReplyInput,
  StartConversationInput,
  UpdateConversationInput,
  UpdateRadioProjectInput,
  UpdateVisitorInput,
  TeamEmbedTokenInput,
} from './management-types';
import type { EmbedToken } from './partner-types';

export class SignalbirdManagement {
  private readonly http: SbTransport;

  constructor(config: ManagementConfig) {
    if (!config.apiKey) {
      throw new SignalbirdError('Signalbird: apiKey zorunlu.', 0, 'NO_KEY');
    }

    // Telsiz (`sbr_`) ya da uygulama (`sbw_pub_`) anahtarı buraya verilirse her
    // istek 401 döner; kurulum anında söylemek haftalar sonra bulunacak hatayı önler.
    if (!config.apiKey.startsWith('sb_')) {
      throw new SignalbirdError(
        'Signalbird: yönetim istemcisi takım API anahtarı ister (sb_…). ' +
          'Telsiz (sbr_…) ve uygulama (sbw_pub_…) anahtarları burada çalışmaz.',
        0,
        'WRONG_KEY_TYPE'
      );
    }

    this.http = new SbTransport({
      apiKey: config.apiKey,
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

  listRadioProjects(): Promise<SbResult<{ data: RadioProject[] }>> {
    return this.http.request('GET', '/v1/radio/projects');
  }

  /**
   * Proje açar.
   *
   * Dönen `secret` (`sbr_live_…`) YALNIZ BURADA görünür: sunucuda yalnız
   * SHA-256 özeti saklanır. Kaybedilirse `rotateRadioSecret` ile yenilenir.
   */
  createRadioProject(input: CreateRadioProjectInput): Promise<SbResult<RadioProjectCreated>> {
    return this.http.request('POST', '/v1/radio/projects', input);
  }

  getRadioProject(id: number | string): Promise<SbResult<{ project: RadioProject }>> {
    return this.http.request('GET', `/v1/radio/projects/${seg(id)}`);
  }

  updateRadioProject(
    id: number | string,
    input: UpdateRadioProjectInput
  ): Promise<SbResult<{ project: RadioProject }>> {
    return this.http.request('PATCH', `/v1/radio/projects/${seg(id)}`, input);
  }

  deleteRadioProject(id: number | string): Promise<SbResult<unknown>> {
    return this.http.request('DELETE', `/v1/radio/projects/${seg(id)}`);
  }

  /** Gizli anahtarı yeniler; eski anahtar ANINDA geçersizleşir. */
  rotateRadioSecret(id: number | string): Promise<SbResult<{ secret: string }>> {
    return this.http.request('POST', `/v1/radio/projects/${seg(id)}/rotate`);
  }

  // ── Telsiz: kanallar ──────────────────────────────────────────────────

  createRadioChannel(
    projectId: number | string,
    input: RadioChannelInput
  ): Promise<SbResult<{ channel: RadioChannel }>> {
    return this.http.request('POST', `/v1/radio/projects/${seg(projectId)}/channels`, input);
  }

  /**
   * Kanalı günceller. `key` DEĞİŞMEZ — müşterinin kodundaki `log('critical', …)`
   * çağrısı ona bağlıdır; sunucu gönderilse de yok sayar.
   */
  updateRadioChannel(
    projectId: number | string,
    channelId: number | string,
    input: RadioChannelInput
  ): Promise<SbResult<{ channel: RadioChannel }>> {
    return this.http.request(
      'PATCH',
      `/v1/radio/projects/${seg(projectId)}/channels/${seg(channelId)}`,
      input
    );
  }

  deleteRadioChannel(
    projectId: number | string,
    channelId: number | string
  ): Promise<SbResult<unknown>> {
    return this.http.request(
      'DELETE',
      `/v1/radio/projects/${seg(projectId)}/channels/${seg(channelId)}`
    );
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

  // ── Uygulamalar ───────────────────────────────────────────────────────

  listApps(): Promise<SbResult<AppRecord[]>> {
    return this.http.request('GET', '/v1/apps');
  }

  /** Yanıttaki `public_key` (`sbw_pub_…`) istemciye gömülür; gizli değildir. */
  createApp(input: AppInput): Promise<SbResult<AppRecord>> {
    return this.http.request('POST', '/v1/apps', input);
  }

  getApp(id: number | string): Promise<SbResult<AppRecord>> {
    return this.http.request('GET', `/v1/apps/${seg(id)}`);
  }

  updateApp(id: number | string, input: AppInput): Promise<SbResult<AppRecord>> {
    return this.http.request('PATCH', `/v1/apps/${seg(id)}`, input);
  }

  deleteApp(id: number | string): Promise<SbResult<unknown>> {
    return this.http.request('DELETE', `/v1/apps/${seg(id)}`);
  }

  /** Açık anahtarı yeniler; siteye gömülü eski anahtar ANINDA çalışmaz olur. */
  rotateAppKey(id: number | string): Promise<SbResult<AppRecord>> {
    return this.http.request('POST', `/v1/apps/${seg(id)}/rotate-key`);
  }

  /**
   * Gömme jetonu — Signalbird ekranını KENDİ panelinizde göstermek için.
   *
   * 120 saniye yaşar ve TEK KULLANIMLIKTIR: dönen `url`'i doğrudan bir
   * iframe'e verin, saklamayın. Anahtar `embed:issue` kapsamı ister.
   */
  embedToken(input: TeamEmbedTokenInput): Promise<SbResult<EmbedToken>> {
    return this.http.request('POST', '/v1/embed/tokens', input);
  }

  listAppDevices(
    id: number | string,
    query?: ListAppDevicesQuery
  ): Promise<SbResult<Paginated<AppDevice>>> {
    return this.http.request('GET', `/v1/apps/${seg(id)}/devices`, undefined, query);
  }
}
