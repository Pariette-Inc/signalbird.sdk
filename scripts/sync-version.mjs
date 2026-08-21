#!/usr/bin/env node
/**
 * Kök VERSION dosyasındaki sürümü, manifestinde sürüm alanı olan dillere yazar.
 *
 * Sürüm kilitlidir: bir dilde değişiklik olmasa bile tüm paketler aynı numarayı
 * taşır, böylece "Signalbird SDK v1.2.0" her dilde aynı şeyi ifade eder.
 *
 * Her registry sürümü aynı yerden okumaz:
 *   - npm      → package.json "version"           (bu betik yazar)
 *   - PyPI     → pyproject.toml [project].version  (bu betik yazar)
 *   - NuGet    → Signalbird.Sdk.csproj <Version>   (bu betik yazar)
 *   - Maven    → build.gradle.kts version          (bu betik yazar)
 *   - Packagist→ git etiketi                       (composer.json'da version ALANI OLMAZ;
 *                                                   repoya atılan vX.Y.Z etiketi belirler)
 *   - Go, SPM  → git etiketi                       (dosyaya yazılmaz)
 *
 * Etiketten sürüm alan diller için kilidi `--check-tag` sağlar; CI sürüm
 * etiketinde bunu çalıştırır.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const version = readFileSync(join(root, 'VERSION'), 'utf8').trim()

if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version)) {
  console.error(`VERSION geçerli semver değil: "${version}"`)
  process.exit(1)
}

// --check-tag vX.Y.Z → etiket ile VERSION uyuşuyor mu
const checkTagIndex = process.argv.indexOf('--check-tag')
if (checkTagIndex !== -1) {
  const tag = (process.argv[checkTagIndex + 1] ?? '').replace(/^v/, '')
  if (tag !== version) {
    console.error(`Etiket "${tag}" ile VERSION "${version}" ayrışmış.`)
    console.error('Etiketten sürüm alan paketler (Packagist, Go, SPM) yanlış sürümle yayınlanır.')
    process.exit(1)
  }
  console.log(`Etiket v${tag} VERSION ile eşleşiyor.`)
  process.exit(0)
}

/** Manifestinde "version" alanı taşıyan diller (kökte dururlar). */
const TARGETS = [
  'package.json',   // npm → signalbird
]

/**
 * JSON olmayan manifestler: sürüm satırı düzenli ifadeyle değiştirilir.
 *
 * Her biri için desen DAR tutulur — `build.gradle.kts` içinde birden çok
 * `version` geçer (bağımlılık sürümleri) ve geniş bir desen onları da bozardı.
 */
const TEXT_TARGETS = [
  {
    file: 'pyproject.toml',
    pattern: /^(version = ")([^"]+)(")$/m,
    label: 'PyPI',
  },
  {
    file: 'Signalbird.Sdk.csproj',
    pattern: /^(\s*<Version>)([^<]+)(<\/Version>)$/m,
    label: 'NuGet',
  },
  {
    file: 'build.gradle.kts',
    pattern: /^(version = ")([^"]+)(")$/m,
    label: 'Maven',
  },
  {
    file: 'src/python/signalbird/__init__.py',
    pattern: /^(__version__ = ")([^"]+)(")$/m,
    label: 'python __version__',
  },

  // Belgelerdeki Gradle satırı. Maven koordinatı sürümü metin olarak taşır ve
  // hiçbir manifest onu güncellemez: v1.2.0'da yazıldı, v1.4.0'a kadar öyle
  // kaldı. Elle bakılan her sayı er geç bayatlar, o yüzden kilide bağlandı.
  //
  // signalbird.web yolları çapraz depodur ama tek yönlüdür ve zaten var olan
  // bir desen: `publish-web.mjs` de widget'ı oraya kopyalıyor. Depo yoksa
  // aşağıdaki döngü sessizce atlar.
  ...[
    'README.md',
    '../signalbird.web/public/docs/tr/sdk-kotlin.md',
    '../signalbird.web/public/docs/tr/sdk-app.md',
    '../signalbird.web/src/app/[locale]/(marketing)/sdk/examples.ts',
    '../signalbird.web/src/app/[locale]/(marketing)/sdk/[slug]/page.tsx',
  ].map((file) => ({
    file,
    pattern: /(io\.signalbird:signalbird-sdk:)(\d+\.\d+\.\d+)()/,
    label: 'Gradle koordinatı',
    // Belgede eksik olması yayını durdurmaz: dil bir belgede hiç anılmıyor olabilir.
    optional: true,
  })),
]

let changed = 0

for (const rel of TARGETS) {
  const path = join(root, rel)
  const raw = readFileSync(path, 'utf8')
  const data = JSON.parse(raw)

  if (data.version === version) {
    console.log(`  = ${rel} (zaten ${version})`)
    continue
  }

  const previous = data.version
  data.version = version

  // Girinti korunur ki diff yalnızca sürüm satırını göstersin
  const indent = raw.match(/^[ \t]+/m)?.[0] ?? '  '
  writeFileSync(path, JSON.stringify(data, null, indent) + '\n')

  console.log(`  ✓ ${rel}: ${previous} → ${version}`)
  changed++
}

for (const target of TEXT_TARGETS) {
  const path = join(root, target.file)

  let raw

  try {
    raw = readFileSync(path, 'utf8')
  } catch {
    console.log(`  · ${target.file} yok, atlandı`)
    continue
  }

  const match = raw.match(target.pattern)

  if (!match) {
    if (target.optional) {
      console.log(`  · ${target.file}: ${target.label} geçmiyor, atlandı`)
      continue
    }

    // Sessizce geçmek, bir paketin eski sürümle yayınlanması demek olurdu.
    console.error(`  ✗ ${target.file}: sürüm satırı bulunamadı (${target.label})`)
    process.exitCode = 1
    continue
  }

  if (match[2] === version) {
    console.log(`  = ${target.file} (zaten ${version})`)
    continue
  }

  writeFileSync(path, raw.replace(target.pattern, `$1${version}$3`))
  console.log(`  ✓ ${target.file}: ${match[2]} → ${version}`)
  changed++
}

// package-lock.json kök sürümü iki yerde tutar
const lockPath = join(root, 'package-lock.json')
try {
  const lock = JSON.parse(readFileSync(lockPath, 'utf8'))
  if (lock.version !== version) {
    lock.version = version
    if (lock.packages?.['']) lock.packages[''].version = version
    writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n')
    console.log(`  ✓ package-lock.json → ${version}`)
    changed++
  }
} catch {
  // lock dosyası yoksa sorun değil
}

console.log(changed ? `\n${version} yazıldı.` : `\nHepsi zaten ${version}.`)
console.log('Etiketten sürüm alanlar (php): git tag v' + version)
