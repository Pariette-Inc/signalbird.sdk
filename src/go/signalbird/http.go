// Package signalbird — Signalbird SDK'sının Go istemcisi.
//
// Üç sunucu yüzeyi vardır ve anahtarları farklıdır:
//
//	Client     → Telsiz (log yazma),  sbr_live_…
//	Messaging  → Gönderim,            sb_…
//	Management → Yönetim,             sb_… + radio|chat|apps scope'ları
//
// Bağımlılığı yoktur: yalnız standart kütüphane. Retry yoktur — aynı iletiyi
// iki kez göndermek hiç göndermemekten pahalıdır, yeniden deneme kararı
// çağıranındır.
//
// Sözleşme: docs/CONTRACT.md
package signalbird

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// DefaultBaseURL — kendi kurulumu olan müşteri BaseURL ile değiştirebilir.
const DefaultBaseURL = "https://live.signalbird.io/api"

// Result, her metodun döndüğü zarftır. Başarısızlık hata değil, veridir:
// log göndermek ya da bir kaydı okumak uygulamanın ASIL işi değildir.
type Result struct {
	OK      bool            `json:"ok"`
	Status  int             `json:"status"`
	Data    json.RawMessage `json:"data,omitempty"`
	Code    string          `json:"code,omitempty"`
	Message string          `json:"message,omitempty"`
}

// Into, Data alanını verilen yapıya çözer.
//
//	var project struct{ Project struct{ ID int } }
//	res.Into(&project)
func (r Result) Into(target any) error {
	if len(r.Data) == 0 {
		return nil
	}

	return json.Unmarshal(r.Data, target)
}

// Error, ThrowOnError açıkken döner.
type Error struct {
	Code    string
	Status  int
	Message string
	Body    json.RawMessage
}

func (e *Error) Error() string {
	return fmt.Sprintf("signalbird: %s (HTTP %d): %s", e.Code, e.Status, e.Message)
}

// ErrWrongKeyType — istemciye yanlış aileden anahtar verildi.
var ErrWrongKeyType = errors.New("signalbird: yanlış anahtar türü")

// ErrNoKey — anahtar boş.
var ErrNoKey = errors.New("signalbird: anahtar zorunlu")

type transport struct {
	apiKey       string
	baseURL      string
	authHeader   string
	authPrefix   string
	client       *http.Client
	throwOnError bool
	debug        bool
}

func newTransport(apiKey, baseURL string, timeout time.Duration, throwOnError, debug bool) *transport {
	if baseURL == "" {
		baseURL = DefaultBaseURL
	}

	return &transport{
		apiKey:       apiKey,
		baseURL:      strings.TrimRight(baseURL, "/"),
		authHeader:   "Authorization",
		authPrefix:   "Bearer ",
		client:       &http.Client{Timeout: timeout},
		throwOnError: throwOnError,
		debug:        debug,
	}
}

// Query — sorgu dizesi. nil değerler atlanır, dilimler key[]= biçiminde gider.
type Query map[string]any

func (t *transport) request(ctx context.Context, method, path string, body any, query Query) (Result, error) {
	var reader io.Reader

	if body != nil {
		encoded, err := json.Marshal(body)
		if err != nil {
			return t.fail(0, "ENCODE_ERROR", err.Error(), nil)
		}

		reader = bytes.NewReader(encoded)
	}

	if ctx == nil {
		ctx = context.Background()
	}

	request, err := http.NewRequestWithContext(ctx, method, t.baseURL+path+buildQuery(query), reader)
	if err != nil {
		return t.fail(0, "NETWORK_ERROR", err.Error(), nil)
	}

	request.Header.Set("Accept", "application/json")
	request.Header.Set(t.authHeader, t.authPrefix+t.apiKey)

	if body != nil {
		request.Header.Set("Content-Type", "application/json")
	}

	response, err := t.client.Do(request)
	if err != nil {
		code := "NETWORK_ERROR"
		if errors.Is(err, context.DeadlineExceeded) || strings.Contains(err.Error(), "Client.Timeout") {
			code = "TIMEOUT"
		}

		return t.fail(0, code, err.Error(), nil)
	}
	defer response.Body.Close()

	raw, _ := io.ReadAll(response.Body)

	if response.StatusCode >= 200 && response.StatusCode < 300 {
		return Result{OK: true, Status: response.StatusCode, Data: json.RawMessage(raw)}, nil
	}

	// API {message, code} döner; Laravel doğrulama hatası {message, errors}
	// döner (kodsuz) — onu VALIDATION_ERROR sayarız.
	var parsed struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	}
	_ = json.Unmarshal(raw, &parsed)

	code := parsed.Code
	if code == "" {
		switch response.StatusCode {
		case 422:
			code = "VALIDATION_ERROR"
		case 401:
			code = "API_KEY_INVALID"
		default:
			code = fmt.Sprintf("HTTP_%d", response.StatusCode)
		}
	}

	message := parsed.Message
	if message == "" {
		message = fmt.Sprintf("HTTP %d", response.StatusCode)
	}

	return t.fail(response.StatusCode, code, message, raw)
}

func (t *transport) fail(status int, code, message string, body []byte) (Result, error) {
	result := Result{OK: false, Status: status, Code: code, Message: message, Data: json.RawMessage(body)}

	if t.throwOnError {
		return result, &Error{Code: code, Status: status, Message: message, Body: result.Data}
	}

	if t.debug {
		fmt.Printf("[signalbird] %s (HTTP %d): %s\n", code, status, message)
	}

	return result, nil
}

func buildQuery(query Query) string {
	if len(query) == 0 {
		return ""
	}

	values := url.Values{}

	for key, value := range query {
		if value == nil {
			continue
		}

		switch typed := value.(type) {
		case []string:
			for _, item := range typed {
				values.Add(key+"[]", item)
			}
		case []int:
			for _, item := range typed {
				values.Add(key+"[]", fmt.Sprint(item))
			}
		case bool:
			if typed {
				values.Set(key, "true")
			} else {
				values.Set(key, "false")
			}
		default:
			values.Set(key, fmt.Sprint(typed))
		}
	}

	if len(values) == 0 {
		return ""
	}

	return "?" + values.Encode()
}

// seg — kimlikler URL'e gömülmeden önce kodlanır.
func seg(value any) string {
	return url.PathEscape(fmt.Sprint(value))
}
