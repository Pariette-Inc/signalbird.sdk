/**
 * @signalbird/sdk — sunucu tarafı giriş noktası.
 *
 * Next.js sunucu bileşenleri, API route'ları, Express/Fastify/NestJS ve düz
 * Node betikleri buradan alır. TARAYICI için `@signalbird/sdk/browser`
 * kullanılır — gizli anahtar istemciye inmez.
 */
export { SignalbirdClient } from './client';
export {
  SignalbirdError,
  DEFAULT_BASE_URL,
  type BatchResult,
  type Level,
  type LogInput,
  type LogResult,
  type SignalbirdConfig,
} from './types';

import { SignalbirdClient } from './client';
import type { SignalbirdConfig } from './types';

let singleton: SignalbirdClient | null = null;

/**
 * Ortam değişkeninden kurulan paylaşımlı istemci.
 *
 * `SIGNALBIRD_KEY` okunur. Uygulamanın her köşesinde istemci kurup anahtarı
 * elden ele taşımak yerine tek çağrı yeter:
 *
 *   import { signalbird } from '@signalbird/sdk'
 *   await signalbird().critical('critical', 'ödeme servisi öldü')
 */
export function signalbird(config?: Partial<SignalbirdConfig>): SignalbirdClient {
  if (singleton && !config) {
    return singleton;
  }

  const apiKey = config?.apiKey ?? process.env.SIGNALBIRD_KEY ?? '';

  const client = new SignalbirdClient({
    apiKey,
    baseUrl: config?.baseUrl ?? process.env.SIGNALBIRD_URL,
    source: config?.source ?? process.env.SIGNALBIRD_SOURCE,
    ...config,
  });

  if (!config) {
    singleton = client;
  }

  return client;
}

/** Test ve sıcak yeniden yükleme için tekil istemciyi sıfırlar. */
export function resetSignalbird(): void {
  singleton = null;
}
