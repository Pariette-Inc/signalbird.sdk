/**
 * Canlı bağlantı — bağımlılıksız Pusher/Reverb istemcisi.
 *
 * KARAR 2026-08-29 (Ahmet): "Chat sistemi hiç durmadan sürekli request atıyor.
 * Bu böyle olmaz, köylü işi bu. WebSocket kurmamız lazım."
 *
 * ── NİYE `pusher-js` DEĞİL ────────────────────────────────────────────────
 *
 * Widget'a paket eklenmez (CLAUDE.md kuralı): 19 KB gzip'lik balona 30 KB'lık
 * bir kütüphane koymak, sohbeti açmak için sayfayı yavaşlatmaktır. Reverb'ün
 * konuştuğu Pusher sözleşmesinin bize gereken kısmı çok küçük: bağlan, özel
 * kanala abone ol, olayları dinle, ping'e cevap ver. Aşağısı o kadar.
 *
 * ── SOKET VERİYİ GETİRMEZ, HABERİ GETİRİR ─────────────────────────────────
 *
 * Sunucu yayınında mesaj gövdesi YOK (bkz. api/app/Events/Chat). Soket
 * "konuşmada hareket var" der, widget bir kez çeker. Bu yüzden polling
 * silinmedi: soket bağlıyken merdiven çok yavaşlar, koptuğunda kendiliğinden
 * eski hâline döner. Tek yolun soket olduğu bir sohbet, ilk vekil sunucu
 * WebSocket'i kesince ölürdü.
 */

export interface SocketConfig {
  enabled: boolean;
  key?: string;
  host?: string;
  port?: number;
  scheme?: string;
}

/** Sunucudan gelen olay: `chat.message` | `chat.conversation` | `chat.typing` */
export interface SocketEvent {
  name: string;
  data: Record<string, unknown>;
}

type AuthFn = (socketId: string, channel: string) => Promise<string | null>;

const PROTOCOL = 7;
const CLIENT = 'signalbird-widget';

/** Yeniden bağlanma merdiveni (ms). Sonuncusu tekrarlanır. */
const BACKOFF = [1000, 2000, 5000, 10000, 30000];

export class Socket {
  private ws: WebSocket | null = null;
  private socketId: string | null = null;
  private attempt = 0;
  private closed = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private pending = new Set<string>();
  private subscribed = new Set<string>();

  constructor(
    private readonly config: SocketConfig,
    private readonly auth: AuthFn,
    private readonly onEvent: (event: SocketEvent) => void,
    private readonly onState: (connected: boolean) => void,
    private readonly log: (...args: unknown[]) => void = () => {},
  ) {}

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN && this.socketId !== null;
  }

  connect(): void {
    if (!this.config.enabled || !this.config.key || !this.config.host) return;
    if (typeof WebSocket === 'undefined') return;
    if (this.ws) return;

    this.closed = false;

    const scheme = this.config.scheme === 'http' ? 'ws' : 'wss';
    const port = this.config.port && this.config.port !== 443 && this.config.port !== 80 ? `:${this.config.port}` : '';
    const url = `${scheme}://${this.config.host}${port}/app/${this.config.key}?protocol=${PROTOCOL}&client=${CLIENT}&version=1`;

    try {
      this.ws = new WebSocket(url);
    } catch (e) {
      this.log('socket open failed', e);
      this.retry();
      return;
    }

    this.ws.onmessage = (ev) => this.handle(ev);
    this.ws.onclose = () => this.retry();
    this.ws.onerror = () => {
      // `onerror`dan sonra `onclose` da gelir; yeniden bağlanmayı orada
      // yönetiyoruz ki iki kez zincir kurulmasın.
      this.log('socket error');
    };
  }

  /** Kanala abone ol. Bağlantı yoksa kuyruğa alınır; kurulunca gönderilir. */
  subscribe(channel: string): void {
    if (this.subscribed.has(channel) || this.pending.has(channel)) return;

    this.pending.add(channel);

    if (this.connected) void this.flush();
  }

  close(): void {
    this.closed = true;
    if (this.timer) clearTimeout(this.timer);
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.timer = null;
    this.pingTimer = null;
    this.subscribed.clear();

    try {
      this.ws?.close();
    } catch {
      /* yut */
    }

    this.ws = null;
    this.socketId = null;
  }

  // ── İç işleyiş ───────────────────────────────────────────────────────

  private handle(ev: MessageEvent): void {
    let frame: { event?: string; data?: unknown; channel?: string };

    try {
      frame = JSON.parse(String(ev.data));
    } catch {
      return;
    }

    // Pusher `data`yı bazen dize olarak yollar, bazen nesne.
    const data =
      typeof frame.data === 'string'
        ? (() => {
            try {
              return JSON.parse(frame.data as string);
            } catch {
              return {};
            }
          })()
        : ((frame.data ?? {}) as Record<string, unknown>);

    switch (frame.event) {
      case 'pusher:connection_established':
        this.socketId = String((data as { socket_id?: string }).socket_id ?? '');
        this.attempt = 0;
        this.onState(true);
        this.startPing();
        void this.flush();
        return;

      case 'pusher:ping':
        this.send({ event: 'pusher:pong', data: {} });
        return;

      case 'pusher:error':
        this.log('socket rejected', data);
        return;

      case 'pusher_internal:subscription_succeeded':
        if (frame.channel) {
          this.pending.delete(frame.channel);
          this.subscribed.add(frame.channel);
        }
        return;

      default:
        // Sunucu olayları `chat.*` adıyla gelir (broadcastAs).
        if (frame.event && frame.event.startsWith('chat.')) {
          this.onEvent({ name: frame.event, data });
        }
    }
  }

  /**
   * Bekleyen kanallar için imza al ve abone ol.
   *
   * İmza her BAĞLANTIDA yeniden alınır: Pusher imzası `socket_id`e bağlıdır
   * ve yeniden bağlanınca o kimlik değişir. Saklamak, ikinci bağlantıda
   * sessizce reddedilmek demekti.
   */
  private async flush(): Promise<void> {
    const socketId = this.socketId;

    if (!socketId) return;

    for (const channel of Array.from(this.pending)) {
      try {
        const auth = await this.auth(socketId, channel);

        if (!auth) {
          // Yetki yoksa bir daha denemeyiz: sunucu "hayır" dediyse tekrar
          // sormak yalnız istek üretir.
          this.pending.delete(channel);
          continue;
        }

        this.send({ event: 'pusher:subscribe', data: { channel, auth } });
      } catch (e) {
        this.log('subscribe failed', channel, e);
      }
    }
  }

  private send(frame: unknown): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return;

    try {
      this.ws.send(JSON.stringify(frame));
    } catch {
      /* yut */
    }
  }

  /**
   * Sessiz bağlantıyı canlı tutar.
   *
   * Vekil sunucular ve mobil ağlar 30–120 saniye sessiz kalan bir soketi
   * kapatır. Sunucu da ping atar ama önce bizim sessizliğimiz cezalandırılır;
   * 30 saniyede bir ping, bağlantıyı ucuza ayakta tutar.
   */
  private startPing(): void {
    if (this.pingTimer) clearInterval(this.pingTimer);

    this.pingTimer = setInterval(() => this.send({ event: 'pusher:ping', data: {} }), 30000);
  }

  private retry(): void {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = null;
    this.ws = null;
    this.socketId = null;
    this.subscribed.forEach((c) => this.pending.add(c));
    this.subscribed.clear();
    this.onState(false);

    if (this.closed) return;

    const delay = BACKOFF[Math.min(this.attempt, BACKOFF.length - 1)];
    this.attempt++;

    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.connect(), delay);
  }
}
