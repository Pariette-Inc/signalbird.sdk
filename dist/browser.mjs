// src/shared/version.ts
var SDK_VERSION = "2.9.1" ;
var SDK_HEADER = "X-Signalbird-Sdk";
function sdkHeaderValue(platform) {
  return `${platform}/${SDK_VERSION}`;
}
var warned = false;
function noteSdkStatus(headers) {
  if (warned || !headers) return;
  try {
    const status = headers.get("Signalbird-Sdk-Status");
    if (status !== "outdated" && status !== "unsupported") return;
    warned = true;
    const latest = headers.get("Signalbird-Sdk-Latest") ?? "?";
    const message = status === "unsupported" ? `[signalbird] Bu SDK s\xFCr\xFCm\xFC (${SDK_VERSION}) art\u0131k desteklenmiyor. Son s\xFCr\xFCm: ${latest}. Paketi g\xFCncelleyin.` : `[signalbird] Yeni SDK s\xFCr\xFCm\xFC var: ${latest} (kurulu: ${SDK_VERSION}).`;
    if (typeof console !== "undefined") console.warn(message);
  } catch {
  }
}

// src/shared/serialize.ts
var MAX_MESSAGE_LENGTH = 4e3;
function truncateMessage(message) {
  const text = typeof message === "string" ? message : String(message);
  if (text.length <= MAX_MESSAGE_LENGTH) {
    return text;
  }
  return Array.from(text).slice(0, MAX_MESSAGE_LENGTH).join("");
}
function toJsonSafe(value) {
  const ancestors = [];
  const walk = (current) => {
    if (typeof current === "bigint") {
      return current.toString();
    }
    if (current === null || typeof current !== "object") {
      return current;
    }
    if (ancestors.includes(current)) {
      return "[Circular]";
    }
    if (current instanceof Error) {
      return { name: current.name, message: current.message, stack: current.stack };
    }
    const withToJson = current;
    if (typeof withToJson.toJSON === "function") {
      try {
        ancestors.push(current);
        return walk(withToJson.toJSON());
      } catch {
        return "[Unserializable]";
      } finally {
        ancestors.pop();
      }
    }
    ancestors.push(current);
    try {
      if (Array.isArray(current)) {
        return current.map((item) => walk(item));
      }
      const out = {};
      for (const key of Object.keys(current)) {
        let item;
        try {
          item = current[key];
        } catch {
          item = "[Unserializable]";
        }
        out[key] = walk(item);
      }
      return out;
    } finally {
      ancestors.pop();
    }
  };
  return walk(value);
}
function safeContext(context) {
  if (context === void 0 || context === null) {
    return void 0;
  }
  return toJsonSafe(context);
}

// src/browser/index.ts
var DEFAULT_BASE_URL = "https://live.signalbird.io/api";
var SignalbirdBrowser = class {
  constructor(config) {
    this.config = config;
    this.queue = [];
    this.timer = null;
    if (!config.publicKey?.startsWith("sb_public_live_")) {
      throw new Error(
        "Signalbird: taray\u0131c\u0131 istemcisi a\xE7\u0131k anahtar ister (sb_public_live_\u2026). Gizli anahtar\u0131 (sb_secret_live_\u2026) istemci koduna KOYMAYIN."
      );
    }
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.maxQueue = config.maxQueue ?? 50;
    if (typeof window !== "undefined") {
      this.timer = setInterval(() => void this.flush(), config.flushIntervalMs ?? 3e3);
      window.addEventListener("pagehide", () => this.flushBeacon());
    }
  }
  /**
   * Kanalı bağlar ve yazacı döner - sunucu istemcisindeki `radio()` ile aynı
   * deyim (CONTRACT §1.1):
   *
   *     sb.radio('sepet').error('sepet güncellenemedi', { cartId })
   *
   * `critical` BİLEREK yoktur: istemci kodu herkesin elindedir ve oradan
   * kritik alarm (sessiz saatleri delen bildirim) tetiklemek, kötü niyetli
   * birine ekibin telefonunu çaldırma imkânı verirdi. Gerekirse
   * `log(key, msg, 'critical')` hâlâ yazılabilir; kanal ayarı panelde durur.
   */
  radio(key) {
    return {
      debug: (message, context) => this.log(key, message, "debug", context),
      info: (message, context) => this.log(key, message, "info", context),
      warn: (message, context) => this.log(key, message, "warn", context),
      error: (message, context) => this.log(key, message, "error", context)
    };
  }
  log(key, message, level, context) {
    this.queue.push({
      key,
      message: truncateMessage(message),
      level,
      context: safeContext(context),
      source: this.config.source
    });
    if (this.queue.length >= this.maxQueue) {
      void this.flush();
    }
  }
  info(key, message, context) {
    this.log(key, message, "info", context);
  }
  warn(key, message, context) {
    this.log(key, message, "warn", context);
  }
  error(key, message, context) {
    this.log(key, message, "error", context);
  }
  /**
   * Tarayıcıdaki yakalanmamış hataları bağlar.
   *
   * Varsayılan anahtar `browser`dır ve KRİTİK DEĞİLDİR: istemci tarafı kod
   * herkesin elindedir, oradan kritik alarm tetiklemek kötü niyetli birine
   * ekibin telefonunu çaldırma imkânı verirdi. Hangi kanalın kime bildirim
   * göndereceği panelde durur; oradan sessiz bırakılabilir.
   */
  captureErrors(key = "browser") {
    const onError = (event) => {
      this.error(key, event.message, {
        file: event.filename,
        line: event.lineno,
        column: event.colno,
        url: window.location.href
      });
    };
    const onRejection = (event) => {
      this.error(key, String(event.reason), { url: window.location.href });
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }
  async flush() {
    if (this.queue.length === 0) return;
    const batch = this.queue.splice(0, 100);
    try {
      const response = await fetch(`${this.baseUrl}/v1/radio/log/batch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Signalbird-Key": this.config.publicKey,
          [SDK_HEADER]: sdkHeaderValue("browser")
        },
        body: JSON.stringify({ events: batch }),
        keepalive: true
      });
      noteSdkStatus(response.headers);
    } catch (error) {
      if (this.config.debug) {
        console.warn("[signalbird] g\xF6nderilemedi", error);
      }
      this.queue = [...batch, ...this.queue].slice(0, this.maxQueue);
    }
  }
  /** Sayfa kapanırken son gönderim. */
  flushBeacon() {
    if (this.queue.length === 0 || typeof navigator === "undefined") return;
    const blob = new Blob(
      [JSON.stringify({ events: this.queue.splice(0, 100) })],
      { type: "text/plain;charset=UTF-8" }
    );
    navigator.sendBeacon?.(
      `${this.baseUrl}/v1/radio/log/batch?k=${encodeURIComponent(this.config.publicKey)}&sdk=${encodeURIComponent(sdkHeaderValue("browser"))}`,
      blob
    );
  }
  destroy() {
    if (this.timer) clearInterval(this.timer);
    void this.flush();
  }
};
var singleton = null;
function initSignalbird(config) {
  singleton = new SignalbirdBrowser(config);
  return singleton;
}
function signalbird() {
  return singleton;
}

export { SignalbirdBrowser, initSignalbird, signalbird };
//# sourceMappingURL=browser.mjs.map
//# sourceMappingURL=browser.mjs.map