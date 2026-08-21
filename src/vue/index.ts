/**
 * `signalbird/vue` — Vue 3 eklentisi ve composable'ları.
 *
 * React uyarlamasıyla aynı `ChatSession` motorunu kullanır; buradaki tek iş
 * durumu Vue'nun tepkimeli sistemine bağlamaktır.
 *
 * Vue bir `peerDependency`'dir; paket onu kendi getirmez.
 */
import { getCurrentInstance, inject, onScopeDispose, ref, watch, type App, type InjectionKey, type Ref } from 'vue';
import { ChatSession, SignalbirdApp } from '../app';
import type { AppConfig, ChatState, IdentifyInput, RegisterDeviceInput, SessionInput } from '../app';

export const SIGNALBIRD_KEY: InjectionKey<SignalbirdApp> = Symbol('signalbird');

/**
 * `app.use(signalbirdPlugin, { appKey })`
 *
 * Tek istemci tüm bileşenlere `provide` edilir: her bileşenin kendi istemcisini
 * kurması, ziyaretçi sırrının iki kez yüklenmesi ve iki ayrı yoklama döngüsü
 * demekti.
 */
export const signalbirdPlugin = {
  install(app: App, config: AppConfig) {
    app.provide(SIGNALBIRD_KEY, new SignalbirdApp(config));
  },
};

/** Ham istemci — push kaydı, kimlik, özel çağrılar için. */
export function useSignalbird(): SignalbirdApp {
  const client = inject(SIGNALBIRD_KEY, null);

  if (!client) {
    throw new Error('useSignalbird: app.use(signalbirdPlugin, { appKey }) çağrılmadı.');
  }

  return client;
}

export interface UseChatOptions {
  /** Panel açık mı — `ref` verilirse değişimi izlenir. */
  open?: Ref<boolean> | boolean;
  visitor?: SessionInput;
}

export interface UseChatResult {
  state: Ref<ChatState>;
  send(body: string, attachments?: unknown[]): Promise<unknown>;
  typing(isTyping: boolean): void;
  markRead(): Promise<void>;
  close(rating?: number, comment?: string): Promise<void>;
  openSession(input: SessionInput): Promise<unknown>;
  refresh(): Promise<void>;
}

export function useChat(options: UseChatOptions = {}): UseChatResult {
  const client = useSignalbird();
  const openRef = isRef(options.open) ? options.open : ref(!!options.open);

  const session = new ChatSession(client, { active: openRef.value, visitor: options.visitor });
  const state = ref<ChatState>(session.snapshot()) as Ref<ChatState>;

  const unsubscribe = session.subscribe((next) => {
    state.value = next;
  });

  void session.start();

  watch(openRef, (open) => session.setActive(!!open));

  // Bileşen yok olduğunda yoklama durur. Bunu unutmak, sayfadan çıkıldıktan
  // sonra da üç saniyede bir istek atan bir uygulama demekti.
  if (getCurrentInstance()) {
    onScopeDispose(() => {
      unsubscribe();
      session.stop();
    });
  }

  return {
    state,
    send: (body, attachments) => session.send(body, attachments),
    typing: (isTyping) => session.typing(isTyping),
    markRead: () => session.markRead(),
    close: (rating, comment) => session.close(rating, comment),
    openSession: (input) => session.openSession(input),
    refresh: () => session.refresh(),
  };
}

/** Kullanıcı giriş yaptığında ziyaretçiyi kişi kaydına bağlar. */
export function identify(input: IdentifyInput): Promise<unknown> {
  return useSignalbird().identify(input);
}

/** Push token'ı kaydeder; token'ı almak ev sahibinin işidir. */
export function registerDevice(input: RegisterDeviceInput): Promise<unknown> {
  return useSignalbird().registerDevice(input);
}

function isRef<T>(value: unknown): value is Ref<T> {
  return !!value && typeof value === 'object' && 'value' in (value as object);
}
