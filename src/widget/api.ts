/**
 * Widget'ın HTTP katmanı.
 *
 * Her istek uygulama anahtarını (`X-Signalbird-App-Key`) ve varsa ziyaretçi
 * sırrını (`X-Signalbird-Visitor`) taşır. Sır localStorage'dadır; kimlik
 * doğrulama yoktur — anahtar uygulamayı, sır ziyaretçiyi tanır.
 *
 * `keepalive` yalnız kısa "durum" isteklerinde (yazıyor, okundu) kullanılır:
 * sekme kapanırken bile gitsinler; büyük gövdelerde tarayıcı keepalive'ı
 * 64 KB ile sınırlar.
 */
import type { ApiResult } from './types';

export class Api {
  constructor(
    private readonly baseUrl: string,
    private readonly appKey: string,
    private readonly secret: () => string | null,
    private readonly log: (...args: unknown[]) => void
  ) {}

  get<T>(path: string, query?: Record<string, unknown>): Promise<ApiResult<T>> {
    return this.request<T>('GET', path + toQuery(query));
  }

  post<T>(path: string, body?: unknown, keepalive = false): Promise<ApiResult<T>> {
    return this.request<T>('POST', path, body, keepalive);
  }

  patch<T>(path: string, body?: unknown): Promise<ApiResult<T>> {
    return this.request<T>('PATCH', path, body);
  }

  delete<T>(path: string): Promise<ApiResult<T>> {
    return this.request<T>('DELETE', path);
  }

  /** multipart `file` — Content-Type'ı tarayıcı koyar (boundary). */
  upload<T>(path: string, file: File): Promise<ApiResult<T>> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.request<T>('POST', path, form);
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    keepalive = false
  ): Promise<ApiResult<T>> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'X-Signalbird-App-Key': this.appKey,
    };
    const secret = this.secret();
    if (secret) headers['X-Signalbird-Visitor'] = secret;

    let payload: BodyInit | undefined;
    if (body instanceof FormData) {
      payload = body;
    } else if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }

    let status = 0;
    let data: any = null;

    try {
      const res = await fetch(this.baseUrl + path, { method, headers, body: payload, keepalive });
      status = res.status;
      const text = await res.text();
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = text;
      }
      if (res.ok) return { ok: true, status, data: data as T };
    } catch (error) {
      this.log('network', method, path, error);
      return { ok: false, status: 0, code: 'NETWORK_ERROR', message: String(error) };
    }

    const code = (data && data.code) || `HTTP_${status}`;
    const message = (data && data.message) || `HTTP ${status}`;
    this.log('error', method, path, code, message);

    return { ok: false, status, code, message, data };
  }
}

function toQuery(query?: Record<string, unknown>): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const key in query) {
    const value = query[key];
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  const s = params.toString();
  return s ? `?${s}` : '';
}
