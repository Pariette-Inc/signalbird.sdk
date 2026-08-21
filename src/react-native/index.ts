/**
 * `signalbird/react-native` — Expo ve düz React Native.
 *
 * React uyarlamasının aynısı, iki farkla ve ikisi de platform gereğidir:
 *
 *  1. **Depo eşzamansızdır.** `localStorage` yoktur; `AsyncStorage` ya da
 *     `expo-secure-store` dışarıdan verilir. Ziyaretçi sırrı cihazda kalmazsa
 *     kullanıcı uygulamayı her açtığında sohbet geçmişini kaybeder.
 *  2. **Görünürlük `AppState`'tir.** `document.visibilityState` yoktur; arka
 *     plandaki uygulamada yoklama turu atlanır — aksi hâlde SDK pil yer.
 *
 * React ve react-native `peerDependency`'dir.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChatSession, SignalbirdApp } from '../app';
import type { AppConfig, AppStorage, ChatState, RegisterDeviceInput, SessionInput } from '../app';

/**
 * `AsyncStorage`'ı SDK'nın beklediği arayüze çevirir.
 *
 *   import AsyncStorage from '@react-native-async-storage/async-storage'
 *   const storage = asyncStorageAdapter(AsyncStorage)
 */
export function asyncStorageAdapter(store: {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}): AppStorage {
  return {
    getItem: (key) => store.getItem(key),
    setItem: (key, value) => store.setItem(key, value),
    removeItem: (key) => store.removeItem(key),
  };
}

export interface NativeChatOptions {
  /** Sohbet ekranı önde mi — yoklama hızını belirler. */
  open?: boolean;
  visitor?: SessionInput;
  /**
   * Uygulama önde mi. `AppState.currentState === 'active'` verin:
   *   const [fg, setFg] = useState(true)
   *   useEffect(() => AppState.addEventListener('change', s => setFg(s === 'active')).remove, [])
   */
  isForeground?: boolean;
}

export interface NativeChatResult extends ChatState {
  send(body: string, attachments?: unknown[]): Promise<unknown>;
  typing(isTyping: boolean): void;
  markRead(): Promise<void>;
  close(rating?: number, comment?: string): Promise<void>;
  openSession(input: SessionInput): Promise<unknown>;
  refresh(): Promise<void>;
}

/** İstemciyi kurar. Depoyu vermeyi UNUTMAYIN — bellekte kalırsa oturum uçar. */
export function createSignalbirdApp(config: AppConfig): SignalbirdApp {
  return new SignalbirdApp(config);
}

export function useNativeChat(client: SignalbirdApp, options: NativeChatOptions = {}): NativeChatResult {
  const foregroundRef = useRef(options.isForeground ?? true);
  foregroundRef.current = options.isForeground ?? true;

  const session = useMemo(
    () =>
      new ChatSession(client, {
        active: options.open,
        visitor: options.visitor,
        isVisible: () => foregroundRef.current,
      }),
    [client]
  );

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

/**
 * Push token'ını kaydeder.
 *
 * Token'ı almak (Expo Notifications ya da Firebase Messaging) ve izin
 * diyaloğunu göstermek uygulamanın işidir: izni ne zaman isteyeceğin bir ürün
 * kararıdır ve mağaza kuralları bunu ciddiye alır.
 */
export function useNativePush(
  client: SignalbirdApp,
  input: RegisterDeviceInput | null | undefined
): void {
  useEffect(() => {
    if (!input?.token) return;

    void client.registerDevice(input);
  }, [client, input?.token, input?.external_id]);
}

export { SignalbirdApp, ChatSession } from '../app';
export type { AppConfig, AppStorage, ChatState, RegisterDeviceInput, SessionInput } from '../app';
