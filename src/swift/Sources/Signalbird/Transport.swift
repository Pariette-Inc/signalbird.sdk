import Foundation

#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

/// Varsayılan API kökü. Kendi kurulumu olan müşteri `baseURL` ile değiştirir.
public let signalbirdDefaultBaseURL = "https://signalbird.io/api"

/// Her metodun döndüğü zarf.
///
/// Başarısızlık `throw` değil, veridir: sohbet balonunun ya da bir log
/// çağrısının hatası uygulamayı çökertmemeli. `throwOnError` açıkken
/// `SignalbirdError` fırlatılır.
public struct SbResult {
    public let ok: Bool
    public let status: Int
    public let data: Any?
    public let code: String?
    public let message: String?

    /// Sözlük gövde — çoğu uç `{"conversation": {...}}` biçiminde döner.
    public var dictionary: [String: Any]? { data as? [String: Any] }

    /// Dizi gövde.
    public var array: [[String: Any]]? { data as? [[String: Any]] }

    /// Gövdeyi `Decodable` bir tipe çözer.
    public func decode<T: Decodable>(_ type: T.Type) -> T? {
        guard let data, let raw = try? JSONSerialization.data(withJSONObject: data) else { return nil }

        return try? JSONDecoder().decode(type, from: raw)
    }
}

public struct SignalbirdError: Error, CustomStringConvertible {
    public let code: String
    public let status: Int
    public let message: String

    public var description: String { "signalbird: \(code) (HTTP \(status)): \(message)" }
}

/// İstemcilerin ortak HTTP katmanı.
///
/// Bağımlılığı yoktur: `URLSession`. Bir SDK'nın Alamofire dayatması,
/// müşterinin bağımlılık grafiğini kilitler.
struct Transport {
    let baseURL: String
    let timeout: TimeInterval
    let throwOnError: Bool
    let session: URLSession

    /// Kimlik başlıkları — yüzeye göre değişir (`Authorization` ya da
    /// `X-Signalbird-App-Key` + ziyaretçi sırrı).
    var headers: () -> [String: String]

    init(
        baseURL: String,
        timeout: TimeInterval,
        throwOnError: Bool,
        session: URLSession = .shared,
        headers: @escaping () -> [String: String]
    ) {
        var trimmed = baseURL
        while trimmed.hasSuffix("/") { trimmed.removeLast() }

        self.baseURL = trimmed
        self.timeout = timeout
        self.throwOnError = throwOnError
        self.session = session
        self.headers = headers
    }

    func request(
        _ method: String,
        _ path: String,
        body: [String: Any]? = nil,
        query: [String: Any]? = nil
    ) async throws -> SbResult {
        guard let url = URL(string: baseURL + path + Transport.buildQuery(query)) else {
            return try fail(0, "INVALID_URL", "geçersiz adres", nil)
        }

        var request = URLRequest(url: url, timeoutInterval: timeout)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        for (key, value) in headers() {
            request.setValue(value, forHTTPHeaderField: key)
        }

        if let body {
            // `NSNull` alanlar gövdede kalır: "gönderilmedi" ile "null yapıldı"
            // aynı şey değildir ve sunucu ikisini farklı yorumlar.
            request.httpBody = try? JSONSerialization.data(withJSONObject: body.compactMapValues { $0 })
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }

        let raw: Data
        let response: URLResponse

        do {
            (raw, response) = try await session.data(for: request)
        } catch let error as URLError where error.code == .timedOut {
            return try fail(0, "TIMEOUT", error.localizedDescription, nil)
        } catch {
            return try fail(0, "NETWORK_ERROR", error.localizedDescription, nil)
        }

        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        let parsed = raw.isEmpty ? nil : try? JSONSerialization.jsonObject(with: raw, options: [.fragmentsAllowed])

        if (200 ..< 300).contains(status) {
            return SbResult(ok: true, status: status, data: parsed, code: nil, message: nil)
        }

        // API `{message, code}` döner; Laravel doğrulama hatası `{message,
        // errors}` döner (kodsuz) — onu VALIDATION_ERROR sayarız.
        let object = parsed as? [String: Any]
        let code = (object?["code"] as? String).flatMap { $0.isEmpty ? nil : $0 }
            ?? (status == 422 ? "VALIDATION_ERROR" : status == 401 ? "API_KEY_INVALID" : "HTTP_\(status)")
        let message = (object?["message"] as? String) ?? "HTTP \(status)"

        return try fail(status, code, message, parsed)
    }

    private func fail(_ status: Int, _ code: String, _ message: String, _ data: Any?) throws -> SbResult {
        if throwOnError {
            throw SignalbirdError(code: code, status: status, message: message)
        }

        return SbResult(ok: false, status: status, data: data, code: code, message: message)
    }

    /// `nil` alanlar atlanır; diziler `key[]=` biçiminde gider.
    static func buildQuery(_ query: [String: Any]?) -> String {
        guard let query, !query.isEmpty else { return "" }

        var items: [URLQueryItem] = []

        for (key, value) in query {
            if value is NSNull { continue }

            if let list = value as? [Any] {
                for item in list {
                    items.append(URLQueryItem(name: "\(key)[]", value: stringify(item)))
                }
            } else {
                items.append(URLQueryItem(name: key, value: stringify(value)))
            }
        }

        guard !items.isEmpty else { return "" }

        var components = URLComponents()
        components.queryItems = items

        return components.percentEncodedQuery.map { "?\($0)" } ?? ""
    }

    private static func stringify(_ value: Any) -> String {
        if let flag = value as? Bool { return flag ? "true" : "false" }

        return "\(value)"
    }

    /// Yol parçası — kimlikler URL'e gömülmeden önce kodlanır.
    static func seg(_ value: Any) -> String {
        "\(value)".addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? "\(value)"
    }
}
