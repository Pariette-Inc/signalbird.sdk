/**
 * Cloudflare Turnstile - tembel, tek kullanımlık jeton (CONTRACT §15.1).
 *
 * Betik YALNIZ sunucu `captcha` gönderdiyse ve widget ilk kez açıldığında
 * (ya da jeton gerçekten gerektiğinde) eklenir: sohbeti hiç açmayan
 * ziyaretçiye üçüncü taraf betik indirilmez. Widget'a bağımlılık girmez;
 * Turnstile çalışma anında Cloudflare'den gelir.
 *
 * Her `token()` çağrısı YENİ bir Turnstile örneği çizer ve jeton gelince onu
 * söker: jetonlar tek kullanımlıktır, biri ikinci isteğe taşınmaz.
 * `interaction-only`: Cloudflare etkileşim istemedikçe ziyaretçi hiçbir şey
 * görmez; isterse kutu panelin içindeki kapta çıkar.
 *
 * Hiçbir yol istisna fırlatmaz: betik yüklenemezse ya da jeton gelmezse
 * `null` döner ve çağrı jetonsuz gider - kararı sunucu verir.
 */
import type { CaptchaConfig } from './types';

const SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
/** Etkileşimli doğrulamada ziyaretçiye tanınan süre. */
const TIMEOUT_MS = 120000;

interface Turnstile {
  render(el: HTMLElement, opts: Record<string, unknown>): string | undefined;
  remove(id: string): void;
}

let loading: Promise<Turnstile | null> | null = null;

function api(): Turnstile | null {
  return ((window as any).turnstile as Turnstile | undefined) || null;
}

/** Betiği bir kez ekler; sayfada zaten varsa (site kendisi yüklediyse) onu kullanır. */
function load(): Promise<Turnstile | null> {
  if (api()) return Promise.resolve(api());
  if (loading) return loading;

  loading = new Promise<Turnstile | null>((resolve) => {
    try {
      const s = document.createElement('script');
      s.src = SRC;
      s.async = true;
      s.onload = () => {
        // `render=explicit`: global onload'dan hemen sonra hazırdır; yine de
        // kısa bir yoklama, yavaş cihazda `turnstile` tanımlanmadan dönülmesin.
        let tries = 0;
        const wait = () => (api() || tries++ > 50 ? resolve(api()) : setTimeout(wait, 50));
        wait();
      };
      s.onerror = () => {
        loading = null; // bir sonraki açılışta yeniden denenebilsin
        resolve(null);
      };
      document.head.appendChild(s);
    } catch {
      loading = null;
      resolve(null);
    }
  });

  return loading;
}

export class Captcha {
  constructor(
    private readonly config: CaptchaConfig,
    /** Turnstile'ın çizileceği kap - Shadow DOM'a slot ile yansıyan ışık-DOM elemanı. */
    private readonly mountPoint: () => HTMLElement | null,
    private readonly locale: string,
    private readonly log: (...args: unknown[]) => void
  ) {}

  /** Panel açıldığında: betiği ısıt, jeton gerektiğinde beklenmesin. */
  preload(): void {
    void load();
  }

  /** Tek kullanımlık jeton; alınamazsa `null`. */
  async token(action: string): Promise<string | null> {
    if (this.config.provider && this.config.provider !== 'turnstile') return null;

    const ts = await load();
    const host = this.mountPoint();

    if (!ts || !host) {
      this.log('captcha unavailable');
      return null;
    }

    return new Promise<string | null>((resolve) => {
      const box = document.createElement('div');
      let id: string | undefined;
      let done = false;

      const finish = (value: string | null) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        try {
          if (id) ts.remove(id);
        } catch {
          /* yok say */
        }
        box.remove();
        resolve(value);
      };

      const timer = setTimeout(() => finish(null), TIMEOUT_MS);

      try {
        host.appendChild(box);
        id = ts.render(box, {
          sitekey: this.config.site_key,
          action,
          appearance: 'interaction-only',
          language: this.locale,
          callback: (t: string) => finish(t || null),
          'error-callback': () => {
            this.log('captcha error');
            finish(null);
          },
          'expired-callback': () => finish(null),
          'timeout-callback': () => finish(null),
        });
      } catch (e) {
        this.log('captcha render failed', e);
        finish(null);
      }
    });
  }
}
