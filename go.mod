// Signalbird SDK - Go modülü.
//
// Manifest KÖKTE durur (repo kuralı: her paket yöneticisi kendi manifestini
// kökte arar), kaynak `src/go/signalbird/` altındadır:
//
//	import "github.com/Pariette-Inc/signalbird.sdk/v2/src/go/signalbird"
//
// Sürüm git etiketinden gelir (vX.Y.Z); `node scripts/sync-version.mjs
// --check-tag vX.Y.Z` etiketle VERSION'ın ayrışmadığını doğrular.
//
// Modül yolu `/v2` ile biter: Go, v2+ etiketleri ancak büyük sürüm son ekli
// modül yolundan çözer. Son ek olmadan `@v2.x` hata verir, `@latest` ise
// eski v1.9.2'ye düşer (2026-10-15 doğrulandı). v3'te `/v3` olur.
//
// Bağımlılık YOKTUR ve olmayacak - yalnız standart kütüphane.
module github.com/Pariette-Inc/signalbird.sdk/v2

go 1.21
