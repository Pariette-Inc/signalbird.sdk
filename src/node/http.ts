/**
 * Anahtarlı istemcilerin ortak taşıma katmanı.
 *
 * Gönderim ve Yönetim istemcileri aynı kapıyı kullanır (`Authorization: Bearer
 * sb_…`), aynı zarfı döner ve aynı kod eşlemesini uygular. İki yerde ayrı ayrı
 * yazılsaydı biri düzeltilip diğeri unutulurdu — hata kodları da sözleşmenin
 * bir parçasıdır.
 *
 * Sözleşme: docs/CONTRACT.md § 8.2 (zarf) ve § 8.5 (sorgu dizesi)
 */
import { SignalbirdError } from './types';

/** Her metodun döndüğü zarf. Başarısızlık istisna değil, veridir. */
export interface SbResult<T = unknown> {
  ok: boolean;
  status: number;
  data?: T;
  code?: string;
  message?: string;
}

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export interface TransportConfig {
  domainKey: string;
  baseUrl: string;
  timeout: number;
  throwOnError: boolean;
  debug: boolean;
}

export class SbTransport {
  constructor(private readonly config: TransportConfig) {}

  async request<T>(
    method: HttpMethod,
    path: string,
    body?: unknown,
    query?: object
  ): Promise<SbResult<T>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeout);
    const url = this.config.baseUrl + path + buildQuery(query);

    let status = 0;
    let data: any;

    try {
      const response = await fetch(url, {
        method,
        headers: {
          Accept: 'application/json',
          'X-Signalbird-Key': this.config.domainKey,
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      status = response.status;
      const text = await response.text();
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = text;
      }

      if (response.ok) {
        return { ok: true, status, data: data as T };
      }
    } catch (error) {
      const timedOut = error instanceof Error && error.name === 'AbortError';

      return this.fail(
        0,
        timedOut ? 'TIMEOUT' : 'NETWORK_ERROR',
        error instanceof Error ? error.message : 'network error',
        undefined
      );
    } finally {
      clearTimeout(timer);
    }

    // API `{message, code}` döner; Laravel doğrulama hatası `{message, errors}`
    // döner (kodsuz) — onu VALIDATION_ERROR sayarız.
    const code: string =
      (data && typeof data === 'object' && typeof data.code === 'string' && data.code) ||
      (status === 422 ? 'VALIDATION_ERROR' : status === 401 ? 'API_KEY_INVALID' : `HTTP_${status}`);
    const message: string =
      (data && typeof data === 'object' && typeof data.message === 'string' && data.message) ||
      `HTTP ${status}`;

    return this.fail(status, code, message, data);
  }

  private fail<T>(status: number, code: string, message: string, data: unknown): SbResult<T> {
    if (this.config.throwOnError) {
      throw new SignalbirdError(`Signalbird: ${code} — ${message}`, status, code, data);
    }

    if (this.config.debug) {
      console.warn(`[signalbird] ${code} (HTTP ${status}): ${message}`);
    }

    return { ok: false, status, code, message, data: data as T };
  }
}

/** `undefined`/`null` alanlar atlanır; diziler `key[]=` biçiminde gider. */
export function buildQuery(query: object | undefined): string {
  if (!query) return '';

  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query as Record<string, unknown>)) {
    if (value === undefined || value === null) continue;

    if (Array.isArray(value)) {
      for (const item of value) params.append(`${key}[]`, String(item));
    } else {
      params.append(key, String(value));
    }
  }

  const encoded = params.toString();

  return encoded ? `?${encoded}` : '';
}

/** Yol parçası — kimlikler URL'e gömülmeden önce kodlanır. */
export function seg(value: string | number): string {
  return encodeURIComponent(String(value));
}
