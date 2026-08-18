/**
 * Telsiz istemcisi (sunucu tarafı).
 *
 * Bağımlılığı yoktur: Node 18+ ile gelen `fetch` kullanılır. Bir log
 * kütüphanesinin kendi bağımlılık zincirini müşterinin projesine taşıması,
 * sürüm çakışmalarının en sinir bozucu kaynağıdır.
 */
import {
  DEFAULT_BASE_URL,
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
    if (!config.apiKey) {
      throw new SignalbirdError('Signalbird: apiKey zorunlu.', 0, 'NO_KEY');
    }

    // Açık anahtarın sunucuda kullanılması sessiz bir güvenlik hatasıdır:
    // çalışır görünür ama kanal kısıtlarına takılır. Baştan söylüyoruz.
    if (config.apiKey.startsWith('sbr_pub_')) {
      throw new SignalbirdError(
        'Signalbird: sunucu istemcisine tarayıcı anahtarı (sbr_pub_…) verildi. ' +
          'Sunucu anahtarı (sbr_live_…) kullanın.',
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
      channel: input.channel,
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
        channel: event.channel,
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
  // `log('critical', …)` yerine `critical(…)`: kanal adı ile seviye çoğu
  // projede aynıdır, ikisini ayrı ayrı yazdırmak gereksiz tekrar olurdu.

  debugLog(channel: string, message: string, context?: Record<string, unknown>) {
    return this.log({ channel, message, level: 'debug', context });
  }

  info(channel: string, message: string, context?: Record<string, unknown>) {
    return this.log({ channel, message, level: 'info', context });
  }

  warn(channel: string, message: string, context?: Record<string, unknown>) {
    return this.log({ channel, message, level: 'warn', context });
  }

  error(channel: string, message: string, context?: Record<string, unknown>) {
    return this.log({ channel, message, level: 'error', context });
  }

  critical(channel: string, message: string, context?: Record<string, unknown>) {
    return this.log({ channel, message, level: 'critical', context });
  }

  /**
   * Yakalanmamış hataları Telsiz'e bağlar.
   *
   * Kancayı takıp süreci ÖLDÜRMEYE devam eder: `uncaughtException` sonrası
   * süreci ayakta tutmak, bozuk durumdaki bir uygulamayı çalıştırmaya devam
   * etmek demektir — log göndermek bunu meşrulaştırmaz.
   */
  captureUncaught(channel = 'critical'): () => void {
    const onError = (error: Error) => {
      void this.log({
        channel,
        message: error.message,
        level: 'critical',
        context: { stack: error.stack?.split('\n').slice(0, 20).join('\n') },
      });
    };

    const onRejection = (reason: unknown) => {
      void this.log({
        channel,
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
          Authorization: `Bearer ${this.config.apiKey}`,
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
