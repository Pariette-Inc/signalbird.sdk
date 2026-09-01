/**
 * Telsiz istemcisi (sunucu tarafı).
 *
 * Bağımlılığı yoktur: Node 18+ ile gelen `fetch` kullanılır. Bir log
 * kütüphanesinin kendi bağımlılık zincirini müşterinin projesine taşıması,
 * sürüm çakışmalarının en sinir bozucu kaynağıdır.
 */
import {
  DEFAULT_BASE_URL,
  PUBLIC_PREFIX,
  SECRET_PREFIX,
  SignalbirdError,
  type BatchResult,
  type Level,
  type LogInput,
  type LogResult,
  type SignalbirdConfig,
} from './types';

export class SignalbirdClient {
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly throwOnError: boolean;
  private readonly debug: boolean;
  private readonly source?: string;

  constructor(private readonly config: SignalbirdConfig) {
    if (!config.domainKey) {
      throw new SignalbirdError('Signalbird: domainKey zorunlu.', 0, 'NO_KEY');
    }

    /*
     * Yanlış anahtar türü KURULUMDA yakalanır, ilk istekte değil.
     *
     * Açık anahtarı sunucuda kullanmak sessiz bir hatadır: istek gider,
     * `ORIGIN_REQUIRED` döner ve sebebi log'da görünmez. Haftalar sonra fark
     * etmektense burada durmak yeğdir.
     */
    if (config.domainKey.startsWith(PUBLIC_PREFIX)) {
      throw new SignalbirdError(
        'Signalbird: sunucu istemcisine AÇIK anahtar (sb_public_live_…) verildi. ' +
          'Gizli anahtarı (sb_secret_live_…) kullanın; açık anahtar tarayıcı içindir.',
        0,
        'WRONG_KEY_TYPE'
      );
    }

    if (!config.domainKey.startsWith(SECRET_PREFIX)) {
      throw new SignalbirdError(
        'Signalbird: anahtar biçimi tanınmadı. Gizli domain anahtarı ' +
          '`sb_secret_live_` ile başlar (Panel → Alan adları → Anahtarlar).',
        0,
        'WRONG_KEY_TYPE'
      );
    }

    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
    this.timeout = config.timeout ?? 5000;
    this.throwOnError = config.throwOnError ?? false;
    this.debug = config.debug ?? process.env.NODE_ENV !== 'production';
    this.source = config.source;
  }

  /** Tek kayıt gönderir. */
  async log(input: LogInput): Promise<LogResult> {
    return this.send('/v1/radio/log', {
      key: input.key,
      message: input.message,
      level: input.level,
      context: input.context,
      source: input.source ?? this.source,
    });
  }

  /**
   * Toplu gönderim — 100 kayda kadar.
   *
   * Kısmi başarı normaldir (kota tam ortada dolabilir), o yüzden sonuç tek bir
   * durum değil satır satır döner.
   */
  async batch(events: LogInput[]): Promise<BatchResult> {
    const payload = {
      events: events.slice(0, 100).map((event) => ({
        key: event.key,
        message: event.message,
        level: event.level,
        context: event.context,
        source: event.source ?? this.source,
      })),
    };

    const response = await this.request('/v1/radio/log/batch', payload);

    if (!response) {
      return { accepted: 0, total: events.length, results: {} };
    }

    const results: BatchResult['results'] = {};

    for (const [index, row] of Object.entries(response.body?.results ?? {})) {
      const value = row as { ok: boolean; event_id?: string; code?: string };
      results[Number(index)] = { ok: value.ok, eventId: value.event_id, code: value.code };
    }

    return {
      accepted: Number(response.body?.accepted ?? 0),
      total: Number(response.body?.total ?? events.length),
      results,
    };
  }

  // ── Seviye kısayolları ────────────────────────────────────────────────
  // İlk argüman MODÜL ANAHTARIDIR (panelde açtığınız kanalın adı), seviye
  // değil: `sb.error('kritikApiHatasi', '…')`.

  debugLog(key: string, message: string, context?: Record<string, unknown>) {
    return this.log({ key, message, level: 'debug', context });
  }

  info(key: string, message: string, context?: Record<string, unknown>) {
    return this.log({ key, message, level: 'info', context });
  }

  warn(key: string, message: string, context?: Record<string, unknown>) {
    return this.log({ key, message, level: 'warn', context });
  }

  error(key: string, message: string, context?: Record<string, unknown>) {
    return this.log({ key, message, level: 'error', context });
  }

  critical(key: string, message: string, context?: Record<string, unknown>) {
    return this.log({ key, message, level: 'critical', context });
  }

  /**
   * Yakalanmamış hataları Telsiz'e bağlar.
   *
   * Kancayı takıp süreci ÖLDÜRMEYE devam eder: `uncaughtException` sonrası
   * süreci ayakta tutmak, bozuk durumdaki bir uygulamayı çalıştırmaya devam
   * etmek demektir — log göndermek bunu meşrulaştırmaz.
   */
  captureUncaught(key = 'critical'): () => void {
    const onError = (error: Error) => {
      void this.log({
        key,
        message: error.message,
        level: 'critical',
        context: { stack: error.stack?.split('\n').slice(0, 20).join('\n') },
      });
    };

    const onRejection = (reason: unknown) => {
      void this.log({
        key,
        message: reason instanceof Error ? reason.message : String(reason),
        level: 'error',
        context: reason instanceof Error ? { stack: reason.stack } : undefined,
      });
    };

    process.on('uncaughtException', onError);
    process.on('unhandledRejection', onRejection);

    return () => {
      process.off('uncaughtException', onError);
      process.off('unhandledRejection', onRejection);
    };
  }

  private async send(path: string, payload: unknown): Promise<LogResult> {
    const response = await this.request(path, payload);

    if (!response) {
      return { ok: false, code: 'NETWORK_ERROR' };
    }

    if (!response.ok) {
      const code = response.body?.code ?? 'UNKNOWN';

      if (this.throwOnError) {
        throw new SignalbirdError(`Signalbird: ${code}`, response.status, code);
      }

      if (this.debug) {
        console.warn(`[signalbird] gönderilemedi: ${code} (HTTP ${response.status})`);
      }

      return { ok: false, code, status: response.status };
    }

    return { ok: true, eventId: response.body?.event_id, status: response.status };
  }

  private async request(
    path: string,
    payload: unknown
  ): Promise<{ ok: boolean; status: number; body: any } | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(this.baseUrl + path, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          // Kanonik başlık `X-Signalbird-Key`; `Authorization: Bearer` de
          // kabul edilir ama anahtarın bir OAuth jetonu olmadığı açık olsun.
          'X-Signalbird-Key': this.config.domainKey,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const body = await response.json().catch(() => ({}));

      return { ok: response.ok, status: response.status, body };
    } catch (error) {
      if (this.throwOnError) {
        throw new SignalbirdError(
          error instanceof Error ? error.message : 'network error',
          0,
          'NETWORK_ERROR'
        );
      }

      if (this.debug) {
        console.warn('[signalbird] ulaşılamadı:', error);
      }

      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}

export type { Level, LogInput, LogResult, BatchResult, SignalbirdConfig };
