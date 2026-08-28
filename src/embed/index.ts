/**
 * signalbird/embed — panel ekranlarını başka bir panelin içinde çalıştıran
 * yüzey. Ayrıntı için `element.ts` ve `types.ts` başlıklarına bakın.
 *
 *   import { createEmbed } from 'signalbird/embed'
 *
 *   const chat = createEmbed({
 *     module: 'chat',
 *     mint: () => fetch('/api/signalbird/embed', {
 *       method: 'POST',
 *       body: JSON.stringify({ module: 'chat' }),
 *     }).then((r) => r.json()),
 *   })
 *
 *   await chat.mount('#sb-chat')
 *
 * Betik etiketiyle kullanan (npm'siz) ev sahibi için aynı işlev global
 * `Signalbird.embed(...)` altında da yayınlanır.
 */
export { createEmbed } from './element';
export type {
  EmbedEvent,
  EmbedHandle,
  EmbedMinter,
  EmbedModule,
  EmbedOptions,
  EmbedTheme,
} from './types';
