package io.signalbird.sdk

/** Beş seviye. Fazlası eklenmez: kanal ayarını anlaşılır tutar. */
enum class SignalbirdLevel(val value: String) {
    DEBUG("debug"),
    INFO("info"),
    WARN("warn"),
    ERROR("error"),
    CRITICAL("critical"),
}

data class SignalbirdConfig(
    /**
     * Sunucu anahtarı (`sbr_live_…`).
     *
     * Bu anahtar GİZLİDİR ve Android uygulamasına gömülmemelidir — APK
     * çözülebilir. Mobil taraf sohbeti ve push kaydını [SignalbirdApp] ile
     * (açık anahtarla) yapar; bu istemci sunucu tarafı Kotlin servisleri
     * (Ktor, Spring) içindir.
     */
    val apiKey: String,
    val baseUrl: String = SIGNALBIRD_DEFAULT_BASE_URL,
    /** Her olaya eklenen köken adı (sunucu ya da servis adı). */
    val source: String? = null,
    /** Varsayılan 5 sn — bir log çağrısı isteği bekletmemeli. */
    val timeoutMs: Int = 5_000,
    /** Varsayılan kapalı: telsiz erişilemezse ödeme akışı çökmemeli. */
    val throwOnError: Boolean = false,
)

/**
 * Telsiz (Radio) istemcisi — log ve olay yazar.
 *
 * Sözleşme: docs/CONTRACT.md § 1–7
 */
class SignalbirdClient(private val config: SignalbirdConfig) {
    private val http: Transport

    init {
        require(config.apiKey.isNotEmpty()) { "Signalbird: apiKey zorunlu." }

        // Açık anahtarın sunucuda kullanılması sessiz bir güvenlik hatasıdır:
        // çalışır görünür, sonra kanal kısıtına takılır. Baştan söylüyoruz.
        require(!config.apiKey.startsWith("sbr_pub_")) {
            "Signalbird: sunucu istemcisine tarayıcı anahtarı verildi. sbr_live_… kullanın."
        }

        http = Transport(config.baseUrl, config.timeoutMs, config.throwOnError) {
            mapOf("Authorization" to "Bearer ${config.apiKey}")
        }
    }

    /** Seviye verilmezse kanalın kendi varsayılanı geçerlidir. */
    suspend fun log(
        channel: String,
        message: String,
        level: SignalbirdLevel? = null,
        context: Map<String, Any?>? = null,
    ): SbResult = http.request(
        "POST",
        "/v1/radio/log",
        mapOf(
            "channel" to channel,
            "message" to message,
            "level" to level?.value,
            "context" to context,
            "source" to config.source,
        ),
    )

    suspend fun debug(channel: String, message: String, context: Map<String, Any?>? = null): SbResult =
        log(channel, message, SignalbirdLevel.DEBUG, context)

    suspend fun info(channel: String, message: String, context: Map<String, Any?>? = null): SbResult =
        log(channel, message, SignalbirdLevel.INFO, context)

    suspend fun warn(channel: String, message: String, context: Map<String, Any?>? = null): SbResult =
        log(channel, message, SignalbirdLevel.WARN, context)

    suspend fun error(channel: String, message: String, context: Map<String, Any?>? = null): SbResult =
        log(channel, message, SignalbirdLevel.ERROR, context)

    suspend fun critical(channel: String, message: String, context: Map<String, Any?>? = null): SbResult =
        log(channel, message, SignalbirdLevel.CRITICAL, context)

    /**
     * En fazla 100 kayıt, satır satır sonuç.
     *
     * Kısmi başarı normaldir (kota tam ortada dolabilir). Başarısız satırlar
     * YENİDEN DENENMEZ: aynı logu iki kez yazmak da bir maliyettir.
     */
    suspend fun batch(events: List<Map<String, Any?>>): SbResult {
        val rows = events.take(100).map { event ->
            if (event["source"] == null && config.source != null) {
                event + ("source" to config.source)
            } else {
                event
            }
        }

        return http.request("POST", "/v1/radio/log/batch", mapOf("events" to rows))
    }
}
