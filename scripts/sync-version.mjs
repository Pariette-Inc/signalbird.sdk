#!/usr/bin/env node
/**
 * Kök VERSION dosyasındaki sürümü, sürüm alanı taşıyan paketlere yazar.
 *
 * Sürüm kilitlidir: bir dilde değişiklik olmasa bile tüm paketler aynı numarayı
 * taşır, böylece "Signalbird SDK v1.2.0" her dilde aynı şeyi ifade eder.
 *
 * Her registry sürümü aynı yerden okumaz:
 *   - npm      → package.json "version"           (bu betik yazar)
 *   - Packagist→ git etiketi                       (composer.json'da version ALANI OLMAZ;
 *                                                   ayna repoya taşınan vX.Y.Z etiketi belirler)
 *   - NuGet    → .csproj <Version>                 (eklendiğinde TARGETS'a gir)
 *   - Maven    → pom.xml / gradle.properties       (eklendiğinde TARGETS'a gir)
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

/** JSON dosyasındaki "version" alanı güncellenecek paketler. */
const TARGETS = [
  'packages/node/package.json',
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

// package-lock.json kök sürümü iki yerde tutar
const lockPath = join(root, 'packages/node/package-lock.json')
try {
  const lock = JSON.parse(readFileSync(lockPath, 'utf8'))
  if (lock.version !== version) {
    lock.version = version
    if (lock.packages?.['']) lock.packages[''].version = version
    writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n')
    console.log(`  ✓ packages/node/package-lock.json → ${version}`)
    changed++
  }
} catch {
  // lock dosyası yoksa sorun değil
}

console.log(changed ? `\n${version} yazıldı.` : `\nHepsi zaten ${version}.`)
console.log('Etiketten sürüm alanlar (php): git tag v' + version)
