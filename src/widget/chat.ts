/**
 * Sohbet denetleyicisi: bootstrap → oturum → konuşma → polling → arayüz.
 *
 * Arayüz (`ui/`) çizer, `Store` durumu tutar, `Api` konuşur, `Poller` zamanlar.
 * Buradaki her dış çağrı try/catch içindedir: widget, ev sahibi sayfaya asla
 * hata fırlatmaz — canlı sohbetin çökmesi müşterinin ödeme sayfasını
 * çökertmemeli.
 */
import { Api } from './api';
import { Store } from './store';
import { Poller } from './poller';
import { UI } from './ui';
import { uuid } from './ui/dom';
import { TitleBlinker } from './title';
import { beep } from './sound';
import { resolveLocale, strings, fmt, type Strings } from './i18n';
import type {
  ApiResult,
  Bootstrap,
  ChatEvent,
  ChatSettings,
  Conversation,
  ConversationPayload,
  IdentifyInput,
  InitOptions,
  Message,
  PushRegisterInput,
  Visitor,
} from './types';

const DEFAULT_BASE_URL = 'https://live.signalbird.io/api';
const CONV = '/v1/sdk/chat/conversations';

interface Pending {
  text: string;
  files: File[];
  replyTo: string | null;
}

export class ChatController {
  private api: Api;
  private store: Store;
  private poller: Poller;
  private title = new TitleBlinker();
  /** Ön-formda seçilen konu (slug); ilk konuşmayla birlikte gönderilir. */
  private topic: string | null = null;
  private ui: UI | null = null;
  private t: Strings;
  private locale: 'tr' | 'en';
  private settings: ChatSettings | null = null;
  private appName = '';
  private ready: Promise<void>;
  private started = false;
  private destroyed = false;
  private pendingSends = new Map<string, Pending>();
  private ratingMode: 'end' | 'resolved' | null = null;
  private lastTypingSent = 0;
  private pollCount = 0;
  private baseUrl: string;

  constructor(private readonly opts: InitOptions) {
    this.baseUrl = (opts.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, '');
    this.store = new Store(opts.appKey);
    this.api = new Api(this.baseUrl, opts.appKey, () => this.store.secret, (...a) => this.log(...a));
    this.poller = new Poller(() => this.tick());
    this.locale = resolveLocale(null, opts.locale);
    this.t = strings(this.locale);
    this.ready = this.start().catch((e) => this.log('start failed', e));
  }

  private log(...args: unknown[]): void {
    if (this.opts.debug) console.debug('[signalbird]', ...args);
  }

  // ── Başlatma ──────────────────────────────────────────────────────────

  private async start(): Promise<void> {
    const boot = await this.api.post<Bootstrap>('/v1/sdk/bootstrap', {
      page_url: location.href,
      locale: this.opts.locale,
    });

    if (!boot.ok || !boot.data?.app) {
      this.log('bootstrap failed', boot);
      return;
    }
    if (this.destroyed) return;

    const { app, online, within_hours, visitor, conversation, topics } = boot.data;
    if (!app.chat_enabled) {
      this.log('chat disabled for app');
      return;
    }

    this.settings = app.chat || ({} as ChatSettings);
    this.appName = app.name || '';
    this.locale = resolveLocale(this.settings.locale, this.opts.locale);
    this.t = strings(this.locale);

    // Sır vardı ama sunucu ziyaretçiyi tanımadı → sır geçersiz, temizle.
    if (this.store.visitor && !visitor) this.store.clearVisitor();
    if (visitor) this.store.setVisitor({ id: visitor.id, name: visitor.name, email: visitor.email });

    this.store.online = !!online;
    this.store.withinHours = within_hours !== false;
    if (conversation) this.store.setConversation(conversation);

    const maxMb = Number(this.settings.max_attachment_mb || app.max_attachment_mb || 10);
    this.ui = new UI({
      t: this.t,
      locale: this.locale,
      settings: this.settings,
      appName: this.appName,
      maxMb,
      topics: topics || [],
      actions: {
        open: () => this.open(),
        close: () => this.close(),
        send: (text, files, replyTo) => void this.send(text, files, replyTo),
        typing: (active) => void this.typing(active),
        submitPrechat: (name, email, topic) => void this.submitPrechat(name, email, topic),
        skipPrechat: (topic) => {
          this.topic = topic;
          this.enterChat();
        },
        rate: (stars, comment) => void this.rate(stars, comment),
        endChat: () => this.endChat(),
        newChat: () => this.newChat(),
        saveEdit: (m, body) => void this.saveEdit(m, body),
        reply: (m) => this.ui?.setReply(m),
        react: (m, emoji) => void this.react(m, emoji),
        edit: (m) => this.ui?.startEdit(m),
        remove: (m) => void this.remove(m),
        retry: (m) => void this.retry(m),
        openImage: (url) => window.open(url, '_blank', 'noopener'),
      },
    });

    this.store.on('unread', () => this.syncUnread());
    this.store.on('messages', () => this.render());
    this.store.on('change', () => this.render());
    document.addEventListener('visibilitychange', this.onVisibility);

    this.ui.mount();
    this.ui.setHeader(this.store.agent, this.store.online);
    this.applyBanner();
    this.store.setUnread(visitor?.unread || conversation?.visitor_unread || 0);
    this.syncUnread();

    this.started = true;
    this.poller.start();

    if (this.opts.user) void this.identify(this.opts.user);
  }

  private onVisibility = (): void => {
    this.syncUnread();
    if (!document.hidden && this.store.isOpen && this.store.conversation) {
      void this.markRead();
    }
  };

  private applyBanner(): void {
    if (!this.ui || !this.settings) return;
    this.ui.setBanner(this.store.withinHours ? null : this.settings.offline_message || this.t.offlineMessage);
  }

  private syncUnread(): void {
    const n = this.store.isOpen && !document.hidden ? 0 : this.store.unread;
    this.ui?.setUnread(this.store.unread);
    this.title.update(n, (c) => fmt(this.t.unreadTitle, { n: c }));
    this.store.emit('public:unread', this.store.unread);
  }

  // ── Dış API ──────────────────────────────────────────────────────────

  open(): void {
    if (!this.ui || this.store.isOpen) return;
    this.store.isOpen = true;
    this.ui.setOpen(true);
    this.poller.setOpen(true);
    this.decideView();
    this.store.emit('public:open');
    if (this.store.conversation) void this.loadConversation();
    else this.store.setUnread(0);
    this.syncUnread();
  }

  close(): void {
    if (!this.ui || !this.store.isOpen) return;

    // Ajan çözdüyse ve henüz puanlanmadıysa kapatmadan önce bir kez sor.
    const c = this.store.conversation;
    if (
      c &&
      c.status === 'resolved' &&
      !this.store.wasRated(c.id) &&
      this.ui.currentView === 'chat' &&
      this.store.messages.some((m) => m.sender_type === 'agent')
    ) {
      this.ratingMode = 'resolved';
      this.ui.setEndVisible(false);
      this.ui.showRating();
      return;
    }

    this.store.isOpen = false;
    this.ui.setOpen(false);
    this.poller.setOpen(false);
    void this.typing(false);
    this.store.emit('public:close');
    this.syncUnread();
  }

  toggle(): void {
    this.store.isOpen ? this.close() : this.open();
  }

  isOpen(): boolean {
    return this.store.isOpen;
  }

  on(event: ChatEvent, fn: (payload?: unknown) => void): void {
    this.store.on(`public:${event}`, fn);
  }

  off(event: ChatEvent, fn: (payload?: unknown) => void): void {
    this.store.off(`public:${event}`, fn);
  }

  async identify(input: IdentifyInput): Promise<void> {
    await this.ready;
    if (this.destroyed) return;
    const [first_name, ...rest] = (input.name || '').trim().split(/\s+/);
    const body = {
      external_id: input.external_id,
      email: input.email,
      phone: input.phone,
      first_name: first_name || undefined,
      last_name: rest.join(' ') || undefined,
      attributes: input.attributes,
    };
    if (input.external_id) {
      this.check(await this.api.post('/v1/sdk/identify', body));
    }
    await this.session({ name: input.name, email: input.email, external_id: input.external_id });
  }

  async pushRegister(input: PushRegisterInput): Promise<ApiResult<unknown>> {
    await this.ready;
    return this.api.post('/v1/sdk/devices', {
      provider: input.platform === 'ios' ? 'apns' : 'fcm',
      locale: this.locale,
      ...input,
    });
  }

  destroy(): void {
    this.destroyed = true;
    this.poller.stop();
    this.title.end();
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.ui?.unmount();
    this.ui = null;
  }

  // ── Görünüm kararları ────────────────────────────────────────────────

  private decideView(): void {
    if (!this.ui || !this.settings) return;
    const p = this.settings.prechat;
    const needsPrechat = !this.store.visitor && p && (p.name || p.email);
    if (needsPrechat) this.ui.showPrechat({});
    else this.enterChat();
  }

  private enterChat(): void {
    if (!this.ui) return;
    this.ratingMode = null;
    this.ui.showChat();
    this.ui.setEndVisible(this.store.conversation?.status === 'open');
    this.render();
  }

  private render(): void {
    if (!this.ui || this.ui.currentView !== 'chat') return;
    const c = this.store.conversation;
    this.ui.render({
      messages: this.store.messages,
      greeting: this.settings?.greeting || this.t.greeting,
      agentName: this.store.agent?.name || this.t.agent,
      find: (id) => this.store.find(id),
    });
    this.ui.setEndVisible(c?.status === 'open');
    if (c && c.status !== 'open') {
      this.ui.setNotice(c.status === 'resolved' ? this.t.resolved : this.t.closed, {
        label: this.t.newChat,
        fn: () => this.newChat(),
      });
    } else {
      this.ui.setNotice(null);
    }
  }

  private async submitPrechat(name: string, email: string, topic: string | null): Promise<void> {
    // Konu ön-formda seçilir ama İLK KONUŞMA AÇILIRKEN gönderilir: ziyaretçi
    // formu doldurup hiç yazmadan kapatabilir, o hâlde açılmış bir konuşma da
    // olmaz.
    this.topic = topic;

    const ok = await this.session({ name: name || undefined, email: email || undefined });
    if (ok) this.enterChat();
    else this.ui?.setBanner(this.t.unavailable, true);
  }

  private newChat(): void {
    this.ratingMode = null;
    this.store.setConversation(null);
    this.enterChat();
    if (!this.store.isOpen) this.open();
  }

  private endChat(): void {
    if (!this.ui || !this.store.conversation) return;
    this.ratingMode = 'end';
    this.ui.setEndVisible(false);
    this.ui.showRating();
  }

  private async rate(stars: number, comment: string): Promise<void> {
    const c = this.store.conversation;
    const mode = this.ratingMode;
    this.ratingMode = null;
    if (!c || !this.ui) return;

    if (stars > 0) {
      const r = await this.api.post(`${CONV}/${c.id}/rate`, { rating: stars, comment: comment || undefined });
      this.check(r);
      this.store.markRated(c.id);
    }

    if (mode === 'end') {
      const r = await this.api.post(`${CONV}/${c.id}/close`);
      this.check(r);
      if (this.store.conversation?.id === c.id) {
        this.store.setConversation({ ...c, status: 'closed' });
      }
      this.ui.showThanks();
      return;
    }

    // resolved: puan verildi/atlandı → paneli kapat, sohbet görünümüne dön
    if (stars === 0) this.store.markRated(c.id); // bir daha sorma
    this.enterChat();
    this.close();
  }

  // ── Oturum ve konuşma ────────────────────────────────────────────────

  private async session(identity: { name?: string; email?: string; external_id?: string } = {}): Promise<boolean> {
    const r = await this.api.post<{ visitor: Visitor }>('/v1/sdk/chat/session', {
      ...identity,
      locale: this.locale,
      page_url: location.href,
      user_agent: navigator.userAgent,
    });

    if (r.ok && r.data?.visitor) {
      const v = r.data.visitor;
      if (!v.secret && !this.store.visitor) {
        // Sunucu sırrı yalnız oluşturma anında döner; elimizde de yoksa
        // ziyaretçiyi asla doğrulayamayız — sırsız devam etmenin anlamı yok.
        this.log('session returned no secret');
        return false;
      }
      this.store.setVisitor(v);
      return true;
    }

    // Sır geçersizse temizleyip bir kez daha (yeni ziyaretçi) dene.
    if (!r.ok && r.code === 'VISITOR_INVALID' && this.store.visitor) {
      this.store.clearVisitor();
      return this.session(identity);
    }

    this.check(r);
    return false;
  }

  private async loadConversation(): Promise<void> {
    const c = this.store.conversation;
    if (!c) return;
    const r = await this.api.get<ConversationPayload>(`${CONV}/${c.id}`, { limit: 50 });
    if (!this.applyPayload(r, true)) return;
    if (this.store.isOpen && !document.hidden) this.store.setUnread(0);
  }

  /** Sunucu yanıtını duruma işler; yeni ajan mesajı sayısını döner (hata: -1). */
  private applyPayload(r: ApiResult<ConversationPayload>, replace: boolean): number {
    if (!r.ok) {
      this.check(r);
      if (r.status === 404) this.store.setConversation(null);
      return -1;
    }
    const d = r.data;
    if (d.conversation) {
      const prevStatus = this.store.conversation?.status;
      this.store.conversation = d.conversation;
      if (prevStatus !== d.conversation.status) this.store.emit('change');
    }
    if (d.agent !== undefined) this.store.agent = d.agent || null;
    this.store.agentTyping = !!d.agent_typing;
    this.ui?.setHeader(this.store.agent, this.store.online);
    this.ui?.setTyping(this.store.agentTyping, this.store.agent?.name || this.t.agent);
    return this.store.mergeMessages(d.messages || [], replace);
  }

  private async tick(): Promise<boolean> {
    if (!this.started || !this.store.visitor) return false;
    this.pollCount++;
    const c = this.store.conversation;

    if (this.store.isOpen && c) {
      // Açık panel: yeni mesajlar; her 5. turda tam liste (tepki/düzenleme/okundu tazelensin)
      const full = this.pollCount % 5 === 0;
      const after = full ? undefined : this.store.lastServerMessageId || undefined;
      const r = await this.api.get<ConversationPayload>(`${CONV}/${c.id}`, after ? { after } : { limit: 50 });
      const fresh = this.applyPayload(r, !after);
      if (fresh > 0) {
        if (document.hidden) {
          this.store.setUnread(this.store.unread + fresh);
          if (this.settings?.sound) beep();
        } else {
          void this.markRead();
        }
      }
      return fresh > 0;
    }

    // Kapalı panel ya da konuşma yok: ucuz özet listesi
    if (this.store.isOpen && !c && this.pollCount % 10 !== 0) return false;
    const r = await this.api.get<unknown>(CONV);
    if (!r.ok) {
      this.check(r);
      return false;
    }
    const raw: any = r.data;
    const items: Conversation[] = Array.isArray(raw) ? raw : raw?.conversations || raw?.data || [];
    const open = items.find((x) => x.status === 'open') || items[0] || null;
    const unread = items.reduce((sum, x) => sum + (x.visitor_unread || 0), 0);
    const grew = unread > this.store.unread;

    if (open && open.id !== this.store.conversation?.id) {
      this.store.setConversation(open);
      if (this.store.isOpen) void this.loadConversation();
    }
    if (!this.store.isOpen || document.hidden) {
      this.store.setUnread(unread);
      if (grew && this.settings?.sound) beep();
    }
    return grew;
  }

  private async markRead(): Promise<void> {
    const c = this.store.conversation;
    const last = this.store.lastServerMessageId;
    if (!c || !last) return;
    this.store.setUnread(0);
    await this.api.post(`${CONV}/${c.id}/read`, { last_message_id: last }, true);
  }

  // ── Gönderim ─────────────────────────────────────────────────────────

  private async send(text: string, files: File[], replyTo: Message | null, clientId = uuid()): Promise<void> {
    const local: Message = {
      id: `local_${clientId}`,
      client_id: clientId,
      sender_type: 'visitor',
      type: files.length ? (files[0].type.startsWith('image/') ? 'image' : 'file') : 'text',
      body: text || null,
      attachments: null,
      reply_to_id: replyTo?.id || null,
      created_at: new Date().toISOString(),
      _pending: true,
      _files: files,
    };
    this.pendingSends.set(clientId, { text, files, replyTo: replyTo?.id || null });
    this.store.upsertMessage(local);

    const fail = () => {
      const m = this.store.find(local.id);
      if (m) this.store.upsertMessage({ ...m, _pending: false, _failed: true });
    };

    try {
      if (!this.store.visitor && !(await this.session())) return fail();

      let c = this.store.conversation;
      const needNew = !c || c.status !== 'open';

      // Metin-yalnız ilk mesaj: konuşma + mesaj tek çağrıda
      if (needNew && files.length === 0) {
        const r = await this.api.post<ConversationPayload>(CONV, {
          body: text,
          page_url: location.href,
          client_id: clientId,
          ...(this.topic ? { topic: this.topic } : {}),
        });
        if (!r.ok) return this.sendFailed(r, fail);
        this.store.setConversation(r.data.conversation);
        this.store.mergeMessages(r.data.messages || []);
        this.reconcile(local, r.data.messages);
        this.pendingSends.delete(clientId);
        this.poller.poke(3000);
        return;
      }

      if (needNew) {
        const r = await this.api.post<ConversationPayload>(CONV, {
          page_url: location.href,
          ...(this.topic ? { topic: this.topic } : {}),
        });
        if (!r.ok) return this.sendFailed(r, fail);
        this.store.setConversation(r.data.conversation);
        this.store.mergeMessages(r.data.messages || []);
        c = r.data.conversation;
      }
      if (!c) return fail();

      const attachments = [];
      for (const f of files) {
        const up = await this.api.upload<any>(`${CONV}/${c.id}/attachments`, f);
        if (!up.ok) return this.sendFailed(up, fail);
        attachments.push(up.data);
      }

      const r = await this.api.post<Message>(`${CONV}/${c.id}/messages`, {
        body: text || undefined,
        attachments: attachments.length ? attachments : undefined,
        reply_to_id: replyTo?.id || undefined,
        client_id: clientId,
      });
      if (!r.ok) return this.sendFailed(r, fail);
      const msg: Message = (r.data as any)?.message || r.data;
      this.reconcile(local, [msg]);
      this.pendingSends.delete(clientId);
      this.poller.poke(3000);
    } catch (e) {
      this.log('send error', e);
      fail();
    }
  }

  /** Sunucu mesajı `client_id` taşımıyorsa yerel kopyayı elle değiştir. */
  private reconcile(local: Message, serverMessages: Message[] | undefined): void {
    const match = (serverMessages || []).find((m) => m.client_id === local.client_id);
    if (match) {
      this.store.mergeMessages([{ ...match, client_id: local.client_id }]);
    } else if (serverMessages && serverMessages.length) {
      this.store.removeMessage(local.id);
      this.store.mergeMessages(serverMessages);
    }
  }

  private sendFailed(r: Extract<ApiResult<unknown>, { ok: false }>, fail: () => void): void {
    this.check(r);
    if (r.code === 'CHAT_UNAVAILABLE' || r.status === 503) {
      this.ui?.setBanner(this.t.unavailable, true);
    }
    fail();
  }

  private async retry(m: Message): Promise<void> {
    const p = m.client_id ? this.pendingSends.get(m.client_id) : null;
    this.store.removeMessage(m.id);
    if (!p || !m.client_id) return;
    await this.send(p.text, p.files, this.store.find(p.replyTo) || null, m.client_id);
  }

  private async typing(active: boolean): Promise<void> {
    const c = this.store.conversation;
    if (!c || c.status !== 'open' || !this.store.visitor) return;
    const now = Date.now();
    if (active && now - this.lastTypingSent < 4000) return;
    this.lastTypingSent = active ? now : 0;
    await this.api.post(`${CONV}/${c.id}/typing`, { is_typing: active }, true);
  }

  private async react(m: Message, emoji: string): Promise<void> {
    const c = this.store.conversation;
    if (!c) return;
    // İyimser: yerelde aç/kapat, sunucu yanıtı gelince onunla ez
    const reactions = { ...(m.reactions || {}) };
    const users = [...(reactions[emoji] || [])];
    const idx = users.indexOf('visitor');
    if (idx >= 0) users.splice(idx, 1);
    else users.push('visitor');
    reactions[emoji] = users;
    this.store.upsertMessage({ ...m, reactions });

    const r = await this.api.post<any>(`${CONV}/${c.id}/messages/${m.id}/reactions`, { emoji });
    if (!r.ok) {
      this.check(r);
      this.store.upsertMessage({ ...m });
      return;
    }
    const server = r.data?.message?.reactions ?? r.data?.reactions;
    if (server) this.store.upsertMessage({ ...m, reactions: server });
  }

  private async saveEdit(m: Message, body: string): Promise<void> {
    const c = this.store.conversation;
    if (!c) return;
    this.store.upsertMessage({ ...m, body, edited_at: new Date().toISOString() });
    const r = await this.api.patch<any>(`${CONV}/${c.id}/messages/${m.id}`, { body });
    if (!r.ok) {
      this.check(r);
      this.store.upsertMessage({ ...m });
      return;
    }
    const server: Message = r.data?.message || r.data;
    if (server && server.id) this.store.upsertMessage(server);
  }

  private async remove(m: Message): Promise<void> {
    const c = this.store.conversation;
    if (!c) return;
    this.store.upsertMessage({ ...m, deleted_at: new Date().toISOString() });
    const r = await this.api.delete(`${CONV}/${c.id}/messages/${m.id}`);
    if (!r.ok) {
      this.check(r);
      this.store.upsertMessage({ ...m });
    }
  }

  /** Ortak hata işleme: geçersiz sır → yerel kimliği sil, ön-forma dön. */
  private check(r: ApiResult<unknown>): void {
    if (r.ok) return;
    if (r.code === 'VISITOR_INVALID' || (r.status === 401 && this.store.visitor)) {
      this.store.clearVisitor();
      if (this.store.isOpen) this.decideView();
    }
  }
}
