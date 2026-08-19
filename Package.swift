// swift-tools-version: 5.9
//
// Signalbird SDK — Swift paketi.
//
// Manifest KÖKTE durur (SPM zaten kökte arar), kaynak `src/swift/Sources/`
// altındadır; `path` ile gösterilir ki diğer dillerin dosyaları derlemeye
// girmesin.
//
// Sürüm git etiketinden gelir (vX.Y.Z); `node scripts/sync-version.mjs
// --check-tag vX.Y.Z` etiketle VERSION'ın ayrışmadığını doğrular.
//
// Bağımlılık YOKTUR: yalnız Foundation/URLSession.
import PackageDescription

let package = Package(
    name: "Signalbird",
    platforms: [
        .iOS(.v15),
        .macOS(.v12),
        .tvOS(.v15),
        .watchOS(.v8),
    ],
    products: [
        .library(name: "Signalbird", targets: ["Signalbird"]),
    ],
    targets: [
        .target(
            name: "Signalbird",
            path: "src/swift/Sources/Signalbird"
        ),
    ]
)
