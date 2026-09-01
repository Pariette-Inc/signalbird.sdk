import Foundation

/// Ziyaretçi kimliğinin saklandığı yer.
///
/// Varsayılan `UserDefaults`'tur. Sır cihazda kalmazsa kullanıcı uygulamayı
/// her açtığında sohbet geçmişini kaybeder — bu yüzden saklama zorunludur,
/// isteğe bağlı değil. Keychain isteyen kendi uyarlamasını verir.
public protocol SignalbirdStorage: Sendable {
    func get(_ key: String) -> String?
    func set(_ key: String, _ value: String)
    func remove(_ key: String)
}

/// `UserDefaults` `Sendable` işaretli değildir ama okuma/yazması iş parçacığı
/// güvenlidir (Apple belgeleri). `@unchecked` bunu açıkça üstlenir; alternatifi
/// her erişimi bir kuyruğa taşımaktı — üç satırlık bir depo için fazla.
public struct UserDefaultsStorage: SignalbirdStorage, @unchecked Sendable {
    private let defaults: UserDefaults

    public init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    public func get(_ key: String) -> String? { defaults.string(forKey: key) }
    public func set(_ key: String, _ value: String) { defaults.set(value, forKey: key) }
    public func remove(_ key: String) { defaults.removeObject(forKey: key) }
}

/// Ziyaretçi kimliğinin kilitli kutusu.
///
/// Sır iki yerden okunur — istek başlıkları ve `currentVisitorID` — ve oturum
/// açılışında yazılır. Küçük ama paylaşılan bir durum olduğu için kilidi
/// kendisi taşır; istemcinin tamamını eşzamanlılık kurallarına hapsetmeye
/// gerek kalmaz.
final class VisitorStore: @unchecked Sendable {
    private static let storageKey = "sb_visitor"

    private let storage: SignalbirdStorage
    private let publicKey: String
    private let lock = NSLock()
    private var cached: (id: String, secret: String)?
    private var loaded = false

    init(storage: SignalbirdStorage, publicKey: String) {
        self.storage = storage
        self.publicKey = publicKey
    }

    var id: String? { current()?.id }

    var secret: String? { current()?.secret }

    func save(id: String, secret: String) {
        lock.lock()
        defer { lock.unlock() }

        cached = (id, secret)
        loaded = true

        let payload: [String: Any] = ["id": id, "secret": secret, "publicKey": publicKey]

        if let raw = try? JSONSerialization.data(withJSONObject: payload),
           let text = String(data: raw, encoding: .utf8) {
            storage.set(Self.storageKey, text)
        }
    }

    func clear() {
        lock.lock()
        defer { lock.unlock() }

        cached = nil
        loaded = true
        storage.remove(Self.storageKey)
    }

    /// Anahtar değiştiyse (uygulama döndürüldü, farklı ortam) kimlik geçersizdir:
    /// eski sırla yapılan her çağrı 401 alırdı ve sohbet sessizce ölürdü.
    private func current() -> (id: String, secret: String)? {
        lock.lock()
        defer { lock.unlock() }

        if loaded { return cached }

        loaded = true

        guard let text = storage.get(Self.storageKey),
              let raw = text.data(using: .utf8),
              let parsed = try? JSONSerialization.jsonObject(with: raw) as? [String: Any],
              let id = parsed["id"] as? String,
              let secret = parsed["secret"] as? String,
              parsed["publicKey"] as? String == publicKey
        else {
            return nil
        }

        cached = (id, secret)

        return cached
    }
}
