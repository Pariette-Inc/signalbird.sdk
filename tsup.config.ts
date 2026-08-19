import { readFileSync } from 'node:fs'
import { defineConfig } from 'tsup'

/**
 * Üç giriş noktası, üç yüzey:
 *  - `index`      → sunucu (Node 18+): Telsiz (`SignalbirdClient`) + Gönderim
 *                   (`SignalbirdMessaging`, `verifyWebhook`)
 *  - `browser`    → tarayıcı Telsiz istemcisi (açık anahtar, sendBeacon)
 *  - `signalbird` → sohbet/push widget'ı: tek dosya IIFE, global `Signalbird`,
 *                   `<script src=…/sdk/v1/signalbird.js data-app-key=…>` ile
 *                   gömülür. npm paketine girmez; `scripts/publish-web.mjs`
 *                   çıktıyı signalbird.web'e kopyalar.
 *
 * `index`/`browser` ayrımı teknik değil güvenliktir; ayrıntı için
 * `src/browser/index.ts` başlığına bakın.
 */
const version = readFileSync(new URL('./VERSION', import.meta.url), 'utf8').trim()

export default defineConfig([
  {
    entry: { index: 'src/node/index.ts', browser: 'src/browser/index.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
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
