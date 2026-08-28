import * as react from 'react';
import { ReactNode } from 'react';
import { AppConfig, SignalbirdApp, SessionInput, ChatState, IdentifyInput, RegisterDeviceInput } from './app.js';

interface SignalbirdProviderProps extends AppConfig {
    children?: ReactNode;
}
/**
 * Uygulamanın köküne konur. İstemci bir kez kurulur; `appKey` değişirse
 * (ortam değişimi, çoklu marka) yeniden kurulur.
 */
declare function SignalbirdProvider({ children, ...config }: SignalbirdProviderProps): react.FunctionComponentElement<react.ProviderProps<SignalbirdApp | null>>;
/** Ham istemci — push kaydı, kimlik, özel çağrılar için. */
declare function useSignalbird(): SignalbirdApp;
interface UseChatOptions {
    /** Panel açık mı — yoklama hızını belirler (açık 3 s, kapalı merdiven). */
    open?: boolean;
    /** Oturum kurulurken kullanılacak ziyaretçi bilgisi (ön-form ya da giriş). */
    visitor?: SessionInput;
}
interface UseChatResult extends ChatState {
    send(body: string, attachments?: unknown[]): Promise<unknown>;
    typing(isTyping: boolean): void;
    markRead(): Promise<void>;
    close(rating?: number, comment?: string): Promise<void>;
    openSession(input: SessionInput): Promise<unknown>;
    refresh(): Promise<void>;
    /** Konuşmayı bırakır; sonraki mesaj yeni bir konuşma açar. */
    reset(): void;
}
/**
 * Sohbet durumu + eylemleri.
 *
 * `open` değiştiğinde oturum yeniden KURULMAZ, yalnız yoklama hızı değişir —
 * paneli her açışta baştan yüklemek, konuşmayı kaybetmiş gibi hissettirirdi.
 */
declare function useChat(options?: UseChatOptions): UseChatResult;
/** Rozet için okunmamış sayısı — sohbet arayüzü açılmadan da çalışır. */
declare function useUnreadCount(): number;
/** Kullanıcı giriş yaptığında çağrılır; ziyaretçiyi kişi kaydına bağlar. */
declare function useIdentify(input: IdentifyInput | null | undefined): void;
/** Push token'ı kaydeder; token'ı almak ev sahibinin işidir. */
declare function usePushRegistration(input: RegisterDeviceInput | null | undefined): void;

export { SignalbirdProvider, type SignalbirdProviderProps, type UseChatOptions, type UseChatResult, useChat, useIdentify, usePushRegistration, useSignalbird, useUnreadCount };
