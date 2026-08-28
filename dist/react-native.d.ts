import { SessionInput, ChatState, AppStorage, AppConfig, SignalbirdApp, RegisterDeviceInput } from './app.js';
export { ChatSession } from './app.js';

/**
 * `AsyncStorage`'ı SDK'nın beklediği arayüze çevirir.
 *
 *   import AsyncStorage from '@react-native-async-storage/async-storage'
 *   const storage = asyncStorageAdapter(AsyncStorage)
 */
declare function asyncStorageAdapter(store: {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
}): AppStorage;
interface NativeChatOptions {
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
interface NativeChatResult extends ChatState {
    send(body: string, attachments?: unknown[]): Promise<unknown>;
    typing(isTyping: boolean): void;
    markRead(): Promise<void>;
    close(rating?: number, comment?: string): Promise<void>;
    openSession(input: SessionInput): Promise<unknown>;
    refresh(): Promise<void>;
    /** Konuşmayı bırakır; sonraki mesaj yeni bir konuşma açar. */
    reset(): void;
}
/** İstemciyi kurar. Depoyu vermeyi UNUTMAYIN — bellekte kalırsa oturum uçar. */
declare function createSignalbirdApp(config: AppConfig): SignalbirdApp;
declare function useNativeChat(client: SignalbirdApp, options?: NativeChatOptions): NativeChatResult;
/**
 * Push token'ını kaydeder.
 *
 * Token'ı almak (Expo Notifications ya da Firebase Messaging) ve izin
 * diyaloğunu göstermek uygulamanın işidir: izni ne zaman isteyeceğin bir ürün
 * kararıdır ve mağaza kuralları bunu ciddiye alır.
 */
declare function useNativePush(client: SignalbirdApp, input: RegisterDeviceInput | null | undefined): void;

export { AppConfig, AppStorage, ChatState, type NativeChatOptions, type NativeChatResult, RegisterDeviceInput, SessionInput, SignalbirdApp, asyncStorageAdapter, createSignalbirdApp, useNativeChat, useNativePush };
