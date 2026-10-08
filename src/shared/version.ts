/**
 * SDK sürüm bildirimi - CONTRACT §14.
 *
 * Her istek `X-Signalbird-Sdk: <platform>/<sürüm>` taşır; API bunu kaydeder
 * ve yanıtta `Signalbird-Sdk-Status` (current | outdated | unsupported) ile
 * `Signalbird-Sdk-Latest` döner. SDK eski olduğunu öğrenince geliştiriciye
 * süreç başına BİR KEZ uyarı yazar. Uyarı hata değildir: istek sonucu
 * değişmez, istisna fırlatılmaz.
 *
 * Sürüm numarası derlemede `VERSION` dosyasından gömülür (tsup `define`).
 */

declare const __SB_VERSION__: string;

export const SDK_VERSION: string = typeof __SB_VERSION__ === 'string' ? __SB_VERSION__ : '0.0.0';

export const SDK_HEADER = 'X-Signalbird-Sdk';

/** `node/2.6.0` - platform adları CONTRACT §14.1'deki listededir. */
export function sdkHeaderValue(platform: string): string {
  return `${platform}/${SDK_VERSION}`;
}

/** Başlık okuyabilen her şey: fetch `Headers`, ya da sahte bir yanıt. */
interface HeaderSource {
  get(name: string): string | null;
}

let warned = false;

/**
 * Yanıttaki sürüm durumuna bakar; eskiyse bir kez `console.warn` yazar.
 * Hiçbir koşulda hata fırlatmaz: sürüm uyarısı yüzünden müşterinin isteği
 * bozulmamalı.
 */
export function noteSdkStatus(headers: HeaderSource | null | undefined): void {
  if (warned || !headers) return;

  try {
    const status = headers.get('Signalbird-Sdk-Status');

    if (status !== 'outdated' && status !== 'unsupported') return;

    warned = true;

    const latest = headers.get('Signalbird-Sdk-Latest') ?? '?';
    const message = status === 'unsupported'
      ? `[signalbird] Bu SDK sürümü (${SDK_VERSION}) artık desteklenmiyor. Son sürüm: ${latest}. Paketi güncelleyin.`
      : `[signalbird] Yeni SDK sürümü var: ${latest} (kurulu: ${SDK_VERSION}).`;

    if (typeof console !== 'undefined') console.warn(message);
  } catch {
    // uyarı yazılamadıysa sessiz kal
  }
}

/** Yalnız testler için: uyarıyı yeniden kurar. */
export function resetSdkStatusWarning(): void {
  warned = false;
}
