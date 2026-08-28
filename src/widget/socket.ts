/**
 * Canlı bağlantı — bağımlılıksız socket.io istemcisi.
 *
 * KARAR 2026-08-29 (Ahmet): "Chat sistemi hiç durmadan sürekli request atıyor.
 * Bu böyle olmaz, köylü işi bu. WebSocket kurmamız lazım."
 *
 * ── NİYE `socket.io-client` DEĞİL ─────────────────────────────────────────
 *
 * Widget'a paket eklenmez (CLAUDE.md kuralı): 20 KB gzip'lik balona 40 KB'lık
 * bir kütüphane koymak, sohbeti açmak için sayfayı yavaşlatmaktır. Sunucu
 * tarafında socket.io var (odalar, yeniden bağlanma, bakım kolaylığı) ama
 * tarayıcı tarafında bize gereken protokol parçası küçük.
 *
 * ── PROTOKOL (Engine.IO v4 + Socket.IO v5) ────────────────────────────────
 *
 * Ham WebSocket üzerinden, metin çerçeveleri:
 *
 *   ← `0{"sid":…,"pingInterval":…}`   Engine.IO açılış
 *   → `40`                            ana ad alanına bağlan
 *   ← `40{"sid":…}`                   bağlandı — BU `sid` socket.id'dir
 *   → `42["subscribe",{…}]`           olay
 *   ← `42["chat.message",{…}]`        sunucu olayı
 *   ← `2` / → `3`                     ping / pong (ping'i SUNUCU atar; biz
 *                                      yalnız cevaplarız — sessiz bağlantıyı
 *                                      canlı tutmak onun işi)
 *
 * `transports: ['websocket']` sunucuda zorunlu tutuluyor, yani uzun yoklamaya
 * (polling) düşme ihtimali yok — zaten kaçtığımız şey o.
 */

export interface SocketConfig {
  enabled: boolean;
  /** `https://ws.signalbird.io` — bootstrap yanıtından gelir. */
  url?: string;
}

export interface SocketEvent {
  name: string;
  data: Record<string, unknown>;
}

/** Kanal imzasını API'den alan işlev. */
type AuthFn = (socketId: string, channel: string) => Promise<{ auth: string; at: number } | null>;

/** Yeniden bağlanma merdiveni (ms). Sonuncusu tekrarlanır. */
const BACKOFF = [1000, 2000, 5000, 10000, 30000];

export class Socket {
  private ws: WebSocket | null = null;
  private sid: string | null = null;
  private attempt = 0;
  private closed = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pending = new Set<string>();
  private joined = new Set<string>();

  constructor(
    private readonly config: SocketConfig,
    private readonly auth: AuthFn,
    private readonly onEvent: (event: SocketEvent) => void,
    private readonly onState: (connected: boolean) => void,
    private readonly log: (...args: unknown[]) => void = () => {},
  ) {}

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN && this.sid !== null;
  }

  connect(): void {
    if (!this.config.enabled || !this.config.url) return;
    if (typeof WebSocket === 'undefined') return;
    if (this.ws) return;

    this.closed = false;

    // `https://…` → `wss://…/socket.io/?EIO=4&transport=websocket`
    const base = this.config.url.replace(/^http/, 'ws').replace(/\/$/, '');
    const url = `${base}/socket.io/?EIO=4&transport=websocket`;

    try {
      this.ws = new WebSocket(url);
    } catch (e) {
      this.log('socket open failed', e);
      this.retry();
      return;
    }

    this.ws.onmessage = (ev) => this.handle(String(ev.data));
    this.ws.onclose = () => this.retry();
    this.ws.onerror = () => {
      // `onerror`dan sonra `onclose` da gelir; yeniden bağlanma orada yönetilir
      // ki iki zincir birden kurulmasın.
      this.log('socket error');
    };
  }

  /** Kanala abone ol. Bağlantı yoksa kuyruğa alınır, kurulunca gönderilir. */
  subscribe(channel: string): void {
    if (this.joined.has(channel) || this.pending.has(channel)) return;

    this.pending.add(channel);

    if (this.connected) void this.flush();
  }

  close(): void {
    this.closed = true;

    if (this.timer) clearTimeout(this.timer);

    this.timer = null;
    this.joined.clear();

    try {
      this.ws?.close();
    } catch {
      /* yut */
    }

    this.ws = null;
    this.sid = null;
  }

  // ── Protokol ─────────────────────────────────────────────────────────

  private handle(frame: string): void {
    // Engine.IO paket türü ilk karakterdir.
    const type = frame[0];

    if (type === '0') {
      // Açılış — asıl kimlik Socket.IO `40` yanıtında gelir.
      this.send('40');
      return;
    }

    if (type === '2') {
      this.send('3'); // ping → pong
      return;
    }

    if (type !== '4') return; // yalnız MESSAGE paketleri ilgilendiriyor

    const sub = frame[1];
    const body = frame.slice(2);

    // `40{…}` — ad alanına bağlandık.
    if (sub === '0') {
      try {
        this.sid = String(JSON.parse(body || '{}').sid || '');
      } catch {
        this.sid = '';
      }

      this.attempt = 0;
      this.onState(true);
      void this.flush();
      return;
    }

    // `42[…]` — sunucu olayı. `43N[…]` (ack) bizi ilgilendirmiyor: abonelik
    // sonucunu zaten bir sonraki yayında görürüz.
    if (sub === '2') {
      let parsed: unknown;

      try {
        parsed = JSON.parse(body);
      } catch {
        return;
      }

      if (!Array.isArray(parsed)) return;

      const [name, data] = parsed as [string, Record<string, unknown>];

      if (typeof name === 'string' && name.startsWith('chat.')) {
        this.onEvent({ name, data: data ?? {} });
      }
    }
  }

  /**
   * Bekleyen kanallar için imza al ve `subscribe` yolla.
   *
   * İmza her BAĞLANTIDA yeniden alınır: `socket_id`e bağlı ve zaman damgalı.
   * Saklamak, ikinci bağlantıda sessizce reddedilmek demekti.
   */
  private async flush(): Promise<void> {
    const sid = this.sid;

    if (!sid) return;

    for (const channel of Array.from(this.pending)) {
      try {
        const signed = await this.auth(sid, channel);

        if (!signed) {
          // Sunucu "hayır" dediyse tekrar sormak yalnız istek üretir.
          this.pending.delete(channel);
          continue;
        }

        this.emit('subscribe', { channel, auth: signed.auth, at: signed.at });
        this.pending.delete(channel);
        this.joined.add(channel);
      } catch (e) {
        this.log('subscribe failed', channel, e);
      }
    }
  }

  /**
   * Olay yolla — ACK İSTEMEDEN.
   *
   * `subscribe`in sonucunu beklemek bir tur daha protokol yönetmek demekti;
   * oysa sonucu zaten davranıştan görüyoruz: imza tutmadıysa yayın gelmez ve
   * polling merdiveni işini yapmaya devam eder.
   */
  private emit(event: string, payload: unknown): void {
    this.send(`42${JSON.stringify([event, payload])}`);
  }

  private send(frame: string): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return;

    try {
      this.ws.send(frame);
    } catch {
      /* yut */
    }
  }

  private retry(): void {
    this.ws = null;
    this.sid = null;

    // Kopan bağlantıdaki abonelikler yeni bağlantıda yeniden kurulmalı:
    // imza socket_id'ye bağlı, eskisi geçersiz.
    this.joined.forEach((c) => this.pending.add(c));
    this.joined.clear();
    this.onState(false);

    if (this.closed) return;

    const delay = BACKOFF[Math.min(this.attempt, BACKOFF.length - 1)];
    this.attempt++;

    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.connect(), delay);
  }
}
