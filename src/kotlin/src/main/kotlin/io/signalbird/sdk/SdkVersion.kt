package io.signalbird.sdk

import java.net.HttpURLConnection
import java.util.concurrent.atomic.AtomicBoolean

/**
 * SDK sürümü ve sürüm bildirimi (docs/CONTRACT.md § 14).
 *
 * Her istek `X-Signalbird-Sdk: kotlin/<sürüm>` taşır. API yanıtta
 * `Signalbird-Sdk-Status` (current | outdated | unsupported) döner; SDK
 * eskiyse süreç başına BİR KEZ `System.err`e (Android'de logcat) uyarı
 * yazılır. İstisna fırlatılmaz, istek sonucu değişmez.
 *
 * `VERSION` satırını `scripts/sync-version.mjs` kökteki VERSION dosyasından
 * yazar - elle değiştirmeyin.
 */
object SignalbirdSdk {
    const val VERSION = "2.8.0"

    internal const val HEADER = "X-Signalbird-Sdk"
    internal val headerValue: String get() = "kotlin/$VERSION"

    private val warned = AtomicBoolean(false)

    internal fun note(connection: HttpURLConnection) {
        try {
            val status = connection.getHeaderField("Signalbird-Sdk-Status")
            if (status != "outdated" && status != "unsupported") return
            if (!warned.compareAndSet(false, true)) return

            val latest = connection.getHeaderField("Signalbird-Sdk-Latest") ?: "?"
            System.err.println(
                if (status == "unsupported")
                    "[signalbird] Bu SDK sürümü ($VERSION) artık desteklenmiyor. Son sürüm: $latest. io.signalbird:signalbird-sdk bağımlılığını güncelleyin."
                else
                    "[signalbird] Yeni SDK sürümü var: $latest (kurulu: $VERSION)."
            )
        } catch (_: Exception) {
            // uyarı isteği asla bozmamalı
        }
    }
}
