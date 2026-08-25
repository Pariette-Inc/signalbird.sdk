# Yayın (release)

Sürüm **kilitlidir**: tek kaynak `VERSION` dosyasıdır ve
`scripts/sync-version.mjs` onu tüm manifestlere yazar. Manifestler ayrışırsa CI
kırılır — bu bilinçli: sürümü elle üç yerde güncellemek, üçüncüsünü unutmanın
en kolay yoludur.

## Adımlar

```bash
# 1. Sürümü yaz ve manifestlere dağıt
echo "1.5.0" > VERSION
node scripts/sync-version.mjs

# 2. Denetim (CI de aynısını yapar)
node scripts/check-parity.mjs     # beş dilde metot paritesi
npm run typecheck && npm run build
vendor/bin/phpunit

# 3. Commit + etiket
git add -A && git commit -m "v1.5.0 — …"
git tag v1.5.0
git push && git push --tags
```

Etiket gidince `.github/workflows/publish.yml` çalışır.

## Kayıt defterleri

| Defter | Nasıl yayınlanır | Gereken sır |
|---|---|---|
| **npm** (`signalbird`) | iş akışı | `NPM_TOKEN` |
| **PyPI** (`signalbird`) | iş akışı | `PYPI_TOKEN` |
| **NuGet** (`Signalbird.Sdk`) | iş akışı | `NUGET_API_KEY` |
| **Packagist** (`pariette/signalbird`) | GitHub webhook'u ile kendiliğinden | — (ilk kayıt elle) |
| **Go** (`go get …/signalbird.sdk`) | yayın yok, etiket okunur | — |
| **SPM** (Swift) | yayın yok, etiket okunur | — |
| **Maven** (Kotlin) | henüz yayınlanmıyor | — |

Jetonu tanımlı olmayan defterin adımı **atlanır**, iş akışı kırılmaz: npm'i
olan ama PyPI hesabı henüz açılmamış bir kurulumda yayının tamamının durması
en kötü sıralamadır.

## İlk kurulumda bir kez yapılacaklar

1. **npm** — `npmjs.com` hesabı, `signalbird` adı üzerinde yayın yetkisi,
   Automation token üret → GitHub deposunda `NPM_TOKEN` sırrı.
2. **PyPI** — `pypi.org` hesabı, `signalbird` projesi, API token →
   `PYPI_TOKEN`.
3. **NuGet** — `nuget.org` hesabı, API key → `NUGET_API_KEY`.
4. **Packagist** — `packagist.org` üzerinde `pariette/signalbird` paketini
   **bir kez** gönder (Submit), sonra GitHub deposunda Packagist webhook'unu
   etkinleştir. Sonraki etiketler kendiliğinden görünür.
5. **Go** — ek işlem yok; modül yolu (`module` satırı) depo adresiyle
   eşleşmelidir.

## Sık yapılan hata

`composer.json` içindeki paket adı Packagist kaydıyla **birebir** aynı olmalı.
Packagist adı etiketin `composer.json`'ından okur; ad ayrışırsa o sürümü
sessizce yok sayar ve paket "yalnız dev-main" olarak kalır. CI bunu denetler.
