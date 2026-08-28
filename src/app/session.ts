/**
 * Sohbet oturumu — çatısız durum yönetimi.
 *
 * `SignalbirdApp` ham uçları verir; burası bir sohbet ekranının gerçekten
 * ihtiyaç duyduğu şeyi verir: mesaj listesi, okunmamış sayısı, yazıyor durumu,
 * iyimser gönderim ve yoklama merdiveni. React/Vue/Angular/React Native
 * uyarlamaları bu sınıfa abone olur — üçünde de aynı mantığı yeniden yazmak,
 * üç ayrı hata takımı üretmek demekti.
 *
 * Yoklama merdiveni (penyu deseni): panel açıkken 3 s, kapalıyken 20 s ×3 →
 * 60 s ×2 → 180 s. Yeni veri merdiveni sıfırlar; sekme/uygulama arka plandayken
 * tur atlanır. WebSocket yoktur: imleçli yoklama, bağlantı kopmasında kendi
 * kendini toparlar ve mobil ağda pil yakmaz.
 */
import { clientId, SignalbirdApp } from './client';
import type { Conversation, Message, SbResult, SessionInput, StartConversationInput, TopicOption } from './types';

export interface ChatState {
  /** Sohbet bu uygulamada açık mı (`bootstrap` cevabı). */
  enabled: boolean;
  loading: boolean;
  conversation: Conversation | null;
  messages: Message[];
  unread: number;
  agentTyping: boolean;
  withinHours: boolean;
  /**
   * Ziyaretçinin seçebileceği destek konuları (boşsa konu adımı çizilmez).
   * Seçimi `setTopic()` taşır; ilk konuşma açılırken gönderilir.
   */
  topics: TopicOption[];
  /** Seçili konu (slug) — ilk konuşmayla birlikte gider. */
  topic: string | null;
  /** Son hatanın kodu — arayüz isterse gösterir, göstermezse yutar. */
  errorCode?: string;
}

export type ChatListener = (state: ChatState) => void;

export interface ChatSessionOptions {
  /** Panel açık mı — yoklama hızını belirler. */
  active?: boolean;
  /** Arka plandayken tur atlanır; varsayılan: `document.visibilityState`. */
  isVisible?: () => boolean;
  /** Açılışta oturum kurulurken kullanılacak ziyaretçi bilgisi. */
  visitor?: SessionInput;
}

/** Kapalı panelde yoklama aralıkları (ms) — son değer sonsuza kadar tekrarlar. */
const IDLE_LADDER = [20_000, 20_000, 20_000, 60_000, 60_000, 180_000];
const ACTIVE_INTERVAL = 3_000;

export class ChatSession {
  private state: ChatState = {
    enabled: false,
    loading: true,
    topics: [],
    topic: null,
    conversation: null,
    messages: [],
    unread: 0,
    agentTyping: false,
    withinHours: true,
  };

  private listeners = new Set<ChatListener>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private step = 0;
  private active: boolean;
  private stopped = false;
  private polling = false;

  constructor(
    private readonly app: SignalbirdApp,
    private readonly options: ChatSessionOptions = {}
  ) {
    this.active = options.active ?? false;
  }

  // ── Abonelik ──────────────────────────────────────────────────────────

  subscribe(listener: ChatListener): () => void {
    this.listeners.add(listener);
    listener(this.state);

    return () => this.listeners.delete(listener);
  }

  snapshot(): ChatState {
    return this.state;
  }

  // ── Yaşam döngüsü ─────────────────────────────────────────────────────

  /** Bootstrap + varsa mevcut konuşmayı yükler, sonra yoklamayı başlatır. */
  async start(): Promise<void> {
    this.stopped = false;

    const boot = await this.app.bootstrap();
    const app = boot.data?.app;

    if (!boot.ok || !app?.chat_enabled) {
      this.patch({ enabled: false, loading: false, errorCode: boot.code });

      return;
    }

    this.patch({
      enabled: true,
      withinHours: app.within_hours ?? true,
      topics: boot.data?.topics ?? [],
    });

    // Ziyaretçi yoksa oturum AÇILMAZ: ilk mesaja kadar bekleriz. Her sayfa
    // görüntülemesinde ziyaretçi kaydı açmak, hiç konuşmayacak binlerce boş
    // kayıt üretirdi.
    if (await this.app.currentVisitor()) {
      await this.refresh();
    }

    this.patch({ loading: false });
    this.schedule();
  }

  /** Panel açıldı/kapandı — yoklama hızı buna göre değişir. */
  setActive(active: boolean): void {
    if (this.active === active) return;

    this.active = active;
    this.step = 0;

    if (active) void this.refresh();

    this.schedule();
  }

  stop(): void {
    this.stopped = true;

    if (this.timer) clearTimeout(this.timer);

    this.timer = null;
  }

  // ── Eylemler ──────────────────────────────────────────────────────────

  /** Ön-form gönderildiğinde ya da uygulama kullanıcıyı tanıdığında. */
  async openSession(input: SessionInput): Promise<SbResult<unknown>> {
    const result = await this.app.startSession(input);

    if (result.ok) await this.refresh();

    return result;
  }

  /**
   * Mesaj gönderir. Konuşma yoksa açar.
   *
   * İyimser: mesaj listeye ANINDA düşer, `client_id` ile eşlenir. Sunucu
   * cevabı gelince yerel kopya onunla değiştirilir; başarısızsa `failed`
   * işaretlenir ve arayüz "yeniden dene" gösterebilir.
   */
  async send(body: string, attachments?: unknown[]): Promise<SbResult<unknown>> {
    const trimmed = body.trim();

    if (!trimmed && !attachments?.length) {
      return { ok: false, status: 0, code: 'EMPTY_BODY', message: 'Mesaj boş.' };
    }

    const cid = clientId();
    const optimistic: Message & { failed?: boolean } = {
      id: cid,
      client_id: cid,
      sender_type: 'visitor',
      body: trimmed,
      created_at: new Date().toISOString(),
    };

    this.patch({ messages: [...this.state.messages, optimistic] });

    // Ziyaretçi yoksa önce oturum: ilk mesaj kimliği de yaratır.
    if (!(await this.app.currentVisitor())) {
      const session = await this.app.startSession(this.options.visitor ?? {});

      if (!session.ok) return this.markFailed(cid, session);
    }

    const conversation = this.state.conversation;

    const result = conversation
      ? await this.app.sendMessage(conversation.id, { body: trimmed, client_id: cid, attachments })
      : await this.app.startConversation({
          body: trimmed,
          client_id: cid,
          attachments,
          ...(this.state.topic ? { topic: this.state.topic } : {}),
        } as StartConversationInput);

    if (!result.ok) return this.markFailed(cid, result);

    await this.refresh();
    this.step = 0;
    this.schedule();

    return result;
  }

  /**
   * Ziyaretçinin konu seçimi. Konuşma AÇILDIKTAN sonra çağrılırsa etkisizdir:
   * açılmış konuşmanın konusunu ajan panelden değiştirir — ziyaretçiye kendi
   * konuşmasını yeniden sınıflandırma yetkisi vermek, atamayı da bozardı.
   */
  setTopic(slug: string | null): void {
    this.patch({ topic: slug });
  }

  /** İlk tuşta `true`, 2.5 s hareketsizlikte `false` — çağıran zamanlar. */
  typing(isTyping: boolean): void {
    const conversation = this.state.conversation;

    if (!conversation) return;

    void this.app.setTyping(conversation.id, isTyping);
  }

  /** Görülen son mesaja kadar okundu işaretler. */
  async markRead(): Promise<void> {
    const conversation = this.state.conversation;
    const last = this.state.messages[this.state.messages.length - 1];

    if (!conversation || !last) return;

    await this.app.markRead(conversation.id, last.id);
    this.patch({ unread: 0 });
  }

  async close(rating?: number, comment?: string): Promise<void> {
    const conversation = this.state.conversation;

    if (!conversation) return;

    if (typeof rating === 'number') {
      await this.app.rateConversation(conversation.id, rating, comment);
    }

    await this.app.closeConversation(conversation.id);
    await this.refresh();
  }

  /** Sunucudaki durumu çeker; imleç varsa yalnız yenileri ister. */
  async refresh(): Promise<void> {
    const current = this.state.conversation;

    if (!current) {
      const list = await this.app.listConversations();
      const first = list.data?.data?.[0];

      if (!first) {
        this.patch({ errorCode: list.ok ? undefined : list.code });

        return;
      }

      const detail = await this.app.getConversation(first.id);

      this.applyConversation(detail.data?.conversation ?? first, true);

      return;
    }

    const after = this.lastServerMessageId();
    const detail = await this.app.getConversation(current.id, after ? { after } : undefined);

    if (!detail.ok || !detail.data?.conversation) {
      this.patch({ errorCode: detail.code });

      return;
    }

    this.applyConversation(detail.data.conversation, !after);
  }

  // ── İç işler ──────────────────────────────────────────────────────────

  private applyConversation(conversation: Conversation, replace: boolean): void {
    const incoming = conversation.messages ?? [];
    const merged = replace ? incoming : mergeMessages(this.state.messages, incoming);

    // Yeni veri geldiyse merdiven sıfırlanır: konuşma canlandığında bir sonraki
    // yoklamayı üç dakika beklemek, kullanıcıyı terk edilmiş hissettirir.
    if (incoming.length) this.step = 0;

    this.patch({
      conversation,
      messages: merged,
      unread: conversation.unread_count ?? 0,
      agentTyping: !!conversation.agent_typing,
      withinHours: conversation.within_hours ?? this.state.withinHours,
      errorCode: undefined,
    });
  }

  /** İyimser kayıtlar sunucu kimliği taşımaz; imleç yalnız gerçek kimliktir. */
  private lastServerMessageId(): string | undefined {
    for (let i = this.state.messages.length - 1; i >= 0; i--) {
      const message = this.state.messages[i];

      if (message.id && !message.id.startsWith('c_') && message.id !== message.client_id) {
        return message.id;
      }
    }

    return undefined;
  }

  private markFailed(cid: string, result: SbResult<unknown>): SbResult<unknown> {
    this.patch({
      messages: this.state.messages.map((m) =>
        m.client_id === cid ? { ...m, failed: true } : m
      ) as Message[],
      errorCode: result.code,
    });

    return result;
  }

  private schedule(): void {
    if (this.timer) clearTimeout(this.timer);
    if (this.stopped) return;

    const delay = this.active
      ? ACTIVE_INTERVAL
      : IDLE_LADDER[Math.min(this.step, IDLE_LADDER.length - 1)];

    this.timer = setTimeout(() => void this.tick(), delay);
  }

  private async tick(): Promise<void> {
    if (this.stopped || this.polling) return;

    // Arka plandaki sekme/uygulama tur atlar: görünmeyen sohbet için ağ
    // trafiği üretmek pil ve kota harcar.
    if (!this.visible()) {
      this.schedule();

      return;
    }

    this.polling = true;

    try {
      await this.refresh();
    } finally {
      this.polling = false;
    }

    if (!this.active) this.step++;

    this.schedule();
  }

  private visible(): boolean {
    if (this.options.isVisible) return this.options.isVisible();

    try {
      if (typeof document !== 'undefined' && document.visibilityState) {
        return document.visibilityState === 'visible';
      }
    } catch {
      /* yok say */
    }

    return true;
  }

  private patch(partial: Partial<ChatState>): void {
    this.state = { ...this.state, ...partial };

    for (const listener of this.listeners) {
      try {
        listener(this.state);
      } catch (error) {
        // Bir dinleyicinin hatası diğerlerini ve oturumu düşürmemeli.
        console.warn('[signalbird] dinleyici hatası:', error);
      }
    }
  }
}

/** Sunucu kaydı, aynı `client_id`'li yerel kopyanın yerine geçer. */
function mergeMessages(existing: Message[], incoming: Message[]): Message[] {
  if (!incoming.length) return existing;

  const byKey = new Map<string, Message>();

  for (const message of existing) {
    byKey.set(message.client_id ?? message.id, message);
  }

  for (const message of incoming) {
    const key = message.client_id ?? message.id;
    byKey.delete(key);
    byKey.set(key, message);
  }

  return [...byKey.values()].sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''));
}
