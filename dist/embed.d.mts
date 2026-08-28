/**
 * Gömme (embed) yüzeyi — Signalbird panel ekranını BAŞKA bir panelin içinde
 * çalıştırır.
 *
 * Sözleşme: signalbird.api/docs/PARTNER_PLATFORM_2026-08-20.md §2.6, §4.4.
 *
 * KARAR 2026-08-27 (Ahmet): "submitcms paneline chat modülü yazmayalım, SDK
 * içinde doğrudan render eden bir yapı olsun; nereye çakarsak orda çalışsın."
 * Yani sanal POS mantığı: ev sahibi sayfa bir kap (`<div>`) verir, SDK o kabın
 * içine çalışan ekranı kurar. Ev sahibi ne iframe yazar, ne yükseklik hesaplar,
 * ne jeton ömrü yönetir.
 */
/** Gömülebilir modüller — Signalbird `Partner::EMBED_MODULES` ile birebir. */
type EmbedModule = 'chat' | 'monitoring' | 'campaigns' | 'contacts' | 'radio' | 'messages';
type EmbedTheme = 'light' | 'dark' | 'auto';
/**
 * Jeton üretimi EV SAHİBİNİN SUNUCUSUNDA olur; partner anahtarı (`sbp_live_…`)
 * tarayıcıya asla inmez. SDK yalnızca sonucu ister.
 *
 * Dönüş: Signalbird'ün `POST /v1/partner/companies/{ext}/embed` yanıtındaki
 * `url` — ya doğrudan string, ya `{url}` taşıyan nesne (ev sahibinin API
 * zarfını soymasına gerek kalmasın diye ikisi de kabul edilir).
 */
type EmbedMinter = (context: {
    module: EmbedModule;
    theme: 'light' | 'dark';
    locale?: string;
}) => Promise<string | {
    url?: string;
    data?: {
        url?: string;
    };
}>;
interface EmbedOptions {
    module: EmbedModule;
    /** Jeton üretici (bkz. EmbedMinter). `url` verilmediyse ZORUNLU. */
    mint?: EmbedMinter;
    /**
     * Hazır gömme adresi. Ev sahibi jetonu kendi almışsa kullanılır; TEK
     * KULLANIMLIKTIR, `refresh()` çağrıldığında `mint` yoksa yeniden kullanılamaz.
     */
    url?: string;
    /** Varsayılan `auto`: ev sahibi sayfanın karanlık kipini izler. */
    theme?: EmbedTheme;
    locale?: string;
    /** Vurgu rengi (hex, `#` olmadan da olur) — Signalbird ekranı buna uyar. */
    accent?: string;
    /**
     * `auto` (varsayılan): yükseklik gömülü ekranın bildirdiği kadar olur.
     * Sayı verilirse sabit piksel; sohbet gibi kendi içinde kayan ekranlarda
     * sabit yükseklik genelde daha iyidir.
     */
    height?: number | 'auto';
    /** `auto` yükseklikte alt sınır — ekran yüklenirken çerçeve zıplamasın. */
    minHeight?: number;
    /** iframe'e eklenecek CSS sınıfı (ev sahibinin kendi kenarlığı, gölgesi…). */
    className?: string;
    /** Yükleme/hata metinleri Türkçe varsayılır; `en` de desteklenir. */
    language?: 'tr' | 'en';
}
type EmbedEvent = 'ready' | 'error' | 'height';
interface EmbedHandle {
    /** Kabın içine kurar. Aynı handle iki kez mount edilmez. */
    mount(target: Element | string): Promise<void>;
    /** Yeni jeton alır ve ekranı sıfırdan kurar. */
    refresh(): Promise<void>;
    /** Karanlık/aydınlık kip değişiminde: jeton tazelenir, tema aktarılır. */
    setTheme(theme: EmbedTheme): Promise<void>;
    /** iframe'i ve dinleyicileri kaldırır. */
    destroy(): void;
    on(event: EmbedEvent, handler: (payload?: unknown) => void): void;
    off(event: EmbedEvent, handler: (payload?: unknown) => void): void;
}

/**
 * Gömme çekirdeği — çatısız, bağımlılıksız.
 *
 * Ev sahibi tarafında TEK satır:
 *
 *   Signalbird.embed({ module: 'chat', mint }).mount('#sb-chat')
 *
 * Ne yapar:
 *   • jetonu ev sahibinin sunucusundan ister (partner anahtarı tarayıcıya inmez)
 *   • iframe'i kurar, tema/dil/vurgu rengini adrese işler
 *   • gömülü ekranın `postMessage` ile bildirdiği yüksekliği uygular
 *   • jeton süresi dolmuş/geçersizse anlaşılır bir hata ve "yeniden dene" çizer
 *   • `destroy()` ile dinleyicileri bırakır (SPA'da sızıntı yok)
 *
 * NE YAPMAZ: modülün satın alınıp alınmadığına bakmaz. O kapı ev sahibinin
 * kendi satış kaydındadır ve `mint` çağrısı 403 dönerek söyler; SDK yalnız
 * mesajı gösterir.
 */

declare function createEmbed(options: EmbedOptions): EmbedHandle;

export { type EmbedEvent, type EmbedHandle, type EmbedMinter, type EmbedModule, type EmbedOptions, type EmbedTheme, createEmbed };
