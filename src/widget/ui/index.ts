/**
 * Widget arayüzü: Shadow DOM host, balon, panel, görünümler (ön-form / sohbet /
 * puanlama), kompozitör. Durum tutmaz — denetleyici (`chat.ts`) durumu verir,
 * arayüz çizer ve kullanıcı eylemlerini geri bildirir.
 */
import { CSS } from './styles';
import { h, icon, clear } from './dom';
import { renderMessages, scrollToBottom, snippet, type MessageActions, type RenderCtx } from './messages';
import type { Message, ChatSettings, Agent, TopicOption } from '../types';
import type { Strings } from '../i18n';
import { fmt } from '../i18n';

export interface UIActions extends MessageActions {
  open(): void;
  close(): void;
  send(text: string, files: File[], replyTo: Message | null): void;
  typing(active: boolean): void;
  submitPrechat(name: string, email: string, topic: string | null): void;
  skipPrechat(topic: string | null): void;
  rate(stars: number, comment: string): void;
  endChat(): void;
  newChat(): void;
  saveEdit(m: Message, body: string): void;
}

export interface UIOptions {
  t: Strings;
  locale: string;
  settings: ChatSettings;
  appName: string;
  maxMb: number;
  /** Ziyaretçinin seçebileceği konular; boşsa ön-formda adım çizilmez. */
  topics: TopicOption[];
  actions: UIActions;
}

const ALLOWED = /^(image\/|application\/pdf|application\/msword|application\/vnd\.openxmlformats|application\/vnd\.ms-excel|text\/plain|application\/zip|application\/x-zip)/;

export class UI {
  readonly host: HTMLElement;
  private root: ShadowRoot;
  private wrap: HTMLElement;
  private launcher: HTMLButtonElement;
  private badge: HTMLElement;
  private panel: HTMLElement;
  private headerName: HTMLElement;
  private headerStatus: HTMLElement;
  private headerDot: HTMLElement;
  private headerAvatar: HTMLElement;
  private endBtn: HTMLButtonElement;
  private banner: HTMLElement;
  private body: HTMLElement;
  private list: HTMLElement | null = null;
  private typingEl: HTMLElement | null = null;
  private textarea: HTMLTextAreaElement | null = null;
  private chips: HTMLElement | null = null;
  private replyBar: HTMLElement | null = null;
  private notice: HTMLElement | null = null;
  private files: File[] = [];
  private replyTo: Message | null = null;
  private editing: Message | null = null;
  private view: 'prechat' | 'chat' | 'rating' | 'none' = 'none';
  private typingTimer: ReturnType<typeof setTimeout> | null = null;
  private wasTyping = false;

  constructor(private readonly o: UIOptions) {
    const t = o.t;
    this.host = h('div', { id: 'signalbird-widget' });
    this.root = this.host.attachShadow({ mode: 'open' });
    this.root.appendChild(h('style', null, CSS));

    const pos = o.settings.position === 'left' ? 'left' : 'right';
    this.wrap = h('div', { class: `sb ${pos}`, style: `--sb-c:${safeColor(o.settings.color)}` });

    // Balon
    this.badge = h('span', { class: 'badge', style: 'display:none' });
    const text = o.settings.launcher_text;
    this.launcher = h('button', {
      class: `ln${text ? '' : ' icon-only'}`,
      type: 'button',
      'aria-label': text || t.launcher,
      onclick: () => o.actions.open(),
    }, icon('chat', 26), text ? h('span', { class: 'lt' }, text) : null, this.badge);

    // Panel başlığı
    this.headerAvatar = h('div', { class: 'av' }, initials(o.appName));
    this.headerName = h('div', { class: 'hn' }, o.appName || t.title);
    this.headerDot = h('span', { class: 'dot' });
    this.headerStatus = h('div', { class: 'hs' }, this.headerDot, h('span', null, t.offline));
    this.endBtn = h('button', { class: 'hb', type: 'button', title: t.endChat, style: 'display:none', onclick: () => o.actions.endChat() }, icon('done', 18));
    const header = h('div', { class: 'hd' },
      this.headerAvatar,
      h('div', { class: 'hi' }, this.headerName, this.headerStatus),
      this.endBtn,
      h('button', { class: 'hb', type: 'button', title: t.close, 'aria-label': t.close, onclick: () => o.actions.close() }, icon('close', 20)));

    this.banner = h('div', { class: 'bn', style: 'display:none' });
    this.body = h('div', { class: 'bd' });
    this.panel = h('div', { class: 'pn', role: 'dialog', 'aria-label': t.title }, header, this.banner, this.body);

    this.wrap.appendChild(this.launcher);
    this.wrap.appendChild(this.panel);
    this.root.appendChild(this.wrap);

    // Sürükle-bırak
    let depth = 0;
    this.body.addEventListener('dragenter', (e) => { e.preventDefault(); depth++; this.body.classList.add('dragging'); });
    this.body.addEventListener('dragover', (e) => e.preventDefault());
    this.body.addEventListener('dragleave', () => { if (--depth <= 0) { depth = 0; this.body.classList.remove('dragging'); } });
    this.body.addEventListener('drop', (e) => {
      e.preventDefault();
      depth = 0;
      this.body.classList.remove('dragging');
      if (this.view === 'chat' && e.dataTransfer?.files) this.addFiles(Array.from(e.dataTransfer.files));
    });
  }

  mount(): void {
    if (!this.host.isConnected) document.body.appendChild(this.host);
  }

  unmount(): void {
    this.host.remove();
  }

  // ── Genel durum ─────────────────────────────────────────────────────

  setOpen(open: boolean): void {
    this.wrap.classList.toggle('open', open);
    if (open && this.list) {
      requestAnimationFrame(() => {
        if (this.list) scrollToBottom(this.list);
        this.textarea?.focus();
      });
    }
  }

  setUnread(n: number): void {
    this.badge.textContent = n > 99 ? '99+' : String(n);
    this.badge.style.display = n > 0 ? 'flex' : 'none';
  }

  setHeader(agent: Agent | null, online: boolean): void {
    const t = this.o.t;
    const name = agent?.name || this.o.appName || t.title;
    this.headerName.textContent = name;
    clear(this.headerAvatar);
    if (agent?.avatar) this.headerAvatar.appendChild(h('img', { src: agent.avatar, alt: '' }));
    else this.headerAvatar.textContent = initials(name);
    const isOnline = agent?.online ?? online;
    this.headerDot.classList.toggle('on', isOnline);
    (this.headerStatus.lastChild as HTMLElement).textContent = isOnline ? t.online : t.offline;
  }

  setBanner(text: string | null, error = false): void {
    this.banner.textContent = text || '';
    this.banner.className = `bn${error ? ' err' : ''}`;
    this.banner.style.display = text ? 'block' : 'none';
  }

  setEndVisible(visible: boolean): void {
    this.endBtn.style.display = visible ? 'flex' : 'none';
  }

  // ── Görünümler ──────────────────────────────────────────────────────

  showPrechat(defaults: { name?: string | null; email?: string | null }): void {
    const t = this.o.t;
    const p = this.o.settings.prechat || { name: true, email: true, required: false };
    this.view = 'prechat';
    this.list = null;
    this.textarea = null;
    clear(this.body);

    const name = h('input', { type: 'text', placeholder: t.name, value: defaults.name || '', autocomplete: 'name' });
    const email = h('input', { type: 'email', placeholder: t.email, value: defaults.email || '', autocomplete: 'email' });

    /*
     * Konu seçimi HER ZAMAN isteğe bağlıdır — ön-form zorunlu olsa bile.
     * Konusunu bilmeyen ziyaretçiyi kapıda tutmak, gelmeyecek bir mesaj
     * demektir; sınıflandırmayı ajan sonradan düzeltebilir.
     */
    const topics = this.o.topics || [];
    const topicSelect = topics.length
      ? h('select', { 'aria-label': t.topicLabel },
          h('option', { value: '' }, t.topicPlaceholder),
          ...topics.map((topic) => h('option', { value: topic.slug }, topic.name)))
      : null;

    const submit = () => {
      const n = name.value.trim();
      const e = email.value.trim();
      if (p.required && ((p.name && !n) || (p.email && !e))) {
        (p.name && !n ? name : email).focus();
        return;
      }
      if (e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
        email.focus();
        return;
      }
      this.o.actions.submitPrechat(n, e, topicSelect?.value || null);
    };
    const form = h('form', { class: 'fm', onsubmit: (ev: Event) => { ev.preventDefault(); submit(); } },
      h('h3', null, t.prechatTitle),
      h('p', null, this.o.settings.greeting || t.prechatHint),
      p.name ? name : null,
      p.email ? email : null,
      topicSelect,
      h('button', { class: 'btn', type: 'submit' }, t.start),
      p.required ? null : h('button', { class: 'btn gh', type: 'button', onclick: () => this.o.actions.skipPrechat(topicSelect?.value || null) }, t.skip));
    this.body.appendChild(form);
    setTimeout(() => (p.name ? name : email).focus(), 50);
  }

  showChat(): void {
    if (this.view === 'chat' && this.list) return;
    const t = this.o.t;
    this.view = 'chat';
    clear(this.body);

    this.list = h('div', { class: 'ml' });
    this.notice = h('div', { class: 'notice', style: 'display:none' });
    this.typingEl = h('div', { class: 'tp' }, h('i'), h('i'), h('i'), h('span', { style: 'margin-left:4px' }, ''));

    // Kompozitör
    this.replyBar = h('div', { class: 'rq', style: 'display:none' });
    this.chips = h('div', { class: 'chips', style: 'display:none' });
    this.textarea = h('textarea', {
      rows: 1,
      placeholder: t.placeholder,
      'aria-label': t.placeholder,
      onkeydown: (e: KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
          e.preventDefault();
          this.submit();
        } else if (e.key === 'Escape') {
          if (this.editing) this.cancelEdit();
          else if (this.replyTo) this.setReply(null);
        }
      },
      oninput: () => {
        this.autosize();
        this.notifyTyping();
      },
      onpaste: (e: ClipboardEvent) => {
        const files = Array.from(e.clipboardData?.files || []);
        if (files.length) {
          e.preventDefault();
          this.addFiles(files);
        }
      },
    });
    const fileInput = h('input', {
      type: 'file',
      multiple: true,
      style: 'display:none',
      accept: 'image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip',
      onchange: () => {
        this.addFiles(Array.from(fileInput.files || []));
        fileInput.value = '';
      },
    });
    const composer = h('div', { class: 'cp' },
      this.replyBar,
      this.chips,
      h('div', { class: 'cr' },
        h('button', { class: 'cb', type: 'button', title: t.attach, 'aria-label': t.attach, onclick: () => fileInput.click() }, icon('clip', 19)),
        this.textarea,
        h('button', { class: 'cb sd', type: 'button', title: t.send, 'aria-label': t.send, onclick: () => this.submit() }, icon('send', 17))),
      fileInput,
      h('div', { class: 'pw' }, h('a', { href: 'https://signalbird.io', target: '_blank', rel: 'noopener' }, t.poweredBy)));

    this.body.appendChild(this.list);
    this.body.appendChild(this.notice);
    this.body.appendChild(this.typingEl);
    this.body.appendChild(composer);
    this.body.appendChild(h('div', { class: 'drop' }, t.dropHere));
  }

  showRating(): void {
    const t = this.o.t;
    this.view = 'rating';
    this.list = null;
    this.textarea = null;
    clear(this.body);

    let stars = 0;
    const starEls: HTMLButtonElement[] = [];
    const paint = () => starEls.forEach((b, i) => b.classList.toggle('on', i < stars));
    const starRow = h('div', { class: 'stars' });
    for (let i = 1; i <= 5; i++) {
      const b = h('button', { type: 'button', 'aria-label': String(i), onclick: () => { stars = i; paint(); } }, icon('star', 30));
      starEls.push(b);
      starRow.appendChild(b);
    }
    const comment = h('textarea', { placeholder: t.rateComment });
    const form = h('form', { class: 'fm', onsubmit: (ev: Event) => { ev.preventDefault(); this.o.actions.rate(stars, comment.value.trim()); } },
      h('h3', { style: 'text-align:center' }, t.rateTitle),
      starRow,
      comment,
      h('button', { class: 'btn', type: 'submit' }, t.rateSend),
      h('button', { class: 'btn gh', type: 'button', onclick: () => this.o.actions.rate(0, '') }, t.skip));
    this.body.appendChild(form);
  }

  showThanks(): void {
    this.view = 'none';
    this.list = null;
    clear(this.body);
    this.body.appendChild(h('div', { class: 'ok' }, h('p', null, this.o.t.rateThanks),
      h('button', { class: 'btn', type: 'button', style: 'margin-top:12px', onclick: () => this.o.actions.newChat() }, this.o.t.newChat)));
  }

  get currentView(): string {
    return this.view;
  }

  // ── Mesajlar ────────────────────────────────────────────────────────

  render(ctx: Omit<RenderCtx, 'actions' | 't' | 'locale'>): void {
    if (!this.list) return;
    renderMessages(this.list, { ...ctx, t: this.o.t, locale: this.o.locale, actions: this.o.actions });
  }

  setTyping(active: boolean, name: string): void {
    if (!this.typingEl) return;
    this.typingEl.classList.toggle('on', active);
    (this.typingEl.lastChild as HTMLElement).textContent = `${name} ${this.o.t.typing}`;
    if (active && this.list) scrollToBottom(this.list);
  }

  setNotice(text: string | null, action?: { label: string; fn: () => void }): void {
    if (!this.notice) return;
    clear(this.notice);
    if (!text) {
      this.notice.style.display = 'none';
      return;
    }
    this.notice.appendChild(document.createTextNode(text));
    if (action) this.notice.appendChild(h('button', { type: 'button', onclick: action.fn }, action.label));
    this.notice.style.display = 'block';
  }

  // ── Kompozitör ──────────────────────────────────────────────────────

  setReply(m: Message | null): void {
    this.replyTo = m;
    if (!this.replyBar) return;
    clear(this.replyBar);
    if (!m) {
      this.replyBar.style.display = 'none';
      return;
    }
    const who = m.sender_type === 'visitor' ? this.o.t.you : m.sender_name || this.o.t.agent;
    this.replyBar.appendChild(h('span', { class: 'rt' }, `${this.o.t.replyingTo} ${who}: ${snippet(m, this.o.t)}`));
    this.replyBar.appendChild(h('button', { type: 'button', onclick: () => this.setReply(null) }, icon('close', 14)));
    this.replyBar.style.display = 'flex';
    this.textarea?.focus();
  }

  startEdit(m: Message): void {
    if (!this.textarea) return;
    this.editing = m;
    this.setReply(null);
    this.textarea.value = m.body || '';
    this.autosize();
    this.textarea.focus();
    if (this.replyBar) {
      clear(this.replyBar);
      this.replyBar.appendChild(h('span', { class: 'rt' }, `${this.o.t.edit}: ${snippet(m, this.o.t)}`));
      this.replyBar.appendChild(h('button', { type: 'button', onclick: () => this.cancelEdit() }, icon('close', 14)));
      this.replyBar.style.display = 'flex';
    }
  }

  private cancelEdit(): void {
    this.editing = null;
    if (this.textarea) {
      this.textarea.value = '';
      this.autosize();
    }
    if (this.replyBar) {
      clear(this.replyBar);
      this.replyBar.style.display = 'none';
    }
  }

  private submit(): void {
    if (!this.textarea) return;
    const text = this.textarea.value.trim();

    if (this.editing) {
      const m = this.editing;
      this.cancelEdit();
      if (text && text !== m.body) this.o.actions.saveEdit(m, text);
      return;
    }

    if (!text && this.files.length === 0) return;
    const files = this.files;
    const replyTo = this.replyTo;
    this.files = [];
    this.renderChips();
    this.setReply(null);
    this.textarea.value = '';
    this.autosize();
    this.stopTyping();
    this.o.actions.send(text, files, replyTo);
    this.textarea.focus();
  }

  private addFiles(files: File[]): void {
    const maxBytes = this.o.maxMb * 1024 * 1024;
    for (const f of files) {
      if (f.size > maxBytes) {
        this.flash(fmt(this.o.t.fileTooLarge, { mb: this.o.maxMb }));
        continue;
      }
      if (f.type && !ALLOWED.test(f.type)) {
        this.flash(this.o.t.fileNotAllowed);
        continue;
      }
      if (this.files.length >= 5) break;
      this.files.push(f);
    }
    this.renderChips();
  }

  private renderChips(): void {
    if (!this.chips) return;
    clear(this.chips);
    this.chips.style.display = this.files.length ? 'flex' : 'none';
    this.files.forEach((f, i) => {
      const chip = h('div', { class: 'chip' },
        f.type.startsWith('image/') ? h('img', { src: URL.createObjectURL(f), alt: '' }) : icon('file', 16),
        h('span', null, f.name),
        h('button', { type: 'button', onclick: () => { this.files.splice(i, 1); this.renderChips(); } }, icon('close', 12)));
      this.chips!.appendChild(chip);
    });
  }

  private flash(text: string): void {
    this.setBanner(text, true);
    setTimeout(() => this.setBanner(null), 3000);
  }

  private autosize(): void {
    const ta = this.textarea;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  }

  private notifyTyping(): void {
    if (!this.wasTyping) {
      this.wasTyping = true;
      this.o.actions.typing(true);
    }
    if (this.typingTimer) clearTimeout(this.typingTimer);
    this.typingTimer = setTimeout(() => this.stopTyping(), 2500);
  }

  private stopTyping(): void {
    if (this.typingTimer) clearTimeout(this.typingTimer);
    this.typingTimer = null;
    if (this.wasTyping) {
      this.wasTyping = false;
      this.o.actions.typing(false);
    }
  }
}

function initials(name: string): string {
  return (name || '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0] || '')
    .join('')
    .toUpperCase();
}

/** Yalnız #hex ya da rgb()/hsl() kabul edilir — stil enjeksiyonu olmasın. */
function safeColor(color: string | undefined): string {
  return color && /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%]+\))$/i.test(color) ? color : '#111827';
}
