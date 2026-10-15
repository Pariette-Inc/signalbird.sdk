import Foundation
import XCTest
@testable import Signalbird

#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

/// Uygulama yüzeyinde kanal başlığı (`X-Signalbird-Module-Key`) YOLA göre
/// seçilir: cihaz ve push uçları `pushKey`, geri kalanı `chatKey`. API bu
/// başlık yoksa 400 `MODULE_KEY_MISSING` döner (CONTRACT §11.1).
final class ModuleKeyHeaderTests: XCTestCase {
    override func setUp() {
        super.setUp()
        StubProtocol.reset()
    }

    private func makeApp(chatKey: String? = "destek", pushKey: String? = "mobil") throws -> SignalbirdApp {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [StubProtocol.self]

        return try SignalbirdApp(
            config: SignalbirdAppConfig(
                publicKey: "sb_public_live_test",
                chatKey: chatKey,
                pushKey: pushKey,
                baseURL: "https://api.test/api",
                storage: MemoryStorage()
            ),
            session: URLSession(configuration: configuration)
        )
    }

    func testRegisterDeviceSendsPushKey() async throws {
        let result = try await makeApp().registerDevice(token: "apns-token")

        XCTAssertTrue(result.ok)
        let request = try XCTUnwrap(StubProtocol.last)
        XCTAssertEqual(request.url?.path, "/api/v1/sdk/devices")
        XCTAssertEqual(request.value(forHTTPHeaderField: "X-Signalbird-Module-Key"), "mobil")
        XCTAssertEqual(request.value(forHTTPHeaderField: "X-Signalbird-Key"), "sb_public_live_test")
    }

    func testUnregisterDeviceSendsPushKey() async throws {
        _ = try await makeApp().unregisterDevice(token: "apns-token")

        XCTAssertEqual(StubProtocol.last?.httpMethod, "DELETE")
        XCTAssertEqual(StubProtocol.last?.value(forHTTPHeaderField: "X-Signalbird-Module-Key"), "mobil")
    }

    func testReportPushOpenedSendsPushKey() async throws {
        _ = try await makeApp().reportPushOpened(messageID: "msg_1")

        XCTAssertEqual(StubProtocol.last?.url?.path, "/api/v1/sdk/push/opened")
        XCTAssertEqual(StubProtocol.last?.value(forHTTPHeaderField: "X-Signalbird-Module-Key"), "mobil")
    }

    func testChatEndpointsSendChatKey() async throws {
        let app = try makeApp()

        _ = try await app.bootstrap()
        XCTAssertEqual(StubProtocol.last?.value(forHTTPHeaderField: "X-Signalbird-Module-Key"), "destek")

        _ = try await app.startSession()
        XCTAssertEqual(StubProtocol.last?.url?.path, "/api/v1/sdk/chat/session")
        XCTAssertEqual(StubProtocol.last?.value(forHTTPHeaderField: "X-Signalbird-Module-Key"), "destek")
    }

    func testMissingKeyOmitsHeader() async throws {
        _ = try await makeApp(chatKey: "destek", pushKey: nil).registerDevice(token: "apns-token")

        XCTAssertNil(StubProtocol.last?.value(forHTTPHeaderField: "X-Signalbird-Module-Key"))
    }
}

private final class MemoryStorage: SignalbirdStorage, @unchecked Sendable {
    private var values: [String: String] = [:]
    private let lock = NSLock()

    func get(_ key: String) -> String? { lock.withLock { values[key] } }
    func set(_ key: String, _ value: String) { lock.withLock { values[key] = value } }
    func remove(_ key: String) { _ = lock.withLock { values.removeValue(forKey: key) } }
}

/// İsteği yakalayan sahte ağ katmanı: her isteğe `{}` ile 200 döner.
private final class StubProtocol: URLProtocol {
    private static let lock = NSLock()
    nonisolated(unsafe) private static var captured: URLRequest?

    static var last: URLRequest? { lock.withLock { captured } }
    static func reset() { lock.withLock { captured = nil } }

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        StubProtocol.lock.withLock { StubProtocol.captured = request }

        let response = HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: nil)!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: Data("{}".utf8))
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}
}
