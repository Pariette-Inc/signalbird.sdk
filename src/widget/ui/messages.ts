/**
 * Mesaj listesi çizimi: gün ayraçları, kabarcıklar, ekler, yanıt alıntısı,
 * tepkiler, ✓/✓✓, eylem çubuğu (yanıtla / tepki / düzenle / sil).
 *
 * Her değişimde liste baştan çizilir — yüzlerce mesajda bile ucuz, ve
 * "hangi satır değişti" muhasebesinden çok daha az hata üretir. Kaydırma
 * konumu korunur: kullanıcı en alttaysa altta kalır.
 */
import { h, icon, clear, fileSize } from './dom';
import type { Message, Attachment } from '../types';
import type { Strings } from '../i18n';

export const QUICK_EMOJI = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
const EDIT_WINDOW_MS = 15 * 60 * 1000;

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
}

export function renderMessages(list: HTMLElement, ctx: RenderCtx): void {
  const atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 40;
  const prevHeight = list.scrollHeight;
  clear(list);

  if (ctx.greeting && ctx.messages.length === 0) {
    list.appendChild(h('div', { class: 'gr' }, ctx.greeting));
  }

  let lastDay = '';
  let prev: Message | null = null;

  for (const m of ctx.messages) {
    const day = dayKey(m.created_at);
    if (day !== lastDay) {
      list.appendChild(h('div', { class: 'day' }, dayLabel(m.created_at, ctx)));
      lastDay = day;
      prev = null;
    }
    list.appendChild(renderRow(m, ctx, prev));
    prev = m;
  }

  if (atBottom || prevHeight === 0) list.scrollTop = list.scrollHeight;
}

export function scrollToBottom(list: HTMLElement): void {
  list.scrollTop = list.scrollHeight;
}

function renderRow(m: Message, ctx: RenderCtx, prev: Message | null): HTMLElement {
  const side = m.sender_type === 'visitor' ? 'v' : m.sender_type === 'system' ? 's' : 'a';
  const gap = prev && prev.sender_type !== m.sender_type;
  const row = h('div', {
    class: `row ${side}${gap ? ' gap' : ''}${m._pending ? ' pend' : ''}${m._failed ? ' fail' : ''}`,
    'data-id': m.id,
  });

  const bubble = h('div', { class: `bb${m.deleted_at ? ' del' : ''}` });

  if (m.deleted_at) {
    bubble.textContent = ctx.t.deleted;
    row.appendChild(bubble);
    return row;
  }

  // Yanıt alıntısı
  if (m.reply_to_id) {
    const target = ctx.find(m.reply_to_id);
    const who = target
      ? target.sender_type === 'visitor'
        ? ctx.t.you
        : target.sender_name || ctx.agentName
      : '';
    bubble.appendChild(
      h('span', { class: 'q' }, who ? `${who}: ` : '', target ? snippet(target, ctx.t) : '…')
    );
  }

  // Ekler
  const files = m.attachments || [];
  const images = files.filter((a) => isImage(a.mime));
  const others = files.filter((a) => !isImage(a.mime));
  if (m._files && m._files.length) {
    // Henüz yüklenmemiş: yerel önizleme
    const imgs = h('div', { class: 'imgs' });
    for (const f of m._files) {
      if (f.type.startsWith('image/')) imgs.appendChild(h('img', { src: URL.createObjectURL(f), alt: f.name }));
      else bubble.appendChild(fileRow({ id: '', name: f.name, url: '', mime: f.type, size: f.size }, ctx));
    }
    if (imgs.childNodes.length) bubble.appendChild(imgs);
  }
  if (images.length) {
    const imgs = h('div', { class: 'imgs' });
    for (const a of images) {
      imgs.appendChild(
        h('img', {
          src: a.url,
          alt: a.name,
          loading: 'lazy',
          onclick: () => ctx.actions.openImage(a.url),
        })
      );
    }
    bubble.appendChild(imgs);
  }
  for (const a of others) bubble.appendChild(fileRow(a, ctx));

  if (m.body) bubble.appendChild(document.createTextNode(m.body));

  if (m._failed) {
    bubble.appendChild(h('div', { style: 'font-size:11px;margin-top:4px' }, ctx.t.failed));
    bubble.addEventListener('click', () => ctx.actions.retry(m));
  }

  row.appendChild(bubble);

  // Tepkiler
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
    if (rx.childNodes.length) row.appendChild(rx);
  }

  // Zaman + ✓✓ + düzenlendi
  if (side !== 's') {
    const meta = h('div', { class: 'mt' }, timeLabel(m.created_at, ctx.locale));
    if (m.edited_at) meta.appendChild(h('span', { class: 'ed' }, `· ${ctx.t.edited}`));
    if (side === 'v' && !m._failed) {
      const tick = h('span', { class: `tk${m.read_at ? ' rd' : ''}` });
      tick.appendChild(m._pending ? icon('check', 12) : m.read_at || m.delivered_at ? icon('checks', 13) : icon('check', 12));
      if (m._pending) tick.style.opacity = '.4';
      meta.appendChild(tick);
    }
    row.appendChild(meta);
  }

  // Eylem çubuğu (sistem mesajı ve bekleyen/başarısız hariç)
  if (side !== 's' && !m._pending && !m._failed) {
    row.appendChild(actionBar(m, ctx, row));
    attachLongPress(row);
  }

  return row;
}

function actionBar(m: Message, ctx: RenderCtx, row: HTMLElement): HTMLElement {
  const bar = h('div', { class: 'ac' });
  for (const e of QUICK_EMOJI.slice(0, 3)) {
    bar.appendChild(h('button', { type: 'button', title: ctx.t.react, onclick: () => ctx.actions.react(m, e) }, e));
  }
  bar.appendChild(h('button', { type: 'button', title: ctx.t.reply, onclick: () => ctx.actions.reply(m) }, icon('reply', 15)));

  const menu = h('div', { class: 'menu' });
  for (const e of QUICK_EMOJI.slice(3)) {
    menu.appendChild(h('button', { type: 'button', onclick: () => { menu.classList.remove('show'); ctx.actions.react(m, e); } }, `${e}  ${ctx.t.react}`));
  }
  const own = m.sender_type === 'visitor';
  const editable = own && Date.now() - Date.parse(m.created_at) < EDIT_WINDOW_MS;
  if (editable) {
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
      const off = (ev: Event) => {
        if (!row.contains(ev.target as Node)) {
          row.classList.remove('acts');
          document.removeEventListener('touchstart', off, true);
        }
      };
      document.addEventListener('touchstart', off, true);
    }, 450);
  };
  const cancel = () => timer && clearTimeout(timer);
  row.addEventListener('touchstart', start, { passive: true });
  row.addEventListener('touchend', cancel);
  row.addEventListener('touchmove', cancel, { passive: true });
}

function fileRow(a: Attachment, ctx: RenderCtx): HTMLElement {
  const el = h('a', { class: 'fr', href: a.url || undefined, target: '_blank', rel: 'noopener' },
    icon('file', 18),
    h('span', { class: 'fn' }, a.name || ctx.t.attachment),
    h('span', { class: 'fs' }, fileSize(a.size || 0)));
  return el;
}

export function snippet(m: Message, t: Strings): string {
  if (m.deleted_at) return t.deleted;
  if (m.body) return m.body.length > 90 ? m.body.slice(0, 90) + '…' : m.body;
  const a = m.attachments?.[0];
  return a ? `📎 ${a.name}` : '…';
}

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
