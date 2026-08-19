// Signalbird SDK — Go modülü.
//
// Manifest KÖKTE durur (repo kuralı: her paket yöneticisi kendi manifestini
// kökte arar), kaynak `src/go/signalbird/` altındadır:
//
//	import "github.com/Pariette-Inc/signalbird.sdk/src/go/signalbird"
//
// Sürüm git etiketinden gelir (vX.Y.Z); `node scripts/sync-version.mjs
// --check-tag vX.Y.Z` etiketle VERSION'ın ayrışmadığını doğrular.
//
// Bağımlılık YOKTUR ve olmayacak — yalnız standart kütüphane.
module github.com/Pariette-Inc/signalbird.sdk

go 1.21
