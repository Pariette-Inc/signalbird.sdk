/**
 * Küçük DOM yardımcıları — çerçeve yok, düz DOM. `h(tag, attrs, ...children)`
 * yeter; sanal DOM'a gerek yok, liste yeniden çizimi ucuzdur.
 */
type Child = Node | string | number | null | undefined | false;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: Record<string, unknown> | null,
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (attrs) {
    for (const key in attrs) {
      const value = attrs[key];
      if (value === undefined || value === null || value === false) continue;
      if (key === 'class') el.className = String(value);
      else if (key === 'style') el.setAttribute('style', String(value));
      else if (key.startsWith('on') && typeof value === 'function') {
        el.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
      } else if (key === 'html') el.innerHTML = String(value);
      else if (key in el && key !== 'list' && key !== 'form') (el as any)[key] = value;
      else el.setAttribute(key, String(value));
    }
  }
  append(el, children);
  return el;
}

export function append(el: Node, children: Child[]): void {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    el.appendChild(typeof child === 'object' ? child : document.createTextNode(String(child)));
  }
}

export function clear(el: Node): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}

/** SVG ikonlar — path verisi tek satır, boyut CSS'ten. */
export function icon(name: keyof typeof ICONS, size = 18): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.innerHTML = ICONS[name];
  return svg;
}

/**
 * Marka işareti — sinyal hattına tünemiş origami kuş.
 *
 * KARAR 2026-08-29 (Ahmet): "Chatbot ikonunda Signalbird logosu (kuş) olsun.
 * Neden olmasın ki?"
 *
 * Panel logosunun (signalbird.web `SignalbirdLogo`) SADELEŞTİRİLMİŞ hâlidir ve
 * bu bilinçli: balon 26 pikseldir; ayaklar, katlama çizgileri ve sinyal hattı
 * o boyutta birbirine girip lekeye döner. Kalan siluet — gövde, kafa, gaga,
 * göz — kuşu tanıtmaya yeter.
 *
 * `currentColor` ile boyanır: balonun rengini müşteri seçiyor, işaret onun
 * üstünde okunaklı kalmalı. Kontür ayrı bir renk kullansaydı, koyu temada
 * kaybolur ya da açık temada kirli görünürdü.
 */
export function brandIcon(size = 26): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '10 2 28 38');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML =
    // gövde ve kafa yüzeyleri (dolgu, düşük opaklık)
    '<path d="M16 16 L30 16 L33 18 L24 33 L15 18 Z" fill="currentColor" fill-opacity=".18" stroke="none"/>' +
    '<path d="M23 4 L31 9 L23 14 L16 9 Z" fill="currentColor" fill-opacity=".28" stroke="none"/>' +
    // gövde konturu — kanat ucu dahil
    '<path d="M30 16 L33 18 L36 27 L34 34 L41 32 L44 38 L31 37 L24 37 L17 35 L13 27 L15 18 L16 16"/>' +
    // kafa konturu
    '<path d="M16 16 L16 9 L23 4 L31 9 L30 16"/>' +
    // gaga
    '<path d="M21.4 12.4 L23.2 18.6 L25 12.4 Z" fill="currentColor" fill-opacity=".35"/>' +
    // göz
    '<circle cx="28.4" cy="11.4" r="1.6" fill="currentColor" stroke="none"/>';
  return svg;
}

const ICONS = {
  chat: '<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5z"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
  send: '<path d="m22 2-7 20-4-9-9-4 20-7z"/><path d="M22 2 11 13"/>',
  clip: '<path d="m21.4 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',
  file: '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><path d="M14 2v6h6"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  checks: '<path d="M18 6 7 17l-4-4"/><path d="m22 10-7.5 7.5L13 16"/>',
  reply: '<path d="M9 17H5a2 2 0 0 1-2-2V9"/><path d="m3 9 4-4"/><path d="m3 9 4 4"/><path d="M9 17h6a6 6 0 0 0 0-12h-2"/>',
  more: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  star: '<path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  smile: '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9h.01M15 9h.01"/>',
  done: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m22 4-10 10-3-3"/>',
};

export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
