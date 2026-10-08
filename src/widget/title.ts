/**
 * Sekme başlığı yanıp sönmesi: okunmamış mesaj varken ve sekme gizliyken
 * `document.title` ile "(2) Yeni mesaj" dönüşümlü gösterilir. Sekme görünür
 * olunca özgün başlık geri gelir.
 */
export class TitleBlinker {
  private original: string | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private label = '';

  update(unread: number, labelFor: (n: number) => string): void {
    if (unread > 0 && document.hidden) {
      this.label = labelFor(unread);
      this.begin();
    } else {
      this.end();
    }
  }

  private begin(): void {
    if (this.timer) return;
    this.original = document.title;
    let flip = false;
    this.timer = setInterval(() => {
      if (!document.hidden) return this.end();
      flip = !flip;
      document.title = flip ? this.label : this.original || '';
    }, 1200);
  }

  end(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.original !== null) {
      document.title = this.original;
      this.original = null;
    }
  }
}
