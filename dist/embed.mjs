// src/embed/element.ts
var TEXT = {
  tr: {
    loading: "Y\xFCkleniyor\u2026",
    failed: "Ekran y\xFCklenemedi.",
    expired: "Bu ba\u011Flant\u0131n\u0131n s\xFCresi doldu.",
    retry: "Yeniden dene"
  },
  en: {
    loading: "Loading\u2026",
    failed: "The screen could not be loaded.",
    expired: "This link has expired.",
    retry: "Try again"
  }
};
function resolveTheme(theme) {
  if (theme === "light" || theme === "dark") return theme;
  if (typeof document !== "undefined") {
    const root = document.documentElement;
    if (root.classList.contains("dark") || root.dataset.theme === "dark") return "dark";
    if (root.classList.contains("light") || root.dataset.theme === "light") return "light";
  }
  if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return "light";
}
function readUrl(result) {
  if (typeof result === "string") return result || null;
  if (result && typeof result === "object") {
    const record = result;
    if (typeof record.url === "string") return record.url;
    if (record.data && typeof record.data.url === "string") return record.data.url;
  }
  return null;
}
function createEmbed(options) {
  const text = TEXT[options.language ?? "tr"];
  const listeners = /* @__PURE__ */ new Map();
  let container = null;
  let frame = null;
  let messageHandler = null;
  let theme = options.theme ?? "auto";
  let destroyed = false;
  const emit = (event, payload) => {
    listeners.get(event)?.forEach((fn) => {
      try {
        fn(payload);
      } catch (error) {
        console.warn("[signalbird]", error);
      }
    });
  };
  const clear = () => {
    if (messageHandler) {
      window.removeEventListener("message", messageHandler);
      messageHandler = null;
    }
    frame = null;
    if (container) container.textContent = "";
  };
  const status = (message, withRetry) => {
    if (!container) return;
    container.textContent = "";
    const box = document.createElement("div");
    box.setAttribute("data-signalbird-status", "");
    box.style.cssText = `display:flex;align-items:center;justify-content:center;gap:12px;min-height:${options.minHeight ?? 220}px;font:13px/1.5 system-ui,-apple-system,sans-serif;color:#6b7280;text-align:center;padding:24px;`;
    const label = document.createElement("span");
    label.textContent = message;
    box.appendChild(label);
    if (withRetry) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = text.retry;
      button.style.cssText = "border:1px solid currentColor;border-radius:8px;background:transparent;color:inherit;padding:4px 10px;font:inherit;cursor:pointer;";
      button.addEventListener("click", () => void render());
      box.appendChild(button);
    }
    container.appendChild(box);
  };
  const render = async () => {
    if (!container || destroyed) return;
    clear();
    status(text.loading, false);
    const applied = resolveTheme(theme);
    let url = null;
    try {
      if (options.url) {
        url = options.url;
        options = { ...options, url: void 0 };
      } else if (options.mint) {
        url = readUrl(
          await options.mint({ module: options.module, theme: applied, locale: options.locale })
        );
      }
    } catch (error) {
      emit("error", error);
      status(error instanceof Error ? error.message : text.failed, true);
      return;
    }
    if (!url) {
      emit("error", new Error("EMBED_URL_MISSING"));
      status(text.expired, Boolean(options.mint));
      return;
    }
    let target = url;
    try {
      const parsed = new URL(url);
      parsed.searchParams.set("theme", applied);
      if (options.locale) parsed.searchParams.set("locale", options.locale);
      if (options.accent) parsed.searchParams.set("accent", options.accent.replace(/^#/, ""));
      target = parsed.toString();
    } catch {
    }
    const iframe = document.createElement("iframe");
    iframe.src = target;
    iframe.title = "Signalbird";
    iframe.style.cssText = "width:100%;border:0;display:block;";
    iframe.style.height = `${typeof options.height === "number" ? options.height : options.minHeight ?? 640}px`;
    iframe.setAttribute("allow", "clipboard-write; fullscreen; autoplay");
    iframe.setAttribute(
      "sandbox",
      "allow-same-origin allow-scripts allow-forms allow-popups allow-downloads"
    );
    iframe.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
    iframe.setAttribute("loading", "lazy");
    if (options.className) iframe.className = options.className;
    container.textContent = "";
    container.appendChild(iframe);
    frame = iframe;
    messageHandler = (event) => {
      if (!frame || event.source !== frame.contentWindow) return;
      const data = event.data;
      if (!data || typeof data.type !== "string") return;
      if (data.type === "signalbird:ready") {
        emit("ready", data.module);
        return;
      }
      if (data.type === "signalbird:height" && typeof data.px === "number") {
        emit("height", data.px);
        if ((options.height ?? "auto") === "auto") {
          const px = Math.max(data.px, options.minHeight ?? 220);
          frame.style.height = `${px}px`;
        }
      }
    };
    window.addEventListener("message", messageHandler);
  };
  return {
    async mount(targetSelector) {
      const element = typeof targetSelector === "string" ? document.querySelector(targetSelector) : targetSelector;
      if (!(element instanceof HTMLElement)) {
        throw new Error("Signalbird: g\xF6mme kab\u0131 bulunamad\u0131 \u2014 " + String(targetSelector));
      }
      container = element;
      destroyed = false;
      await render();
    },
    refresh: () => render(),
    async setTheme(next) {
      theme = next;
      await render();
    },
    destroy() {
      destroyed = true;
      clear();
      listeners.clear();
      container = null;
    },
    on(event, handler) {
      if (!listeners.has(event)) listeners.set(event, /* @__PURE__ */ new Set());
      listeners.get(event).add(handler);
    },
    off(event, handler) {
      listeners.get(event)?.delete(handler);
    }
  };
}

export { createEmbed };
//# sourceMappingURL=embed.mjs.map
//# sourceMappingURL=embed.mjs.map