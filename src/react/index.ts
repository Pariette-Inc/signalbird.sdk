/**
 * `signalbird/react` — React ve Next.js için kancalar.
 *
 * Widget'ı gömmek yerine KENDİ sohbet arayüzünü yazan müşteri içindir. Durum
 * yönetimi `ChatSession`'dadır; buradaki kancalar yalnız React'in yeniden
 * çizim döngüsüne bağlar. Böylece aynı mantık Vue ve Angular'da da birebir
 * çalışır — üç ayrı sohbet motoru bakmak zorunda kalmayız.
 *
 * React bir `peerDependency`'dir; paket onu kendi getirmez.
 */
import { createContext, createElement, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ChatSession, SignalbirdApp } from '../app';
import type { AppConfig, ChatState, IdentifyInput, RegisterDeviceInput, SessionInput } from '../app';

const AppContext = createContext<SignalbirdApp | null>(null);

export interface SignalbirdProviderProps extends AppConfig {
  children?: ReactNode;
}

/**
 * Uygulamanın köküne konur. İstemci bir kez kurulur; `appKey` değişirse
 * (ortam değişimi, çoklu marka) yeniden kurulur.
 */
export function SignalbirdProvider({ children, ...config }: SignalbirdProviderProps) {
  const client = useMemo(() => new SignalbirdApp(config), [config.appKey, config.baseUrl, config.locale]);

  return createElement(AppContext.Provider, { value: client }, children);
}

/** Ham istemci — push kaydı, kimlik, özel çağrılar için. */
export function useSignalbird(): SignalbirdApp {
  const client = useContext(AppContext);

  if (!client) {
    throw new Error('useSignalbird: <SignalbirdProvider> içinde kullanılmalı.');
  }

  return client;
}

export interface UseChatOptions {
  /** Panel açık mı — yoklama hızını belirler (açık 3 s, kapalı merdiven). */
  open?: boolean;
  /** Oturum kurulurken kullanılacak ziyaretçi bilgisi (ön-form ya da giriş). */
  visitor?: SessionInput;
}

export interface UseChatResult extends ChatState {
  send(body: string, attachments?: unknown[]): Promise<unknown>;
  typing(isTyping: boolean): void;
  markRead(): Promise<void>;
  close(rating?: number, comment?: string): Promise<void>;
  openSession(input: SessionInput): Promise<unknown>;
  refresh(): Promise<void>;
}

/**
 * Sohbet durumu + eylemleri.
 *
 * `open` değiştiğinde oturum yeniden KURULMAZ, yalnız yoklama hızı değişir —
 * paneli her açışta baştan yüklemek, konuşmayı kaybetmiş gibi hissettirirdi.
 */
export function useChat(options: UseChatOptions = {}): UseChatResult {
  const client = useSignalbird();
  const sessionRef = useRef<ChatSession | null>(null);

  if (!sessionRef.current) {
    sessionRef.current = new ChatSession(client, { active: options.open, visitor: options.visitor });
  }

  const session = sessionRef.current;
  const [state, setState] = useState<ChatState>(session.snapshot());

  useEffect(() => {
    const unsubscribe = session.subscribe(setState);
    void session.start();

    return () => {
      unsubscribe();
      session.stop();
    };
  }, [session]);

  useEffect(() => {
    session.setActive(!!options.open);
  }, [session, options.open]);

  return {
    ...state,
    send: (body, attachments) => session.send(body, attachments),
    typing: (isTyping) => session.typing(isTyping),
    markRead: () => session.markRead(),
    close: (rating, comment) => session.close(rating, comment),
    openSession: (input) => session.openSession(input),
    refresh: () => session.refresh(),
  };
}

/** Rozet için okunmamış sayısı — sohbet arayüzü açılmadan da çalışır. */
export function useUnreadCount(): number {
  const { unread } = useChat({ open: false });

  return unread;
}

/** Kullanıcı giriş yaptığında çağrılır; ziyaretçiyi kişi kaydına bağlar. */
export function useIdentify(input: IdentifyInput | null | undefined): void {
  const client = useSignalbird();
  const key = input ? JSON.stringify(input) : '';

  useEffect(() => {
    if (!input) return;

    void client.identify(input);
  }, [client, key]);
}

/** Push token'ı kaydeder; token'ı almak ev sahibinin işidir. */
export function usePushRegistration(input: RegisterDeviceInput | null | undefined): void {
  const client = useSignalbird();

  useEffect(() => {
    if (!input?.token) return;

    void client.registerDevice(input);
  }, [client, input?.token, input?.external_id]);
}
