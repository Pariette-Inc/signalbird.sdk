/**
 * Gömme çekirdeği — çatısız, bağımlılıksız.
 *
 * Ev sahibi tarafında TEK satır:
 *
 *   Signalbird.embed({ module: 'chat', mint }).mount('#sb-chat')
 *
 * Ne yapar:
 *   • jetonu ev sahibinin sunucusundan ister (partner anahtarı tarayıcıya inmez)
 *   • iframe'i kurar, tema/dil/vurgu rengini adrese işler
 *   • gömülü ekranın `postMessage` ile bildirdiği yüksekliği uygular
 *   • jeton süresi dolmuş/geçersizse anlaşılır bir hata ve "yeniden dene" çizer
 *   • `destroy()` ile dinleyicileri bırakır (SPA'da sızıntı yok)
 *
 * NE YAPMAZ: modülün satın alınıp alınmadığına bakmaz. O kapı ev sahibinin
 * kendi satış kaydındadır ve `mint` çağrısı 403 dönerek söyler; SDK yalnız
 * mesajı gösterir.
 */
import type { EmbedEvent, EmbedHandle, EmbedOptions, EmbedTheme } from './types';

type Listener = (payload?: unknown) => void;

const TEXT = {
  tr: {
    loading: 'Yükleniyor…',
    failed: 'Ekran yüklenemedi.',
    expired: 'Bu bağlantının süresi doldu.',
    retry: 'Yeniden dene',
  },
  en: {
    loading: 'Loading…',
    failed: 'The screen could not be loaded.',
    expired: 'This link has expired.',
    retry: 'Try again',
  },
} as const;

/** Ev sahibi sayfanın kipi: açık talep > `data-theme`/`.dark` > işletim sistemi. */
function resolveTheme(theme: EmbedTheme | undefined): 'light' | 'dark' {
  if (theme === 'light' || theme === 'dark') return theme;

  if (typeof document !== 'undefined') {
    const root = document.documentElement;

    if (root.classList.contains('dark') || root.dataset.theme === 'dark') return 'dark';
    if (root.classList.contains('light') || root.dataset.theme === 'light') return 'light';
  }

  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  return 'light';
}

/** `{url}`, `{data:{url}}` ya da düz string — üçü de kabul edilir. */
function readUrl(result: unknown): string | null {
  if (typeof result === 'string') return result || null;

  if (result && typeof result === 'object') {
    const record = result as { url?: unknown; data?: { url?: unknown } };

    if (typeof record.url === 'string') return record.url;
    if (record.data && typeof record.data.url === 'string') return record.data.url;
  }

  return null;
}

export function createEmbed(options: EmbedOptions): EmbedHandle {
  const text = TEXT[options.language ?? 'tr'];
  const listeners = new Map<EmbedEvent, Set<Listener>>();

  let container: HTMLElement | null = null;
  let frame: HTMLIFrameElement | null = null;
  let messageHandler: ((event: MessageEvent) => void) | null = null;
  let theme: EmbedTheme = options.theme ?? 'auto';
  let destroyed = false;

  const emit = (event: EmbedEvent, payload?: unknown) => {
    listeners.get(event)?.forEach((fn) => {
      try {
        fn(payload);
      } catch (error) {
        console.warn('[signalbird]', error);
      }
    });
  };

  const clear = () => {
    if (messageHandler) {
      window.removeEventListener('message', messageHandler);
      messageHandler = null;
    }

    frame = null;

    if (container) container.textContent = '';
  };

  const status = (message: string, withRetry: boolean) => {
    if (!container) return;

    container.textContent = '';

    const box = document.createElement('div');
    box.setAttribute('data-signalbird-status', '');
    box.style.cssText =
      'display:flex;align-items:center;justify-content:center;gap:12px;' +
      `min-height:${options.minHeight ?? 220}px;font:13px/1.5 system-ui,-apple-system,sans-serif;` +
      'color:#6b7280;text-align:center;padding:24px;';

    const label = document.createElement('span');
    label.textContent = message;
    box.appendChild(label);

    if (withRetry) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = text.retry;
      button.style.cssText =
        'border:1px solid currentColor;border-radius:8px;background:transparent;' +
        'color:inherit;padding:4px 10px;font:inherit;cursor:pointer;';
      button.addEventListener('click', () => void render());
      box.appendChild(button);
    }

    container.appendChild(box);
  };

  /** Jetonu alır ve iframe'i kurar. Her çağrı YENİ jeton demektir. */
  const render = async (): Promise<void> => {
    if (!container || destroyed) return;

    clear();
    status(text.loading, false);

    const applied = resolveTheme(theme);
    let url: string | null = null;

    try {
      if (options.url) {
        // Elde hazır jeton varsa İLK kurulum onu kullanır: ev sahibi jetonu
        // zaten almış olabilir (ör. betiğin hangi kökenden yükleneceğini o
        // yanıttan öğrenir). Jeton tek kullanımlıktır, bu yüzden tüketilir;
        // sonraki `refresh()` çağrıları `mint` ister.
        url = options.url;
        options = { ...options, url: undefined };
      } else if (options.mint) {
        url = readUrl(
          await options.mint({ module: options.module, theme: applied, locale: options.locale }),
        );
      }
    } catch (error) {
      emit('error', error);
      status(error instanceof Error ? error.message : text.failed, true);

      return;
    }

    if (!url) {
      emit('error', new Error('EMBED_URL_MISSING'));
      status(text.expired, Boolean(options.mint));

      return;
    }

    // Tema/dil/vurgu adrese işlenir: gömülü ekran ev sahibiyle aynı görünsün.
    let target = url;

    try {
      const parsed = new URL(url);

      parsed.searchParams.set('theme', applied);
      if (options.locale) parsed.searchParams.set('locale', options.locale);
      if (options.accent) parsed.searchParams.set('accent', options.accent.replace(/^#/, ''));
      target = parsed.toString();
    } catch {
      // Göreli adres: olduğu gibi kullanılır.
    }

    const iframe = document.createElement('iframe');

    iframe.src = target;
    iframe.title = 'Signalbird';
    iframe.style.cssText = 'width:100%;border:0;display:block;';
    iframe.style.height = `${typeof options.height === 'number' ? options.height : options.minHeight ?? 640}px`;
    iframe.setAttribute('allow', 'clipboard-write; fullscreen; autoplay');
    /*
     * `allow-same-origin` ŞART: gömülü ekran jetonu KENDİ kökeninde oturuma
     * çevirir; sandbox onu kısarsa ekran hiç açılmaz. `allow-top-navigation`
     * VERİLMEZ — gömülü ekran ev sahibi panelin tamamını başka bir adrese
     * götüremesin. Ses (yeni mesaj) ve dosya yükleme için `allow-popups` ve
     * `allow-downloads` gerekir.
     */
    iframe.setAttribute(
      'sandbox',
      'allow-same-origin allow-scripts allow-forms allow-popups allow-downloads',
    );
    iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    iframe.setAttribute('loading', 'lazy');

    if (options.className) iframe.className = options.className;

    container.textContent = '';
    container.appendChild(iframe);
    frame = iframe;

    // Gömülü ekran yüksekliğini ve hazır olduğunu bildirir. Gönderen KONTROL
    // EDİLİR (`event.source`): sayfadaki başka bir iframe bizim çerçevemizi
    // büyütemesin.
    messageHandler = (event: MessageEvent) => {
      if (!frame || event.source !== frame.contentWindow) return;

      const data = event.data as { type?: string; px?: number; module?: string } | null;

      if (!data || typeof data.type !== 'string') return;

      if (data.type === 'signalbird:ready') {
        emit('ready', data.module);

        return;
      }

      if (data.type === 'signalbird:height' && typeof data.px === 'number') {
        emit('height', data.px);

        if ((options.height ?? 'auto') === 'auto') {
          const px = Math.max(data.px, options.minHeight ?? 220);

          frame.style.height = `${px}px`;
        }
      }
    };

    window.addEventListener('message', messageHandler);
  };

  return {
    async mount(targetSelector) {
      const element =
        typeof targetSelector === 'string' ? document.querySelector(targetSelector) : targetSelector;

      if (!(element instanceof HTMLElement)) {
        throw new Error('Signalbird: gömme kabı bulunamadı — ' + String(targetSelector));
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
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(handler);
    },

    off(event, handler) {
      listeners.get(event)?.delete(handler);
    },
  };
}
