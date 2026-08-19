import Foundation

/// Beş seviye. Fazlası eklenmez: kanal ayarını anlaşılır tutar.
public enum SignalbirdLevel: String, Sendable {
    case debug, info, warn, error, critical
}

public struct SignalbirdConfig {
    /// Sunucu anahtarı (`sbr_live_…`).
    ///
    /// Bu anahtar GİZLİDİR: iOS uygulamasına gömülmemelidir — uygulama paketi
    /// çözülebilir ve anahtar herkesin eline geçer. Mobil taraf sohbeti ve push
    /// kaydını `SignalbirdApp` ile (açık anahtarla) yapar; Telsiz istemcisi
    /// sunucu tarafı Swift servisleri (Vapor, Hummingbird) içindir.
    public let apiKey: String
    public let baseURL: String
    public let source: String?
    public let timeout: TimeInterval
    public let throwOnError: Bool

    public init(
        apiKey: String,
        baseURL: String = signalbirdDefaultBaseURL,
        source: String? = nil,
        timeout: TimeInterval = 5,
        throwOnError: Bool = false
    ) {
        self.apiKey = apiKey
        self.baseURL = baseURL
        self.source = source
        self.timeout = timeout
        self.throwOnError = throwOnError
    }
}

/// Telsiz (Radio) istemcisi — log ve olay yazar.
///
/// Sözleşme: docs/CONTRACT.md § 1–7
public struct SignalbirdClient {
    private let http: Transport
    private let source: String?

    public init(config: SignalbirdConfig) throws {
        guard !config.apiKey.isEmpty else {
            throw SignalbirdError(code: "NO_KEY", status: 0, message: "apiKey zorunlu")
        }

        // Açık anahtarın sunucuda kullanılması sessiz bir güvenlik hatasıdır.
        guard !config.apiKey.hasPrefix("sbr_pub_") else {
            throw SignalbirdError(
                code: "WRONG_KEY_TYPE",
                status: 0,
                message: "sunucu istemcisi sbr_live_… ister"
            )
        }

        self.source = config.source
        self.http = Transport(
            baseURL: config.baseURL,
            timeout: config.timeout,
            throwOnError: config.throwOnError
        ) { ["Authorization": "Bearer \(config.apiKey)"] }
    }

    /// Seviye verilmezse kanalın kendi varsayılanı geçerlidir.
    @discardableResult
    public func log(
        channel: String,
        message: String,
        level: SignalbirdLevel? = nil,
        context: [String: Any]? = nil
    ) async throws -> SbResult {
        try await http.request("POST", "/v1/radio/log", body: [
            "channel": channel,
            "message": message,
            "level": level?.rawValue as Any,
            "context": context as Any,
            "source": source as Any,
        ])
    }

    @discardableResult
    public func debug(_ channel: String, _ message: String, _ context: [String: Any]? = nil) async throws -> SbResult {
        try await log(channel: channel, message: message, level: .debug, context: context)
    }

    @discardableResult
    public func info(_ channel: String, _ message: String, _ context: [String: Any]? = nil) async throws -> SbResult {
        try await log(channel: channel, message: message, level: .info, context: context)
    }

    @discardableResult
    public func warn(_ channel: String, _ message: String, _ context: [String: Any]? = nil) async throws -> SbResult {
        try await log(channel: channel, message: message, level: .warn, context: context)
    }

    @discardableResult
    public func error(_ channel: String, _ message: String, _ context: [String: Any]? = nil) async throws -> SbResult {
        try await log(channel: channel, message: message, level: .error, context: context)
    }

    @discardableResult
    public func critical(_ channel: String, _ message: String, _ context: [String: Any]? = nil) async throws -> SbResult {
        try await log(channel: channel, message: message, level: .critical, context: context)
    }

    /// En fazla 100 kayıt, satır satır sonuç. Başarısız satırlar YENİDEN DENENMEZ.
    @discardableResult
    public func batch(_ events: [[String: Any]]) async throws -> SbResult {
        let rows = events.prefix(100).map { event -> [String: Any] in
            var row = event
            if row["source"] == nil, let source { row["source"] = source }

            return row
        }

        return try await http.request("POST", "/v1/radio/log/batch", body: ["events": Array(rows)])
    }
}
