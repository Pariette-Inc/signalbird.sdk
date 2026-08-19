/**
 * Uyarlanabilir aralıklı polling (penyu deseni — WebSocket yok).
 *
 * Panel kapalıyken merdiven: 20 s ×3 → 60 s ×2 → 180 s. Her yeni veri
 * merdiveni başa sarar. Panel açıkken sabit 3 s.
 *
 * `setTimeout` kendini yeniden kurar (`setInterval` değil): önceki istek
 * bitmeden yenisi başlamaz, sekme uyuyunca istekler üst üste yığılmaz.
 * Sekme gizliyken ya da çevrimdışıyken tur ATLANIR ama merdiven ilerlemez —
 * kullanıcı geri geldiğinde ilk turda tazelenir (`visibilitychange` sıfırlar).
 */
const IDLE_LADDER = [20000, 20000, 20000, 60000, 60000, 180000];
const OPEN_INTERVAL = 3000;

export class Poller {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private step = 0;
  private open = false;
  private running = false;
  private stopped = true;

  constructor(private readonly tick: () => Promise<boolean | void>) {
    this.onVisible = this.onVisible.bind(this);
  }

  start(): void {
    this.stopped = false;
    document.addEventListener('visibilitychange', this.onVisible);
    window.addEventListener('online', this.onVisible);
    this.schedule(0);
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    document.removeEventListener('visibilitychange', this.onVisible);
    window.removeEventListener('online', this.onVisible);
  }

  setOpen(open: boolean): void {
    this.open = open;
    this.step = 0;
    this.schedule(open ? 0 : OPEN_INTERVAL);
  }

  /** Bir eylem sonrası (mesaj gönderildi) hemen tazele ve merdiveni sıfırla. */
  poke(delay = 0): void {
    this.step = 0;
    this.schedule(delay);
  }

  private onVisible(): void {
    if (document.hidden) return;
    this.step = 0;
    this.schedule(0);
  }

  private interval(): number {
    return this.open ? OPEN_INTERVAL : IDLE_LADDER[Math.min(this.step, IDLE_LADDER.length - 1)];
  }

  private schedule(delay = this.interval()): void {
    if (this.stopped) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.run(), delay);
  }

  private async run(): Promise<void> {
    if (this.stopped || this.running) return;

    // Gizli sekme / çevrimdışı: tur atlanır, merdiven ilerlemez.
    if (document.hidden || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
      this.schedule();
      return;
    }

    this.running = true;
    let activity = false;
    try {
      activity = (await this.tick()) === true;
    } catch {
      /* hata polling'i durdurmaz */
    } finally {
      this.running = false;
    }

    if (activity) this.step = 0;
    else if (!this.open) this.step = Math.min(this.step + 1, IDLE_LADDER.length - 1);

    this.schedule();
  }
}
