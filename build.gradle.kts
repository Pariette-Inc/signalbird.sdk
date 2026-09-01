// Signalbird SDK — Kotlin/Android manifesti.
//
// Manifest KÖKTE durur (Gradle zaten kökte arar), kaynak
// `src/kotlin/src/main/kotlin/` altındadır; `sourceSets` ile gösterilir ki
// diğer dillerin dosyaları derlemeye girmesin.
//
// Sürüm `VERSION` dosyasıyla kilitlidir; `node scripts/sync-version.mjs`
// buradaki `version` alanını da yazar.

plugins {
    kotlin("jvm") version "2.0.21"
    `maven-publish`
}

group = "io.signalbird"
version = "2.0.0"

repositories {
    mavenCentral()
    google()
}

dependencies {
    // Tek dış bağımlılık coroutines'tir ve her Android projesinde zaten vardır.
    // JSON için `org.json` kullanılır: Android'in kendi kütüphanesinde bulunur,
    // JVM tarafında ise aşağıdaki küçük paket sağlar. OkHttp/Retrofit/Moshi
    // dayatmıyoruz — bir SDK'nın müşterinin ağ ve serileştirme yığınını
    // seçmesi, sürüm çakışmalarının en sık sebebidir.
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.9.0")
    compileOnly("org.json:json:20240303")
    testImplementation(kotlin("test"))
    testImplementation("org.json:json:20240303")
}

kotlin {
    jvmToolchain(17)
}

sourceSets {
    main {
        kotlin.setSrcDirs(listOf("src/kotlin/src/main/kotlin"))
        resources.setSrcDirs(emptyList<String>())
    }
    test {
        kotlin.setSrcDirs(listOf("src/kotlin/src/test/kotlin"))
        resources.setSrcDirs(emptyList<String>())
    }
}

publishing {
    publications {
        create<MavenPublication>("maven") {
            artifactId = "signalbird-sdk"
            from(components["java"])

            pom {
                name.set("Signalbird SDK")
                description.set("Signalbird SDK — canlı sohbet, push cihaz kaydı ve Telsiz (log) istemcisi")
                url.set("https://signalbird.io/sdk")

                licenses {
                    license {
                        name.set("MIT")
                        url.set("https://opensource.org/licenses/MIT")
                    }
                }
            }
        }
    }
}
