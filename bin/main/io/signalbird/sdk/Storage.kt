package io.signalbird.sdk

import org.json.JSONObject
import java.util.concurrent.locks.ReentrantLock
import kotlin.concurrent.withLock

/**
 * Ziyaretçi kimliğinin saklandığı yer.
 *
 * Android'de `SharedPreferences` sarmalayın. Sır cihazda kalmazsa kullanıcı
 * uygulamayı her açtığında sohbet geçmişini kaybeder — bu yüzden saklama
 * zorunludur, isteğe bağlı değil.
 */
interface SignalbirdStorage {
    fun get(key: String): String?
    fun set(key: String, value: String)
    fun remove(key: String)
}

/** Depo verilmezse: yalnız süreç ömrü boyunca yaşayan bellek deposu. */
class MemoryStorage : SignalbirdStorage {
    private val map = mutableMapOf<String, String>()

    override fun get(key: String): String? = map[key]
    override fun set(key: String, value: String) { map[key] = value }
    override fun remove(key: String) { map.remove(key) }
}

/**
 * Ziyaretçi kimliğinin kilitli kutusu.
 *
 * Sır iki yerden okunur (istek başlıkları ve `currentVisitorId`) ve oturum
 * açılışında yazılır; ikisi farklı iş parçacığında olabilir.
 */
internal class VisitorStore(
    private val storage: SignalbirdStorage,
    private val appKey: String,
) {
    private val lock = ReentrantLock()
    private var cached: Pair<String, String>? = null
    private var loaded = false

    val id: String? get() = current()?.first
    val secret: String? get() = current()?.second

    fun save(id: String, secret: String) = lock.withLock {
        cached = id to secret
        loaded = true

        storage.set(
            STORAGE_KEY,
            JSONObject(mapOf("id" to id, "secret" to secret, "appKey" to appKey)).toString(),
        )
    }

    fun clear() = lock.withLock {
        cached = null
        loaded = true
        storage.remove(STORAGE_KEY)
    }

    /**
     * Anahtar değiştiyse (uygulama döndürüldü, farklı ortam) kimlik geçersizdir:
     * eski sırla yapılan her çağrı 401 alırdı ve sohbet sessizce ölürdü.
     */
    private fun current(): Pair<String, String>? = lock.withLock {
        if (loaded) return cached

        loaded = true

        val text = storage.get(STORAGE_KEY) ?: return null

        cached = try {
            val parsed = JSONObject(text)
            val id = parsed.optString("id")
            val secret = parsed.optString("secret")

            if (id.isEmpty() || secret.isEmpty() || parsed.optString("appKey") != appKey) {
                null
            } else {
                id to secret
            }
        } catch (_: Exception) {
            null
        }

        cached
    }

    private companion object {
        const val STORAGE_KEY = "sb_visitor"
    }
}
