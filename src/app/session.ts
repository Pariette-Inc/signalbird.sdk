/**
 * Sohbet oturumu — çatısız durum yönetimi.
 *
 * `SignalbirdApp` ham uçları verir; burası bir sohbet ekranının gerçekten
 * ihtiyaç duyduğu şeyi verir: mesaj listesi, okunmamış sayısı, yazıyor durumu,
 * iyimser gönderim ve yoklama merdiveni. React/Vue/Angular/React Native
 * uyarlamaları bu sınıfa abone olur — üçünde de aynı mantığı yeniden yazmak,
 * üç ayrı hata takımı üretmek demekti.
 *
 * ── CANLI BAĞLANTI + YOKLAMA ──────────────────────────────────────────────
 *
 * 29 Ağu 2026'ya kadar burada yalnız yoklama vardı ve mobil, widget canlıya
 * geçtikten sonra da saniyede istek atmaya devam etti. Artık aynı soket
 * istemcisi (`../shared/socket`) burada da çalışıyor.
 *
 * YAYIN HABER TAŞIR, VERİ TAŞIMAZ: soketten gelen olay yalnız "yeni bir şey
 * var" der; mesajın kendisi HER ZAMAN kendi yetkimizle yeniden çekilir. Aksi
 * hâlde yayın kanalına düşen bir hata, okuma yetkisi olmayan birine mesaj
 * gövdesi göstermeye dönüşürdü.
 *
 * YOKLAMA KALDIRILMAZ, YAVAŞLAR. Bağlantı kurulduğunda panel açıkken 3 s
 * yerine 45 s, kapalıyken merdivenin son basamağı kullanılır: soket düşerse
 * ya da bir olay kaybolursa konuşma yine ilerler. Emniyet ağını sırf gereksiz
 * göründüğü için sökmek, düştüğünüz gün onu aramak demektir.
 *
 * Yoklama merdiveni (penyu deseni): panel açıkken 3 s, kapalıyken 20 s ×3 →
 * 60 s ×2 → 180 s. Yeni veri merdiveni sıfırlar; uygulama arka plandayken tur
 * atlanır.
 */
import { clientId, SignalbirdApp } from './client';
import { Socket } from '../shared/socket';
import type { BootstrapResult, Conversation, Message, SbResult, SessionInput, StartConversationInput, TopicOption, BootstrapChannel } from './types';

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
  /**
   * Uygulamanın sohbet ayarları (renk, logo, tema, puanlama bağlantısı…).
   *
   * Ekran bunları PANELDEN alır, kendi içine gömmez: müşteri rengini ya da
   * puanlama adresini değiştirdiğinde yeni sürüm yayınlamak gerekmesin.
   */
  settings: BootstrapChannel['chat'] | null;
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

/** Soket bağlıyken açık paneldeki yoklama — emniyet ağı, ana kanal değil. */
const ACTIVE_LIVE_INTERVAL = 45_000;

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
    settings: null,
  };

  private listeners = new Set<ChatListener>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private step = 0;
  private active: boolean;
  private stopped = false;
  private polling = false;
  private socket: Socket | null = null;
  private live = false;
  /**
   * Bir sonraki `refresh()` İMLEÇSİZ olsun mu.
   *
   * "Var olan mesaj değişti" haberi geldiğinde açılır: imleçli çekim
   * (`?after=<son mesaj>`) o mesajı bir daha getirmez, dolayısıyla çeviri ya
   * da düzenleme ekrana hiç yansımaz.
   */
  private forceFull = false;

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
    // Sunucu 1 Eyl'den beri `channel` gönderir; `app` eski sunucu uyumu.
    const app = boot.data?.channel ?? boot.data?.app;

    if (!boot.ok || !app?.chat_enabled) {
      this.patch({ enabled: false, loading: false, errorCode: boot.code });

      return;
    }

    this.patch({
      enabled: true,
      withinHours: app.within_hours ?? true,
      topics: boot.data?.topics ?? [],
      settings: app.chat ?? null,
    });

    this.openSocket(boot.data?.realtime);

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

    if (active) {
      // Kapanmış sohbet geri açılmaz: ekran yeniden görünür olduğunda
      // sıfırdan başlar (bkz. `refresh` ve widget'taki aynı kural).
      if (this.state.conversation?.status === 'closed') this.reset();

      void this.refresh();
    }

    this.schedule();
  }

  /**
   * Konuşmayı bırakır; sonraki mesaj YENİ bir konuşma açar.
   *
   * Ekranın "yeni sohbet" düğmesi de bunu çağırır. Sunucuda hiçbir şey
   * silinmez — yalnız bu oturumun neye baktığı değişir.
   */
  reset(): void {
    this.patch({ conversation: null, messages: [], unread: 0, agentTyping: false, errorCode: undefined });
    this.step = 0;
  }

  stop(): void {
    this.stopped = true;

    if (this.timer) clearTimeout(this.timer);

    this.timer = null;

    this.socket?.close();
    this.socket = null;
    this.live = false;
  }

  /** Canlı bağlantı kurulu mu — arayüz isterse gösterir (zorunlu değil). */
  get isLive(): boolean {
    return this.live;
  }

  // ── Eylemler ──────────────────────────────────────────────────────────

  /** Ön-form gönderildiğinde ya da uygulama kullanıcıyı tanıdığında. */
  async openSession(input: SessionInput): Promise<SbResult<unknown>> {
    const result = await this.app.startSession(input);

    if (result.ok) {
      // Kanal adı ziyaretçi kimliğini içerir; kimlik ancak ŞİMDİ doğdu.
      void this.joinVisitorChannel();
      await this.refresh();
    }

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

      void this.joinVisitorChannel();
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

      /*
       * YALNIZ AÇIK KONUŞMA BENİMSENİR (29 Ağu 2026).
       *
       * Eskiden listenin ilk kaydı alınıyordu ve o kayıt kapanmış olabilirdi:
       * ziyaretçi sohbeti bitirip ekranı yeniden açtığında, okunabilen ama
       * yazılamayan eski yazışma geri geliyordu. `closed` sunucuda da
       * ziyaretçi için finaldir; açık konuşma yoksa doğru cevap "konuşma
       * yok"tur ve ekran sıfırdan başlar.
       *
       * `resolved` bunun DIŞINDA: onu ajan işaretler, ziyaretçi hâlâ yazar.
       */
      const first = (list.data?.data ?? []).find((c) => c.status !== 'closed');

      if (!first) {
        this.patch({ errorCode: list.ok ? undefined : list.code });

        return;
      }

      const detail = await this.app.getConversation(first.id);

      this.applyConversation(detail.data?.conversation ?? first, true, detail.data?.messages);

      return;
    }

    // `forceFull` açıksa imleç atlanır: değişen mesaj zaten imlecin
    // gerisinde kaldığı için `after` ile hiç dönmez.
    const after = this.forceFull ? undefined : this.lastServerMessageId();

    this.forceFull = false;

    const detail = await this.app.getConversation(current.id, after ? { after } : undefined);

    if (!detail.ok || !detail.data?.conversation) {
      this.patch({ errorCode: detail.code });

      return;
    }

    this.applyConversation(detail.data.conversation, !after, detail.data.messages);
  }

  // ── İç işler ──────────────────────────────────────────────────────────

  /*
   * MESAJLAR YANITIN ÜST DÜZEYİNDE GELİR (4 Eyl 2026). Sunucu `GET
   * /conversations/{id}` için `{conversation, messages}` döner; burada
   * `conversation.messages` okunuyordu, o alan hiç yoktu. Sonuç: ilk mesaj
   * gönderilince liste boş sayılıp ekran "sohbet yok" hâline dönüyordu
   * (penyu uygulamasında canlıda görüldü). Üst düzey liste önce, eski alan
   * yedek.
   */
  private applyConversation(conversation: Conversation, replace: boolean, messages?: Message[]): void {
    const incoming = messages ?? conversation.messages ?? [];
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

  // ── Canlı bağlantı ────────────────────────────────────────────────────

  /**
   * Ziyaretçinin kendi kanalına bağlanır (`visitor.<id>`).
   *
   * Kanal ziyaretçi kimliği kurulduktan SONRA bilinir; ilk mesajla kimlik
   * doğduğunda `refresh()` üzerinden yeniden denenir. Bağlantı kurulamazsa
   * hiçbir şey olmaz: yoklama zaten çalışıyor.
   */
  private openSocket(realtime?: { enabled: boolean; url?: string }): void {
    if (!realtime?.enabled || !realtime.url || this.socket) return;

    this.socket = new Socket(
      realtime,
      async (socketId, channel) => {
        const result = await this.app.socketAuth(socketId, channel);

        return result.ok && result.data ? result.data : null;
      },
      (event) => {
        // OLAYIN İÇİNDEKİ VERİ KULLANILMAZ, yalnız "bir şey oldu" bilgisi:
        // mesajı kendi yetkimizle çekeriz. Tek istisna `updated` işareti —
        // o, verinin kendisi değil, NASIL çekileceğinin talimatıdır.
        if (event.data.updated === true) this.forceFull = true;

        this.step = 0;
        void this.refresh();
      },
      (connected) => {
        this.live = connected;
        this.schedule();
      },
    );

    this.socket.connect();
    void this.joinVisitorChannel();
  }

  /** Ziyaretçi kimliği varsa kendi kanalına katılır; yoksa sessizce döner. */
  private async joinVisitorChannel(): Promise<void> {
    const visitor = await this.app.currentVisitor();

    if (visitor?.id) this.socket?.subscribe(`visitor.${visitor.id}`);
  }

  private schedule(): void {
    if (this.timer) clearTimeout(this.timer);
    if (this.stopped) return;

    /*
     * Soket bağlıysa yoklama YAVAŞLAR, DURMAZ. Açık panelde 3 s yerine 45 s;
     * kapalı panelde merdivenin son basamağı — bir olay kaybolsa bile
     * konuşma en geç bu kadar gecikir.
     */
    const delay = this.active
      ? (this.live ? ACTIVE_LIVE_INTERVAL : ACTIVE_INTERVAL)
      : this.live
        ? IDLE_LADDER[IDLE_LADDER.length - 1]
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
