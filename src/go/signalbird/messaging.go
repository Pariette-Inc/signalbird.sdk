package signalbird

import (
	"context"
	"strings"
	"time"
)

// BulkChunk — toplu kişi yüklemede tek istekteki üst sınır.
const BulkChunk = 1000

// KeyConfig — takım anahtarıyla çalışan istemcilerin (Gönderim, Yönetim) ayarı.
type KeyConfig struct {
	// APIKey, takım API anahtarıdır (sb_…). Telsiz anahtarı burada çalışmaz.
	APIKey  string
	BaseURL string
	// Timeout boşsa 15 saniye — toplu kişi yükleme uzun sürebilir.
	Timeout      time.Duration
	ThrowOnError bool
	Debug        bool
}

// Messaging — Gönderim istemcisi: e-posta/SMS/push, kişi, liste, kampanya, mesaj.
type Messaging struct {
	http *transport
}

// NewMessaging kurar. sb_ dışı anahtar kurulum anında reddedilir: sessizce 401
// yiyip haftalar sonra fark edilmesin.
func NewMessaging(config KeyConfig) (*Messaging, error) {
	http, err := newKeyTransport(config)
	if err != nil {
		return nil, err
	}

	return &Messaging{http: http}, nil
}

func newKeyTransport(config KeyConfig) (*transport, error) {
	if config.APIKey == "" {
		return nil, ErrNoKey
	}

	if !strings.HasPrefix(config.APIKey, "sb_") {
		return nil, ErrWrongKeyType
	}

	timeout := config.Timeout
	if timeout == 0 {
		timeout = 15 * time.Second
	}

	return newTransport(config.APIKey, config.BaseURL, timeout, config.ThrowOnError, config.Debug), nil
}

// ── Gönderim ───────────────────────────────────────────────────────────

// SendEmail — class alanı (transactional | commercial) ZORUNLUDUR ve
// varsayılanı yoktur: hukuki kapı çağıranın elindedir.
func (m *Messaging) SendEmail(ctx context.Context, input map[string]any) (Result, error) {
	return m.http.request(ctx, "POST", "/v1/email/send", input, nil)
}

func (m *Messaging) SendSms(ctx context.Context, input map[string]any) (Result, error) {
	return m.http.request(ctx, "POST", "/v1/sms/send", input, nil)
}

// PreviewSms — parça/karakter hesabı; kota harcamaz.
func (m *Messaging) PreviewSms(ctx context.Context, body string) (Result, error) {
	return m.http.request(ctx, "POST", "/v1/sms/preview", map[string]any{"body": body}, nil)
}

func (m *Messaging) SendPush(ctx context.Context, input map[string]any) (Result, error) {
	return m.http.request(ctx, "POST", "/v1/push/send", input, nil)
}

// ── Kişiler ────────────────────────────────────────────────────────────

func (m *Messaging) ListContacts(ctx context.Context, query Query) (Result, error) {
	return m.http.request(ctx, "GET", "/v1/contacts", nil, query)
}

func (m *Messaging) CreateContact(ctx context.Context, contact map[string]any) (Result, error) {
	return m.http.request(ctx, "POST", "/v1/contacts", contact, nil)
}

func (m *Messaging) UpdateContact(ctx context.Context, id any, contact map[string]any) (Result, error) {
	return m.http.request(ctx, "PATCH", "/v1/contacts/"+seg(id), contact, nil)
}

func (m *Messaging) DeleteContact(ctx context.Context, id any) (Result, error) {
	return m.http.request(ctx, "DELETE", "/v1/contacts/"+seg(id), nil, nil)
}

// BulkContacts, girdiyi 1000'lik parçalara böler ve SIRAYLA gönderir.
//
// Paralel değil: aynı e-posta iki parçadaysa yarış olmasın. Bir parça
// başarısız olursa o noktada durulur ve o ana kadarki sonuç döner.
func (m *Messaging) BulkContacts(ctx context.Context, input map[string]any) (Result, error) {
	contacts := normalizeContacts(input["contacts"])

	if len(contacts) == 0 {
		return Result{OK: true, Status: 200}, nil
	}

	rest := map[string]any{}
	for key, value := range input {
		if key != "contacts" {
			rest[key] = value
		}
	}

	var last Result

	for start := 0; start < len(contacts); start += BulkChunk {
		end := start + BulkChunk
		if end > len(contacts) {
			end = len(contacts)
		}

		payload := map[string]any{"contacts": contacts[start:end]}
		for key, value := range rest {
			payload[key] = value
		}

		result, err := m.http.request(ctx, "POST", "/v1/contacts/bulk", payload, nil)
		if err != nil || !result.OK {
			return result, err
		}

		last = result
	}

	return last, nil
}

// ── Listeler ───────────────────────────────────────────────────────────

func (m *Messaging) ListContactLists(ctx context.Context) (Result, error) {
	return m.http.request(ctx, "GET", "/v1/contact-lists", nil, nil)
}

func (m *Messaging) CreateContactList(ctx context.Context, input map[string]any) (Result, error) {
	return m.http.request(ctx, "POST", "/v1/contact-lists", input, nil)
}

func (m *Messaging) DeleteContactList(ctx context.Context, id any) (Result, error) {
	return m.http.request(ctx, "DELETE", "/v1/contact-lists/"+seg(id), nil, nil)
}

// ── Kampanyalar ────────────────────────────────────────────────────────

func (m *Messaging) ListCampaigns(ctx context.Context, query Query) (Result, error) {
	return m.http.request(ctx, "GET", "/v1/campaigns", nil, query)
}

// CreateCampaign — buradan çıkan her ileti ZORUNLU commercial'dır.
func (m *Messaging) CreateCampaign(ctx context.Context, input map[string]any) (Result, error) {
	return m.http.request(ctx, "POST", "/v1/campaigns", input, nil)
}

func (m *Messaging) GetCampaign(ctx context.Context, id any) (Result, error) {
	return m.http.request(ctx, "GET", "/v1/campaigns/"+seg(id), nil, nil)
}

func (m *Messaging) CancelCampaign(ctx context.Context, id any) (Result, error) {
	return m.http.request(ctx, "POST", "/v1/campaigns/"+seg(id)+"/cancel", nil, nil)
}

func (m *Messaging) ListCampaignMessages(ctx context.Context, id any, query Query) (Result, error) {
	return m.http.request(ctx, "GET", "/v1/campaigns/"+seg(id)+"/messages", nil, query)
}

// IterateCampaignMessages, sayfaları gezer ve her satır için fn çağırır.
// fn false dönerse gezinme durur. Büyük kampanyada tüm listeyi belleğe almaz.
func (m *Messaging) IterateCampaignMessages(ctx context.Context, id any, query Query, fn func(row map[string]any) bool) error {
	page := 1

	if query == nil {
		query = Query{}
	}

	for {
		query["page"] = page

		result, err := m.ListCampaignMessages(ctx, id, query)
		if err != nil || !result.OK {
			return err
		}

		var payload struct {
			Data     []map[string]any `json:"data"`
			LastPage int              `json:"last_page"`
		}

		if err := result.Into(&payload); err != nil {
			return err
		}

		for _, row := range payload.Data {
			if !fn(row) {
				return nil
			}
		}

		if len(payload.Data) == 0 || (payload.LastPage > 0 && page >= payload.LastPage) {
			return nil
		}

		page++
	}
}

// ── Mesajlar ───────────────────────────────────────────────────────────

func (m *Messaging) ListMessages(ctx context.Context, query Query) (Result, error) {
	return m.http.request(ctx, "GET", "/v1/messages", nil, query)
}

func (m *Messaging) GetMessage(ctx context.Context, id string) (Result, error) {
	return m.http.request(ctx, "GET", "/v1/messages/"+seg(id), nil, nil)
}

// normalizeContacts, hem []map[string]any hem []any kabul eder.
//
// Çağıran çoğu zaman JSON'dan gelen []any taşır; yalnız birini kabul etmek
// listeyi sessizce BOŞ sayıp "0 kişi yüklendi" demek olurdu — hataların en
// kötüsü hiçbir şey söylemeyendir.
func normalizeContacts(value any) []any {
	switch typed := value.(type) {
	case []any:
		return typed
	case []map[string]any:
		rows := make([]any, 0, len(typed))
		for _, row := range typed {
			rows = append(rows, row)
		}

		return rows
	default:
		return nil
	}
}
