/**
 * Signalbird widget — `dist/signalbird.js` (IIFE, global `Signalbird`).
 *
 * Tek satır kurulum:
 *   <script async src="https://signalbird.io/sdk/v1/signalbird.js"
 *           data-key="sb_public_live_…" data-channel="destek"></script>
 *
 * Betik yüklenince `data-key` varsa kendini başlatır; yoksa ev sahibi
 * `Signalbird.init({publicKey, chatKey})` çağırır. İki değer ayrıdır: anahtar
 * kimliği doğrular, kanal davranışı seçer (1 Eyl 2026 anahtar mimarisi). Buradaki HER dışa açık fonksiyon
 * try/catch içindedir: widget, ev sahibi sayfaya asla hata fırlatmaz —
 * sohbet balonunun çökmesi müşterinin ödeme sayfasını çökertmemeli.
 *
 * Genel API (docs/PLATFORM_EXPANSION §3.2):
 *   Signalbird.init({publicKey, chatKey?, baseUrl?, locale?, user?})
 *   Signalbird.identify({external_id, email, name, phone, attributes})
 *   Signalbird.chat.open() / close() / toggle() / isOpen() / on('unread', fn) / off(…)
 *   Signalbird.push.register({token, platform, provider?})
 *   Signalbird.embed({module, mint}).mount('#kap')   ← panel gömme (partner)
 *   Signalbird.destroy()
 */
import { ChatController } from './chat';
import { createEmbed } from '../embed/element';
import type { ApiResult, ChatEvent, IdentifyInput, InitOptions, PushRegisterInput } from './types';

declare const __SB_VERSION__: string;

/** Paket sürümü (VERSION dosyasından build sırasında yazılır). */
export const version: string = typeof __SB_VERSION__ === 'string' ? __SB_VERSION__ : '0.0.0';

type Listener = (payload?: unknown) => void;

let controller: ChatController | null = null;
/** `init` öncesi kaydedilen dinleyiciler; başlatınca denetleyiciye bağlanır. */
const pendingListeners: Array<{ event: ChatEvent; fn: Listener }> = [];
/** `init` öncesi gelen kimlik; başlatınca uygulanır. */
let pendingIdentify: IdentifyInput | null = null;

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch (error) {
    try {
      console.warn('[signalbird]', error);
    } catch {
      /* konsol bile yoksa sessiz */
    }
    return fallback;
  }
}

function swallow(promise: Promise<unknown>): void {
  promise.catch(() => undefined);
}

/**
 * Widget'ı başlatır. İkinci çağrı öncekini yıkar ve yeniden kurar
 * (SPA'da anahtar/locale değişince). Anahtarsız çağrı hiçbir şey yapmaz.
 */
export function init(options: InitOptions): void {
  safe(() => {
    if (!options || !options.publicKey) {
      console.warn('[signalbird] init: publicKey zorunlu');
      return;
    }
    if (typeof document === 'undefined' || typeof window === 'undefined') return;

    if (controller) controller.destroy();
    controller = new ChatController(options);

    for (const { event, fn } of pendingListeners) controller.on(event, fn);
    if (pendingIdentify) {
      const input = pendingIdentify;
      pendingIdentify = null;
      swallow(controller.identify(input));
    }
  }, undefined);
}

/** Oturum açmış kullanıcıyı ziyaretçiye bağlar (kişi upsert + sohbet oturumu). */
export function identify(input: IdentifyInput): void {
  safe(() => {
    if (!input) return;
    if (!controller) {
      pendingIdentify = { ...(pendingIdentify || {}), ...input };
      return;
    }
    swallow(controller.identify(input));
  }, undefined);
}

export const chat = {
  open(): void {
    safe(() => controller?.open(), undefined);
  },
  close(): void {
    safe(() => controller?.close(), undefined);
  },
  toggle(): void {
    safe(() => controller?.toggle(), undefined);
  },
  isOpen(): boolean {
    return safe(() => !!controller?.isOpen(), false);
  },
  /** `unread` (sayı), `open`, `close` */
  on(event: ChatEvent, fn: Listener): void {
    safe(() => {
      if (typeof fn !== 'function') return;
      pendingListeners.push({ event, fn });
      controller?.on(event, fn);
    }, undefined);
  },
  off(event: ChatEvent, fn: Listener): void {
    safe(() => {
      const idx = pendingListeners.findIndex((l) => l.event === event && l.fn === fn);
      if (idx >= 0) pendingListeners.splice(idx, 1);
      controller?.off(event, fn);
    }, undefined);
  },
};

export const push = {
  /**
   * Cihaz token'ını kaydeder (`POST /v1/sdk/devices`). Token'ı almak
   * (FCM/APNs/Web Push izni) ev sahibinin işidir; widget yalnız iletir.
   */
  register(input: PushRegisterInput): Promise<ApiResult<unknown>> {
    return safe(
      () => {
        if (!controller) {
          return Promise.resolve<ApiResult<unknown>>({
            ok: false,
            status: 0,
            code: 'NOT_INITIALIZED',
            message: 'Signalbird.init çağrılmadı',
          });
        }
        return controller.pushRegister(input).catch(
          (error): ApiResult<unknown> => ({ ok: false, status: 0, code: 'NETWORK_ERROR', message: String(error) })
        );
      },
      Promise.resolve<ApiResult<unknown>>({ ok: false, status: 0, code: 'WIDGET_ERROR', message: 'widget error' })
    );
  },
};

/**
 * Panel gömme — ziyaretçi sohbetiyle İLGİSİ YOKTUR, aynı betikte olmasının
 * sebebi tek kurulumdur: partner paneline zaten bir `<script>` koyuyorsa
 * ikincisini koymasın (KARAR 2026-08-27: "nereye çakarsak orda çalışsın").
 *
 *   Signalbird.embed({ module: 'chat', mint }).mount('#sb-chat')
 *
 * `init()` GEREKMEZ: gömme kimliği jetondan gelir, uygulama anahtarından değil.
 */
export const embed = createEmbed;

/** Widget'ı kaldırır: polling durur, DOM silinir. Ziyaretçi sırrı localStorage'da kalır. */
export function destroy(): void {
  safe(() => {
    controller?.destroy();
    controller = null;
  }, undefined);
}

// ── Otomatik başlatma ──────────────────────────────────────────────────
// `<script data-key data-channel>` — `document.currentScript` yalnız betik çalışırken
// doludur (async dahil); module/defer dışı senaryolarda da tutar. Bulunamazsa
// aynı isimde bir script etiketi aranır (ör. tag manager enjeksiyonu).
safe(() => {
  if (typeof document === 'undefined') return;
  const current =
    (document.currentScript as HTMLScriptElement | null) ||
    (document.querySelector('script[data-key][src*="signalbird"]') as HTMLScriptElement | null);
  const ds = current?.dataset;
  if (!ds || !ds.key) return;

  const start = () =>
    init({
      publicKey: ds.key!,
      // Kanal verilmezse sunucu 400 `MODULE_KEY_MISSING` döner ve widget
      // çizilmez — sessizce yanlış gelen kutusuna yazmaktansa doğrusu bu.
      chatKey: ds.channel || undefined,
      baseUrl: ds.baseUrl || undefined,
      locale: ds.locale || undefined,
      debug: ds.debug === 'true' || ds.debug === '1',
    });

  // Body henüz yoksa (head içine konmuş, defer'siz) DOM hazır olunca başla.
  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start, { once: true });
}, undefined);
