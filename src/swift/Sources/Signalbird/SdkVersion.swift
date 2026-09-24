import Foundation

/// SDK sürümü ve sürüm bildirimi (docs/CONTRACT.md § 14).
///
/// Her istek `X-Signalbird-Sdk: swift/<sürüm>` taşır. API yanıtta
/// `Signalbird-Sdk-Status` (current | outdated | unsupported) döner; SDK
/// eskiyse DEBUG derlemede süreç başına BİR KEZ konsola uyarı yazılır.
/// Mağazadaki uygulamada son kullanıcının göreceği hiçbir şey yoktur.
///
/// `version` satırını `scripts/sync-version.mjs` kökteki VERSION dosyasından
/// yazar - elle değiştirmeyin.
public enum SignalbirdSdk {
    public static let version = "2.7.0"

    static let header = "X-Signalbird-Sdk"
    static var headerValue: String { "swift/\(version)" }

    private static let lock = NSLock()
    private static var warned = false

    static func note(_ response: URLResponse?) {
        guard let http = response as? HTTPURLResponse,
              let status = http.value(forHTTPHeaderField: "Signalbird-Sdk-Status"),
              status == "outdated" || status == "unsupported"
        else { return }

        lock.lock()
        let first = !warned
        warned = true
        lock.unlock()

        guard first else { return }

        #if DEBUG
        let latest = http.value(forHTTPHeaderField: "Signalbird-Sdk-Latest") ?? "?"
        print(status == "unsupported"
            ? "[signalbird] Bu SDK sürümü (\(version)) artık desteklenmiyor. Son sürüm: \(latest). Swift paketini güncelleyin."
            : "[signalbird] Yeni SDK sürümü var: \(latest) (kurulu: \(version)).")
        #endif
    }
}
