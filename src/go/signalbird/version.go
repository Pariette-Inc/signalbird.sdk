package signalbird

import (
	"log"
	"net/http"
	"sync"
)

// Version SDK sürümüdür. `scripts/sync-version.mjs` kökteki VERSION
// dosyasından yazar - elle değiştirmeyin.
const Version = "2.6.0"

// sdkHeader her isteğe `go/<sürüm>` olarak eklenir (docs/CONTRACT.md § 14).
const sdkHeader = "X-Signalbird-Sdk"

var sdkWarnOnce sync.Once

// noteSdkStatus yanıttaki sürüm durumuna bakar; SDK eskiyse süreç başına
// BİR KEZ standart log'a uyarı yazar. İstek sonucunu değiştirmez.
func noteSdkStatus(h http.Header) {
	status := h.Get("Signalbird-Sdk-Status")
	if status != "outdated" && status != "unsupported" {
		return
	}

	sdkWarnOnce.Do(func() {
		latest := h.Get("Signalbird-Sdk-Latest")
		if latest == "" {
			latest = "?"
		}

		if status == "unsupported" {
			log.Printf("[signalbird] Bu SDK sürümü (%s) artık desteklenmiyor. Son sürüm: %s. go get github.com/Pariette-Inc/signalbird.sdk@latest", Version, latest)
			return
		}

		log.Printf("[signalbird] Yeni SDK sürümü var: %s (kurulu: %s).", latest, Version)
	})
}
