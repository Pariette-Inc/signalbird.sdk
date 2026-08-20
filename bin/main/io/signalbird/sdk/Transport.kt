package io.signalbird.sdk

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.net.HttpURLConnection
import java.net.SocketTimeoutException
import java.net.URL
import java.net.URLEncoder

/** Varsayılan API kökü. Kendi kurulumu olan müşteri `baseUrl` ile değiştirir. */
const val SIGNALBIRD_DEFAULT_BASE_URL = "https://signalbird.io/api"

/**
 * Her metodun döndüğü zarf.
 *
 * Başarısızlık istisna değil, veridir: sohbet balonunun ya da bir log
 * çağrısının hatası uygulamayı çökertmemeli.
 */
data class SbResult(
    val ok: Boolean,
    val status: Int,
    /** `JSONObject`, `JSONArray` ya da `null`. */
    val data: Any? = null,
    val code: String? = null,
    val message: String? = null,
) {
    val json: JSONObject? get() = data as? JSONObject
    val array: JSONArray? get() = data as? JSONArray
}

class SignalbirdException(
    message: String,
    val code: String? = null,
    val status: Int = 0,
) : RuntimeException(message)

/**
 * İstemcilerin ortak HTTP katmanı.
 *
 * `HttpURLConnection` ve `org.json` kullanır — ikisi de Android'in kendi
 * kütüphanesindedir. OkHttp ya da Retrofit dayatmak, bir SDK'nın müşterinin
 * ağ yığınını seçmesi demek olurdu; tek dış bağımlılık coroutines'tir ve o da
 * her Android projesinde zaten vardır.
 */
internal class Transport(
    private val baseUrl: String,
    private val timeoutMs: Int,
    private val throwOnError: Boolean,
    private val headers: () -> Map<String, String>,
) {
    suspend fun request(
        method: String,
        path: String,
        body: Map<String, Any?>? = null,
        query: Map<String, Any?>? = null,
    ): SbResult = withContext(Dispatchers.IO) {
        val url = URL(baseUrl.trimEnd('/') + path + buildQuery(query))
        val connection = url.openConnection() as HttpURLConnection

        try {
            connection.requestMethod = if (method == "PATCH") "POST" else method

            // Android'in HttpURLConnection'ı PATCH bilmez; sunucu bu başlıkla
            // isteği PATCH olarak işler. Laravel `X-HTTP-Method-Override`'ı
            // yerleşik olarak destekler.
            if (method == "PATCH") {
                connection.setRequestProperty("X-HTTP-Method-Override", "PATCH")
            }

            connection.connectTimeout = timeoutMs
            connection.readTimeout = timeoutMs
            connection.setRequestProperty("Accept", "application/json")

            for ((key, value) in headers()) {
                connection.setRequestProperty(key, value)
            }

            if (body != null) {
                connection.doOutput = true
                connection.setRequestProperty("Content-Type", "application/json")
                connection.outputStream.use { it.write(toJson(body).toString().toByteArray(Charsets.UTF_8)) }
            }

            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val text = stream?.bufferedReader()?.use(BufferedReader::readText).orEmpty()
            val parsed = parse(text)

            if (status in 200..299) {
                return@withContext SbResult(ok = true, status = status, data = parsed)
            }

            // API `{message, code}` döner; Laravel doğrulama hatası `{message,
            // errors}` döner (kodsuz) — onu VALIDATION_ERROR sayarız.
            val obj = parsed as? JSONObject
            val code = obj?.optString("code").takeUnless { it.isNullOrEmpty() }
                ?: when (status) {
                    422 -> "VALIDATION_ERROR"
                    401 -> "API_KEY_INVALID"
                    else -> "HTTP_$status"
                }
            val message = obj?.optString("message").takeUnless { it.isNullOrEmpty() } ?: "HTTP $status"

            fail(status, code, message)
        } catch (error: SocketTimeoutException) {
            fail(0, "TIMEOUT", error.message ?: "request timed out")
        } catch (error: Exception) {
            fail(0, "NETWORK_ERROR", error.message ?: "network error")
        } finally {
            connection.disconnect()
        }
    }

    private fun fail(status: Int, code: String, message: String): SbResult {
        if (throwOnError) {
            throw SignalbirdException("Signalbird: $code — $message", code, status)
        }

        return SbResult(ok = false, status = status, code = code, message = message)
    }

    private fun parse(text: String): Any? {
        if (text.isBlank()) return null

        return try {
            when (text.trimStart().firstOrNull()) {
                '{' -> JSONObject(text)
                '[' -> JSONArray(text)
                else -> text
            }
        } catch (_: Exception) {
            text
        }
    }

    companion object {
        /** `null` alanlar gövdeden atılır: "gönderilmedi" ile "null yapıldı" aynı şey değil. */
        internal fun toJson(map: Map<String, Any?>): JSONObject {
            val json = JSONObject()

            for ((key, value) in map) {
                when (value) {
                    null -> Unit
                    is Map<*, *> -> json.put(key, toJson(value.entries.associate { it.key.toString() to it.value }))
                    is List<*> -> json.put(key, JSONArray(value))
                    else -> json.put(key, value)
                }
            }

            return json
        }

        /** `null` alanlar atlanır; diziler `key[]=` biçiminde gider. */
        internal fun buildQuery(query: Map<String, Any?>?): String {
            if (query.isNullOrEmpty()) return ""

            val pairs = mutableListOf<String>()

            for ((key, value) in query) {
                when (value) {
                    null -> Unit
                    is Iterable<*> -> value.forEach { item ->
                        if (item != null) pairs += "${encode("$key[]")}=${encode(stringify(item))}"
                    }
                    else -> pairs += "${encode(key)}=${encode(stringify(value))}"
                }
            }

            return if (pairs.isEmpty()) "" else "?" + pairs.joinToString("&")
        }

        private fun stringify(value: Any): String = when (value) {
            is Boolean -> if (value) "true" else "false"
            else -> value.toString()
        }

        private fun encode(value: String): String = URLEncoder.encode(value, "UTF-8")

        /** Yol parçası — kimlikler URL'e gömülmeden önce kodlanır. */
        internal fun seg(value: Any): String = URLEncoder.encode(value.toString(), "UTF-8")
    }
}
