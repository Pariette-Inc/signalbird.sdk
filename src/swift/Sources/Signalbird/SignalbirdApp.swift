import Foundation

public struct SignalbirdAppConfig {
    /// Uygulama anahtarı (`sbw_pub_…`). Takım anahtarını (`sb_…`) BURAYA KOYMAYIN.
    public let appKey: String
    public let baseURL: String
    public let locale: String?
    public let timeout: TimeInterval
    public let storage: SignalbirdStorage

    public init(
        appKey: String,
        baseURL: String = signalbirdDefaultBaseURL,
        locale: String? = nil,
        timeout: TimeInterval = 10,
        storage: SignalbirdStorage = UserDefaultsStorage()
    ) {
        self.appKey = appKey
        self.baseURL = baseURL
        self.locale = locale
        self.timeout = timeout
        self.storage = storage
    }
}

/// Son kullanıcı (uygulama) istemcisi — canlı sohbet + push cihaz kaydı.
///
/// Müşterinin MÜŞTERİSİ için: uygulama kullanıcısı. Yalnız ziyaretçinin KENDİ
/// verisine dokunur; gönderim yapmaz, kişi listesi okumaz.
///
/// Kimlik iki parçadır: açık uygulama anahtarı (`X-Signalbird-App-Key`) ve
/// ziyaretçi sırrı (`X-Signalbird-Visitor`). Sır yalnız oturum açılışında döner
/// ve `storage` içinde saklanır.
///
/// Sözleşme: docs/CONTRACT.md § 11
public final class SignalbirdApp: @unchecked Sendable {
    private let config: SignalbirdAppConfig
    private let visitor: VisitorStore
    private let http: Transport

    /// `actor` DEĞİL, kilitli bir sınıf.
    ///
    /// Aktör olsaydı başlık kurulumu (her istekte sırrı okumak) aktör
    /// yalıtımını delmek zorunda kalırdı ve Swift 6'da derlenmezdi. Paylaşılan
    /// durum tek bir küçük kutudadır (`VisitorStore`) ve o kutu kendi kilidini
    /// taşır — bu, sohbet istemcisinin tamamını aktöre hapsetmekten hem daha
    /// basit hem SwiftUI'dan çağırması daha kolaydır.
    public init(config: SignalbirdAppConfig) throws {
        guard !config.appKey.isEmpty else {
            throw SignalbirdError(code: "NO_KEY", status: 0, message: "appKey zorunlu")
        }

        // Takım anahtarı istemciye gömülürse tüm gönderim yetkisi sızar.
        guard config.appKey.hasPrefix("sbw_pub_") else {
            throw SignalbirdError(
                code: "WRONG_KEY_TYPE",
                status: 0,
                message: "uygulama istemcisi açık uygulama anahtarı ister (sbw_pub_…)"
            )
        }

        self.config = config
        self.visitor = VisitorStore(storage: config.storage, appKey: config.appKey)

        let store = visitor

        // Başlıklar HER istekte yeniden okunur: oturum ortada açılırsa
        // sonraki çağrı sırrı taşısın.
        self.http = Transport(
            baseURL: config.baseURL,
            timeout: config.timeout,
            throwOnError: false
        ) {
            var headers = ["X-Signalbird-App-Key": config.appKey]

            if let locale = config.locale { headers["X-Locale"] = locale }
            if let secret = store.secret { headers["X-Signalbird-Visitor"] = secret }

            return headers
        }
    }

    /// Saklanan ziyaretçi kimliği (yoksa `nil`).
    public var currentVisitorID: String? { visitor.id }

    // ── Kimlik ────────────────────────────────────────────────────────────

    /// Uygulama ayarları: sohbet açık mı, renk, çalışma saati, ön-form.
    public func bootstrap() async throws -> SbResult {
        try await http.request("POST", "/v1/sdk/bootstrap", body: ["locale": config.locale as Any])
    }

    /// Ziyaretçi oturumu açar ya da mevcut olanı günceller; sırrı saklar.
    @discardableResult
    public func startSession(_ input: [String: Any] = [:]) async throws -> SbResult {
        let result = try await http.request("POST", "/v1/sdk/chat/session", body: input)

        if result.ok,
           let visitorPayload = result.dictionary?["visitor"] as? [String: Any],
           let id = visitorPayload["id"] as? String,
           let secret = visitorPayload["secret"] as? String {
            visitor.save(id: id, secret: secret)
        }

        return result
    }

    /// Oturum açmış kullanıcıyı ziyaretçiye bağlar (kişi kaydı upsert edilir).
    @discardableResult
    public func identify(_ input: [String: Any]) async throws -> SbResult {
        try await http.request("POST", "/v1/sdk/identify", body: input)
    }

    /// Yerel kimliği siler (çıkış). Sunucudaki kayıt kalır.
    public func signOut() {
        visitor.clear()
    }

    // ── Sohbet ────────────────────────────────────────────────────────────

    public func listConversations() async throws -> SbResult {
        try await http.request("GET", "/v1/sdk/chat/conversations")
    }

    /// `after` imleci `cm_…` mesaj kimliğidir; yoklamada tam listeyi çekmez.
    public func getConversation(_ id: String, after: String? = nil, limit: Int? = nil) async throws -> SbResult {
        try await http.request(
            "GET",
            "/v1/sdk/chat/conversations/\(Transport.seg(id))",
            query: ["after": after as Any, "limit": limit as Any]
        )
    }

    /// İlk mesajla konuşma açar. Kota burada harcanır — konuşma başına.
    public func startConversation(body: String, clientID: String = UUID().uuidString) async throws -> SbResult {
        try await http.request("POST", "/v1/sdk/chat/conversations", body: ["body": body, "client_id": clientID])
    }

    public func sendMessage(
        conversationID: String,
        body: String,
        clientID: String = UUID().uuidString,
        replyToID: String? = nil
    ) async throws -> SbResult {
        try await http.request(
            "POST",
            "/v1/sdk/chat/conversations/\(Transport.seg(conversationID))/messages",
            body: ["body": body, "client_id": clientID, "reply_to_id": replyToID as Any]
        )
    }

    /// Yalnız kendi mesajı ve gönderimden sonraki 15 dakika içinde.
    public func editMessage(conversationID: String, messageID: String, body: String) async throws -> SbResult {
        try await http.request(
            "PATCH",
            "/v1/sdk/chat/conversations/\(Transport.seg(conversationID))/messages/\(Transport.seg(messageID))",
            body: ["body": body]
        )
    }

    public func deleteMessage(conversationID: String, messageID: String) async throws -> SbResult {
        try await http.request(
            "DELETE",
            "/v1/sdk/chat/conversations/\(Transport.seg(conversationID))/messages/\(Transport.seg(messageID))"
        )
    }

    /// Aynı emoji ikinci kez gönderilirse tepki kaldırılır.
    public func reactToMessage(conversationID: String, messageID: String, emoji: String) async throws -> SbResult {
        try await http.request(
            "POST",
            "/v1/sdk/chat/conversations/\(Transport.seg(conversationID))/messages/\(Transport.seg(messageID))/reactions",
            body: ["emoji": emoji]
        )
    }

    public func setTyping(conversationID: String, isTyping: Bool) async throws -> SbResult {
        try await http.request(
            "POST",
            "/v1/sdk/chat/conversations/\(Transport.seg(conversationID))/typing",
            body: ["is_typing": isTyping]
        )
    }

    public func markRead(conversationID: String, lastMessageID: String? = nil) async throws -> SbResult {
        try await http.request(
            "POST",
            "/v1/sdk/chat/conversations/\(Transport.seg(conversationID))/read",
            body: ["last_message_id": lastMessageID as Any]
        )
    }

    public func closeConversation(_ id: String) async throws -> SbResult {
        try await http.request("POST", "/v1/sdk/chat/conversations/\(Transport.seg(id))/close")
    }

    public func rateConversation(_ id: String, rating: Int, comment: String? = nil) async throws -> SbResult {
        try await http.request(
            "POST",
            "/v1/sdk/chat/conversations/\(Transport.seg(id))/rate",
            body: ["rating": rating, "comment": comment as Any]
        )
    }

    // ── Push ──────────────────────────────────────────────────────────────

    /// APNs token'ını kaydeder.
    ///
    /// Token'ı almak ve bildirim iznini istemek uygulamanın işidir: izni ne
    /// zaman soracağın bir ürün kararıdır ve App Store bunu ciddiye alır.
    @discardableResult
    public func registerDevice(
        token: String,
        provider: String = "apns",
        externalID: String? = nil,
        deviceName: String? = nil,
        appVersion: String? = nil,
        locale: String? = nil
    ) async throws -> SbResult {
        try await http.request("POST", "/v1/sdk/devices", body: [
            "token": token,
            "platform": "ios",
            "provider": provider,
            "external_id": externalID as Any,
            "device_name": deviceName as Any,
            "app_version": appVersion as Any,
            "locale": locale as Any,
        ])
    }

    /// Çıkışta çağrılır: kayıt silinmez, kapatılır (geçmiş korunur).
    @discardableResult
    public func unregisterDevice(token: String) async throws -> SbResult {
        try await http.request("DELETE", "/v1/sdk/devices/\(Transport.seg(token))")
    }

    /// Bildirime dokunuldu — açılma damgası.
    ///
    /// Push'ta açılmayı yalnızca uygulama bilir: APNs "teslim ettim" der,
    /// "kullanıcı dokundu" demez. Bildirim yükündeki `sb_message_id`
    /// değerini buraya geri gönderin (`userNotificationCenter(_:didReceive:)`).
    public func reportPushOpened(messageID: String) async throws -> SbResult {
        try await http.request("POST", "/v1/sdk/push/opened", body: ["message_id": messageID])
    }

}
