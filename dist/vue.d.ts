import { InjectionKey, Ref, App } from 'vue';
import { SignalbirdApp, SessionInput, ChatState, IdentifyInput, RegisterDeviceInput, AppConfig } from './app.js';

/**
 * `signalbird/vue` — Vue 3 eklentisi ve composable'ları.
 *
 * React uyarlamasıyla aynı `ChatSession` motorunu kullanır; buradaki tek iş
 * durumu Vue'nun tepkimeli sistemine bağlamaktır.
 *
 * Vue bir `peerDependency`'dir; paket onu kendi getirmez.
 */

declare const SIGNALBIRD_KEY: InjectionKey<SignalbirdApp>;
/**
 * `app.use(signalbirdPlugin, { appKey })`
 *
 * Tek istemci tüm bileşenlere `provide` edilir: her bileşenin kendi istemcisini
 * kurması, ziyaretçi sırrının iki kez yüklenmesi ve iki ayrı yoklama döngüsü
 * demekti.
 */
declare const signalbirdPlugin: {
    install(app: App, config: AppConfig): void;
};
/** Ham istemci — push kaydı, kimlik, özel çağrılar için. */
declare function useSignalbird(): SignalbirdApp;
interface UseChatOptions {
    /** Panel açık mı — `ref` verilirse değişimi izlenir. */
    open?: Ref<boolean> | boolean;
    visitor?: SessionInput;
}
interface UseChatResult {
    state: Ref<ChatState>;
    send(body: string, attachments?: unknown[]): Promise<unknown>;
    typing(isTyping: boolean): void;
    markRead(): Promise<void>;
    close(rating?: number, comment?: string): Promise<void>;
    openSession(input: SessionInput): Promise<unknown>;
    refresh(): Promise<void>;
    /** Konuşmayı bırakır; sonraki mesaj yeni bir konuşma açar. */
    reset(): void;
}
declare function useChat(options?: UseChatOptions): UseChatResult;
/** Kullanıcı giriş yaptığında ziyaretçiyi kişi kaydına bağlar. */
declare function identify(input: IdentifyInput): Promise<unknown>;
/** Push token'ı kaydeder; token'ı almak ev sahibinin işidir. */
declare function registerDevice(input: RegisterDeviceInput): Promise<unknown>;

export { SIGNALBIRD_KEY, type UseChatOptions, type UseChatResult, identify, registerDevice, signalbirdPlugin, useChat, useSignalbird };
