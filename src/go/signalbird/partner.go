package signalbird

import (
	"context"
	"strings"
	"time"
)

// PartnerConfig — partner istemcisinin kurulumu.
type PartnerConfig struct {
	// APIKey, sözleşmeli partner anahtarıdır (sbp_live_…). Takım anahtarı
	// (sb_…) burada çalışmaz ve kurulum anında reddedilir.
	APIKey  string
	BaseURL string
	// Timeout boşsa 15 saniye.
	Timeout      time.Duration
	ThrowOnError bool
	Debug        bool
}

// Partner — BEŞİNCİ yüzey.
//
// Signalbird'ü kendi ürününün içinde satan sözleşmeli platform (veribenim,
// submitcms) müşterisini bununla sağlar ve yetkilendirir.
//
// Bu, "Admin yüzeyi OLMAYACAK" kuralının BİLİNÇLİ istisnasıdır ve istisna
// olduğu için ayrı anahtar türü taşır. Kural, müşterinin kendi anahtarıyla
// (sb_…) şirket açamaması içindi; o kural aynen duruyor.
//
// Partner SÜPER YÖNETİCİ DEĞİLDİR: yalnız kendi açtığı company'lere erişir,
// başkasınınki 404 döner.
//
// Sözleşme: docs/CONTRACT.md § 12
type Partner struct {
	http *transport
}

// NewPartner kurar.
func NewPartner(config PartnerConfig) (*Partner, error) {
	if config.APIKey == "" {
		return nil, ErrNoKey
	}

	if !strings.HasPrefix(config.APIKey, "sbp_live_") {
		return nil, ErrWrongKeyType
	}

	timeout := config.Timeout
	if timeout == 0 {
		timeout = 15 * time.Second
	}

	return &Partner{
		http: newTransport(config.APIKey, config.BaseURL, timeout, config.ThrowOnError, config.Debug),
	}, nil
}

// ── Müşteri ────────────────────────────────────────────────────────────

// CreateCompany company + takım + owner açar. IDEMPOTENTTİR: aynı external_id
// ile ikinci çağrı yeni kayıt açmaz. keys yalnız ilk oluşturmada döner.
func (p *Partner) CreateCompany(ctx context.Context, input map[string]any) (Result, error) {
	return p.http.request(ctx, "POST", "/v1/partner/companies", input, nil)
}

func (p *Partner) ListCompanies(ctx context.Context, query Query) (Result, error) {
	return p.http.request(ctx, "GET", "/v1/partner/companies", nil, query)
}

func (p *Partner) GetCompany(ctx context.Context, externalID string) (Result, error) {
	return p.http.request(ctx, "GET", "/v1/partner/companies/"+seg(externalID), nil, nil)
}

func (p *Partner) UpdateCompany(ctx context.Context, externalID string, input map[string]any) (Result, error) {
	return p.http.request(ctx, "PATCH", "/v1/partner/companies/"+seg(externalID), input, nil)
}

// SuspendCompany askıya alır — SİLMEZ. İzleme ve mesaj geçmişi durur.
func (p *Partner) SuspendCompany(ctx context.Context, externalID string) (Result, error) {
	return p.http.request(ctx, "DELETE", "/v1/partner/companies/"+seg(externalID), nil, nil)
}

func (p *Partner) RotateKey(ctx context.Context, externalID, keyType string) (Result, error) {
	return p.http.request(ctx, "POST", "/v1/partner/companies/"+seg(externalID)+"/keys/rotate",
		map[string]any{"type": keyType}, nil)
}

// ── Domain ─────────────────────────────────────────────────────────────

// AddDomain domain ekler ve (istenirse) izlemeye alır.
//
// Kayıt verified_via='partner' ile doğar: izleme, sohbet ve push için yeter —
// e-posta/SMS KAMPANYASI için TXT şarttır. Yanıttaki dns kaydını yayınlayıp
// VerifyDomain çağırmak kapıyı açar.
func (p *Partner) AddDomain(ctx context.Context, companyExternalID string, input map[string]any) (Result, error) {
	return p.http.request(ctx, "POST", "/v1/partner/companies/"+seg(companyExternalID)+"/domains", input, nil)
}

func (p *Partner) ListDomains(ctx context.Context, companyExternalID string) (Result, error) {
	return p.http.request(ctx, "GET", "/v1/partner/companies/"+seg(companyExternalID)+"/domains", nil, nil)
}

func (p *Partner) GetDomain(ctx context.Context, externalID string) (Result, error) {
	return p.http.request(ctx, "GET", "/v1/partner/domains/"+seg(externalID), nil, nil)
}

func (p *Partner) VerifyDomain(ctx context.Context, externalID string) (Result, error) {
	return p.http.request(ctx, "POST", "/v1/partner/domains/"+seg(externalID)+"/verify", nil, nil)
}

func (p *Partner) RemoveDomain(ctx context.Context, externalID string) (Result, error) {
	return p.http.request(ctx, "DELETE", "/v1/partner/domains/"+seg(externalID), nil, nil)
}

// DomainUptime — rng boşsa 24h. Hiç kontrol yoksa uptime null döner, %100 DEĞİL.
func (p *Partner) DomainUptime(ctx context.Context, externalID, rng string) (Result, error) {
	return p.http.request(ctx, "GET", "/v1/partner/domains/"+seg(externalID)+"/uptime", nil, uptimeQuery(rng))
}

// CompanyUptime tek istekte tüm domainleri döner — liste ekranı N+1 atmasın.
func (p *Partner) CompanyUptime(ctx context.Context, companyExternalID, rng string) (Result, error) {
	return p.http.request(ctx, "GET", "/v1/partner/companies/"+seg(companyExternalID)+"/uptime", nil, uptimeQuery(rng))
}

func uptimeQuery(rng string) Query {
	if rng == "" {
		rng = "24h"
	}

	return Query{"range": rng}
}

// ── Mesaj günlüğü ──────────────────────────────────────────────────────
//
// Salt okur; alıcı maskeli, gövde yok (MESSAGING_UNIFICATION §5.1).

// ListMessages, müşterinin mesaj günlüğünü döner.
func (p *Partner) ListMessages(ctx context.Context, companyExternalID string, query Query) (Result, error) {
	return p.http.request(ctx, "GET", "/v1/partner/companies/"+seg(companyExternalID)+"/messages", nil, query)
}

// GetMessage, tek mesajı ve olay zaman çizelgesini döner.
func (p *Partner) GetMessage(ctx context.Context, companyExternalID, messageID string) (Result, error) {
	return p.http.request(ctx, "GET",
		"/v1/partner/companies/"+seg(companyExternalID)+"/messages/"+seg(messageID), nil, nil)
}

// MessageSummary, kanal bazlı gönderim özetini döner.
func (p *Partner) MessageSummary(ctx context.Context, companyExternalID, rng string) (Result, error) {
	if rng == "" {
		rng = "7d"
	}

	return p.http.request(ctx, "GET",
		"/v1/partner/companies/"+seg(companyExternalID)+"/message-summary", nil, Query{"range": rng})
}

// ── Modül yetkisi ──────────────────────────────────────────────────────

func (p *Partner) ListModules(ctx context.Context, companyExternalID string) (Result, error) {
	return p.http.request(ctx, "GET", "/v1/partner/companies/"+seg(companyExternalID)+"/modules", nil, nil)
}

// GrantModule — "bu müşteri şu modül için ödeme yaptı, kullanabilir".
func (p *Partner) GrantModule(ctx context.Context, companyExternalID string, input map[string]any) (Result, error) {
	return p.http.request(ctx, "POST", "/v1/partner/companies/"+seg(companyExternalID)+"/modules", input, nil)
}

// RevokeModule yalnız partner'ın KENDİ verdiği hakkı geri alır; plan hakkına
// dokunmaz.
func (p *Partner) RevokeModule(ctx context.Context, companyExternalID, module string) (Result, error) {
	return p.http.request(ctx, "DELETE",
		"/v1/partner/companies/"+seg(companyExternalID)+"/modules/"+seg(module), nil, nil)
}

// ── Kullanıcı ──────────────────────────────────────────────────────────

func (p *Partner) CreateUser(ctx context.Context, companyExternalID string, input map[string]any) (Result, error) {
	return p.http.request(ctx, "POST", "/v1/partner/companies/"+seg(companyExternalID)+"/users", input, nil)
}

func (p *Partner) ListUsers(ctx context.Context, companyExternalID string) (Result, error) {
	return p.http.request(ctx, "GET", "/v1/partner/companies/"+seg(companyExternalID)+"/users", nil, nil)
}

// RemoveUser üyeliği kaldırır, kişinin Signalbird hesabını SİLMEZ.
func (p *Partner) RemoveUser(ctx context.Context, companyExternalID, userExternalID string) (Result, error) {
	return p.http.request(ctx, "DELETE",
		"/v1/partner/companies/"+seg(companyExternalID)+"/users/"+seg(userExternalID), nil, nil)
}

// ── Gömme ──────────────────────────────────────────────────────────────

// CreateEmbedToken panel ekranını partner sayfasına gömmek için kısa ömürlü
// jeton üretir: 120 saniye yaşar ve TEK KULLANIMLIKTIR — jeton URL'de gider,
// log ve Referer başlığına düşer.
func (p *Partner) CreateEmbedToken(ctx context.Context, companyExternalID string, input map[string]any) (Result, error) {
	return p.http.request(ctx, "POST", "/v1/partner/companies/"+seg(companyExternalID)+"/embed", input, nil)
}
