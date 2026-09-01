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
import { BehaviorSubject, type Observable } from 'rxjs';
import { ChatSession, SignalbirdApp } from '../app';
import type { AppConfig, ChatState, IdentifyInput, RegisterDeviceInput, SessionInput } from '../app';

/** DI belirteci — Angular'ın `InjectionToken`'ına sarılır (aşağıda). */
export const SIGNALBIRD_CONFIG = 'SIGNALBIRD_CONFIG';

/**
 * Uygulama başına tek örnek (`providedIn: 'root'` karşılığı).
 *
 * Sohbet durumu bir `Observable`'dır; şablon `| async` ile doğrudan bağlanır.
 */
export class SignalbirdService {
  readonly client: SignalbirdApp;

  private readonly session: ChatSession;
  private readonly subject: BehaviorSubject<ChatState>;
  private started = false;

  constructor(config: AppConfig) {
    this.client = new SignalbirdApp(config);
    this.session = new ChatSession(this.client, { active: false });
    this.subject = new BehaviorSubject<ChatState>(this.session.snapshot());

    this.session.subscribe((state) => this.subject.next(state));
  }

  /** Sohbet durumu akışı. İlk abone olduğunda oturum başlar. */
  chat$(): Observable<ChatState> {
    if (!this.started) {
      this.started = true;
      void this.session.start();
    }

    return this.subject.asObservable();
  }

  /** Panel açık mı — yoklama hızını belirler. */
  setOpen(open: boolean): void {
    this.session.setActive(open);
  }

  send(body: string, attachments?: unknown[]): Promise<unknown> {
    return this.session.send(body, attachments);
  }

  typing(isTyping: boolean): void {
    this.session.typing(isTyping);
  }

  markRead(): Promise<void> {
    return this.session.markRead();
  }

  closeConversation(rating?: number, comment?: string): Promise<void> {
    return this.session.close(rating, comment);
  }

  openSession(input: SessionInput): Promise<unknown> {
    return this.session.openSession(input);
  }

  /**
   * Konuşmayı bırakır; sonraki mesaj YENİ bir konuşma açar (29 Ağu 2026).
   * Kapanmış sohbet geri açılmadığı için arayüzün "yeni sohbet" düğmesine
   * bağlanacak bir eyleme ihtiyacı var.
   */
  resetConversation(): void {
    this.session.reset();
  }

  identify(input: IdentifyInput): Promise<unknown> {
    return this.client.identify(input);
  }

  registerDevice(input: RegisterDeviceInput): Promise<unknown> {
    return this.client.registerDevice(input);
  }

  /** Uygulama kapanırken ya da testte: yoklamayı durdurur. */
  destroy(): void {
    this.session.stop();
    this.subject.complete();
  }
}

/**
 * `bootstrapApplication(App, { providers: [provideSignalbird({ publicKey })] })`
 *
 * Dönen nesne Angular'ın `Provider` biçimindedir ama tipi buraya gömülmez —
 * paket Angular'a derleme zamanı bağımlılık taşımaz.
 */
export function provideSignalbird(config: AppConfig): {
  provide: typeof SignalbirdService;
  useFactory: () => SignalbirdService;
} {
  return {
    provide: SignalbirdService,
    useFactory: () => new SignalbirdService(config),
  };
}
