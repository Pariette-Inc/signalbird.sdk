'use strict';

var crypto = require('crypto');

// src/node/types.ts
var SECRET_PREFIX = "sb_secret_live_";
var PUBLIC_PREFIX = "sb_public_live_";
var SignalbirdError = class extends Error {
  constructor(message, status, code, body) {
    super(message);
    this.status = status;
    this.code = code;
    this.body = body;
    this.name = "SignalbirdError";
  }
};
var DEFAULT_BASE_URL = "https://live.signalbird.io/api";

// src/node/client.ts
var SignalbirdClient = class {
  constructor(config) {
    this.config = config;
    if (!config.domainKey) {
      throw new SignalbirdError("Signalbird: domainKey zorunlu.", 0, "NO_KEY");
    }
    if (config.domainKey.startsWith(PUBLIC_PREFIX)) {
      throw new SignalbirdError(
        "Signalbird: sunucu istemcisine A\xC7IK anahtar (sb_public_live_\u2026) verildi. Gizli anahtar\u0131 (sb_secret_live_\u2026) kullan\u0131n; a\xE7\u0131k anahtar taray\u0131c\u0131 i\xE7indir.",
        0,
        "WRONG_KEY_TYPE"
      );
    }
    if (!config.domainKey.startsWith(SECRET_PREFIX)) {
      throw new SignalbirdError(
        "Signalbird: anahtar bi\xE7imi tan\u0131nmad\u0131. Gizli domain anahtar\u0131 `sb_secret_live_` ile ba\u015Flar (Panel \u2192 Alan adlar\u0131 \u2192 Anahtarlar).",
        0,
        "WRONG_KEY_TYPE"
      );
    }
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.timeout = config.timeout ?? 5e3;
    this.throwOnError = config.throwOnError ?? false;
    this.debug = config.debug ?? process.env.NODE_ENV !== "production";
    this.source = config.source;
  }
  /**
   * Kanalı bağlar ve yazacı döner.
   *
   *     signalbird().radio('penyuCritical').error('Ödeme düğümü öldü', ctx)
   *
   * Kanal adını her satırda tekrar etmemek için; `log()`'un kısaltmasıdır.
   * Sözdizimi şekeridir, yeni bir yüzey değil.
   */
  radio(key) {
    return {
      log: (message, level, context) => this.log({ key, message, level, context }),
      debug: (message, context) => this.debugLog(key, message, context),
      info: (message, context) => this.info(key, message, context),
      warn: (message, context) => this.warn(key, message, context),
      error: (message, context) => this.error(key, message, context),
      critical: (message, context) => this.critical(key, message, context)
    };
  }
  /** Tek kayıt gönderir. */
  async log(input) {
    return this.send("/v1/radio/log", {
      key: input.key,
      message: input.message,
      level: input.level,
      context: input.context,
      source: input.source ?? this.source
    });
  }
  /**
   * Toplu gönderim — 100 kayda kadar.
   *
   * Kısmi başarı normaldir (kota tam ortada dolabilir), o yüzden sonuç tek bir
   * durum değil satır satır döner.
   */
  async batch(events) {
    const payload = {
      events: events.slice(0, 100).map((event) => ({
        key: event.key,
        message: event.message,
        level: event.level,
        context: event.context,
        source: event.source ?? this.source
      }))
    };
    const response = await this.request("/v1/radio/log/batch", payload);
    if (!response) {
      return { accepted: 0, total: events.length, results: {} };
    }
    const results = {};
    for (const [index, row] of Object.entries(response.body?.results ?? {})) {
      const value = row;
      results[Number(index)] = { ok: value.ok, eventId: value.event_id, code: value.code };
    }
    return {
      accepted: Number(response.body?.accepted ?? 0),
      total: Number(response.body?.total ?? events.length),
      results
    };
  }
  // ── Seviye kısayolları ────────────────────────────────────────────────
  // İlk argüman MODÜL ANAHTARIDIR (panelde açtığınız kanalın adı), seviye
  // değil: `sb.error('kritikApiHatasi', '…')`.
  debugLog(key, message, context) {
    return this.log({ key, message, level: "debug", context });
  }
  info(key, message, context) {
    return this.log({ key, message, level: "info", context });
  }
  warn(key, message, context) {
    return this.log({ key, message, level: "warn", context });
  }
  error(key, message, context) {
    return this.log({ key, message, level: "error", context });
  }
  critical(key, message, context) {
    return this.log({ key, message, level: "critical", context });
  }
  /**
   * Yakalanmamış hataları Telsiz'e bağlar.
   *
   * Kancayı takıp süreci ÖLDÜRMEYE devam eder: `uncaughtException` sonrası
   * süreci ayakta tutmak, bozuk durumdaki bir uygulamayı çalıştırmaya devam
   * etmek demektir — log göndermek bunu meşrulaştırmaz.
   */
  captureUncaught(key = "critical") {
    const onError = (error) => {
      void this.log({
        key,
        message: error.message,
        level: "critical",
        context: { stack: error.stack?.split("\n").slice(0, 20).join("\n") }
      });
    };
    const onRejection = (reason) => {
      void this.log({
        key,
        message: reason instanceof Error ? reason.message : String(reason),
        level: "error",
        context: reason instanceof Error ? { stack: reason.stack } : void 0
      });
    };
    process.on("uncaughtException", onError);
    process.on("unhandledRejection", onRejection);
    return () => {
      process.off("uncaughtException", onError);
      process.off("unhandledRejection", onRejection);
    };
  }
  async send(path, payload) {
    const response = await this.request(path, payload);
    if (!response) {
      return { ok: false, code: "NETWORK_ERROR" };
    }
    if (!response.ok) {
      const code = response.body?.code ?? "UNKNOWN";
      if (this.throwOnError) {
        throw new SignalbirdError(`Signalbird: ${code}`, response.status, code);
      }
      if (this.debug) {
        console.warn(`[signalbird] g\xF6nderilemedi: ${code} (HTTP ${response.status})`);
      }
      return { ok: false, code, status: response.status };
    }
    return { ok: true, eventId: response.body?.event_id, status: response.status };
  }
  async request(path, payload) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);
    try {
      const response = await fetch(this.baseUrl + path, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          // Kanonik başlık `X-Signalbird-Key`; `Authorization: Bearer` de
          // kabul edilir ama anahtarın bir OAuth jetonu olmadığı açık olsun.
          "X-Signalbird-Key": this.config.domainKey
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      const body = await response.json().catch(() => ({}));
      return { ok: response.ok, status: response.status, body };
    } catch (error) {
      if (this.throwOnError) {
        throw new SignalbirdError(
          error instanceof Error ? error.message : "network error",
          0,
          "NETWORK_ERROR"
        );
      }
      if (this.debug) {
        console.warn("[signalbird] ula\u015F\u0131lamad\u0131:", error);
      }
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
};

// src/node/messaging.ts
var BULK_CHUNK = 1e3;
var SignalbirdMessaging = class {
  constructor(config) {
    if (!config.domainKey) {
      throw new SignalbirdError("Signalbird: domainKey zorunlu.", 0, "NO_KEY");
    }
    if (!config.domainKey.startsWith("sb_secret_live_")) {
      throw new SignalbirdError(
        "Signalbird: bu istemci G\u0130ZL\u0130 domain anahtar\u0131 ister (sb_secret_live_\u2026). A\xE7\u0131k anahtar (sb_public_live_\u2026) yaln\u0131z taray\u0131c\u0131 ve mobil i\xE7indir.",
        0,
        "WRONG_KEY_TYPE"
      );
    }
    this.domainKey = config.domainKey;
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.timeout = config.timeout ?? 15e3;
    this.throwOnError = config.throwOnError ?? false;
    this.debug = config.debug ?? false;
  }
  // ── Gönderim ──────────────────────────────────────────────────────────
  sendEmail(input) {
    return this.request("POST", "/v1/email/send", input);
  }
  sendSms(input) {
    return this.request("POST", "/v1/sms/send", input);
  }
  /**
   * Otomasyon olayı — kendi sisteminizdeki bir olayı bildirir ve eşleşen
   * akışı tetikler (§11). Signalbird olayın anlamını bilmez; adı sizindir.
   */
  track(input) {
    return this.request("POST", "/v1/events", input);
  }
  /** SMS parça/karakter hesabı — kota harcamaz. */
  previewSms(body) {
    return this.request("POST", "/v1/sms/preview", { body });
  }
  sendPush(input) {
    return this.request("POST", "/v1/push/send", input);
  }
  // ── Kişiler ───────────────────────────────────────────────────────────
  listContacts(query) {
    return this.request("GET", "/v1/contacts", void 0, query);
  }
  createContact(contact) {
    return this.request("POST", "/v1/contacts", contact);
  }
  updateContact(id, contact) {
    return this.request("PATCH", `/v1/contacts/${encodeURIComponent(id)}`, contact);
  }
  deleteContact(id) {
    return this.request("DELETE", `/v1/contacts/${encodeURIComponent(id)}`);
  }
  /**
   * Toplu kişi yükleme.
   *
   * 1000'lik parçalara bölünür ve SIRAYLA gönderilir (paralel değil: aynı
   * e-posta iki parçada da varsa yarış olmasın). Sonuçlar tek yanıtta
   * birleştirilir. Bir parça başarısız olursa o noktada durulur ve o ana kadar
   * biriken sayımlar `data` içinde döner — çağıran kaç kişinin işlendiğini görür.
   */
  async bulkContacts(input) {
    const merged = { imported: 0, updated: 0, skipped: [] };
    const { contacts, ...rest } = input;
    let status = 200;
    if (contacts.length === 0) {
      return { ok: true, status, data: merged };
    }
    for (let offset = 0; offset < contacts.length; offset += BULK_CHUNK) {
      const chunk = contacts.slice(offset, offset + BULK_CHUNK);
      const result = await this.request("POST", "/v1/contacts/bulk", {
        ...rest,
        contacts: chunk
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
  listContactLists() {
    return this.request("GET", "/v1/contact-lists");
  }
  createContactList(input) {
    return this.request("POST", "/v1/contact-lists", input);
  }
  deleteContactList(id) {
    return this.request("DELETE", `/v1/contact-lists/${encodeURIComponent(id)}`);
  }
  // ── Kampanyalar ───────────────────────────────────────────────────────
  listCampaigns(query) {
    return this.request("GET", "/v1/campaigns", void 0, query);
  }
  createCampaign(input) {
    return this.request("POST", "/v1/campaigns", input);
  }
  getCampaign(id) {
    return this.request("GET", `/v1/campaigns/${encodeURIComponent(id)}`);
  }
  cancelCampaign(id) {
    return this.request("POST", `/v1/campaigns/${encodeURIComponent(id)}/cancel`);
  }
  listCampaignMessages(id, query) {
    return this.request("GET", `/v1/campaigns/${encodeURIComponent(id)}/messages`, void 0, query);
  }
  /**
   * Bir kampanyanın tüm mesajlarını sayfa sayfa gezer.
   *
   *   for await (const m of sdk.iterateCampaignMessages(42)) { … }
   *
   * Bir sayfa alınamazsa `SignalbirdError` fırlatır (sessiz yarım liste,
   * "hepsi bu" sanılır — o daha tehlikeli).
   */
  async *iterateCampaignMessages(id, query = {}) {
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
  listMessages(query) {
    return this.request("GET", "/v1/messages", void 0, query);
  }
  getMessage(id) {
    return this.request("GET", `/v1/messages/${encodeURIComponent(id)}`);
  }
  // ── HTTP ──────────────────────────────────────────────────────────────
  async request(method, path, body, query) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);
    const url = this.baseUrl + path + buildQuery(query);
    let status = 0;
    let data;
    try {
      const response = await fetch(url, {
        method,
        headers: {
          Accept: "application/json",
          "X-Signalbird-Key": this.domainKey,
          ...body !== void 0 ? { "Content-Type": "application/json" } : {}
        },
        body: body !== void 0 ? JSON.stringify(body) : void 0,
        signal: controller.signal
      });
      status = response.status;
      const text = await response.text();
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = text;
      }
      if (response.ok) {
        return { ok: true, status, data };
      }
    } catch (error) {
      const timedOut = error instanceof Error && error.name === "AbortError";
      const code2 = timedOut ? "TIMEOUT" : "NETWORK_ERROR";
      const message2 = error instanceof Error ? error.message : "network error";
      return this.fail(0, code2, message2, void 0);
    } finally {
      clearTimeout(timer);
    }
    const code = data && typeof data === "object" && typeof data.code === "string" && data.code || (status === 422 ? "VALIDATION_ERROR" : status === 401 ? "API_KEY_INVALID" : `HTTP_${status}`);
    const message = data && typeof data === "object" && typeof data.message === "string" && data.message || `HTTP ${status}`;
    return this.fail(status, code, message, data);
  }
  fail(status, code, message, data) {
    if (this.throwOnError) {
      throw new SignalbirdError(`Signalbird: ${code} \u2014 ${message}`, status, code, data);
    }
    if (this.debug) {
      console.warn(`[signalbird] ${code} (HTTP ${status}): ${message}`);
    }
    return { ok: false, status, code, message, data };
  }
};
function buildQuery(query) {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === void 0 || value === null) continue;
    if (Array.isArray(value)) {
      for (const item of value) params.append(`${key}[]`, String(item));
    } else {
      params.append(key, String(value));
    }
  }
  const encoded = params.toString();
  return encoded ? `?${encoded}` : "";
}

// src/node/http.ts
var SbTransport = class {
  constructor(config) {
    this.config = config;
  }
  async request(method, path, body, query) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeout);
    const url = this.config.baseUrl + path + buildQuery2(query);
    let status = 0;
    let data;
    try {
      const response = await fetch(url, {
        method,
        headers: {
          Accept: "application/json",
          "X-Signalbird-Key": this.config.domainKey,
          ...body !== void 0 ? { "Content-Type": "application/json" } : {}
        },
        body: body !== void 0 ? JSON.stringify(body) : void 0,
        signal: controller.signal
      });
      status = response.status;
      const text = await response.text();
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = text;
      }
      if (response.ok) {
        return { ok: true, status, data };
      }
    } catch (error) {
      const timedOut = error instanceof Error && error.name === "AbortError";
      return this.fail(
        0,
        timedOut ? "TIMEOUT" : "NETWORK_ERROR",
        error instanceof Error ? error.message : "network error",
        void 0
      );
    } finally {
      clearTimeout(timer);
    }
    const code = data && typeof data === "object" && typeof data.code === "string" && data.code || (status === 422 ? "VALIDATION_ERROR" : status === 401 ? "API_KEY_INVALID" : `HTTP_${status}`);
    const message = data && typeof data === "object" && typeof data.message === "string" && data.message || `HTTP ${status}`;
    return this.fail(status, code, message, data);
  }
  fail(status, code, message, data) {
    if (this.config.throwOnError) {
      throw new SignalbirdError(`Signalbird: ${code} \u2014 ${message}`, status, code, data);
    }
    if (this.config.debug) {
      console.warn(`[signalbird] ${code} (HTTP ${status}): ${message}`);
    }
    return { ok: false, status, code, message, data };
  }
};
function buildQuery2(query) {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === void 0 || value === null) continue;
    if (Array.isArray(value)) {
      for (const item of value) params.append(`${key}[]`, String(item));
    } else {
      params.append(key, String(value));
    }
  }
  const encoded = params.toString();
  return encoded ? `?${encoded}` : "";
}
function seg(value) {
  return encodeURIComponent(String(value));
}

// src/node/management.ts
var SignalbirdManagement = class {
  constructor(config) {
    if (!config.domainKey) {
      throw new SignalbirdError("Signalbird: domainKey zorunlu.", 0, "NO_KEY");
    }
    if (!config.domainKey.startsWith("sb_secret_live_")) {
      throw new SignalbirdError(
        "Signalbird: bu istemci G\u0130ZL\u0130 domain anahtar\u0131 ister (sb_secret_live_\u2026). A\xE7\u0131k anahtar (sb_public_live_\u2026) yaln\u0131z taray\u0131c\u0131 ve mobil i\xE7indir.",
        0,
        "WRONG_KEY_TYPE"
      );
    }
    this.http = new SbTransport({
      domainKey: config.domainKey,
      baseUrl: (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, ""),
      timeout: config.timeout ?? 15e3,
      throwOnError: config.throwOnError ?? false,
      debug: config.debug ?? false
    });
  }
  // ── Telsiz: projeler ──────────────────────────────────────────────────
  /** Panelin Telsiz özeti: proje sayısı, günlük hacim, son olaylar. */
  radioSummary() {
    return this.http.request("GET", "/v1/radio/summary");
  }
  /** Olay akışı — kanal, seviye ve tarihe göre süzülür. */
  radioEvents(query) {
    return this.http.request("GET", "/v1/radio/events", void 0, query);
  }
  // ── Modül anahtarları ─────────────────────────────────────────────────
  //
  // Telsiz projesi/kanalı ve uygulama kaydı 1 Eyl 2026'da kaldırıldı
  // (../signalbird.api/docs/KEY_ARCHITECTURE_2026-09-01.md §3). Yerlerini TEK
  // bir uç ailesi aldı: modül anahtarları. Beş modülün (logger, email, sms,
  // push, chat) hepsi aynı gövdeyi kullanır — beş ayrı metot kümesi yazmak,
  // altıncı modül geldiğinde altıncısını yazmak demekti.
  listModuleKeys(module, query) {
    return this.http.request("GET", `/v1/modules/${seg(module)}/keys`, void 0, query);
  }
  getModuleKey(module, id) {
    return this.http.request("GET", `/v1/modules/${seg(module)}/keys/${seg(id)}`);
  }
  /**
   * Kanal açar.
   *
   * `key` verilmezse başlıktan üretilir ve çakışırsa sonuna sayı eklenir —
   * "bu ad alınmış" hatasıyla geri dönmek, CI'da kanal açan bir betiği
   * durdururdu.
   */
  createModuleKey(module, input) {
    return this.http.request("POST", `/v1/modules/${seg(module)}/keys`, input);
  }
  /**
   * Kanalı günceller.
   *
   * `key` DEĞİŞTİRİLEBİLİR (eskiden değişmezdi): eski ad 30 gün daha kabul
   * edilir, böylece üretimdeki kod bir sonraki deploya kadar kayıt kaybetmez.
   * `keep_previous: false` ile eski ad anında kapatılır.
   */
  updateModuleKey(module, id, input) {
    return this.http.request("PATCH", `/v1/modules/${seg(module)}/keys/${seg(id)}`, input);
  }
  deleteModuleKey(module, id) {
    return this.http.request("DELETE", `/v1/modules/${seg(module)}/keys/${seg(id)}`);
  }
  // ── Sohbet: gelen kutusu ──────────────────────────────────────────────
  chatSummary() {
    return this.http.request("GET", "/v1/chat/summary");
  }
  /** Kısa aralıklı yoklama için: yalnız değişenler + çevrimiçi ajanlar. */
  chatUpdates() {
    return this.http.request("GET", "/v1/chat/updates");
  }
  listConversations(query) {
    return this.http.request("GET", "/v1/chat/conversations", void 0, query);
  }
  getConversation(id) {
    return this.http.request("GET", `/v1/chat/conversations/${seg(id)}`);
  }
  /** `after` imleci `cm_…` mesaj kimliğidir; yoklamada tam listeyi çekmez. */
  listConversationMessages(id, query) {
    return this.http.request("GET", `/v1/chat/conversations/${seg(id)}/messages`, void 0, query);
  }
  /** Proaktif sohbet — ziyaretçi yazmadan ajan başlatır. */
  startConversation(input) {
    return this.http.request("POST", "/v1/chat/conversations", input);
  }
  updateConversation(id, input) {
    return this.http.request("PATCH", `/v1/chat/conversations/${seg(id)}`, input);
  }
  setConversationStatus(id, status) {
    return this.http.request("POST", `/v1/chat/conversations/${seg(id)}/status`, { status });
  }
  /**
   * Atama atomiktir: `userId` verilmezse çağıran anahtarın sahibine atanır.
   * Başkasına atanmış sohbeti devralmak `chat:write` ister.
   */
  assignConversation(id, userId) {
    return this.http.request("POST", `/v1/chat/conversations/${seg(id)}/assign`, {
      user_id: userId ?? null
    });
  }
  readConversation(id, lastMessageId) {
    return this.http.request("POST", `/v1/chat/conversations/${seg(id)}/read`, {
      last_message_id: lastMessageId
    });
  }
  setTyping(id, isTyping) {
    return this.http.request("POST", `/v1/chat/conversations/${seg(id)}/typing`, {
      is_typing: isTyping
    });
  }
  reply(id, input) {
    return this.http.request("POST", `/v1/chat/conversations/${seg(id)}/messages`, input);
  }
  editChatMessage(id, messageId, body) {
    return this.http.request("PATCH", `/v1/chat/conversations/${seg(id)}/messages/${seg(messageId)}`, {
      body
    });
  }
  deleteChatMessage(id, messageId) {
    return this.http.request(
      "DELETE",
      `/v1/chat/conversations/${seg(id)}/messages/${seg(messageId)}`
    );
  }
  /** Tepki açma/kapama — aynı emoji ikinci kez gönderilirse kaldırılır. */
  reactToChatMessage(id, messageId, emoji) {
    return this.http.request(
      "POST",
      `/v1/chat/conversations/${seg(id)}/messages/${seg(messageId)}/reactions`,
      { emoji }
    );
  }
  // ── Sohbet: ziyaretçi ve hazır yanıtlar ───────────────────────────────
  getVisitor(id) {
    return this.http.request("GET", `/v1/chat/visitors/${seg(id)}`);
  }
  updateVisitor(id, input) {
    return this.http.request("PATCH", `/v1/chat/visitors/${seg(id)}`, input);
  }
  banVisitor(id) {
    return this.http.request("POST", `/v1/chat/visitors/${seg(id)}/ban`);
  }
  listCannedReplies() {
    return this.http.request("GET", "/v1/chat/canned-replies");
  }
  createCannedReply(input) {
    return this.http.request("POST", "/v1/chat/canned-replies", input);
  }
  updateCannedReply(id, input) {
    return this.http.request("PATCH", `/v1/chat/canned-replies/${seg(id)}`, input);
  }
  deleteCannedReply(id) {
    return this.http.request("DELETE", `/v1/chat/canned-replies/${seg(id)}`);
  }
  // ── Sohbet: tetikleyiciler ────────────────────────────────────────────
  // "Şu olduğunda şunu yap." Kural KAYITTA durur, kodda değil: müşteri
  // davranışı değiştirmek için sürüm çıkarmak zorunda kalmasın.
  listChatTriggers() {
    return this.http.request("GET", "/v1/chat/triggers");
  }
  createChatTrigger(input) {
    return this.http.request("POST", "/v1/chat/triggers", input);
  }
  updateChatTrigger(id, input) {
    return this.http.request("PATCH", `/v1/chat/triggers/${seg(id)}`, input);
  }
  deleteChatTrigger(id) {
    return this.http.request("DELETE", `/v1/chat/triggers/${seg(id)}`);
  }
  // ── Sohbet: rapor ─────────────────────────────────────────────────────
  /**
   * Yanıt süresi, çözüm süresi, memnuniyet ve ajan kırılımı.
   * Veri yoksa süreler `null` döner — 0 DEĞİL.
   */
  chatReport(range = "30d") {
    return this.http.request("GET", "/v1/chat/reports", void 0, { range });
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
  embedToken(input) {
    return this.http.request("POST", "/v1/embed/tokens", input);
  }
  /** Push kanalına kayıtlı son kullanıcı cihazları (token MASKELİ döner). */
  listModuleKeyDevices(module, id, query) {
    return this.http.request("GET", `/v1/modules/${seg(module)}/keys/${seg(id)}/devices`, void 0, query);
  }
};

// src/node/partner.ts
var SignalbirdPartner = class {
  constructor(config) {
    if (!config.domainKey) {
      throw new SignalbirdError("Signalbird: domainKey zorunlu.", 0, "NO_KEY");
    }
    if (!config.domainKey.startsWith("sb_secret_live_")) {
      throw new SignalbirdError(
        "Signalbird: bu istemci G\u0130ZL\u0130 domain anahtar\u0131 ister (sb_secret_live_\u2026). A\xE7\u0131k anahtar (sb_public_live_\u2026) yaln\u0131z taray\u0131c\u0131 ve mobil i\xE7indir.",
        0,
        "WRONG_KEY_TYPE"
      );
    }
    this.http = new SbTransport({
      domainKey: config.domainKey,
      baseUrl: (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, ""),
      timeout: config.timeout ?? 15e3,
      throwOnError: config.throwOnError ?? false,
      debug: config.debug ?? false
    });
  }
  // ── Müşteri ───────────────────────────────────────────────────────────
  /**
   * Company + takım + owner açar. **Idempotenttir**: aynı `external_id` ile
   * ikinci çağrı yeni kayıt açmaz, `created:false` ile var olanı döner.
   * Anahtarlar (`keys`) yalnız ilk oluşturmada gelir.
   */
  createCompany(input) {
    return this.http.request("POST", "/v1/partner/companies", input);
  }
  listCompanies(query) {
    return this.http.request("GET", "/v1/partner/companies", void 0, query);
  }
  getCompany(externalId) {
    return this.http.request("GET", `/v1/partner/companies/${seg(externalId)}`);
  }
  updateCompany(externalId, input) {
    return this.http.request("PATCH", `/v1/partner/companies/${seg(externalId)}`, input);
  }
  /** Askıya alır — SİLMEZ. Müşterinin izleme ve mesaj geçmişi durur. */
  suspendCompany(externalId) {
    return this.http.request("DELETE", `/v1/partner/companies/${seg(externalId)}`);
  }
  rotateKey(externalId, type) {
    return this.http.request("POST", `/v1/partner/companies/${seg(externalId)}/keys/rotate`, { type });
  }
  // ── Domain ────────────────────────────────────────────────────────────
  /**
   * Domain ekler ve (istenirse) izlemeye alır. Kayıt `verified_via:'partner'`
   * ile doğar: izleme, sohbet ve push için yeter — **e-posta/SMS kampanyası
   * için TXT şarttır**. Yanıttaki `dns` kaydını yayınlayıp `verifyDomain`
   * çağırmak kapıyı açar.
   */
  addDomain(companyExternalId, input) {
    return this.http.request("POST", `/v1/partner/companies/${seg(companyExternalId)}/domains`, input);
  }
  listDomains(companyExternalId) {
    return this.http.request("GET", `/v1/partner/companies/${seg(companyExternalId)}/domains`);
  }
  getDomain(externalId) {
    return this.http.request("GET", `/v1/partner/domains/${seg(externalId)}`);
  }
  /** TXT'yi hemen sorgular; eşleşirse domain kampanya kapısından geçer olur. */
  verifyDomain(externalId) {
    return this.http.request("POST", `/v1/partner/domains/${seg(externalId)}/verify`);
  }
  removeDomain(externalId) {
    return this.http.request("DELETE", `/v1/partner/domains/${seg(externalId)}`);
  }
  domainUptime(externalId, range = "24h") {
    return this.http.request("GET", `/v1/partner/domains/${seg(externalId)}/uptime`, void 0, { range });
  }
  /** Tek istekte müşterinin tüm domainleri — liste ekranı N+1 atmasın. */
  companyUptime(companyExternalId, range = "24h") {
    return this.http.request(
      "GET",
      `/v1/partner/companies/${seg(companyExternalId)}/uptime`,
      void 0,
      { range }
    );
  }
  // ── Mesaj günlüğü ─────────────────────────────────────────────────────
  //
  // Salt okur; alıcı maskeli, gövde yok (MESSAGING_UNIFICATION §5.1).
  listMessages(companyExternalId, query = {}) {
    return this.http.request(
      "GET",
      `/v1/partner/companies/${seg(companyExternalId)}/messages`,
      void 0,
      query
    );
  }
  getMessage(companyExternalId, messageId) {
    return this.http.request(
      "GET",
      `/v1/partner/companies/${seg(companyExternalId)}/messages/${seg(messageId)}`
    );
  }
  messageSummary(companyExternalId, range = "7d") {
    return this.http.request(
      "GET",
      `/v1/partner/companies/${seg(companyExternalId)}/message-summary`,
      void 0,
      { range }
    );
  }
  // ── Modül yetkisi ─────────────────────────────────────────────────────
  listModules(companyExternalId) {
    return this.http.request("GET", `/v1/partner/companies/${seg(companyExternalId)}/modules`);
  }
  /** "Bu müşteri şu modül için ödeme yaptı, kullanabilir." */
  grantModule(companyExternalId, input) {
    return this.http.request("POST", `/v1/partner/companies/${seg(companyExternalId)}/modules`, input);
  }
  /** Yalnız partner'ın KENDİ verdiği hakkı geri alır; plan hakkına dokunmaz. */
  revokeModule(companyExternalId, module) {
    return this.http.request(
      "DELETE",
      `/v1/partner/companies/${seg(companyExternalId)}/modules/${seg(module)}`
    );
  }
  // ── Kullanıcı ─────────────────────────────────────────────────────────
  createUser(companyExternalId, input) {
    return this.http.request("POST", `/v1/partner/companies/${seg(companyExternalId)}/users`, input);
  }
  listUsers(companyExternalId) {
    return this.http.request("GET", `/v1/partner/companies/${seg(companyExternalId)}/users`);
  }
  /** Üyeliği kaldırır, kişinin Signalbird hesabını SİLMEZ. */
  removeUser(companyExternalId, userExternalId) {
    return this.http.request(
      "DELETE",
      `/v1/partner/companies/${seg(companyExternalId)}/users/${seg(userExternalId)}`
    );
  }
  // ── Gömme ─────────────────────────────────────────────────────────────
  /**
   * Panel ekranını partner sayfasına gömmek için kısa ömürlü jeton üretir.
   * 120 saniye yaşar ve TEK KULLANIMLIKTIR — jeton URL'de gider, log ve
   * `Referer` başlığına düşer.
   */
  createEmbedToken(companyExternalId, input) {
    return this.http.request("POST", `/v1/partner/companies/${seg(companyExternalId)}/embed`, input);
  }
};
function verifyWebhook(rawBody, signatureHeader, secret) {
  if (!signatureHeader || !secret) return false;
  const match = /^\s*sha256=([a-f0-9]+)\s*$/i.exec(signatureHeader);
  if (!match) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const provided = match[1].toLowerCase();
  if (provided.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(provided, "utf8"), Buffer.from(expected, "utf8"));
}

// src/node/index.ts
var singleton = null;
function signalbird(config) {
  if (singleton && !config) {
    return singleton;
  }
  const domainKey = config?.domainKey ?? process.env.SIGNALBIRD_DOMAIN_KEY ?? "";
  const client = new SignalbirdClient({
    domainKey,
    baseUrl: config?.baseUrl ?? process.env.SIGNALBIRD_URL,
    source: config?.source ?? process.env.SIGNALBIRD_SOURCE,
    ...config
  });
  if (!config) {
    singleton = client;
  }
  return client;
}
function resetSignalbird() {
  singleton = null;
}
var managementSingleton = null;
function management(config) {
  if (managementSingleton && !config) {
    return managementSingleton;
  }
  const client = new SignalbirdManagement({
    domainKey: config?.domainKey ?? process.env.SIGNALBIRD_DOMAIN_KEY ?? process.env.SIGNALBIRD_DOMAIN_KEY ?? "",
    baseUrl: config?.baseUrl ?? process.env.SIGNALBIRD_URL,
    ...config
  });
  if (!config) {
    managementSingleton = client;
  }
  return client;
}
function resetManagement() {
  managementSingleton = null;
}

exports.DEFAULT_BASE_URL = DEFAULT_BASE_URL;
exports.SignalbirdClient = SignalbirdClient;
exports.SignalbirdError = SignalbirdError;
exports.SignalbirdManagement = SignalbirdManagement;
exports.SignalbirdMessaging = SignalbirdMessaging;
exports.SignalbirdPartner = SignalbirdPartner;
exports.management = management;
exports.resetManagement = resetManagement;
exports.resetSignalbird = resetSignalbird;
exports.signalbird = signalbird;
exports.verifyWebhook = verifyWebhook;
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map