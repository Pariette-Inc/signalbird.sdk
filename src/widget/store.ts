/**
 * Widget durumu: ziyaretçi, konuşma, mesajlar, okunmamış sayısı.
 *
 * Ziyaretçi sırrı `localStorage['sb_visitor']` içinde `{id, secret, publicKey}`
 * olarak durur. `publicKey` de saklanır ki aynı alan adında iki farklı uygulama
 * anahtarı birbirinin ziyaretçisini kapmasın.
 *
 * Basit bir yayıncıdır: `on(event, fn)` — arayüz ve dış API buna abone olur.
 */
import type { Conversation, Message, Agent } from './types';

const KEY = 'sb_visitor';

export interface StoredVisitor {
  id: string;
  secret: string;
  publicKey: string;
  name?: string | null;
  email?: string | null;
}

type Listener = (payload?: unknown) => void;

export class Store {
  visitor: StoredVisitor | null = null;
  conversation: Conversation | null = null;
  messages: Message[] = [];
  agent: Agent | null = null;
  agentTyping = false;
  online = false;
  withinHours = true;
  unread = 0;
  isOpen = false;
  /** Bu tarayıcıda puanlanmış konuşmalar — aynı konuşma için tekrar sorma. */
  private rated = new Set<string>();
  private listeners: Record<string, Listener[]> = {};

  constructor(private readonly publicKey: string) {
    this.visitor = this.readVisitor();
  }

  // ── Olaylar ───────────────────────────────────────────────────────────

  on(event: string, fn: Listener): () => void {
    (this.listeners[event] ||= []).push(fn);
    return () => this.off(event, fn);
  }

  off(event: string, fn: Listener): void {
    const list = this.listeners[event];
    if (list) this.listeners[event] = list.filter((l) => l !== fn);
  }

  emit(event: string, payload?: unknown): void {
    for (const fn of this.listeners[event] || []) {
      try {
        fn(payload);
      } catch {
        /* dinleyici hatası widget'ı düşürmez */
      }
    }
  }

  // ── Ziyaretçi ─────────────────────────────────────────────────────────

  private readVisitor(): StoredVisitor | null {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as StoredVisitor;
      if (!parsed || !parsed.secret || parsed.publicKey !== this.publicKey) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  setVisitor(visitor: { id: string; secret?: string; name?: string | null; email?: string | null }): void {
    const secret = visitor.secret || this.visitor?.secret;
    if (!secret) return; // sır yoksa saklanacak kimlik de yok
    this.visitor = {
      id: visitor.id,
      secret,
      publicKey: this.publicKey,
      name: visitor.name ?? this.visitor?.name ?? null,
      email: visitor.email ?? this.visitor?.email ?? null,
    };
    try {
      localStorage.setItem(KEY, JSON.stringify(this.visitor));
    } catch {
      /* private mode */
    }
  }

  clearVisitor(): void {
    this.visitor = null;
    this.conversation = null;
    this.messages = [];
    this.setUnread(0);
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* yok say */
    }
    this.emit('change');
  }

  get secret(): string | null {
    return this.visitor?.secret ?? null;
  }

  // ── Konuşma ve mesajlar ──────────────────────────────────────────────

  setConversation(conversation: Conversation | null): void {
    const changed = conversation?.id !== this.conversation?.id;
    this.conversation = conversation;
    if (changed) this.messages = [];
    this.emit('change');
  }

  /**
   * Sunucudan gelen mesajları yerel listeyle birleştirir.
   *
   * Eşleme önce `id`, sonra `client_id` (iyimser gönderim) üzerinden yapılır.
   * `replace=true` ise sunucu listesi esas alınır ama henüz sunucuya ulaşmamış
   * (`_pending`) yerel mesajlar korunur. Yeni ajan mesajı sayısını döner.
   */
  mergeMessages(incoming: Message[], replace = false): number {
    let newAgent = 0;
    const byId = new Map<string, Message>();
    const byClient = new Map<string, Message>();
    for (const m of this.messages) {
      byId.set(m.id, m);
      if (m.client_id) byClient.set(m.client_id, m);
    }

    const next: Message[] = replace ? this.messages.filter((m) => m._pending || m._failed) : [...this.messages];

    for (const m of incoming) {
      const existing = byId.get(m.id) || (m.client_id ? byClient.get(m.client_id) : undefined);
      if (existing) {
        const idx = next.indexOf(existing);
        const merged = { ...existing, ...m, _pending: false, _failed: false, _files: undefined };
        if (idx >= 0) next[idx] = merged;
        else next.push(merged);
        byId.set(m.id, merged);
      } else {
        next.push(m);
        byId.set(m.id, m);
        if (m.sender_type === 'agent' || m.sender_type === 'bot') newAgent++;
      }
    }

    next.sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
    this.messages = next;
    this.emit('messages');
    return newAgent;
  }

  upsertMessage(m: Message): void {
    this.mergeMessages([m]);
  }

  removeMessage(id: string): void {
    this.messages = this.messages.filter((m) => m.id !== id);
    this.emit('messages');
  }

  find(id: string | null | undefined): Message | undefined {
    return id ? this.messages.find((m) => m.id === id) : undefined;
  }

  get lastServerMessageId(): string | null {
    for (let i = this.messages.length - 1; i >= 0; i--) {
      const m = this.messages[i];
      if (!m._pending && !m._failed && !m.id.startsWith('local_')) return m.id;
    }
    return null;
  }

  // ── Okunmamış ─────────────────────────────────────────────────────────

  setUnread(count: number): void {
    const value = Math.max(0, count | 0);
    if (value === this.unread) return;
    this.unread = value;
    this.emit('unread', value);
  }

  /**
   * Ziyaretçi balonu gizledi mi (bu tarayıcıda)?
   *
   * Anahtar uygulama başınadır: aynı tarayıcıda iki farklı Signalbird
   * müşterisinin sitesi gezilebilir ve birinde balonu kapatmak diğerini
   * susturmamalı.
   */
  get dismissed(): boolean {
    return safeGet(this.dismissKey) === '1';
  }

  setDismissed(value: boolean): void {
    try {
      if (value) localStorage.setItem(this.dismissKey, '1');
      else localStorage.removeItem(this.dismissKey);
    } catch {
      /* yok say — gizli sekmede localStorage yazılamaz, balon görünür kalır */
    }
  }

  private get dismissKey(): string {
    return `sb_dismissed_${this.publicKey}`;
  }

  wasRated(id: string): boolean {
    return this.rated.has(id) || safeGet(`sb_rated_${id}`) === '1';
  }

  markRated(id: string): void {
    this.rated.add(id);
    try {
      localStorage.setItem(`sb_rated_${id}`, '1');
    } catch {
      /* yok say */
    }
  }
}

/** ULID kimlikler zamana göre sıralanır; yerel mesajlar created_at ile sona düşer. */
function sortKey(m: Message): string {
  return m.created_at || '';
}

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
