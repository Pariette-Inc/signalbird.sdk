import { readFileSync } from 'node:fs'
import { defineConfig } from 'tsup'

/**
 * Giriş noktaları — her biri bir yüzey ya da bir çatı uyarlaması:
 *
 *  - `index`        → sunucu (Node 18+): Telsiz (`SignalbirdClient`), Gönderim
 *                     (`SignalbirdMessaging`, `verifyWebhook`), Yönetim
 *                     (`SignalbirdManagement`)
 *  - `browser`      → tarayıcı Telsiz istemcisi (açık anahtar, sendBeacon)
 *  - `app`          → son kullanıcı yüzeyi: sohbet + push cihaz kaydı
 *                     (`SignalbirdApp`, `ChatSession`) — çatısız
 *  - `embed`        → panel gömme: partner kendi ekranında Signalbird modülünü
 *                     çalıştırır (`createEmbed`) — çatısız, DOM'a bağımlı
 *  - `react` `vue` `angular` `react-native`
 *                   → `app`'in üstüne oturan ince uyarlamalar; motor tektir
 *  - `signalbird`   → hazır sohbet widget'ı: tek dosya IIFE, global `Signalbird`,
 *                     `<script src=…/sdk/v1/signalbird.js data-app-key=…>` ile
 *                     gömülür. npm paketine girmez; `scripts/publish-web.mjs`
 *                     çıktıyı signalbird.web'e kopyalar.
 *
 * `index`/`browser` ayrımı teknik değil güvenliktir; ayrıntı için
 * `src/browser/index.ts` başlığına bakın. Çatılar `external` bırakılır: paket
 * React'i ya da Vue'yu kendi içine gömerse müşterinin uygulamasında iki kopya
 * çalışır — React'te bu doğrudan çökme demektir.
 */
const version = readFileSync(new URL('./VERSION', import.meta.url), 'utf8').trim()

export default defineConfig([
  {
    entry: {
      index: 'src/node/index.ts',
      browser: 'src/browser/index.ts',
      app: 'src/app/index.ts',
      embed: 'src/embed/index.ts',
      react: 'src/react/index.ts',
      vue: 'src/vue/index.ts',
      angular: 'src/angular/index.ts',
      'react-native': 'src/react-native/index.ts',
    },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    external: ['react', 'react-native', 'vue', 'rxjs'],
    // Widget çıktısı paralel build'de silinmesin
    clean: ['!signalbird.js'],
    splitting: false,
    treeshake: true,
    minify: false,
  },
  {
    entry: { signalbird: 'src/widget/index.ts' },
    format: ['iife'],
    globalName: 'Signalbird',
    platform: 'browser',
    target: 'es2018',
    minify: true,
    dts: false,
    sourcemap: false,
    clean: false,
    splitting: false,
    treeshake: true,
    // `signalbird.global.js` yerine `signalbird.js`
    outExtension: () => ({ js: '.js' }),
    define: { __SB_VERSION__: JSON.stringify(version) },
  },
])
