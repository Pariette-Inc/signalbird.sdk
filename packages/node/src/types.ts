export type LogLevel = 'info' | 'warn' | 'error' | 'critical' | 'confirm' | 'debug'

export interface SignalbirdConfig {
  /** Signalbird panelinden oluşturduğunuz SDK API anahtarı (sb_...) */
  apiKey: string
  /** Ortam seçimi. Varsayılan: 'production' */
  mode?: 'production' | 'test'
  /** İstek zaman aşımı (ms). Varsayılan: 10000 */
  timeout?: number
}

export interface LogPayload {
  /** Bildirim başlığı */
  title: string
  /** Bildirim mesajı */
  message: string
}

export interface SendPayload extends LogPayload {
  /** Log seviyesi */
  level: LogLevel
}

export interface TriggerResponse {
  message: string
  data: {
    title: string
    message: string
    level: string
  }
}

export class SignalbirdError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public details?: any
  ) {
    super(message)
    this.name = 'SignalbirdError'
  }
}

export const API_URLS: Record<NonNullable<SignalbirdConfig['mode']>, string> = {
  production: 'https://live.signalbird.io/api',
  test: 'http://localhost/api',
}
