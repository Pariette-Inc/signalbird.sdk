package signalbird

import (
	"context"
	"os"
	"strings"
	"time"
)

// Level — beş seviye. Fazlası eklenmez: kanal ayarını anlaşılır tutar.
type Level string

const (
	LevelDebug    Level = "debug"
	LevelInfo     Level = "info"
	LevelWarn     Level = "warn"
	LevelError    Level = "error"
	LevelCritical Level = "critical"
)

// Config — Telsiz istemcisinin ayarları.
type Config struct {
	// APIKey, sunucu anahtarıdır (sbr_live_…). Bu anahtar GİZLİDİR ve
	// tarayıcıya gömülemez.
	APIKey string
	// BaseURL boşsa DefaultBaseURL kullanılır.
	BaseURL string
	// Source, her olaya eklenen köken adıdır (sunucu ya da servis adı).
	Source string
	// Timeout boşsa 5 saniye. Bir log çağrısı isteği bekletmemeli.
	Timeout time.Duration
	// ThrowOnError açıksa metotlar error döner. Varsayılan kapalıdır:
	// telsiz erişilemezse müşterinin ödeme akışı çökmemeli.
	ThrowOnError bool
	Debug        bool
}

// Event — toplu gönderimdeki tek satır.
type Event struct {
	Channel string         `json:"channel"`
	Message string         `json:"message"`
	Level   Level          `json:"level,omitempty"`
	Context map[string]any `json:"context,omitempty"`
	Source  string         `json:"source,omitempty"`
}

// Client — Telsiz (log yazma) istemcisi.
type Client struct {
	http   *transport
	source string
}

// NewClient, sunucu anahtarıyla Telsiz istemcisi kurar.
//
// Açık anahtarın (sbr_pub_…) sunucuda kullanılması sessiz bir güvenlik
// hatasıdır: çalışır görünür, sonra kanal kısıtına takılır. Baştan reddedilir.
func NewClient(config Config) (*Client, error) {
	if config.APIKey == "" {
		return nil, ErrNoKey
	}

	if strings.HasPrefix(config.APIKey, "sbr_pub_") {
		return nil, ErrWrongKeyType
	}

	timeout := config.Timeout
	if timeout == 0 {
		timeout = 5 * time.Second
	}

	return &Client{
		http:   newTransport(config.APIKey, config.BaseURL, timeout, config.ThrowOnError, config.Debug),
		source: config.Source,
	}, nil
}

// NewClientFromEnv, SIGNALBIRD_KEY / SIGNALBIRD_URL / SIGNALBIRD_SOURCE okur.
func NewClientFromEnv() (*Client, error) {
	return NewClient(Config{
		APIKey:  os.Getenv("SIGNALBIRD_KEY"),
		BaseURL: os.Getenv("SIGNALBIRD_URL"),
		Source:  os.Getenv("SIGNALBIRD_SOURCE"),
	})
}

// Log, bir kanala kayıt gönderir. level boşsa kanalın kendi varsayılanı geçerlidir.
func (c *Client) Log(ctx context.Context, channel, message string, level Level, fields map[string]any) (Result, error) {
	return c.http.request(ctx, "POST", "/v1/radio/log", Event{
		Channel: channel,
		Message: message,
		Level:   level,
		Context: fields,
		Source:  c.source,
	}, nil)
}

func (c *Client) Debug(ctx context.Context, channel, message string, fields map[string]any) (Result, error) {
	return c.Log(ctx, channel, message, LevelDebug, fields)
}

func (c *Client) Info(ctx context.Context, channel, message string, fields map[string]any) (Result, error) {
	return c.Log(ctx, channel, message, LevelInfo, fields)
}

func (c *Client) Warn(ctx context.Context, channel, message string, fields map[string]any) (Result, error) {
	return c.Log(ctx, channel, message, LevelWarn, fields)
}

func (c *Client) Error(ctx context.Context, channel, message string, fields map[string]any) (Result, error) {
	return c.Log(ctx, channel, message, LevelError, fields)
}

func (c *Client) Critical(ctx context.Context, channel, message string, fields map[string]any) (Result, error) {
	return c.Log(ctx, channel, message, LevelCritical, fields)
}

// Batch — en fazla 100 kayıt, satır satır sonuç.
//
// Kısmi başarı normaldir (kota tam ortada dolabilir). Başarısız satırlar
// YENİDEN DENENMEZ: aynı logu iki kez yazmak da bir maliyettir.
func (c *Client) Batch(ctx context.Context, events []Event) (Result, error) {
	if len(events) > 100 {
		events = events[:100]
	}

	rows := make([]Event, 0, len(events))

	for _, event := range events {
		if event.Source == "" {
			event.Source = c.source
		}

		rows = append(rows, event)
	}

	return c.http.request(ctx, "POST", "/v1/radio/log/batch", map[string]any{"events": rows}, nil)
}
