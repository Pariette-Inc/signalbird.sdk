'use strict';

var crypto = require('crypto');

// src/node/types.ts
var SignalbirdError = class extends Error {
  constructor(message, status, code, body) {
    super(message);
    this.status = status;
    this.code = code;
    this.body = body;
    this.name = "SignalbirdError";
  }
};
var DEFAULT_BASE_URL = "https://signalbird.io/api";

// src/node/client.ts
var SignalbirdClient = class {
  constructor(config) {
    this.config = config;
    if (!config.apiKey) {
      throw new SignalbirdError("Signalbird: apiKey zorunlu.", 0, "NO_KEY");
    }
    if (config.apiKey.startsWith("sbr_pub_")) {
      throw new SignalbirdError(
        "Signalbird: sunucu istemcisine taray\u0131c\u0131 anahtar\u0131 (sbr_pub_\u2026) verildi. Sunucu anahtar\u0131 (sbr_live_\u2026) kullan\u0131n.",
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
  /** Tek kayıt gönderir. */
  async log(input) {
    return this.send("/v1/radio/log", {
      channel: input.channel,
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
        channel: event.channel,
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
  // `log('critical', …)` yerine `critical(…)`: kanal adı ile seviye çoğu
  // projede aynıdır, ikisini ayrı ayrı yazdırmak gereksiz tekrar olurdu.
  debugLog(channel, message, context) {
    return this.log({ channel, message, level: "debug", context });
  }
  info(channel, message, context) {
    return this.log({ channel, message, level: "info", context });
  }
  warn(channel, message, context) {
    return this.log({ channel, message, level: "warn", context });
  }
  error(channel, message, context) {
    return this.log({ channel, message, level: "error", context });
  }
  critical(channel, message, context) {
    return this.log({ channel, message, level: "critical", context });
  }
  /**
   * Yakalanmamış hataları Telsiz'e bağlar.
   *
   * Kancayı takıp süreci ÖLDÜRMEYE devam eder: `uncaughtException` sonrası
   * süreci ayakta tutmak, bozuk durumdaki bir uygulamayı çalıştırmaya devam
   * etmek demektir — log göndermek bunu meşrulaştırmaz.
   */
  captureUncaught(channel = "critical") {
    const onError = (error) => {
      void this.log({
        channel,
        message: error.message,
        level: "critical",
        context: { stack: error.stack?.split("\n").slice(0, 20).join("\n") }
      });
    };
    const onRejection = (reason) => {
      void this.log({
        channel,
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
          Authorization: `Bearer ${this.config.apiKey}`
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
    if (!config.apiKey) {
      throw new SignalbirdError("Signalbird: apiKey zorunlu.", 0, "NO_KEY");
    }
    if (!config.apiKey.startsWith("sb_")) {
      throw new SignalbirdError(
        "Signalbird: g\xF6nderim istemcisi tak\u0131m API anahtar\u0131 ister (sb_\u2026). Telsiz (sbr_\u2026) ve uygulama (sbw_pub_\u2026) anahtarlar\u0131 burada \xE7al\u0131\u015Fmaz.",
        0,
        "WRONG_KEY_TYPE"
      );
    }
    this.apiKey = config.apiKey;
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
          Authorization: `Bearer ${this.apiKey}`,
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
  const apiKey = config?.apiKey ?? process.env.SIGNALBIRD_KEY ?? "";
  const client = new SignalbirdClient({
    apiKey,
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

exports.DEFAULT_BASE_URL = DEFAULT_BASE_URL;
exports.SignalbirdClient = SignalbirdClient;
exports.SignalbirdError = SignalbirdError;
exports.SignalbirdMessaging = SignalbirdMessaging;
exports.resetSignalbird = resetSignalbird;
exports.signalbird = signalbird;
exports.verifyWebhook = verifyWebhook;
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map