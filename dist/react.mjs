import { createContext, useMemo, createElement, useContext, useRef, useState, useEffect } from 'react';

// src/react/index.ts

// src/app/client.ts
var DEFAULT_BASE_URL = "https://signalbird.io/api";
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
    if (!config?.appKey) {
      throw new Error("Signalbird: appKey zorunlu (sbw_pub_\u2026).");
    }
    if (!config.appKey.startsWith("sbw_pub_")) {
      throw new Error(
        "Signalbird: uygulama istemcisi a\xE7\u0131k uygulama anahtar\u0131 ister (sbw_pub_\u2026). Tak\u0131m anahtar\u0131n\u0131 (sb_\u2026) istemci koduna KOYMAYIN."
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
        appKey: this.config.appKey,
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
      "X-Signalbird-App-Key": this.config.appKey
    };
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
      if (!parsed?.secret || parsed.appKey !== this.config.appKey) return null;
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

// src/app/session.ts
var IDLE_LADDER = [2e4, 2e4, 2e4, 6e4, 6e4, 18e4];
var ACTIVE_INTERVAL = 3e3;
var ChatSession = class {
  constructor(app, options = {}) {
    this.app = app;
    this.options = options;
    this.state = {
      enabled: false,
      loading: true,
      conversation: null,
      messages: [],
      unread: 0,
      agentTyping: false,
      withinHours: true
    };
    this.listeners = /* @__PURE__ */ new Set();
    this.timer = null;
    this.step = 0;
    this.stopped = false;
    this.polling = false;
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
    const app = boot.data?.app;
    if (!boot.ok || !app?.chat_enabled) {
      this.patch({ enabled: false, loading: false, errorCode: boot.code });
      return;
    }
    this.patch({ enabled: true, withinHours: app.within_hours ?? true });
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
    if (active) void this.refresh();
    this.schedule();
  }
  stop() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
  // ── Eylemler ──────────────────────────────────────────────────────────
  /** Ön-form gönderildiğinde ya da uygulama kullanıcıyı tanıdığında. */
  async openSession(input) {
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
    }
    const conversation = this.state.conversation;
    const result = conversation ? await this.app.sendMessage(conversation.id, { body: trimmed, client_id: cid, attachments }) : await this.app.startConversation({ body: trimmed, client_id: cid, attachments });
    if (!result.ok) return this.markFailed(cid, result);
    await this.refresh();
    this.step = 0;
    this.schedule();
    return result;
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
      const first = list.data?.data?.[0];
      if (!first) {
        this.patch({ errorCode: list.ok ? void 0 : list.code });
        return;
      }
      const detail2 = await this.app.getConversation(first.id);
      this.applyConversation(detail2.data?.conversation ?? first, true);
      return;
    }
    const after = this.lastServerMessageId();
    const detail = await this.app.getConversation(current.id, after ? { after } : void 0);
    if (!detail.ok || !detail.data?.conversation) {
      this.patch({ errorCode: detail.code });
      return;
    }
    this.applyConversation(detail.data.conversation, !after);
  }
  // ── İç işler ──────────────────────────────────────────────────────────
  applyConversation(conversation, replace) {
    const incoming = conversation.messages ?? [];
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
  schedule() {
    if (this.timer) clearTimeout(this.timer);
    if (this.stopped) return;
    const delay = this.active ? ACTIVE_INTERVAL : IDLE_LADDER[Math.min(this.step, IDLE_LADDER.length - 1)];
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

// src/react/index.ts
var AppContext = createContext(null);
function SignalbirdProvider({ children, ...config }) {
  const client = useMemo(() => new SignalbirdApp(config), [config.appKey, config.baseUrl, config.locale]);
  return createElement(AppContext.Provider, { value: client }, children);
}
function useSignalbird() {
  const client = useContext(AppContext);
  if (!client) {
    throw new Error("useSignalbird: <SignalbirdProvider> i\xE7inde kullan\u0131lmal\u0131.");
  }
  return client;
}
function useChat(options = {}) {
  const client = useSignalbird();
  const sessionRef = useRef(null);
  if (!sessionRef.current) {
    sessionRef.current = new ChatSession(client, { active: options.open, visitor: options.visitor });
  }
  const session = sessionRef.current;
  const [state, setState] = useState(session.snapshot());
  useEffect(() => {
    const unsubscribe = session.subscribe(setState);
    void session.start();
    return () => {
      unsubscribe();
      session.stop();
    };
  }, [session]);
  useEffect(() => {
    session.setActive(!!options.open);
  }, [session, options.open]);
  return {
    ...state,
    send: (body, attachments) => session.send(body, attachments),
    typing: (isTyping) => session.typing(isTyping),
    markRead: () => session.markRead(),
    close: (rating, comment) => session.close(rating, comment),
    openSession: (input) => session.openSession(input),
    refresh: () => session.refresh()
  };
}
function useUnreadCount() {
  const { unread } = useChat({ open: false });
  return unread;
}
function useIdentify(input) {
  const client = useSignalbird();
  const key = input ? JSON.stringify(input) : "";
  useEffect(() => {
    if (!input) return;
    void client.identify(input);
  }, [client, key]);
}
function usePushRegistration(input) {
  const client = useSignalbird();
  useEffect(() => {
    if (!input?.token) return;
    void client.registerDevice(input);
  }, [client, input?.token, input?.external_id]);
}

export { SignalbirdProvider, useChat, useIdentify, usePushRegistration, useSignalbird, useUnreadCount };
//# sourceMappingURL=react.mjs.map
//# sourceMappingURL=react.mjs.map