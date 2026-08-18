// src/browser/index.ts
var DEFAULT_BASE_URL = "https://signalbird.io/api";
var SignalbirdBrowser = class {
  constructor(config) {
    this.config = config;
    this.queue = [];
    this.timer = null;
    if (!config.publicKey?.startsWith("sbr_pub_")) {
      throw new Error(
        "Signalbird: taray\u0131c\u0131 istemcisi a\xE7\u0131k anahtar ister (sbr_pub_\u2026). Gizli anahtar\u0131 (sbr_live_\u2026) istemci koduna KOYMAYIN."
      );
    }
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.maxQueue = config.maxQueue ?? 50;
    if (typeof window !== "undefined") {
      this.timer = setInterval(() => void this.flush(), config.flushIntervalMs ?? 3e3);
      window.addEventListener("pagehide", () => this.flushBeacon());
    }
  }
  log(channel, message, level, context) {
    this.queue.push({ channel, message, level, context, source: this.config.source });
    if (this.queue.length >= this.maxQueue) {
      void this.flush();
    }
  }
  info(channel, message, context) {
    this.log(channel, message, "info", context);
  }
  warn(channel, message, context) {
    this.log(channel, message, "warn", context);
  }
  error(channel, message, context) {
    this.log(channel, message, "error", context);
  }
  /**
   * Tarayıcıdaki yakalanmamış hataları bağlar.
   *
   * Kritik kanala YAZMAZ: istemci tarafı kod herkesin elindedir, oradan
   * kritik alarm tetiklemek kötü niyetli birine ekibin telefonunu çaldırma
   * imkânı verirdi. Sunucu zaten `browser_channels` ile bunu kısıtlar.
   */
  captureErrors(channel = "browser") {
    const onError = (event) => {
      this.error(channel, event.message, {
        file: event.filename,
        line: event.lineno,
        column: event.colno,
        url: window.location.href
      });
    };
    const onRejection = (event) => {
      this.error(channel, String(event.reason), { url: window.location.href });
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
      await fetch(`${this.baseUrl}/v1/radio/log/batch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Signalbird-Key": this.config.publicKey
        },
        body: JSON.stringify({ events: batch }),
        keepalive: true
      });
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
      { type: "application/json" }
    );
    navigator.sendBeacon?.(
      `${this.baseUrl}/v1/radio/log/batch?key=${encodeURIComponent(this.config.publicKey)}`,
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