import { SignalbirdClient } from './client'
import { SignalbirdConfig, LogPayload, SendPayload, TriggerResponse } from './types'

export class Signalbird {
  private client: SignalbirdClient

  constructor(config: SignalbirdConfig) {
    this.client = new SignalbirdClient(config)
  }

  /** Bilgilendirme bildirimi gönder */
  info(payload: LogPayload): Promise<TriggerResponse> {
    return this.client.trigger(payload.title, payload.message, 'info')
  }

  /** Uyarı bildirimi gönder */
  warn(payload: LogPayload): Promise<TriggerResponse> {
    return this.client.trigger(payload.title, payload.message, 'warn')
  }

  /** Hata bildirimi gönder */
  error(payload: LogPayload): Promise<TriggerResponse> {
    return this.client.trigger(payload.title, payload.message, 'error')
  }

  /** Kritik hata bildirimi gönder (acil bildirim) */
  critical(payload: LogPayload): Promise<TriggerResponse> {
    return this.client.trigger(payload.title, payload.message, 'critical')
  }

  /** Onay/başarı bildirimi gönder */
  confirm(payload: LogPayload): Promise<TriggerResponse> {
    return this.client.trigger(payload.title, payload.message, 'confirm')
  }

  /** Debug bildirimi gönder */
  debug(payload: LogPayload): Promise<TriggerResponse> {
    return this.client.trigger(payload.title, payload.message, 'debug')
  }

  /** Özel seviyede bildirim gönder */
  send(payload: SendPayload): Promise<TriggerResponse> {
    return this.client.trigger(payload.title, payload.message, payload.level)
  }
}
