'use strict';

var vue = require('vue');

// src/vue/index.ts

// src/app/client.ts
var DEFAULT_BASE_URL = "https://live.signalbird.io/api";
var STORAGE_KEY = "sb_visitor";
function defaultStorage() {
  try {
    if (typeof localStorage !== "undefined") {
      return {
        getItem: (k) => localStorage.getItem(k),
        setItem: (k, v) => localStorage.setItem(k, v),
        removeItem: (k) => localStorage.removeItem(k)
      };
    }
  } catch {
  }
  const memory = /* @__PURE__ */ new Map();
  return {
    getItem: (k) => memory.get(k) ?? null,
    setItem: (k, v) => void memory.set(k, v),
    removeItem: (k) => void memory.delete(k)
  };
}
function clientId() {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
  }
  return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
var SignalbirdApp = class {
  constructor(config) {
    this.config = config;
    this.visitor = null;
    this.loaded = false;
    if (!config?.publicKey) {
      throw new Error("Signalbird: publicKey zorunlu (sb_public_live_\u2026).");
    }
    if (!config.publicKey.startsWith("sb_public_live_")) {
      throw new Error(
        "Signalbird: uygulama istemcisi a\xE7\u0131k domain anahtar\u0131 ister (sb_public_live_\u2026). Tak\u0131m anahtar\u0131n\u0131 (sb_\u2026) istemci koduna KOYMAYIN."
      );
    }
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.storage = config.storage ?? defaultStorage();
    this.timeout = config.timeout ?? 1e4;
    this.doFetch = config.fetchImpl ?? ((...args) => fetch(...args));
  }
  // ── Kimlik ────────────────────────────────────────────────────────────
  /** Uygulama ayarları: sohbet açık mı, renk, çalışma saati, ön-form. */
  bootstrap() {
    return this.request("POST", "/v1/sdk/bootstrap", { locale: this.config.locale });
  }
  /**
   * Canlı bağlantı kanalı için imza.
   *
   * Ziyaretçinin oturumu yoktur; hangi kanalı dinleyebileceğine SUNUCU karar
   * verir ve yalnız kendi `visitor.<id>` kanalını imzalar. Soket servisi
   * kimseyi tanımaz, yalnız imzayı doğrular.
   */
  socketAuth(socketId, channel) {
    return this.request("POST", "/v1/sdk/chat/socket/auth", { socket_id: socketId, channel });
  }
  /**
   * Ziyaretçi oturumu açar ya da mevcut olanı günceller.
   *
   * Sır saklanır; ikinci çağrı aynı ziyaretçiyi tazeler. Sunucu `VISITOR_INVALID`
   * derse yerel kimlik silinir ve bir sonraki çağrı yeni oturum açar.
   */
  async startSession(input = {}) {
    const result = await this.request("POST", "/v1/sdk/chat/session", input);
    const visitor = result.data?.visitor;
    if (result.ok && visitor?.id && visitor.secret) {
      await this.storeVisitor({
        id: visitor.id,
        secret: visitor.secret,
        publicKey: this.config.publicKey,
        name: visitor.name ?? null,
        email: visitor.email ?? null
      });
    }
    return result;
  }
  /** Oturum açmış kullanıcıyı ziyaretçiye bağlar (kişi kaydı upsert edilir). */
  identify(input) {
    return this.request("POST", "/v1/sdk/identify", input);
  }
  /** Saklanan ziyaretçi kimliği — yoksa `null`. */
  async currentVisitor() {
    const stored = await this.loadVisitor();
    return stored ? { id: stored.id, name: stored.name, email: stored.email } : null;
  }
  /** Yerel kimliği siler: çıkış yapıldığında çağrılır. Sunucudaki kayıt kalır. */
  async signOut() {
    this.visitor = null;
    this.loaded = true;
    await this.storage.removeItem(STORAGE_KEY);
  }
  // ── Sohbet ────────────────────────────────────────────────────────────
  listConversations() {
    return this.request("GET", "/v1/sdk/chat/conversations");
  }
  getConversation(id, query) {
    return this.request("GET", `/v1/sdk/chat/conversations/${enc(id)}`, void 0, query);
  }
  /**
   * İlk mesajla konuşma açar. Kota burada harcanır — konuşma başına sayılır,
   * mesaj başına değil.
   */
  startConversation(input) {
    return this.request("POST", "/v1/sdk/chat/conversations", {
      client_id: clientId(),
      ...this.config.platform ? { source: this.config.platform } : {},
      ...input
    });
  }
  sendMessage(conversationId, input) {
    return this.request("POST", `/v1/sdk/chat/conversations/${enc(conversationId)}/messages`, {
      client_id: clientId(),
      ...input
    });
  }
  /** Yalnız kendi mesajı ve gönderimden sonraki 15 dakika içinde. */
  editMessage(conversationId, messageId, body) {
    return this.request(
      "PATCH",
      `/v1/sdk/chat/conversations/${enc(conversationId)}/messages/${enc(messageId)}`,
      { body }
    );
  }
  deleteMessage(conversationId, messageId) {
    return this.request(
      "DELETE",
      `/v1/sdk/chat/conversations/${enc(conversationId)}/messages/${enc(messageId)}`
    );
  }
  /** Aynı emoji ikinci kez gönderilirse tepki kaldırılır. */
  reactToMessage(conversationId, messageId, emoji) {
    return this.request(
      "POST",
      `/v1/sdk/chat/conversations/${enc(conversationId)}/messages/${enc(messageId)}/reactions`,
      { emoji }
    );
  }
  setTyping(conversationId, isTyping) {
    return this.request("POST", `/v1/sdk/chat/conversations/${enc(conversationId)}/typing`, {
      is_typing: isTyping
    });
  }
  markRead(conversationId, lastMessageId) {
    return this.request("POST", `/v1/sdk/chat/conversations/${enc(conversationId)}/read`, {
      last_message_id: lastMessageId
    });
  }
  /**
   * Ek dosya yükler; dönen tanımlayıcı `sendMessage`'a `attachments` içinde
   * verilir. İki adım olmasının sebebi: dosya yüklenirken mesaj metni hâlâ
   * yazılıyor olabilir ve yarım kalan yükleme mesaj kaydı yaratmamalı.
   */
  uploadAttachment(conversationId, file, fileName) {
    const form = new FormData();
    form.append("file", file, fileName);
    return this.request(
      "POST",
      `/v1/sdk/chat/conversations/${enc(conversationId)}/attachments`,
      form
    );
  }
  closeConversation(conversationId) {
    return this.request("POST", `/v1/sdk/chat/conversations/${enc(conversationId)}/close`);
  }
  rateConversation(conversationId, rating, comment) {
    return this.request("POST", `/v1/sdk/chat/conversations/${enc(conversationId)}/rate`, {
      rating,
      comment
    });
  }
  // ── Push ──────────────────────────────────────────────────────────────
  /**
   * Cihaz token'ını kaydeder. Token'ı almak (FCM/APNs/Web Push izni) ev
   * sahibinin işidir; SDK yalnız iletir — izin diyaloğunu kimin, ne zaman
   * göstereceği ürün kararıdır, kütüphane kararı değil.
   */
  registerDevice(input) {
    return this.request("POST", "/v1/sdk/devices", input);
  }
  /** Çıkışta çağrılır: kayıt silinmez, kapatılır (geçmiş korunur). */
  unregisterDevice(token) {
    return this.request("DELETE", `/v1/sdk/devices/${enc(token)}`);
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
  reportPushOpened(messageId) {
    return this.request("POST", "/v1/sdk/push/opened", { message_id: messageId });
  }
  // ── HTTP ──────────────────────────────────────────────────────────────
  async request(method, path, body, query) {
    const stored = await this.loadVisitor();
    const isForm = typeof FormData !== "undefined" && body instanceof FormData;
    const headers = {
      Accept: "application/json",
      "X-Signalbird-Key": this.config.publicKey
    };
    const moduleKey = path.startsWith("/v1/sdk/devices") || path.startsWith("/v1/sdk/push") ? this.config.pushKey : this.config.chatKey;
    if (moduleKey) headers["X-Signalbird-Module-Key"] = moduleKey;
    if (stored?.secret) headers["X-Signalbird-Visitor"] = stored.secret;
    if (body !== void 0 && !isForm) headers["Content-Type"] = "application/json";
    if (this.config.locale) headers["X-Locale"] = this.config.locale;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);
    try {
      const response = await this.doFetch(this.baseUrl + path + buildQuery(query), {
        method,
        headers,
        body: body === void 0 ? void 0 : isForm ? body : JSON.stringify(body),
        signal: controller.signal
      });
      const text = await response.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = text;
      }
      if (response.ok) {
        return { ok: true, status: response.status, data };
      }
      const code = data && typeof data === "object" && typeof data.code === "string" && data.code || (response.status === 422 ? "VALIDATION_ERROR" : `HTTP_${response.status}`);
      if (code === "VISITOR_INVALID" || response.status === 401) {
        await this.signOut();
      }
      if (this.config.debug) {
        console.warn(`[signalbird] ${code} (HTTP ${response.status})`);
      }
      return {
        ok: false,
        status: response.status,
        code,
        message: data && typeof data === "object" && typeof data.message === "string" && data.message || `HTTP ${response.status}`,
        data
      };
    } catch (error) {
      const timedOut = error instanceof Error && error.name === "AbortError";
      if (this.config.debug) {
        console.warn("[signalbird] ula\u015F\u0131lamad\u0131:", error);
      }
      return {
        ok: false,
        status: 0,
        code: timedOut ? "TIMEOUT" : "NETWORK_ERROR",
        message: error instanceof Error ? error.message : "network error"
      };
    } finally {
      clearTimeout(timer);
    }
  }
  async loadVisitor() {
    if (this.loaded) return this.visitor;
    this.loaded = true;
    try {
      const raw = await this.storage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed?.secret || parsed.publicKey !== this.config.publicKey) return null;
      this.visitor = parsed;
    } catch {
      this.visitor = null;
    }
    return this.visitor;
  }
  async storeVisitor(visitor) {
    this.visitor = visitor;
    this.loaded = true;
    try {
      await this.storage.setItem(STORAGE_KEY, JSON.stringify(visitor));
    } catch {
    }
  }
};
function enc(value) {
  return encodeURIComponent(value);
}
function buildQuery(query) {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === void 0 || value === null) continue;
    params.append(key, String(value));
  }
  const encoded = params.toString();
  return encoded ? `?${encoded}` : "";
}

// src/shared/socket.ts
var BACKOFF = [1e3, 2e3, 5e3, 1e4, 3e4];
var Socket = class {
  constructor(config, auth, onEvent, onState, log = () => {
  }) {
    this.config = config;
    this.auth = auth;
    this.onEvent = onEvent;
    this.onState = onState;
    this.log = log;
    this.ws = null;
    this.sid = null;
    this.attempt = 0;
    this.closed = false;
    this.timer = null;
    this.pending = /* @__PURE__ */ new Set();
    this.joined = /* @__PURE__ */ new Set();
  }
  get connected() {
    return this.ws?.readyState === WebSocket.OPEN && this.sid !== null;
  }
  connect() {
    if (!this.config.enabled || !this.config.url) return;
    if (typeof WebSocket === "undefined") return;
    if (this.ws) return;
    this.closed = false;
    const base = this.config.url.replace(/^http/, "ws").replace(/\/$/, "");
    const url = `${base}/socket.io/?EIO=4&transport=websocket`;
    try {
      this.ws = new WebSocket(url);
    } catch (e) {
      this.log("socket open failed", e);
      this.retry();
      return;
    }
    this.ws.onmessage = (ev) => this.handle(String(ev.data));
    this.ws.onclose = () => this.retry();
    this.ws.onerror = () => {
      this.log("socket error");
    };
  }
  /** Kanala abone ol. Bağlantı yoksa kuyruğa alınır, kurulunca gönderilir. */
  subscribe(channel) {
    if (this.joined.has(channel) || this.pending.has(channel)) return;
    this.pending.add(channel);
    if (this.connected) void this.flush();
  }
  close() {
    this.closed = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.joined.clear();
    try {
      this.ws?.close();
    } catch {
    }
    this.ws = null;
    this.sid = null;
  }
  // ── Protokol ─────────────────────────────────────────────────────────
  handle(frame) {
    const type = frame[0];
    if (type === "0") {
      this.send("40");
      return;
    }
    if (type === "2") {
      this.send("3");
      return;
    }
    if (type !== "4") return;
    const sub = frame[1];
    const body = frame.slice(2);
    if (sub === "0") {
      try {
        this.sid = String(JSON.parse(body || "{}").sid || "");
      } catch {
        this.sid = "";
      }
      this.attempt = 0;
      this.onState(true);
      void this.flush();
      return;
    }
    if (sub === "2") {
      let parsed;
      try {
        parsed = JSON.parse(body);
      } catch {
        return;
      }
      if (!Array.isArray(parsed)) return;
      const [name, data] = parsed;
      if (typeof name === "string" && name.startsWith("chat.")) {
        this.onEvent({ name, data: data ?? {} });
      }
    }
  }
  /**
   * Bekleyen kanallar için imza al ve `subscribe` yolla.
   *
   * İmza her BAĞLANTIDA yeniden alınır: `socket_id`e bağlı ve zaman damgalı.
   * Saklamak, ikinci bağlantıda sessizce reddedilmek demekti.
   */
  async flush() {
    const sid = this.sid;
    if (!sid) return;
    for (const channel of Array.from(this.pending)) {
      try {
        const signed = await this.auth(sid, channel);
        if (!signed) {
          this.pending.delete(channel);
          continue;
        }
        this.emit("subscribe", { channel, auth: signed.auth, at: signed.at });
        this.pending.delete(channel);
        this.joined.add(channel);
      } catch (e) {
        this.log("subscribe failed", channel, e);
      }
    }
  }
  /**
   * Olay yolla — ACK İSTEMEDEN.
   *
   * `subscribe`in sonucunu beklemek bir tur daha protokol yönetmek demekti;
   * oysa sonucu zaten davranıştan görüyoruz: imza tutmadıysa yayın gelmez ve
   * polling merdiveni işini yapmaya devam eder.
   */
  emit(event, payload) {
    this.send(`42${JSON.stringify([event, payload])}`);
  }
  send(frame) {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    try {
      this.ws.send(frame);
    } catch {
    }
  }
  retry() {
    this.ws = null;
    this.sid = null;
    this.joined.forEach((c) => this.pending.add(c));
    this.joined.clear();
    this.onState(false);
    if (this.closed) return;
    const delay = BACKOFF[Math.min(this.attempt, BACKOFF.length - 1)];
    this.attempt++;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.connect(), delay);
  }
};

// src/app/session.ts
var IDLE_LADDER = [2e4, 2e4, 2e4, 6e4, 6e4, 18e4];
var ACTIVE_INTERVAL = 3e3;
var ACTIVE_LIVE_INTERVAL = 45e3;
var ChatSession = class {
  constructor(app, options = {}) {
    this.app = app;
    this.options = options;
    this.state = {
      enabled: false,
      loading: true,
      topics: [],
      topic: null,
      conversation: null,
      messages: [],
      unread: 0,
      agentTyping: false,
      withinHours: true,
      settings: null
    };
    this.listeners = /* @__PURE__ */ new Set();
    this.timer = null;
    this.step = 0;
    this.stopped = false;
    this.polling = false;
    this.socket = null;
    this.live = false;
    /**
     * Bir sonraki `refresh()` İMLEÇSİZ olsun mu.
     *
     * "Var olan mesaj değişti" haberi geldiğinde açılır: imleçli çekim
     * (`?after=<son mesaj>`) o mesajı bir daha getirmez, dolayısıyla çeviri ya
     * da düzenleme ekrana hiç yansımaz.
     */
    this.forceFull = false;
    this.active = options.active ?? false;
  }
  // ── Abonelik ──────────────────────────────────────────────────────────
  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }
  snapshot() {
    return this.state;
  }
  // ── Yaşam döngüsü ─────────────────────────────────────────────────────
  /** Bootstrap + varsa mevcut konuşmayı yükler, sonra yoklamayı başlatır. */
  async start() {
    this.stopped = false;
    const boot = await this.app.bootstrap();
    const app = boot.data?.channel ?? boot.data?.app;
    if (!boot.ok || !app?.chat_enabled) {
      this.patch({ enabled: false, loading: false, errorCode: boot.code });
      return;
    }
    this.patch({
      enabled: true,
      withinHours: app.within_hours ?? true,
      topics: boot.data?.topics ?? [],
      settings: app.chat ?? null
    });
    this.openSocket(boot.data?.realtime);
    if (await this.app.currentVisitor()) {
      await this.refresh();
    }
    this.patch({ loading: false });
    this.schedule();
  }
  /** Panel açıldı/kapandı — yoklama hızı buna göre değişir. */
  setActive(active) {
    if (this.active === active) return;
    this.active = active;
    this.step = 0;
    if (active) {
      if (this.state.conversation?.status === "closed") this.reset();
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
  reset() {
    this.patch({ conversation: null, messages: [], unread: 0, agentTyping: false, errorCode: void 0 });
    this.step = 0;
  }
  stop() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.socket?.close();
    this.socket = null;
    this.live = false;
  }
  /** Canlı bağlantı kurulu mu — arayüz isterse gösterir (zorunlu değil). */
  get isLive() {
    return this.live;
  }
  // ── Eylemler ──────────────────────────────────────────────────────────
  /** Ön-form gönderildiğinde ya da uygulama kullanıcıyı tanıdığında. */
  async openSession(input) {
    const result = await this.app.startSession(input);
    if (result.ok) {
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
  async send(body, attachments) {
    const trimmed = body.trim();
    if (!trimmed && !attachments?.length) {
      return { ok: false, status: 0, code: "EMPTY_BODY", message: "Mesaj bo\u015F." };
    }
    const cid = clientId();
    const optimistic = {
      id: cid,
      client_id: cid,
      sender_type: "visitor",
      body: trimmed,
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.patch({ messages: [...this.state.messages, optimistic] });
    if (!await this.app.currentVisitor()) {
      const session = await this.app.startSession(this.options.visitor ?? {});
      if (!session.ok) return this.markFailed(cid, session);
      void this.joinVisitorChannel();
    }
    const conversation = this.state.conversation;
    const result = conversation ? await this.app.sendMessage(conversation.id, { body: trimmed, client_id: cid, attachments }) : await this.app.startConversation({
      body: trimmed,
      client_id: cid,
      attachments,
      ...this.state.topic ? { topic: this.state.topic } : {}
    });
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
  setTopic(slug) {
    this.patch({ topic: slug });
  }
  /** İlk tuşta `true`, 2.5 s hareketsizlikte `false` — çağıran zamanlar. */
  typing(isTyping) {
    const conversation = this.state.conversation;
    if (!conversation) return;
    void this.app.setTyping(conversation.id, isTyping);
  }
  /** Görülen son mesaja kadar okundu işaretler. */
  async markRead() {
    const conversation = this.state.conversation;
    const last = this.state.messages[this.state.messages.length - 1];
    if (!conversation || !last) return;
    await this.app.markRead(conversation.id, last.id);
    this.patch({ unread: 0 });
  }
  async close(rating, comment) {
    const conversation = this.state.conversation;
    if (!conversation) return;
    if (typeof rating === "number") {
      await this.app.rateConversation(conversation.id, rating, comment);
    }
    await this.app.closeConversation(conversation.id);
    await this.refresh();
  }
  /** Sunucudaki durumu çeker; imleç varsa yalnız yenileri ister. */
  async refresh() {
    const current = this.state.conversation;
    if (!current) {
      const list = await this.app.listConversations();
      const first = (list.data?.data ?? []).find((c) => c.status !== "closed");
      if (!first) {
        this.patch({ errorCode: list.ok ? void 0 : list.code });
        return;
      }
      const detail2 = await this.app.getConversation(first.id);
      this.applyConversation(detail2.data?.conversation ?? first, true, detail2.data?.messages);
      return;
    }
    const after = this.forceFull ? void 0 : this.lastServerMessageId();
    this.forceFull = false;
    const detail = await this.app.getConversation(current.id, after ? { after } : void 0);
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
  applyConversation(conversation, replace, messages) {
    const incoming = messages ?? conversation.messages ?? [];
    const merged = replace ? incoming : mergeMessages(this.state.messages, incoming);
    if (incoming.length) this.step = 0;
    this.patch({
      conversation,
      messages: merged,
      unread: conversation.unread_count ?? 0,
      agentTyping: !!conversation.agent_typing,
      withinHours: conversation.within_hours ?? this.state.withinHours,
      errorCode: void 0
    });
  }
  /** İyimser kayıtlar sunucu kimliği taşımaz; imleç yalnız gerçek kimliktir. */
  lastServerMessageId() {
    for (let i = this.state.messages.length - 1; i >= 0; i--) {
      const message = this.state.messages[i];
      if (message.id && !message.id.startsWith("c_") && message.id !== message.client_id) {
        return message.id;
      }
    }
    return void 0;
  }
  markFailed(cid, result) {
    this.patch({
      messages: this.state.messages.map(
        (m) => m.client_id === cid ? { ...m, failed: true } : m
      ),
      errorCode: result.code
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
  openSocket(realtime) {
    if (!realtime?.enabled || !realtime.url || this.socket) return;
    this.socket = new Socket(
      realtime,
      async (socketId, channel) => {
        const result = await this.app.socketAuth(socketId, channel);
        return result.ok && result.data ? result.data : null;
      },
      (event) => {
        if (event.data.updated === true) this.forceFull = true;
        this.step = 0;
        void this.refresh();
      },
      (connected) => {
        this.live = connected;
        this.schedule();
      }
    );
    this.socket.connect();
    void this.joinVisitorChannel();
  }
  /** Ziyaretçi kimliği varsa kendi kanalına katılır; yoksa sessizce döner. */
  async joinVisitorChannel() {
    const visitor = await this.app.currentVisitor();
    if (visitor?.id) this.socket?.subscribe(`visitor.${visitor.id}`);
  }
  schedule() {
    if (this.timer) clearTimeout(this.timer);
    if (this.stopped) return;
    const delay = this.active ? this.live ? ACTIVE_LIVE_INTERVAL : ACTIVE_INTERVAL : this.live ? IDLE_LADDER[IDLE_LADDER.length - 1] : IDLE_LADDER[Math.min(this.step, IDLE_LADDER.length - 1)];
    this.timer = setTimeout(() => void this.tick(), delay);
  }
  async tick() {
    if (this.stopped || this.polling) return;
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
  visible() {
    if (this.options.isVisible) return this.options.isVisible();
    try {
      if (typeof document !== "undefined" && document.visibilityState) {
        return document.visibilityState === "visible";
      }
    } catch {
    }
    return true;
  }
  patch(partial) {
    this.state = { ...this.state, ...partial };
    for (const listener of this.listeners) {
      try {
        listener(this.state);
      } catch (error) {
        console.warn("[signalbird] dinleyici hatas\u0131:", error);
      }
    }
  }
};
function mergeMessages(existing, incoming) {
  if (!incoming.length) return existing;
  const byKey = /* @__PURE__ */ new Map();
  for (const message of existing) {
    byKey.set(message.client_id ?? message.id, message);
  }
  for (const message of incoming) {
    const key = message.client_id ?? message.id;
    byKey.delete(key);
    byKey.set(key, message);
  }
  return [...byKey.values()].sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""));
}

// src/vue/index.ts
var SIGNALBIRD_KEY = /* @__PURE__ */ Symbol("signalbird");
var signalbirdPlugin = {
  install(app, config) {
    app.provide(SIGNALBIRD_KEY, new SignalbirdApp(config));
  }
};
function useSignalbird() {
  const client = vue.inject(SIGNALBIRD_KEY, null);
  if (!client) {
    throw new Error("useSignalbird: app.use(signalbirdPlugin, { publicKey }) \xE7a\u011Fr\u0131lmad\u0131.");
  }
  return client;
}
function useChat(options = {}) {
  const client = useSignalbird();
  const openRef = isRef(options.open) ? options.open : vue.ref(!!options.open);
  const session = new ChatSession(client, { active: openRef.value, visitor: options.visitor });
  const state = vue.ref(session.snapshot());
  const unsubscribe = session.subscribe((next) => {
    state.value = next;
  });
  void session.start();
  vue.watch(openRef, (open) => session.setActive(!!open));
  if (vue.getCurrentInstance()) {
    vue.onScopeDispose(() => {
      unsubscribe();
      session.stop();
    });
  }
  return {
    state,
    send: (body, attachments) => session.send(body, attachments),
    typing: (isTyping) => session.typing(isTyping),
    markRead: () => session.markRead(),
    close: (rating, comment) => session.close(rating, comment),
    openSession: (input) => session.openSession(input),
    refresh: () => session.refresh(),
    /*
     * Konuşmayı bırakır; sonraki mesaj YENİ bir konuşma açar (29 Ağu 2026).
     * Kapanmış sohbet geri açılmadığı için arayüzün "yeni sohbet" düğmesine
     * bağlanacak bir eyleme ihtiyacı var.
     */
    reset: () => session.reset()
  };
}
function identify(input) {
  return useSignalbird().identify(input);
}
function registerDevice(input) {
  return useSignalbird().registerDevice(input);
}
function isRef(value) {
  return !!value && typeof value === "object" && "value" in value;
}

exports.SIGNALBIRD_KEY = SIGNALBIRD_KEY;
exports.identify = identify;
exports.registerDevice = registerDevice;
exports.signalbirdPlugin = signalbirdPlugin;
exports.useChat = useChat;
exports.useSignalbird = useSignalbird;
//# sourceMappingURL=vue.js.map
//# sourceMappingURL=vue.js.map