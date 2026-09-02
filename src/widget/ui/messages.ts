/**
 * Mesaj listesi çizimi: boş ekran, gün ayraçları, GRUPLANMIŞ kabarcıklar,
 * ekler, yanıt alıntısı, tepkiler, ✓/✓✓ ve eylem çubuğu.
 *
 * ── GRUPLAMA (2 Eyl 2026) ────────────────────────────────────────────────
 * Aynı kişinin arka arkaya (5 dk içinde) yazdığı mesajlar tek bir öbek gibi
 * çizilir: avatar yalnız öbeğin SON satırında, saat yalnız son satırda,
 * aradaki boşluk 2px ve köşeler sürekli. Her mesaja avatar+saat basmak
 * sohbeti bir kayıt listesine benzetiyordu; gruplanınca konuşmaya benziyor.
 *
 * Her değişimde liste baştan çizilir — yüzlerce mesajda bile ucuz ve "hangi
 * satır değişti" muhasebesinden çok daha az hata üretir. Kaydırma konumu
 * korunur: kullanıcı en alttaysa altta kalır, değilse yerinde durur.
 */
import { h, icon, clear, fileSize, avatarNode, initials } from './dom';
import type { Message, Attachment } from '../types';
import type { Strings } from '../i18n';

export const QUICK_EMOJI = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

/** Kompozitördeki seçicinin listesi — tam emoji klavyesi widget'a girmez. */
export const EMOJI_PICKER = [
  '😀', '😄', '😊', '🙂', '😉', '😍', '🤩', '😎',
  '🤔', '😐', '😕', '🙁', '😢', '😭', '😡', '🤯',
  '👍', '👎', '👏', '🙏', '💪', '🔥', '✅', '❤️',
];

const EDIT_WINDOW_MS = 15 * 60 * 1000;
/** Bu süreden uzun aradan sonra yazılan mesaj yeni öbek başlatır. */
const GROUP_GAP_MS = 5 * 60 * 1000;

export interface MessageActions {
  reply(m: Message): void;
  react(m: Message, emoji: string): void;
  edit(m: Message): void;
  remove(m: Message): void;
  retry(m: Message): void;
  openImage(url: string): void;
}

export interface RenderCtx {
  t: Strings;
  locale: string;
  messages: Message[];
  greeting: string | null;
  agentName: string;
  find(id: string | null | undefined): Message | undefined;
  actions: MessageActions;
  /* ── Aşağısı arayüz katmanının kendi eklediği bağlam (chat.ts vermez) ── */
  agentAvatar?: string | null;
  /** Boş ekrandaki hazır başlangıçlar; boşsa çip çizilmez. */
  quick?: string[];
  onQuick?(text: string): void;
  /** Yanıt süresi vaadi — boş ekranda karşılamanın altında görünür. */
  responseHint?: string | null;
  /**
   * Müşterinin adı. Boş ekranda ajan HENÜZ atanmamıştır; orada "Destek"
   * yazan bir baş harf yerine markanın kendisi görünmeli.
   */
  brandName?: string | null;
}

export function renderMessages(list: HTMLElement, ctx: RenderCtx): void {
  const atBottom = isAtBottom(list);
  const first = list.childNodes.length === 0;
  const seen = collectSeen(list);
  clear(list);

  if (ctx.messages.length === 0) {
    list.appendChild(hero(ctx));
    return;
  }

  let lastDay = '';

  for (let i = 0; i < ctx.messages.length; i++) {
    const m = ctx.messages[i];
    const day = dayKey(m.created_at);
    const prev = day === lastDay ? ctx.messages[i - 1] || null : null;
    const next = ctx.messages[i + 1] || null;

    if (day !== lastDay) {
      list.appendChild(h('div', { class: 'day' }, dayLabel(m.created_at, ctx)));
      lastDay = day;
    }

    list.appendChild(renderRow(m, ctx, prev, sameDay(m, next) ? next : null, !first && !seen.has(m.id)));
  }

  if (atBottom || first) scrollToBottom(list);
}

export function isAtBottom(list: HTMLElement, slack = 60): boolean {
  return list.scrollHeight - list.scrollTop - list.clientHeight < slack;
}

export function scrollToBottom(list: HTMLElement, smooth = false): void {
  if (smooth && typeof list.scrollTo === 'function') {
    list.scrollTo({ top: list.scrollHeight, behavior: 'smooth' });
    return;
  }
  list.scrollTop = list.scrollHeight;
}

/** Çizimden önce listede olan mesajlar — yalnız YENİ gelenler animasyonlanır. */
function collectSeen(list: HTMLElement): Set<string> {
  const seen = new Set<string>();
  list.querySelectorAll('[data-id]').forEach((el) => {
    const id = (el as HTMLElement).dataset.id;
    if (id) seen.add(id);
  });
  return seen;
}

/**
 * Boş ekran — form duvarı değil, davet.
 *
 * KARAR 2026-09-02 (Ahmet: "kendini fark ettirme"). Ziyaretçi paneli
 * açtığında eskiden tek bir gri karşılama balonu görüyordu. Şimdi: ajanın
 * yüzü, karşılama cümlesi, yanıt süresi vaadi ve tek dokunuşla sohbeti
 * başlatan konu çipleri. "Ne yazacağımı bilmiyorum" en sık terk sebebidir;
 * çipler o eşiği kaldırır.
 */
function hero(ctx: RenderCtx): HTMLElement {
  const box = h('div', { class: 'hero' });

  box.appendChild(h('div', { class: 'hv' }, h('span', null, avatarNode(ctx.agentAvatar, ctx.brandName || ctx.agentName))));
  box.appendChild(h('h4', null, ctx.greeting || ctx.t.greeting));
  if (ctx.responseHint) box.appendChild(h('p', null, ctx.responseHint));

  const quick = ctx.quick || [];
  if (quick.length && ctx.onQuick) {
    const row = h('div', { class: 'qk' });
    for (const label of quick.slice(0, 6)) {
      row.appendChild(h('button', { type: 'button', onclick: () => ctx.onQuick!(label) }, label));
    }
    box.appendChild(row);
  }

  return box;
}

function renderRow(
  m: Message,
  ctx: RenderCtx,
  prev: Message | null,
  next: Message | null,
  fresh: boolean
): HTMLElement {
  const side = m.sender_type === 'visitor' ? 'v' : m.sender_type === 'system' ? 's' : 'a';
  const startsGroup = !grouped(prev, m);
  const endsGroup = !grouped(m, next);

  const row = h('div', {
    class:
      `row ${side}` +
      (startsGroup && prev ? ' gap' : '') +
      (endsGroup ? '' : ' mid') +
      (m._pending ? ' pend' : '') +
      (m._failed ? ' fail' : '') +
      (fresh ? ' new' : ''),
    'data-id': m.id,
  });

  if (side === 's') {
    row.appendChild(h('div', { class: 'bb' }, m.body || ''));
    return row;
  }

  // Avatar yalnız ajan tarafında ve yalnız öbeğin son satırında; ara
  // satırlarda görünmez bir kopya yer tutar ki baloncuklar hizada kalsın.
  if (side === 'a') {
    row.appendChild(
      h('div', { class: `av${endsGroup ? '' : ' gh'}` }, avatarNode(ctx.agentAvatar, m.sender_name || ctx.agentName))
    );
  }

  const col = h('div', { class: 'cl' });
  const bubble = h('div', { class: `bb${m.deleted_at ? ' del' : ''}` });

  if (m.deleted_at) {
    bubble.textContent = ctx.t.deleted;
    col.appendChild(bubble);
    row.appendChild(col);
    return row;
  }

  // Yanıt alıntısı
  if (m.reply_to_id) {
    const target = ctx.find(m.reply_to_id);
    const who = target ? (target.sender_type === 'visitor' ? ctx.t.you : target.sender_name || ctx.agentName) : '';
    bubble.appendChild(h('span', { class: 'q' }, who ? `${who}: ` : '', target ? snippet(target, ctx.t) : '…'));
  }

  // Henüz yüklenmemiş ekler: yerel önizleme
  if (m._files && m._files.length) {
    const imgs = h('div', { class: 'imgs' });
    for (const f of m._files) {
      if (f.type.startsWith('image/')) imgs.appendChild(h('img', { src: URL.createObjectURL(f), alt: f.name }));
      else bubble.appendChild(fileRow({ id: '', name: f.name, url: '', mime: f.type, size: f.size }, ctx));
    }
    if (imgs.childNodes.length) bubble.appendChild(imgs);
  }

  const files = m.attachments || [];
  const images = files.filter((a) => isImage(a.mime));
  if (images.length) {
    const imgs = h('div', { class: 'imgs' });
    for (const a of images) {
      imgs.appendChild(h('img', { src: a.url, alt: a.name, loading: 'lazy', onclick: () => ctx.actions.openImage(a.url) }));
    }
    bubble.appendChild(imgs);
  }
  for (const a of files.filter((f) => !isImage(f.mime))) bubble.appendChild(fileRow(a, ctx));

  /*
   * ÇEVİRİ YALNIZ KARŞI TARAFIN MESAJINDA GÖSTERİLİR.
   *
   * `translation` HEDEF dile çevrilmiş metindir ve hedef, mesajı OKUYACAK
   * tarafın dilidir: ziyaretçininki ajanın diline, ajanınki ziyaretçinin
   * diline çevrilir. Ziyaretçinin kendi mesajındaki çeviri ona değil ajana
   * aittir — 29 Ağu 2026'da canlıda ziyaretçi kendi İngilizce cümlesini
   * sayfayı tazeledikten sonra Türkçeye çevrilmiş buluyordu.
   */
  const shown = (side === 'v' ? null : m.translation?.body) || m.body;
  if (shown) bubble.appendChild(linkify(shown));

  if (m._failed) {
    bubble.appendChild(h('div', { style: 'font-size:11px;margin-top:5px;font-weight:600' }, ctx.t.failed));
    bubble.addEventListener('click', () => ctx.actions.retry(m));
  }

  col.appendChild(bubble);

  // Tepkiler — baloncuğun alt kenarına biner
  const reactions = m.reactions && Object.keys(m.reactions).length ? m.reactions : null;
  if (reactions) {
    const rx = h('div', { class: 'rx' });
    for (const emoji in reactions) {
      const users = reactions[emoji] || [];
      if (!users.length) continue;
      const mine = users.includes('visitor');
      rx.appendChild(
        h('button', { class: mine ? 'me' : '', type: 'button', onclick: () => ctx.actions.react(m, emoji) },
          `${emoji} ${users.length}`)
      );
    }
    if (rx.childNodes.length) col.appendChild(rx);
  }

  // Saat + ✓✓ + "düzenlendi" — yalnız öbeğin son satırında
  if (endsGroup) {
    const meta = h('div', { class: 'mt' }, timeLabel(m.created_at, ctx.locale));
    if (m.edited_at) meta.appendChild(h('span', { class: 'ed' }, `· ${ctx.t.edited}`));
    if (side === 'v' && !m._failed) {
      const tick = h('span', { class: `tk${m.read_at ? ' rd' : ''}` });
      tick.appendChild(m._pending ? icon('check', 12) : m.read_at || m.delivered_at ? icon('checks', 13) : icon('check', 12));
      if (m._pending) tick.style.opacity = '.4';
      meta.appendChild(tick);
    }
    col.appendChild(meta);
  }

  row.appendChild(col);

  if (!m._pending && !m._failed) {
    row.appendChild(actionBar(m, ctx, row));
    attachLongPress(row);
  }

  return row;
}

/** İki mesaj aynı öbekte mi: aynı gönderen, aynı gün, 5 dakikadan yakın. */
function grouped(a: Message | null, b: Message | null): boolean {
  if (!a || !b) return false;
  if (a.sender_type !== b.sender_type || a.sender_type === 'system') return false;
  if (a.sender_id !== b.sender_id) return false;
  const gap = Date.parse(b.created_at) - Date.parse(a.created_at);

  return gap >= 0 && gap < GROUP_GAP_MS;
}

function sameDay(a: Message, b: Message | null): boolean {
  return !!b && dayKey(a.created_at) === dayKey(b.created_at);
}

function actionBar(m: Message, ctx: RenderCtx, row: HTMLElement): HTMLElement {
  const bar = h('div', { class: 'ac' });
  for (const e of QUICK_EMOJI.slice(0, 3)) {
    bar.appendChild(h('button', { type: 'button', title: ctx.t.react, onclick: () => ctx.actions.react(m, e) }, e));
  }
  bar.appendChild(h('button', { type: 'button', title: ctx.t.reply, onclick: () => ctx.actions.reply(m) }, icon('reply', 15)));

  const menu = h('div', { class: 'menu' });
  for (const e of QUICK_EMOJI.slice(3)) {
    menu.appendChild(
      h('button', { type: 'button', onclick: () => { menu.classList.remove('show'); ctx.actions.react(m, e); } }, `${e}  ${ctx.t.react}`)
    );
  }
  const own = m.sender_type === 'visitor';
  if (own && Date.now() - Date.parse(m.created_at) < EDIT_WINDOW_MS) {
    menu.appendChild(h('button', { type: 'button', onclick: () => { menu.classList.remove('show'); ctx.actions.edit(m); } }, ctx.t.edit));
    menu.appendChild(h('button', { type: 'button', class: 'dg', onclick: () => { menu.classList.remove('show'); ctx.actions.remove(m); } }, ctx.t.delete));
  }

  bar.appendChild(
    h('button', {
      type: 'button',
      title: ctx.t.react,
      onclick: (ev: Event) => {
        ev.stopPropagation();
        menu.classList.toggle('show');
        menu.style.top = `${row.offsetHeight + 4}px`;
      },
    }, icon('more', 15))
  );
  row.appendChild(menu);
  document.addEventListener('click', () => menu.classList.remove('show'), { once: true, capture: true });

  return bar;
}

/** Dokunmatikte hover yok: uzun basınca eylem çubuğu açılır. */
function attachLongPress(row: HTMLElement): void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const start = () => {
    timer = setTimeout(() => {
      row.classList.add('acts');
      try {
        navigator.vibrate?.(8);
      } catch {
        /* titreşim yoksa sessiz geç */
      }
      const off = (ev: Event) => {
        if (!row.contains(ev.target as Node)) {
          row.classList.remove('acts');
          document.removeEventListener('touchstart', off, true);
        }
      };
      document.addEventListener('touchstart', off, true);
    }, 420);
  };
  const cancel = () => timer && clearTimeout(timer);
  row.addEventListener('touchstart', start, { passive: true });
  row.addEventListener('touchend', cancel);
  row.addEventListener('touchmove', cancel, { passive: true });
}

function fileRow(a: Attachment, ctx: RenderCtx): HTMLElement {
  return h('a', { class: 'fr', href: a.url || undefined, target: '_blank', rel: 'noopener' },
    icon('file', 18),
    h('span', { class: 'fn' }, a.name || ctx.t.attachment),
    h('span', { class: 'fs' }, fileSize(a.size || 0)));
}

/**
 * Metindeki bağlantıları tıklanır yapar.
 *
 * `innerHTML` KULLANILMAZ: gövde ziyaretçinin ya da ajanın yazdığı serbest
 * metindir ve widget müşterinin sayfasında çalışır. Parçalar tek tek düğüm
 * olarak eklenir; yazılan hiçbir şey biçimlendirme olarak yorumlanmaz.
 */
function linkify(text: string): DocumentFragment {
  const frag = document.createDocumentFragment();
  const re = /(https?:\/\/[^\s<]+)/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text))) {
    if (match.index > last) frag.appendChild(document.createTextNode(text.slice(last, match.index)));
    const url = match[1].replace(/[.,;:!?)]+$/, '');
    frag.appendChild(h('a', { href: url, target: '_blank', rel: 'noopener noreferrer nofollow' }, url));
    last = match.index + url.length;
  }
  if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));

  return frag;
}

export function snippet(m: Message, t: Strings): string {
  if (m.deleted_at) return t.deleted;
  // Aynı kural özet metninde de geçerli: ziyaretçinin kendi mesajının
  // çevirisi ajan içindir, ona gösterilmez.
  const preview = (m.sender_type === 'visitor' ? null : m.translation?.body) || m.body;

  if (preview) return preview.length > 90 ? preview.slice(0, 90) + '…' : preview;
  const a = m.attachments?.[0];

  return a ? `📎 ${a.name}` : '…';
}

export { initials };

function isImage(mime: string | undefined): boolean {
  return !!mime && mime.startsWith('image/');
}

function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(iso: string, ctx: RenderCtx): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
  if (diff === 0) return ctx.t.today;
  if (diff === 1) return ctx.t.yesterday;
  try {
    return new Intl.DateTimeFormat(ctx.locale, {
      day: 'numeric',
      month: 'long',
      year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    }).format(d);
  } catch {
    return d.toLocaleDateString();
  }
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function timeLabel(iso: string, locale: string): string {
  const d = new Date(iso);
  try {
    return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(d);
  } catch {
    return d.toLocaleTimeString();
  }
}
