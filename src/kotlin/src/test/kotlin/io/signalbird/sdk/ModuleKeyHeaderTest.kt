package io.signalbird.sdk

import com.sun.net.httpserver.HttpServer
import kotlinx.coroutines.runBlocking
import java.net.InetSocketAddress
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * Uygulama yüzeyinde kanal başlığı (`X-Signalbird-Module-Key`) YOLA göre
 * seçilir: cihaz ve push uçları `pushKey`, geri kalanı `chatKey`. API bu
 * başlık yoksa 400 `MODULE_KEY_MISSING` döner (CONTRACT §11.1).
 *
 * Sahte API JDK'nın kendi HTTP sunucusudur - test için bağımlılık eklenmez.
 */
class ModuleKeyHeaderTest {
    private data class Captured(val method: String, val path: String, val moduleKey: String?, val publicKey: String?)

    private lateinit var server: HttpServer
    private val requests = mutableListOf<Captured>()

    @BeforeTest
    fun start() {
        server = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
        server.createContext("/") { exchange ->
            synchronized(requests) {
                requests += Captured(
                    exchange.requestMethod,
                    exchange.requestURI.path,
                    exchange.requestHeaders.getFirst("X-Signalbird-Module-Key"),
                    exchange.requestHeaders.getFirst("X-Signalbird-Key"),
                )
            }
            val body = "{}".toByteArray()
            exchange.sendResponseHeaders(200, body.size.toLong())
            exchange.responseBody.use { it.write(body) }
        }
        server.start()
    }

    @AfterTest
    fun stop() = server.stop(0)

    private fun app(chatKey: String? = "destek", pushKey: String? = "mobil") = SignalbirdApp(
        SignalbirdAppConfig(
            publicKey = "sb_public_live_test",
            chatKey = chatKey,
            pushKey = pushKey,
            baseUrl = "http://127.0.0.1:${server.address.port}/api",
        ),
    )

    private val last get() = synchronized(requests) { requests.last() }

    @Test
    fun registerDeviceSendsPushKey() = runBlocking {
        val result = app().registerDevice(token = "fcm-token")

        assertTrue(result.ok)
        assertEquals("/api/v1/sdk/devices", last.path)
        assertEquals("mobil", last.moduleKey)
        assertEquals("sb_public_live_test", last.publicKey)
    }

    @Test
    fun unregisterDeviceSendsPushKey() = runBlocking {
        app().unregisterDevice("fcm-token")

        assertEquals("DELETE", last.method)
        assertEquals("mobil", last.moduleKey)
    }

    @Test
    fun reportPushOpenedSendsPushKey() = runBlocking {
        app().reportPushOpened("msg_1")

        assertEquals("/api/v1/sdk/push/opened", last.path)
        assertEquals("mobil", last.moduleKey)
    }

    @Test
    fun chatEndpointsSendChatKey() = runBlocking {
        val app = app()

        app.bootstrap()
        assertEquals("destek", last.moduleKey)

        app.startSession()
        assertEquals("/api/v1/sdk/chat/session", last.path)
        assertEquals("destek", last.moduleKey)
    }

    @Test
    fun missingKeyOmitsHeader() = runBlocking {
        app(pushKey = null).registerDevice(token = "fcm-token")

        assertNull(last.moduleKey)
    }
}
