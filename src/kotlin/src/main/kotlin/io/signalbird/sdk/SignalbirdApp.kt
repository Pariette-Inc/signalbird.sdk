package io.signalbird.sdk

import java.util.UUID

data class SignalbirdAppConfig(
    /** Uygulama anahtarı (`sbw_pub_…`). Takım anahtarını (`sb_…`) BURAYA KOYMAYIN. */
    val appKey: String,
    val baseUrl: String = SIGNALBIRD_DEFAULT_BASE_URL,
    val locale: String? = null,
    val timeoutMs: Int = 10_000,
    val storage: SignalbirdStorage = MemoryStorage(),
)

/**
 * Son kullanıcı (uygulama) istemcisi — canlı sohbet + push cihaz kaydı.
 *
 * Müşterinin MÜŞTERİSİ için. Yalnız ziyaretçinin KENDİ verisine dokunur;
 * gönderim yapmaz, kişi listesi okumaz.
 *
 * Kimlik iki parçadır: açık uygulama anahtarı (`X-Signalbird-App-Key`) ve
 * ziyaretçi sırrı (`X-Signalbird-Visitor`). Sır yalnız oturum açılışında döner.
 *
 * Sözleşme: docs/CONTRACT.md § 11
 */
class SignalbirdApp(private val config: SignalbirdAppConfig) {
    private val visitor = VisitorStore(config.storage, config.appKey)
    private val http: Transport

    init {
        require(config.appKey.isNotEmpty()) { "Signalbird: appKey zorunlu." }

        // Takım anahtarı istemciye gömülürse tüm gönderim yetkisi sızar.
        // Sunucu da reddederdi ama o noktada anahtar çoktan yayınlanmış olurdu.
        require(config.appKey.startsWith("sbw_pub_")) {
            "Signalbird: uygulama istemcisi açık uygulama anahtarı ister (sbw_pub_…)."
        }

        http = Transport(config.baseUrl, config.timeoutMs, throwOnError = false) {
            buildMap {
                put("X-Signalbird-App-Key", config.appKey)
                config.locale?.let { put("X-Locale", it) }
                visitor.secret?.let { put("X-Signalbird-Visitor", it) }
            }
        }
    }

    /** Saklanan ziyaretçi kimliği (yoksa `null`). */
    val currentVisitorId: String? get() = visitor.id

    // ── Kimlik ────────────────────────────────────────────────────────────

    /** Uygulama ayarları: sohbet açık mı, renk, çalışma saati, ön-form. */
    suspend fun bootstrap(): SbResult =
        http.request("POST", "/v1/sdk/bootstrap", mapOf("locale" to config.locale))

    /** Ziyaretçi oturumu açar ya da mevcut olanı günceller; sırrı saklar. */
    suspend fun startSession(input: Map<String, Any?> = emptyMap()): SbResult {
        val result = http.request("POST", "/v1/sdk/chat/session", input)
        val payload = result.json?.optJSONObject("visitor")

        if (result.ok && payload != null) {
            val id = payload.optString("id")
            val secret = payload.optString("secret")

            if (id.isNotEmpty() && secret.isNotEmpty()) {
                visitor.save(id, secret)
            }
        }

        return result
    }

    /** Oturum açmış kullanıcıyı ziyaretçiye bağlar (kişi kaydı upsert edilir). */
    suspend fun identify(input: Map<String, Any?>): SbResult =
        http.request("POST", "/v1/sdk/identify", input)

    /** Yerel kimliği siler (çıkış). Sunucudaki kayıt kalır. */
    fun signOut() = visitor.clear()

    // ── Sohbet ────────────────────────────────────────────────────────────

    suspend fun listConversations(): SbResult =
        http.request("GET", "/v1/sdk/chat/conversations")

    /** `after` imleci `cm_…` mesaj kimliğidir; yoklamada tam listeyi çekmez. */
    suspend fun getConversation(id: String, after: String? = null, limit: Int? = null): SbResult =
        http.request(
            "GET",
            "/v1/sdk/chat/conversations/${Transport.seg(id)}",
            query = mapOf("after" to after, "limit" to limit),
        )

    /** İlk mesajla konuşma açar. Kota burada harcanır — konuşma başına. */
    suspend fun startConversation(body: String, clientId: String = UUID.randomUUID().toString()): SbResult =
        http.request("POST", "/v1/sdk/chat/conversations", mapOf("body" to body, "client_id" to clientId))

    suspend fun sendMessage(
        conversationId: String,
        body: String,
        clientId: String = UUID.randomUUID().toString(),
        replyToId: String? = null,
    ): SbResult = http.request(
        "POST",
        "/v1/sdk/chat/conversations/${Transport.seg(conversationId)}/messages",
        mapOf("body" to body, "client_id" to clientId, "reply_to_id" to replyToId),
    )

    /** Yalnız kendi mesajı ve gönderimden sonraki 15 dakika içinde. */
    suspend fun editMessage(conversationId: String, messageId: String, body: String): SbResult =
        http.request(
            "PATCH",
            "/v1/sdk/chat/conversations/${Transport.seg(conversationId)}/messages/${Transport.seg(messageId)}",
            mapOf("body" to body),
        )

    suspend fun deleteMessage(conversationId: String, messageId: String): SbResult =
        http.request(
            "DELETE",
            "/v1/sdk/chat/conversations/${Transport.seg(conversationId)}/messages/${Transport.seg(messageId)}",
        )

    /** Aynı emoji ikinci kez gönderilirse tepki kaldırılır. */
    suspend fun reactToMessage(conversationId: String, messageId: String, emoji: String): SbResult =
        http.request(
            "POST",
            "/v1/sdk/chat/conversations/${Transport.seg(conversationId)}/messages/${Transport.seg(messageId)}/reactions",
            mapOf("emoji" to emoji),
        )

    suspend fun setTyping(conversationId: String, isTyping: Boolean): SbResult =
        http.request(
            "POST",
            "/v1/sdk/chat/conversations/${Transport.seg(conversationId)}/typing",
            mapOf("is_typing" to isTyping),
        )

    suspend fun markRead(conversationId: String, lastMessageId: String? = null): SbResult =
        http.request(
            "POST",
            "/v1/sdk/chat/conversations/${Transport.seg(conversationId)}/read",
            mapOf("last_message_id" to lastMessageId),
        )

    suspend fun closeConversation(id: String): SbResult =
        http.request("POST", "/v1/sdk/chat/conversations/${Transport.seg(id)}/close")

    suspend fun rateConversation(id: String, rating: Int, comment: String? = null): SbResult =
        http.request(
            "POST",
            "/v1/sdk/chat/conversations/${Transport.seg(id)}/rate",
            mapOf("rating" to rating, "comment" to comment),
        )

    // ── Push ──────────────────────────────────────────────────────────────

    /**
     * FCM token'ını kaydeder.
     *
     * Token'ı almak (`FirebaseMessaging.getInstance().token`) ve Android 13+
     * bildirim iznini istemek uygulamanın işidir: izni ne zaman soracağın bir
     * ürün kararıdır, kütüphane kararı değil.
     */
    suspend fun registerDevice(
        token: String,
        provider: String = "fcm",
        externalId: String? = null,
        deviceName: String? = null,
        appVersion: String? = null,
        locale: String? = null,
    ): SbResult = http.request(
        "POST",
        "/v1/sdk/devices",
        mapOf(
            "token" to token,
            "platform" to "android",
            "provider" to provider,
            "external_id" to externalId,
            "device_name" to deviceName,
            "app_version" to appVersion,
            "locale" to locale,
        ),
    )

    /** Çıkışta çağrılır: kayıt silinmez, kapatılır (geçmiş korunur). */
    suspend fun unregisterDevice(token: String): SbResult =
        http.request("DELETE", "/v1/sdk/devices/${Transport.seg(token)}")

    /**
     * Bildirime dokunuldu — açılma damgası.
     *
     * Push'ta açılmayı yalnızca uygulama bilir: FCM "teslim ettim" der,
     * "kullanıcı dokundu" demez. Bildirim yükündeki `sb_message_id` değerini
     * buraya geri gönderin (`onMessageReceived` ya da açılış Intent'inde).
     */
    suspend fun reportPushOpened(messageId: String): SbResult =
        http.request("POST", "/v1/sdk/push/opened", mapOf("message_id" to messageId))
}
