/**
 * Widget arayüzü: Shadow DOM host, balon, karşılama kartı, mesaj önizlemesi,
 * panel ve görünümler (ön-form / sohbet / puanlama / teşekkür).
 *
 * Durum TUTMAZ — denetleyici (`chat.ts`) durumu verir, arayüz çizer ve
 * kullanıcı eylemlerini geri bildirir. Bu sınırın korunması bilinçli: çekirdek
 * (api/store/poller/chat) 2 Eyl 2026 yeniden yazımında hiç değişmedi, yalnız
 * bu katman söküldü ve baştan kuruldu.
 *
 * ── BU KATMANIN ÜÇ İŞİ ───────────────────────────────────────────────────
 *  1. GÖRÜNMEK      → styles.ts'teki "Aurora" dili.
 *  2. FARK EDİLMEK  → teaser (karşılama kartı) + toast (yanıt önizlemesi) +
 *                     nabız + rozet + yaylanma. Dördü ayrı işe bakar.
 *  3. MOBİLDE ÇALIŞMAK → tam ekran, klavye takibi (`visualViewport`), sayfa
 *                     kaydırma kilidi, aşağı sürükleyerek kapatma, güvenli
 *                     alan boşlukları.
 */
import { CSS } from './styles';
import { h, icon, brandIcon, clear, avatarNode, initials, safeUrl } from './dom';
import {
  renderMessages,
  scrollToBottom,
  isAtBottom,
  snippet,
  EMOJI_PICKER,
  type MessageActions,
  type RenderCtx,
} from './messages';
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
  /** Balonu tamamen gizle — ziyaretçinin "bir daha görünme" demesi. */
  dismiss(): void;
  endChat(): void;
  newChat(): void;
  saveEdit(m: Message, body: string): void;
}

export interface UIOptions {
  t: Strings;
  locale: string;
  /**
   * Açık domain anahtarı. Yalnız tarayıcıda saklanan tercihleri AYIRMAK için
   * kullanılır: aynı tarayıcıda iki farklı Signalbird müşterisinin sitesi
   * gezilebilir ve birinde karşılama kartını kapatmak diğerini susturmamalı
   * (store.ts'teki `sb_dismissed_<key>` ile aynı gerekçe).
   */
  publicKey: string;
  settings: ChatSettings;
  appName: string;
  maxMb: number;
  /** Ziyaretçinin seçebileceği konular; boşsa ön-formda adım çizilmez. */
  topics: TopicOption[];
  actions: UIActions;
}

/** Panel kapalıyken gelen yanıtın önizlemesi. */
export interface AttentionPreview {
  name?: string | null;
  avatar?: string | null;
  body?: string | null;
}

/*
 * İzinli türler SUNUCUDAN gelir (`chat.attachment_mimes`, 2 Eyl 2026).
 *
 * Buradaki kontrol yalnız erken uyarıdır — 8 MB'lık bir dosyayı yükletip sonra
 * reddetmek ziyaretçinin bağlantısını boşuna harcar. ASIL kapı sunucudadır ve
 * orada MIME dosyanın İÇERİĞİNDEN okunur: `zararli.exe` adını `resim.png`
 * yapmak buradan geçse de oradan geçmez.
 *
 * Liste boş gelirse (eski sunucu) eski davranışa düşülür: yalnız fotoğraf.
 */
const FALLBACK_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

/** Sunucunun bildirmediği durumda kullanılacak tavan. */
const FALLBACK_MAX_CHARS = 420;

/** Sayaç yalnız son bu kadar karakterde görünür — sürekli duran sayı baskıdır. */
const COUNTER_THRESHOLD = 60;

/** Karşılama kartının açılma gecikmesi. Hemen çıkarsa reklam gibi okunuyor. */
const TEASER_DELAY = 11000;
/** Mesaj önizlemesi ekranda bu kadar kalır. */
const TOAST_MS = 9000;
const TEASER_KEY = 'sb_teaser';
const SEEN_KEY = 'sb_seen';

export class UI {
  readonly host: HTMLElement;
  private root: ShadowRoot;
  private wrap: HTMLElement;

  private launcher: HTMLButtonElement;
  private dismissBtn: HTMLButtonElement;
  private badge: HTMLElement;
  private teaser: HTMLElement;
  private toast: HTMLElement;

  private panel: HTMLElement;
  private headerName: HTMLElement;
  private headerStatus: HTMLElement;
  private headerDot: HTMLElement;
  private headerPhoto: HTMLElement;
  private endBtn: HTMLButtonElement;
  private grip: HTMLElement;
  private dragBar: HTMLElement;
  private banner: HTMLElement;
  private body: HTMLElement;

  private list: HTMLElement | null = null;
  private typingEl: HTMLElement | null = null;
  private typingAvatar: HTMLElement | null = null;
  private jumpBtn: HTMLElement | null = null;
  private textarea: HTMLTextAreaElement | null = null;
  private sendBtn: HTMLButtonElement | null = null;
  private emojiBox: HTMLElement | null = null;
  private chips: HTMLElement | null = null;
  private replyBar: HTMLElement | null = null;
  private notice: HTMLElement | null = null;

  private files: File[] = [];
  private counter: HTMLElement | null = null;
  private replyTo: Message | null = null;
  private editing: Message | null = null;
  private view: 'prechat' | 'chat' | 'rating' | 'none' = 'none';
  private agent: Agent | null = null;
  private online = false;

  private typingTimer: ReturnType<typeof setTimeout> | null = null;
  private teaserTimer: ReturnType<typeof setTimeout> | null = null;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private attnTimer: ReturnType<typeof setTimeout> | null = null;
  private wasTyping = false;
  private scrollLock = 0;
  private locked = false;

  constructor(private readonly o: UIOptions) {
    const t = o.t;
    this.host = h('div', { id: 'signalbird-widget' });
    this.root = this.host.attachShadow({ mode: 'open' });
    this.root.appendChild(h('style', null, CSS));

    const pos = o.settings.position === 'left' ? 'left' : 'right';
    const layout = o.settings.layout === 'sidebar' ? ' sidebar' : '';
    this.wrap = h('div', {
      class: `sb ${pos}${layout}${prefersDark(o.settings.theme) ? ' dark' : ''}`,
      style: `--sb-c:${safeColor(o.settings.color)}`,
    });

    /*
     * `auto` seçildiyse sayfanın tercihi CANLI izlenir: ziyaretçi işletim
     * sistemini gece moduna aldığında panel de döner. Yalnız `auto` için
     * dinlenir — 'light'/'dark' bir KARARDIR, sistem onu ezmemeli.
     */
    if (o.settings.theme === 'auto' && typeof matchMedia === 'function') {
      const mq = matchMedia('(prefers-color-scheme: dark)');
      mq.addEventListener?.('change', (e) => this.wrap.classList.toggle('dark', e.matches));
    }

    this.badge = h('span', { class: 'badge' });
    const text = o.settings.launcher_text;
    this.launcher = h(
      'button',
      {
        class: `ln${text ? '' : ' icon-only'}`,
        type: 'button',
        'aria-label': text || t.launcher,
        onclick: () => this.onLauncher(),
      },
      h('span', { class: 'lm' }, this.launcherMark()),
      text ? h('span', { class: 'lt' }, text) : null,
      h('span', { class: 'ln-on' }),
      h('span', { class: 'ln-pulse' }),
      this.badge
    );

    /*
     * Balonu tamamen kapatma (29 Ağu 2026, Ahmet). Ayrı bir düğmedir, balonun
     * İÇİNDE değil: iç içe düğme HTML'de geçersiz ve dokunmatikte "kapatayım
     * derken açtım" hatasını doğurur.
     */
    this.dismissBtn = h('button', {
      class: 'dm',
      type: 'button',
      title: t.dismiss,
      'aria-label': t.dismiss,
      onclick: (e: Event) => {
        e.stopPropagation();
        o.actions.dismiss();
      },
    }, icon('close', 13));

    this.teaser = this.buildTeaser();
    this.toast = this.buildToast();

    // ── Panel ──────────────────────────────────────────────────────────
    this.headerPhoto = h('div', { class: 'ph' }, this.brandAvatar());
    this.headerDot = h('span', { class: 'dot' });
    this.headerName = h('div', { class: 'hn' }, o.appName || t.title);
    this.headerStatus = h('div', { class: 'hs' }, t.offline);
    this.endBtn = h('button', {
      class: 'hb hide',
      type: 'button',
      title: t.endChat,
      'aria-label': t.endChat,
      onclick: () => o.actions.endChat(),
    }, icon('done', 19));

    const header = h('div', { class: 'hd' },
      h('div', { class: 'av' }, this.headerPhoto, this.headerDot),
      h('div', { class: 'hi' }, this.headerName, this.headerStatus),
      h('div', { class: 'ha' },
        this.endBtn,
        h('button', { class: 'hb', type: 'button', title: t.close, 'aria-label': t.close, onclick: () => o.actions.close() },
          icon('close', 20))));

    this.dragBar = h('div', { class: 'drag', 'aria-hidden': 'true' }, h('i'));
    this.banner = h('div', { class: 'bn' });
    this.body = h('div', { class: 'bd' });
    this.grip = h('div', { class: 'gp', title: t.resize, 'aria-hidden': 'true' });

    this.panel = h('div', { class: 'pn', role: 'dialog', 'aria-modal': 'false', 'aria-label': t.title },
      h('div', { class: 'glow', 'aria-hidden': 'true' }),
      this.dragBar,
      header,
      this.banner,
      this.body,
      this.grip);

    /*
     * Taşıma ve boyutlandırma yalnız köşe penceresindedir. Çekmecede ikisi de
     * anlamsız: kenara yaslı, ekran boyu bir paneli 12 piksel sola çekmek bir
     * tercih değil kazadır.
     */
    if (o.settings.layout !== 'sidebar') {
      this.restoreGeometry();
      this.enableMove(header);
      this.enableResize();
    }
    this.enableSwipeClose();

    this.wrap.appendChild(this.launcher);
    this.wrap.appendChild(this.dismissBtn);
    this.wrap.appendChild(this.teaser);
    this.wrap.appendChild(this.toast);
    this.wrap.appendChild(this.panel);
    this.root.appendChild(this.wrap);

    this.enableDrop();

    // Escape paneli kapatır — modal olmayan ama tam ekranı kaplayan bir
    // yüzeyde beklenen davranış budur.
    this.onKey = this.onKey.bind(this);
    this.onViewport = this.onViewport.bind(this);
  }

  /** Tarayıcıda saklanan tercihin anahtarı — müşteri başınadır. */
  private key(name: string): string {
    return `${name}_${this.o.publicKey}`;
  }

  mount(): void {
    if (!this.host.isConnected) document.body.appendChild(this.host);
    document.addEventListener('keydown', this.onKey);
    this.scheduleTeaser();
  }

  unmount(): void {
    this.clearTimers();
    this.unlockScroll();
    document.removeEventListener('keydown', this.onKey);
    visualViewport()?.removeEventListener('resize', this.onViewport);
    this.host.remove();
  }

  // ══ Genel durum ═════════════════════════════════════════════════════

  /** Balon gizli mi — `dismiss` sonrası. Widget DOM'da kalır, görünmez olur. */
  setDismissed(hidden: boolean): void {
    this.wrap.classList.toggle('hidden', hidden);
    if (hidden) this.hideTeaser(false);
  }

  /**
   * Balonu `launcher_mode: 'manual'` için gizler.
   *
   * `dismiss`ten AYRI bir sınıf kullanır ve bilerek: biri ziyaretçinin kararı
   * (tarayıcıda saklanır), diğeri site sahibinin ayarı. Aynı bayrağa
   * bindirilseydi, ziyaretçi balonu bir kez kapattığında site sahibinin ayarı
   * da onun cihazında kalıcı olarak bozulurdu.
   */
  setLauncherHidden(hidden: boolean): void {
    this.wrap.classList.toggle('no-ln', hidden);
    if (hidden) this.hideTeaser(false);
  }

  setOpen(open: boolean): void {
    this.wrap.classList.toggle('open', open);

    if (open) {
      remember(this.key(SEEN_KEY));
      this.hideTeaser(false);
      this.hideToast();
      this.lockScroll();
      this.bindViewport();
      requestAnimationFrame(() => {
        if (this.list) scrollToBottom(this.list);
        // Mobilde odaklanmak klavyeyi hemen açar ve mesajı okumadan yazmaya
        // zorlar; masaüstünde ise imleç doğrudan yazı alanında olmalı.
        if (!isMobile()) this.textarea?.focus();
      });
    } else {
      this.unlockScroll();
      visualViewport()?.removeEventListener('resize', this.onViewport);
      this.wrap.style.setProperty('--sb-kb', '0px');
      this.wrap.classList.remove('kb');
      this.hideEmoji();
    }
  }

  setUnread(n: number): void {
    this.badge.textContent = n > 99 ? '99+' : String(n);
    this.badge.classList.toggle('on', n > 0);
    this.wrap.classList.toggle('pulse', n > 0);
    if (n === 0) this.hideToast();
  }

  /**
   * "Bana bak" — yeni mesaj geldi, panel kapalı.
   *
   * Üç sinyal üst üste biner ve üçü de ayrı işe bakar:
   *   • yaylanma → sessiz sekmede görülen tek hareket,
   *   • nabız    → okunmamış durdukça devam eden düşük şiddetli işaret,
   *   • toast    → NE geldiğini söyleyen tek şey. Rozet "bir şey var" der;
   *                açılma oranını belirleyen ise mesajın kendisini görmektir.
   *
   * Hareketi kapatan kullanıcıya saygı gösterilir: `prefers-reduced-motion`
   * varsa animasyon hiç çalışmaz (stil tarafında), rozet ve kart kalır.
   */
  attention(preview?: AttentionPreview | null): void {
    const el = this.launcher;
    el.classList.remove('attn');
    // Sınıf yeniden eklenmeden önce tarayıcının animasyonu sıfırlaması gerekir;
    // arka arkaya gelen iki mesajda ikincisi yoksa hiç oynamaz.
    void el.offsetWidth;
    el.classList.add('attn');
    if (this.attnTimer) clearTimeout(this.attnTimer);
    this.attnTimer = setTimeout(() => el.classList.remove('attn'), 2400);

    if (preview && (preview.body || preview.name)) this.showToast(preview);
  }

  setHeader(agent: Agent | null, online: boolean): void {
    const t = this.o.t;
    this.agent = agent;
    this.online = agent?.online ?? online;

    const name = agent?.name || this.o.appName || t.title;
    this.headerName.textContent = name;
    clear(this.headerPhoto);
    // Sıra: ajanın fotoğrafı → müşterinin logosu → baş harfler. Ajan
    // atandığında ONUN yüzü gelir; sohbet bir kurumla değil biriyle yapılır.
    this.headerPhoto.appendChild(agent ? avatarNode(agent.avatar, name) : this.brandAvatar());

    this.headerDot.classList.toggle('on', this.online);
    this.headerStatus.textContent = this.online ? t.online : t.offline;
    this.wrap.classList.toggle('agent-on', this.online);

    if (this.typingAvatar) {
      clear(this.typingAvatar);
      this.typingAvatar.appendChild(avatarNode(agent?.avatar, name));
    }
  }

  setBanner(text: string | null, error = false): void {
    clear(this.banner);
    this.banner.className = `bn${error ? ' err' : ''}${text ? ' on' : ''}`;
    if (!text) return;
    this.banner.appendChild(icon(error ? 'close' : 'chat', 15));
    this.banner.appendChild(h('span', null, text));
  }

  setEndVisible(visible: boolean): void {
    this.endBtn.classList.toggle('hide', !visible);
  }

  get currentView(): string {
    return this.view;
  }

  // ══ Görünümler ══════════════════════════════════════════════════════

  showPrechat(defaults: { name?: string | null; email?: string | null }): void {
    const t = this.o.t;
    const p = this.o.settings.prechat || { name: true, email: true, required: false };
    this.view = 'prechat';
    this.list = null;
    this.textarea = null;
    clear(this.body);

    const name = field('text', t.name, defaults.name || '', 'name');
    const email = field('email', t.email, defaults.email || '', 'email');

    /*
     * Konu seçimi HER ZAMAN isteğe bağlıdır — ön-form zorunlu olsa bile.
     * Konusunu bilmeyen ziyaretçiyi kapıda tutmak, gelmeyecek bir mesaj
     * demektir; sınıflandırmayı ajan sonradan düzeltebilir.
     */
    const topics = this.o.topics || [];
    const select = topics.length
      ? h('select', { 'aria-label': t.topicLabel },
          h('option', { value: '' }, t.topicPlaceholder),
          ...topics.map((topic) => h('option', { value: topic.slug }, topic.name)))
      : null;
    const topicField = select
      ? h('div', { class: 'fld' }, select, h('label', null, t.topicLabel), h('span', { class: 'cv' }, icon('chevron', 16)))
      : null;

    const submit = () => {
      const n = name.input.value.trim();
      const e = email.input.value.trim();
      if (p.required && ((p.name && !n) || (p.email && !e))) {
        const bad = p.name && !n ? name : email;
        bad.wrap.classList.add('bad');
        bad.input.focus();
        return;
      }
      if (e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
        email.wrap.classList.add('bad');
        email.input.focus();
        return;
      }
      this.o.actions.submitPrechat(n, e, select?.value || null);
    };

    const form = h('form', { class: 'fm', onsubmit: (ev: Event) => { ev.preventDefault(); submit(); } },
      h('h3', null, t.prechatTitle),
      h('p', null, this.o.settings.greeting || t.prechatHint),
      p.name ? name.wrap : null,
      p.email ? email.wrap : null,
      topicField,
      h('button', { class: 'btn', type: 'submit' }, t.start),
      p.required
        ? null
        : h('button', { class: 'btn gh', type: 'button', onclick: () => this.o.actions.skipPrechat(select?.value || null) }, t.skip));

    this.body.appendChild(form);
    if (!isMobile()) setTimeout(() => (p.name ? name.input : email.input).focus(), 60);
  }

  showChat(): void {
    if (this.view === 'chat' && this.list) return;
    const t = this.o.t;
    this.view = 'chat';
    clear(this.body);

    this.list = h('div', { class: 'ml' });
    this.list.addEventListener('scroll', () => this.syncJump(), { passive: true });

    this.jumpBtn = h('button', {
      class: 'jump',
      type: 'button',
      'aria-label': t.jump,
      onclick: () => this.list && scrollToBottom(this.list, true),
    }, icon('down', 14), h('span', null, t.jump));

    this.typingAvatar = h('div', { class: 'av' }, avatarNode(this.agent?.avatar, this.agent?.name || this.o.appName));
    this.typingEl = h('div', { class: 'tp', 'aria-live': 'polite' },
      this.typingAvatar,
      h('div', { class: 'dots' }, h('i'), h('i'), h('i')));

    this.notice = h('div', { class: 'notice' });

    this.body.appendChild(this.list);
    this.body.appendChild(this.jumpBtn);
    this.body.appendChild(this.typingEl);
    this.body.appendChild(this.notice);
    this.body.appendChild(this.buildComposer());
    this.body.appendChild(h('div', { class: 'drop' }, icon('image', 26), h('span', null, t.dropHere)));
  }

  showRating(): void {
    const t = this.o.t;
    this.view = 'rating';
    this.list = null;
    this.textarea = null;
    clear(this.body);

    let stars = 0;
    const buttons: HTMLButtonElement[] = [];
    const label = h('div', { class: 'rl' });
    const paint = () => {
      buttons.forEach((b, i) => b.classList.toggle('on', i < stars));
      label.textContent = stars ? t.rateScale[stars - 1] : '';
    };

    const row = h('div', { class: 'stars' });
    for (let i = 1; i <= 5; i++) {
      const b = h('button', {
        type: 'button',
        'aria-label': String(i),
        onclick: () => { stars = i; paint(); },
      }, icon('star', 32));
      buttons.push(b);
      row.appendChild(b);
    }

    const comment = h('textarea', { placeholder: t.rateComment, rows: 3 });
    const form = h('form', { class: 'fm', onsubmit: (ev: Event) => { ev.preventDefault(); this.o.actions.rate(stars, comment.value.trim()); } },
      h('h3', { style: 'text-align:center' }, t.rateTitle),
      row,
      label,
      comment,
      h('button', { class: 'btn', type: 'submit' }, t.rateSend),
      h('button', { class: 'btn gh', type: 'button', onclick: () => this.o.actions.rate(0, '') }, t.skip));

    this.body.appendChild(form);
  }

  /**
   * Bitiş ekranı. `review` verildiyse yorum çağrısı da çizilir.
   *
   * KARAR 2026-08-29 (Ahmet): sohbet sonunda Trustpilot/Google bağlantısı da
   * olsun. Bağlantıyı ve eşiği SUNUCU seçer (`review_url`,
   * `review_min_rating`): kötü puan veren müşteriye halka açık bir puanlama
   * sitesini göstermek kendi ayağımıza sıkmaktır ve bu kural iki yerde
   * yazılmamalı.
   */
  showThanks(review?: { url: string; label: string | null } | null): void {
    const t = this.o.t;
    this.view = 'none';
    this.list = null;
    this.textarea = null;
    clear(this.body);

    const box = h('div', { class: 'ok' },
      h('div', { class: 'ic' }, icon('done', 30)),
      h('h3', null, t.rateThanksTitle),
      h('p', null, t.rateThanks));

    if (review?.url) {
      box.appendChild(h('p', { style: 'margin-top:16px' }, t.reviewIntro));
      box.appendChild(h('a', {
        class: 'btn',
        href: review.url,
        target: '_blank',
        // Yeni sekmede açılan bağlantı `opener` üzerinden bu sayfaya
        // erişebilir; müşterinin sitesini üçüncü bir siteye açmayız.
        rel: 'noopener noreferrer',
      }, review.label || t.reviewCta));
    }

    box.appendChild(h('button', { class: 'btn gh', type: 'button', onclick: () => this.o.actions.newChat() }, t.newChat));
    this.body.appendChild(box);
  }

  // ══ Mesajlar ════════════════════════════════════════════════════════

  render(ctx: Omit<RenderCtx, 'actions' | 't' | 'locale'>): void {
    if (!this.list) return;
    renderMessages(this.list, {
      ...ctx,
      t: this.o.t,
      locale: this.o.locale,
      actions: this.o.actions,
      agentAvatar: this.agent?.avatar || safeUrl(this.o.settings.logo_url),
      brandName: this.agent?.name || this.o.appName,
      responseHint: this.online
        ? this.o.t.replyFast
        : this.o.settings.offline_message || this.o.t.offlineMessage,
      quick: this.quickStarters(),
      onQuick: (text) => this.o.actions.send(text, [], null),
    });
    this.syncJump();
  }

  setTyping(active: boolean, name: string): void {
    if (!this.typingEl) return;
    this.typingEl.classList.toggle('on', active);
    this.typingEl.setAttribute('aria-label', `${name} ${this.o.t.typing}`);
    if (active && this.list && isAtBottom(this.list, 120)) scrollToBottom(this.list, true);
  }

  setNotice(text: string | null, action?: { label: string; fn: () => void }): void {
    if (!this.notice) return;
    clear(this.notice);
    this.notice.classList.toggle('on', !!text);
    if (!text) return;
    this.notice.appendChild(document.createTextNode(text));
    if (action) this.notice.appendChild(h('button', { type: 'button', onclick: action.fn }, action.label));
  }

  // ══ Kompozitör ══════════════════════════════════════════════════════

  setReply(m: Message | null): void {
    this.replyTo = m;
    if (!this.replyBar) return;
    clear(this.replyBar);
    this.replyBar.classList.toggle('on', !!m);
    if (!m) return;

    const who = m.sender_type === 'visitor' ? this.o.t.you : m.agent?.name || m.sender_name || this.o.t.agent;
    this.replyBar.appendChild(icon('reply', 14));
    this.replyBar.appendChild(h('span', { class: 'rt' }, `${this.o.t.replyingTo} ${who}: ${snippet(m, this.o.t)}`));
    this.replyBar.appendChild(h('button', { type: 'button', 'aria-label': this.o.t.cancel, onclick: () => this.setReply(null) }, icon('close', 14)));
    this.textarea?.focus();
  }

  startEdit(m: Message): void {
    if (!this.textarea || !this.replyBar) return;
    this.editing = m;
    this.setReply(null);
    this.textarea.value = m.body || '';
    this.autosize();
    this.syncSend();
    this.textarea.focus();

    clear(this.replyBar);
    this.replyBar.classList.add('on');
    this.replyBar.appendChild(h('span', { class: 'rt' }, `${this.o.t.edit}: ${snippet(m, this.o.t)}`));
    this.replyBar.appendChild(h('button', { type: 'button', 'aria-label': this.o.t.cancel, onclick: () => this.cancelEdit() }, icon('close', 14)));
  }

  private buildComposer(): HTMLElement {
    const t = this.o.t;

    this.replyBar = h('div', { class: 'rq' });
    this.chips = h('div', { class: 'chips' });

    this.textarea = h('textarea', {
      rows: 1,
      placeholder: t.placeholder,
      'aria-label': t.placeholder,
      /*
       * Tavan tarayıcıya bırakılır: `maxlength` hem yazmayı hem YAPIŞTIRMAYI
       * kırpar. Kendi elimizle kesmek, kullanıcının panosundaki metni sessizce
       * budayıp "neden eksik gitti" sorusunu doğururdu; tarayıcı kırpınca
       * imleç sınırda durur ve sayaç sıfırı gösterir.
       */
      maxLength: this.maxChars,
      onkeydown: (e: KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
          e.preventDefault();
          this.submit();
        } else if (e.key === 'Escape') {
          if (this.editing) this.cancelEdit();
          else if (this.replyTo) this.setReply(null);
          else this.hideEmoji();
        }
      },
      oninput: () => {
        this.autosize();
        this.syncSend();
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
      // Seçicide sunucunun kabul ettiği türler. Reddedilecek bir dosyayı
      // seçtirmek kullanıcıya boşuna yol yürütmektir.
      accept: this.allowedMimes.join(','),
      onchange: () => {
        this.addFiles(Array.from(fileInput.files || []));
        fileInput.value = '';
      },
    });

    this.emojiBox = h('div', { class: 'emj' },
      ...EMOJI_PICKER.map((e) =>
        h('button', { type: 'button', onclick: () => this.insertEmoji(e) }, e)));

    this.sendBtn = h('button', {
      class: 'cb sd',
      type: 'button',
      title: t.send,
      'aria-label': t.send,
      disabled: true,
      onclick: () => this.submit(),
    }, icon('send', 17));

    this.counter = h('div', { class: 'cnt' });

    const composer = h('div', { class: 'cp' },
      this.emojiBox,
      this.replyBar,
      this.chips,
      this.counter,
      h('div', { class: 'cr' },
        h('button', { class: 'cb', type: 'button', title: t.attach, 'aria-label': t.attach, onclick: () => fileInput.click() },
          icon('clip', 19)),
        this.textarea,
        h('button', { class: 'cb', type: 'button', title: t.emoji, 'aria-label': t.emoji, onclick: (e: Event) => { e.stopPropagation(); this.toggleEmoji(); } },
          icon('smile', 19)),
        this.sendBtn),
      fileInput,
      /*
       * İMZA (29 Ağu 2026, Ahmet: "alttaki 'signalbird ile' yazısı da çok
       * kötü. bunu da kaliteli bir imzaya çevir").
       *
       * Düz bir cümle yerine gerçek bir imza: kuş işareti + kelime işareti.
       * "… ile" kalıbı KALDIRILDI — imza cümle kurmaz, isim söyler; üstelik o
       * kalıp her dilde ayrı bir dilbilgisi sorunuydu. Tam cümle `title`
       * içinde durur, ekran okuyucu ve fare üstünde görünür.
       */
      h('div', { class: 'pw' },
        h('a', { href: 'https://signalbird.io', target: '_blank', rel: 'noopener', title: t.poweredBy },
          h('span', { class: 'pk' }, brandIcon(13)),
          h('span', { class: 'pn2' }, 'Signalbird'))));

    return composer;
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

    // Son kapı: buraya Enter ile de gelinir, düğmenin kapalı olması yetmez.
    if (this.textarea.value.length > this.maxChars) {
      this.flash(fmt(this.o.t.tooLong, { max: this.maxChars }));
      return;
    }

    const files = this.files;
    const replyTo = this.replyTo;
    this.files = [];
    this.renderChips();
    this.setReply(null);
    this.hideEmoji();
    this.textarea.value = '';
    this.autosize();
    this.syncSend();
    this.stopTyping();
    this.o.actions.send(text, files, replyTo);
    if (!isMobile()) this.textarea.focus();
  }

  private cancelEdit(): void {
    this.editing = null;
    if (this.textarea) {
      this.textarea.value = '';
      this.autosize();
      this.syncSend();
    }
    if (this.replyBar) {
      clear(this.replyBar);
      this.replyBar.classList.remove('on');
    }
  }

  private addFiles(files: File[]): void {
    const maxBytes = this.o.maxMb * 1024 * 1024;
    for (const f of files) {
      if (f.size > maxBytes) {
        this.flash(fmt(this.o.t.fileTooLarge, { mb: this.o.maxMb }));
        continue;
      }
      if (f.type && !this.allowedMimes.includes(f.type)) {
        this.flash(this.o.t.fileNotAllowed);
        continue;
      }
      if (this.files.length >= 5) break;
      this.files.push(f);
    }
    this.renderChips();
    this.syncSend();
  }

  private renderChips(): void {
    if (!this.chips) return;
    clear(this.chips);
    this.chips.classList.toggle('on', this.files.length > 0);
    this.files.forEach((f, i) => {
      this.chips!.appendChild(
        h('div', { class: 'chip' },
          f.type.startsWith('image/') ? h('img', { src: URL.createObjectURL(f), alt: '' }) : icon('file', 16),
          h('span', null, f.name),
          h('button', {
            type: 'button',
            'aria-label': this.o.t.delete,
            onclick: () => { this.files.splice(i, 1); this.renderChips(); this.syncSend(); },
          }, icon('close', 12)))
      );
    });
  }

  /** Gönder düğmesi yalnız gönderilecek bir şey varken canlanır. */
  private syncSend(): void {
    if (!this.sendBtn || !this.textarea) return;
    const empty = !this.textarea.value.trim() && this.files.length === 0;

    /*
     * `maxLength` yalnız KULLANICI girişini kırpar; değer programatik
     * atandığında (ev sahibi sayfanın betiği, otomasyon, tarayıcı eklentisi)
     * sınırı aşabilir. Gönder düğmesi o hâlde de kapalı kalır — sunucudan 422
     * almak, düğmenin en baştan basılmaması kadar iyi bir cevap değil.
     */
    this.sendBtn.disabled = empty || this.textarea.value.length > this.maxChars;
    this.syncCounter();
  }

  /**
   * Kalan karakter — yalnız sınıra YAKLAŞINCA görünür.
   *
   * Sürekli duran bir sayaç, kısa yazmayı bir kural gibi gösterir ve sohbetin
   * tonunu bozar. Son 60 karakterde belirmesi yeter: kullanıcı sınırı ancak o
   * noktada merak eder, sıfıra gelince de neden yazamadığını görür.
   */
  private syncCounter(): void {
    if (!this.counter || !this.textarea) return;

    const left = this.maxChars - this.textarea.value.length;
    const show = left <= COUNTER_THRESHOLD;

    this.counter.classList.toggle('on', show);
    this.counter.classList.toggle('full', left <= 0);
    this.counter.textContent = show ? String(left) : '';
  }

  private toggleEmoji(): void {
    if (!this.emojiBox) return;
    const on = this.emojiBox.classList.toggle('on');
    if (on) document.addEventListener('click', () => this.hideEmoji(), { once: true, capture: true });
  }

  private hideEmoji(): void {
    this.emojiBox?.classList.remove('on');
  }

  private insertEmoji(e: string): void {
    if (!this.textarea) return;
    const ta = this.textarea;
    const at = ta.selectionStart ?? ta.value.length;
    ta.value = ta.value.slice(0, at) + e + ta.value.slice(ta.selectionEnd ?? at);
    ta.selectionStart = ta.selectionEnd = at + e.length;
    this.autosize();
    this.syncSend();
    ta.focus();
  }

  private autosize(): void {
    const ta = this.textarea;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 132)}px`;
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

  private syncJump(): void {
    if (!this.jumpBtn || !this.list) return;
    this.jumpBtn.classList.toggle('on', !isAtBottom(this.list, 160));
  }

  private flash(text: string): void {
    this.setBanner(text, true);
    setTimeout(() => this.setBanner(null), 3200);
  }

  // ══ Dikkat çekme: karşılama kartı ve mesaj önizlemesi ═══════════════

  private buildTeaser(): HTMLElement {
    const t = this.o.t;
    const s = this.o.settings;

    return h('div', {
      class: 'teaser',
      role: 'button',
      tabindex: 0,
      onclick: () => { this.hideTeaser(true); this.o.actions.open(); },
    },
      h('div', { class: 'tv' }, this.brandAvatar()),
      h('div', { class: 'tc' },
        h('div', { class: 'tn' }, this.o.appName || t.title),
        h('div', { class: 'tb' }, s.greeting || t.greeting)),
      h('button', {
        class: 'tx',
        type: 'button',
        'aria-label': t.close,
        onclick: (e: Event) => { e.stopPropagation(); this.hideTeaser(true); },
      }, icon('close', 13)));
  }

  private buildToast(): HTMLElement {
    return h('div', {
      class: 'toast',
      role: 'button',
      tabindex: 0,
      onclick: () => { this.hideToast(); this.o.actions.open(); },
    },
      h('div', { class: 'tv' }),
      h('div', { class: 'tc' }, h('div', { class: 'tn' }), h('div', { class: 'tb' })));
  }

  /**
   * Karşılama kartı — ziyaretçi sayfada bir süre kaldıktan sonra BİR KEZ.
   *
   * Üç kapıdan geçer: (1) daha önce kapatılmamış olacak, (2) ziyaretçi
   * paneli bu tarayıcıda hiç açmamış olacak — açmışsa zaten bizi biliyor,
   * (3) balon görünür olacak. Kapatma kararı tarayıcıda saklanır; bu bir
   * hesap ayarı değil, bu cihazdaki bu kişinin tercihi.
   */
  private scheduleTeaser(): void {
    if (recalled(this.key(TEASER_KEY)) || recalled(this.key(SEEN_KEY))) return;
    if (this.o.settings.launcher_mode === 'manual') return;

    this.teaserTimer = setTimeout(() => {
      if (this.wrap.classList.contains('open') || this.wrap.classList.contains('hidden')) return;
      if (this.wrap.classList.contains('no-ln') || this.wrap.classList.contains('tst')) return;
      this.wrap.classList.add('tz');
    }, TEASER_DELAY);
  }

  private hideTeaser(remembered: boolean): void {
    if (this.teaserTimer) clearTimeout(this.teaserTimer);
    this.teaserTimer = null;
    this.wrap.classList.remove('tz');
    if (remembered) remember(this.key(TEASER_KEY));
  }

  private showToast(p: AttentionPreview): void {
    const name = p.name || this.agent?.name || this.o.appName || this.o.t.agent;
    const av = this.toast.querySelector('.tv') as HTMLElement;
    const nm = this.toast.querySelector('.tn') as HTMLElement;
    const bd = this.toast.querySelector('.tb') as HTMLElement;

    clear(av);
    av.appendChild(avatarNode(p.avatar || this.agent?.avatar, name));
    nm.textContent = name;
    bd.textContent = p.body || this.o.t.newMessage;

    this.hideTeaser(false);
    this.wrap.classList.add('tst');
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.hideToast(), TOAST_MS);
  }

  private hideToast(): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = null;
    this.wrap.classList.remove('tst');
  }

  private onLauncher(): void {
    this.hideTeaser(true);
    this.hideToast();
    this.o.actions.open();
  }

  /** Sunucunun bildirdiği izinli türler; boşsa eski davranış. */
  private get allowedMimes(): string[] {
    const list = this.o.settings.attachment_mimes;

    return Array.isArray(list) && list.length ? list : FALLBACK_MIMES;
  }

  /** Tek mesajda en fazla karakter. */
  private get maxChars(): number {
    const n = Number(this.o.settings.max_message_chars);

    return Number.isFinite(n) && n > 0 ? n : FALLBACK_MAX_CHARS;
  }

  /** Boş ekrandaki hazır başlangıçlar — panelin verdiği konu adları. */
  private quickStarters(): string[] {
    return (this.o.topics || []).slice(0, 4).map((t) => t.name).filter(Boolean);
  }

  // ══ Mobil: klavye, kaydırma kilidi, aşağı sürükleyerek kapatma ══════

  /**
   * Klavye açılınca panel kısalır.
   *
   * `visualViewport` klavyenin kapladığı yüksekliği verir; `--sb-kb` ile panel
   * boyu ondan düşülür. Bu olmadan iOS'ta kompozitör klavyenin ALTINDA kalıyor
   * ve kullanıcı ne yazdığını göremiyordu — mobil şikâyetinin en somut hâli.
   */
  private bindViewport(): void {
    const vv = visualViewport();
    if (!vv) return;
    vv.addEventListener('resize', this.onViewport);
    this.onViewport();
  }

  private onViewport(): void {
    const vv = visualViewport();
    if (!vv || !isMobile()) return;
    const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    this.wrap.style.setProperty('--sb-kb', `${kb}px`);
    this.wrap.classList.toggle('kb', kb > 40);
    if (kb > 40 && this.list) requestAnimationFrame(() => this.list && scrollToBottom(this.list));
  }

  /**
   * Panel açıkken arkadaki sayfa kaymaz.
   *
   * `overflow:hidden` iOS'ta yetmiyor; gövde `position:fixed` yapılır ve
   * kaydırma konumu geri yüklenir. Yoksa panel kapanınca sayfa başa dönüyordu.
   */
  private lockScroll(): void {
    if (this.locked || !isMobile()) return;
    this.locked = true;
    this.scrollLock = window.scrollY || 0;
    const b = document.body.style;
    b.position = 'fixed';
    b.top = `-${this.scrollLock}px`;
    b.left = '0';
    b.right = '0';
    b.width = '100%';
  }

  private unlockScroll(): void {
    if (!this.locked) return;
    this.locked = false;
    const b = document.body.style;
    b.position = '';
    b.top = '';
    b.left = '';
    b.right = '';
    b.width = '';
    window.scrollTo(0, this.scrollLock);
  }

  /** Tepedeki tutamağı aşağı sürüklemek paneli kapatır (mobil jesti). */
  private enableSwipeClose(): void {
    let startY = 0;
    let dy = 0;
    let active = false;

    const end = () => {
      if (!active) return;
      active = false;
      this.wrap.classList.remove('dragging');
      this.panel.style.transform = '';
      if (dy > 110) this.o.actions.close();
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', end);
      removeEventListener('pointercancel', end);
    };

    const move = (e: PointerEvent) => {
      if (!active) return;
      dy = Math.max(0, e.clientY - startY);
      this.panel.style.transform = `translateY(${dy}px)`;
      this.panel.style.opacity = String(Math.max(0.5, 1 - dy / 420));
    };

    this.dragBar.addEventListener('pointerdown', (e: PointerEvent) => {
      if (!isMobile()) return;
      active = true;
      startY = e.clientY;
      dy = 0;
      this.wrap.classList.add('dragging');
      addEventListener('pointermove', move);
      addEventListener('pointerup', end);
      addEventListener('pointercancel', end);
    });
  }

  private onKey(e: KeyboardEvent): void {
    if (e.key !== 'Escape') return;
    if (this.emojiBox?.classList.contains('on')) {
      this.hideEmoji();
      return;
    }
    if (this.wrap.classList.contains('open')) this.o.actions.close();
  }

  private enableDrop(): void {
    let depth = 0;
    this.body.addEventListener('dragenter', (e) => {
      e.preventDefault();
      depth++;
      if (this.view === 'chat') this.body.classList.add('dragover');
    });
    this.body.addEventListener('dragover', (e) => e.preventDefault());
    this.body.addEventListener('dragleave', () => {
      if (--depth <= 0) {
        depth = 0;
        this.body.classList.remove('dragover');
      }
    });
    this.body.addEventListener('drop', (e) => {
      e.preventDefault();
      depth = 0;
      this.body.classList.remove('dragover');
      if (this.view === 'chat' && e.dataTransfer?.files) this.addFiles(Array.from(e.dataTransfer.files));
    });
  }

  private clearTimers(): void {
    for (const t of [this.typingTimer, this.teaserTimer, this.toastTimer, this.attnTimer]) {
      if (t) clearTimeout(t);
    }
  }

  // ══ Marka ═══════════════════════════════════════════════════════════

  /**
   * Balondaki işaret: müşterinin logosu, Signalbird kuşu ya da klasik sohbet
   * baloncuğu. Panelden seçilir (`chat.launcher_icon`).
   *
   * Logo seçilip URL girilmemişse kuşa düşülür — boş bir daire, marka
   * yönetiminin yarım kaldığını ziyaretçiye ilan etmekten iyidir.
   */
  private launcherMark(): Node {
    const s = this.o.settings;
    const logo = safeUrl(s.logo_url);

    if (s.launcher_icon === 'logo' && logo) return h('img', { class: 'lg', src: logo, alt: '' });
    if (s.launcher_icon === 'chat') return icon('chat', 25);

    return brandIcon(27);
  }

  /** Başlık/kart avatarı: logo varsa logo, yoksa uygulama adının baş harfleri. */
  private brandAvatar(): Node {
    const logo = safeUrl(this.o.settings.logo_url);

    return logo ? h('img', { src: logo, alt: '' }) : document.createTextNode(initials(this.o.appName));
  }

  // ══ Geometri: ziyaretçi paneli taşır ve boyutlandırır ═══════════════
  //
  // KARAR 2026-08-29 (Ahmet): "kullanıcı tarafından boyutlandırılabilmeli,
  // pozisyonu değiştirilebilmeli."
  //
  // Seçim `localStorage`'da durur ve ziyaretçiye özeldir: müşterinin panelden
  // verdiği `position` bir BAŞLANGIÇTIR, kural değil. Mobilde ikisi de kapalı
  // (panel zaten tam ekran) — orada sürükleme, kaydırmayı çalardı.

  private restoreGeometry(): void {
    const g = readGeometry();
    if (!g) return;
    if (g.w) this.panel.style.width = `${g.w}px`;
    if (g.h) this.panel.style.height = `${g.h}px`;
    this.wrap.style.setProperty('--sb-dx', `${g.dx || 0}px`);
    this.wrap.style.setProperty('--sb-dy', `${g.dy || 0}px`);
  }

  private saveGeometry(): void {
    writeGeometry({
      w: this.panel.offsetWidth,
      h: this.panel.offsetHeight,
      dx: parseFloat(this.wrap.style.getPropertyValue('--sb-dx')) || 0,
      dy: parseFloat(this.wrap.style.getPropertyValue('--sb-dy')) || 0,
    });
  }

  /** Başlığı sürükleyerek taşıma. Düğmeler hariç: kapatma tıklaması taşıma sayılmasın. */
  private enableMove(header: HTMLElement): void {
    header.addEventListener('pointerdown', (e: PointerEvent) => {
      if (e.button !== 0 || isMobile() || (e.target as HTMLElement).closest('button')) return;

      const startX = e.clientX;
      const startY = e.clientY;
      const dx0 = parseFloat(this.wrap.style.getPropertyValue('--sb-dx')) || 0;
      const dy0 = parseFloat(this.wrap.style.getPropertyValue('--sb-dy')) || 0;
      const flip = this.wrap.classList.contains('left') ? -1 : 1;
      let moved = false;

      const move = (ev: PointerEvent) => {
        const mx = ev.clientX - startX;
        const my = ev.clientY - startY;
        // Küçük titremeler sürükleme sayılmaz; yoksa her başlık tıklaması
        // paneli birkaç piksel kaydırırdı.
        if (!moved && Math.abs(mx) + Math.abs(my) < 4) return;
        moved = true;
        this.wrap.classList.add('moving');
        // Panel her zaman ekranda kalır: taşıma miktarı görünür alanla sınırlı.
        const maxX = Math.max(0, innerWidth - this.panel.offsetWidth - 24);
        const maxY = Math.max(0, innerHeight - this.panel.offsetHeight - 24);
        this.wrap.style.setProperty('--sb-dx', `${clamp(dx0 - mx * flip, 0, maxX)}px`);
        this.wrap.style.setProperty('--sb-dy', `${clamp(dy0 - my, 0, maxY)}px`);
      };

      const up = () => {
        removeEventListener('pointermove', move);
        removeEventListener('pointerup', up);
        this.wrap.classList.remove('moving');
        if (moved) this.saveGeometry();
      };

      addEventListener('pointermove', move);
      addEventListener('pointerup', up);
    });
  }

  private enableResize(): void {
    this.grip.addEventListener('pointerdown', (e: PointerEvent) => {
      if (e.button !== 0 || isMobile()) return;
      e.preventDefault();

      const startX = e.clientX;
      const startY = e.clientY;
      const w0 = this.panel.offsetWidth;
      const h0 = this.panel.offsetHeight;
      // Sağ yerleşimde tutamak SOL üstte: sola çekmek genişletir.
      const flip = this.wrap.classList.contains('left') ? -1 : 1;
      this.wrap.classList.add('sizing');

      const move = (ev: PointerEvent) => {
        this.panel.style.width = `${clamp(w0 + (startX - ev.clientX) * flip, 340, innerWidth - 40)}px`;
        this.panel.style.height = `${clamp(h0 + (startY - ev.clientY), 400, innerHeight - 40)}px`;
      };

      const up = () => {
        removeEventListener('pointermove', move);
        removeEventListener('pointerup', up);
        this.wrap.classList.remove('sizing');
        this.saveGeometry();
      };

      addEventListener('pointermove', move);
      addEventListener('pointerup', up);
    });
  }
}

/** Yüzen etiketli alan — etiket yazarken kaybolmaz, küçülüp yukarı çıkar. */
function field(type: string, label: string, value: string, autocomplete: string) {
  const input = h('input', { type, value, autocomplete, placeholder: ' ' });
  if (value) input.classList.add('has');
  input.addEventListener('input', () => {
    input.classList.toggle('has', input.value.length > 0);
    input.parentElement?.classList.remove('bad');
  });

  return { wrap: h('div', { class: 'fld' }, input, h('label', null, label)), input };
}

const GEO_KEY = 'sb_geometry';

interface Geometry { w: number; h: number; dx: number; dy: number }

function readGeometry(): Geometry | null {
  try {
    const raw = localStorage.getItem(GEO_KEY);
    if (!raw) return null;
    const g = JSON.parse(raw) as Geometry;

    // Ekran küçüldüyse (dizüstüne geçti, pencereyi böldü) eski ölçü paneli
    // görünmez yapardı: sığmıyorsa hatırlanan geometri atılır.
    if (!g || g.w > innerWidth || g.h > innerHeight) return null;

    return g;
  } catch {
    return null;
  }
}

function writeGeometry(g: Geometry): void {
  try {
    localStorage.setItem(GEO_KEY, JSON.stringify(g));
  } catch {
    /* özel sekmede yazılamaz — panel yine çalışır, hatırlamaz */
  }
}

function remember(key: string): void {
  try {
    localStorage.setItem(key, '1');
  } catch {
    /* gizli sekme: kart bu oturumda bir daha çıkmaz, kalıcı olmaz */
  }
}

function recalled(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function isMobile(): boolean {
  return innerWidth <= 640;
}

function visualViewport(): VisualViewport | null {
  return typeof window !== 'undefined' ? window.visualViewport || null : null;
}

/** `dark` ya da sayfa koyu temadayken `auto`. */
function prefersDark(theme: unknown): boolean {
  if (theme === 'dark') return true;
  if (theme !== 'auto' || typeof matchMedia !== 'function') return false;

  return matchMedia('(prefers-color-scheme: dark)').matches;
}

/** Yalnız #hex ya da rgb()/hsl() kabul edilir — stil enjeksiyonu olmasın. */
function safeColor(color: string | undefined): string {
  return color && /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%]+\))$/i.test(color) ? color : '#4f46e5';
}
