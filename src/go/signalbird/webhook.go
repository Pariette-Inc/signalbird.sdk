package signalbird

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"strings"
)

// VerifyWebhook, mesaj olay webhook'unun imzasını doğrular.
//
// İki kural, ikisi de kritik:
//   - Doğrulama HAM GÖVDE üzerinde yapılır. JSON'u çözüp yeniden kodlamak
//     imzayı bozar — alan sırası ve boşluklar değişir.
//   - Karşılaştırma sabit zamanlıdır (hmac.Equal).
//
// Yeniden gönderimlere karşı tekilleştirme (evt_… kimliği) çağıranındır.
//
// Sözleşme: docs/CONTRACT.md § 8.6
func VerifyWebhook(rawBody []byte, signatureHeader, secret string) bool {
	if signatureHeader == "" || secret == "" {
		return false
	}

	if !strings.HasPrefix(signatureHeader, "sha256=") {
		return false
	}

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(rawBody)
	expected := hex.EncodeToString(mac.Sum(nil))

	return hmac.Equal([]byte(expected), []byte(strings.TrimPrefix(signatureHeader, "sha256=")))
}
