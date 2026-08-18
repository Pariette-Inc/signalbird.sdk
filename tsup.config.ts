import { defineConfig } from 'tsup'

/**
 * İki giriş noktası, iki paket:
 *  - `index`   → sunucu (Node 18+, gizli anahtar)
 *  - `browser` → tarayıcı (açık anahtar, sendBeacon)
 *
 * Ayrılmalarının sebebi teknik değil güvenliktir; ayrıntı için
 * `src/browser/index.ts` başlığına bakın.
 */
export default defineConfig({
  entry: { index: 'src/node/index.ts', browser: 'src/browser/index.ts' },
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  minify: false,
})
