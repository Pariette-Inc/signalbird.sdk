// src/node/types.ts
var SignalbirdError = class extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
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

export { DEFAULT_BASE_URL, SignalbirdClient, SignalbirdError, resetSignalbird, signalbird };
//# sourceMappingURL=index.mjs.map
//# sourceMappingURL=index.mjs.map