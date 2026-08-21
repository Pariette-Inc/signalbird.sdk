import { Observable } from 'rxjs';
import { SignalbirdApp, AppConfig, ChatState, SessionInput, IdentifyInput, RegisterDeviceInput } from './app.mjs';

/**
 * `signalbird/angular` — Angular servisi ve sağlayıcısı.
 *
 * Dekoratör KULLANMAZ: `@Injectable()` yazsaydık paketin derlenmesi Angular
 * sürümüne bağlanırdı ve her büyük sürümde yeniden yayın gerekirdi. Bunun
 * yerine düz sınıf + `provideSignalbird()` fabrikası veriyoruz; Angular'ın DI'ı
 * bunu sorunsuz kabul eder ve sürümden bağımsızdır.
 *
 * RxJS bir `peerDependency`'dir (Angular zaten getirir).
 */

/** DI belirteci — Angular'ın `InjectionToken`'ına sarılır (aşağıda). */
declare const SIGNALBIRD_CONFIG = "SIGNALBIRD_CONFIG";
/**
 * Uygulama başına tek örnek (`providedIn: 'root'` karşılığı).
 *
 * Sohbet durumu bir `Observable`'dır; şablon `| async` ile doğrudan bağlanır.
 */
declare class SignalbirdService {
    readonly client: SignalbirdApp;
    private readonly session;
    private readonly subject;
    private started;
    constructor(config: AppConfig);
    /** Sohbet durumu akışı. İlk abone olduğunda oturum başlar. */
    chat$(): Observable<ChatState>;
    /** Panel açık mı — yoklama hızını belirler. */
    setOpen(open: boolean): void;
    send(body: string, attachments?: unknown[]): Promise<unknown>;
    typing(isTyping: boolean): void;
    markRead(): Promise<void>;
    closeConversation(rating?: number, comment?: string): Promise<void>;
    openSession(input: SessionInput): Promise<unknown>;
    identify(input: IdentifyInput): Promise<unknown>;
    registerDevice(input: RegisterDeviceInput): Promise<unknown>;
    /** Uygulama kapanırken ya da testte: yoklamayı durdurur. */
    destroy(): void;
}
/**
 * `bootstrapApplication(App, { providers: [provideSignalbird({ appKey })] })`
 *
 * Dönen nesne Angular'ın `Provider` biçimindedir ama tipi buraya gömülmez —
 * paket Angular'a derleme zamanı bağımlılık taşımaz.
 */
declare function provideSignalbird(config: AppConfig): {
    provide: typeof SignalbirdService;
    useFactory: () => SignalbirdService;
};

export { SIGNALBIRD_CONFIG, SignalbirdService, provideSignalbird };
