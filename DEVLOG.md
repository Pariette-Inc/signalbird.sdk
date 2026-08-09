# DEVLOG — signalbird.sdk

> Değişiklik günlüğü. En yeni bölüm en üstte.
> Metot → endpoint envanteri için bkz. `DEVELOPMENT.md`,
> diller arası davranış kuralları için `docs/CONTRACT.md`.

## 2026-08-10 — Tek paket yapısına geçiş

İlk kurgudaki `packages/*` + ayna repo düzeni terk edildi. Manifestler repo
köküne alındı; bir repo aynı anda npm ve Composer paketi olabildiği için
Packagist bu repoyu doğrudan izleyebiliyor, ayna repoya gerek kalmadı.

## 2026-08-10 — Fork ve birleştirme

`sistemtakip.sdk` (Node) ile `sistemtakip.php.sdk` (PHP) tek pakette birleşti.
Geçmiş taşınmadı; kaynak repolar `Pariette-Inc/sistemtakip.sdk` ve
`Pariette-Inc/sistemtakip.php.sdk` adreslerinde durmaya devam ediyor.
