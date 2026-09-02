package signalbird

import "context"

// Management — Yönetim istemcisi.
//
// Müşterinin panelde tıklayarak yaptığı her şeyi kodla yapar: Telsiz projesi
// ve kanalı, sohbet gelen kutusu, uygulama kaydı ve cihaz listesi.
//
// Bu ADMIN yüzeyi DEĞİLDİR: anahtar tek bir takıma bağlıdır ve yalnız o
// takımın kayıtlarına dokunur; başka takımın kaydı 404 döner.
//
// Sözleşme: docs/CONTRACT.md § 10
type Management struct {
	http *transport
}

// NewManagement kurar. Gönderim ile aynı anahtar ailesini kullanır (sb_…) ama
// radio:*, chat:*, apps:* scope'larını ister.
func NewManagement(config KeyConfig) (*Management, error) {
	http, err := newKeyTransport(config)
	if err != nil {
		return nil, err
	}

	return &Management{http: http}, nil
}

// ── Telsiz: projeler ───────────────────────────────────────────────────

func (m *Management) RadioSummary(ctx context.Context) (Result, error) {
	return m.http.request(ctx, "GET", "/v1/radio/summary", nil, nil)
}

func (m *Management) RadioEvents(ctx context.Context, query Query) (Result, error) {
	return m.http.request(ctx, "GET", "/v1/radio/events", nil, query)
}

// ── Modül anahtarları ──────────────────────────────────────────────────
//
// Telsiz projesi/kanalı ve uygulama kaydı 1 Eyl 2026'da kaldırıldı
// (../signalbird.api/docs/KEY_ARCHITECTURE_2026-09-01.md §3). Beş modül
// (logger, email, sms, push, chat) aynı gövdeyi kullanır.

func (m *Management) ListModuleKeys(ctx context.Context, module string, query Query) (Result, error) {
	return m.http.request(ctx, "GET", "/v1/modules/"+seg(module)+"/keys", nil, query)
}

func (m *Management) GetModuleKey(ctx context.Context, module string, id any) (Result, error) {
	return m.http.request(ctx, "GET", "/v1/modules/"+seg(module)+"/keys/"+seg(id), nil, nil)
}

// CreateModuleKey — `key` verilmezse başlıktan üretilir; çakışırsa sayı eklenir.
func (m *Management) CreateModuleKey(ctx context.Context, module string, input any) (Result, error) {
	return m.http.request(ctx, "POST", "/v1/modules/"+seg(module)+"/keys", input, nil)
}

// UpdateModuleKey — `key` DEĞİŞTİRİLEBİLİR: eski ad 30 gün daha kabul edilir.
func (m *Management) UpdateModuleKey(ctx context.Context, module string, id any, input any) (Result, error) {
	return m.http.request(ctx, "PATCH", "/v1/modules/"+seg(module)+"/keys/"+seg(id), input, nil)
}

func (m *Management) DeleteModuleKey(ctx context.Context, module string, id any) (Result, error) {
	return m.http.request(ctx, "DELETE", "/v1/modules/"+seg(module)+"/keys/"+seg(id), nil, nil)
}

// ListModuleKeyDevices — push kanalının cihazları; token MASKELİ döner.
func (m *Management) ListModuleKeyDevices(ctx context.Context, module string, id any, query Query) (Result, error) {
	return m.http.request(ctx, "GET", "/v1/modules/"+seg(module)+"/keys/"+seg(id)+"/devices", nil, query)
}

// ── Sohbet: gelen kutusu ───────────────────────────────────────────────

func (m *Management) ChatSummary(ctx context.Context) (Result, error) {
	return m.http.request(ctx, "GET", "/v1/chat/summary", nil, nil)
}

func (m *Management) ChatUpdates(ctx context.Context) (Result, error) {
	return m.http.request(ctx, "GET", "/v1/chat/updates", nil, nil)
}

func (m *Management) ListConversations(ctx context.Context, query Query) (Result, error) {
	return m.http.request(ctx, "GET", "/v1/chat/conversations", nil, query)
}

func (m *Management) GetConversation(ctx context.Context, id string) (Result, error) {
	return m.http.request(ctx, "GET", "/v1/chat/conversations/"+seg(id), nil, nil)
}

// ListConversationMessages — after imleci cm_… mesaj kimliğidir.
func (m *Management) ListConversationMessages(ctx context.Context, id string, query Query) (Result, error) {
	return m.http.request(ctx, "GET", "/v1/chat/conversations/"+seg(id)+"/messages", nil, query)
}

// StartConversation — proaktif sohbet; ziyaretçi yazmadan ajan başlatır.
func (m *Management) StartConversation(ctx context.Context, input map[string]any) (Result, error) {
	return m.http.request(ctx, "POST", "/v1/chat/conversations", input, nil)
}

func (m *Management) UpdateConversation(ctx context.Context, id string, input map[string]any) (Result, error) {
	return m.http.request(ctx, "PATCH", "/v1/chat/conversations/"+seg(id), input, nil)
}

func (m *Management) SetConversationStatus(ctx context.Context, id, status string) (Result, error) {
	return m.http.request(ctx, "POST", "/v1/chat/conversations/"+seg(id)+"/status", map[string]any{"status": status}, nil)
}

// AssignConversation — userID 0 ise anahtarın sahibine atanır.
func (m *Management) AssignConversation(ctx context.Context, id string, userID int) (Result, error) {
	var value any

	if userID > 0 {
		value = userID
	}

	return m.http.request(ctx, "POST", "/v1/chat/conversations/"+seg(id)+"/assign", map[string]any{"user_id": value}, nil)
}

func (m *Management) ReadConversation(ctx context.Context, id, lastMessageID string) (Result, error) {
	return m.http.request(ctx, "POST", "/v1/chat/conversations/"+seg(id)+"/read", map[string]any{"last_message_id": lastMessageID}, nil)
}

func (m *Management) SetTyping(ctx context.Context, id string, isTyping bool) (Result, error) {
	return m.http.request(ctx, "POST", "/v1/chat/conversations/"+seg(id)+"/typing", map[string]any{"is_typing": isTyping}, nil)
}

// Reply — is_internal true ise iç nottur ve ziyaretçiye ASLA gitmez.
func (m *Management) Reply(ctx context.Context, id string, input map[string]any) (Result, error) {
	return m.http.request(ctx, "POST", "/v1/chat/conversations/"+seg(id)+"/messages", input, nil)
}

func (m *Management) EditChatMessage(ctx context.Context, id, messageID, body string) (Result, error) {
	return m.http.request(ctx, "PATCH", "/v1/chat/conversations/"+seg(id)+"/messages/"+seg(messageID), map[string]any{"body": body}, nil)
}

func (m *Management) DeleteChatMessage(ctx context.Context, id, messageID string) (Result, error) {
	return m.http.request(ctx, "DELETE", "/v1/chat/conversations/"+seg(id)+"/messages/"+seg(messageID), nil, nil)
}

// ReactToChatMessage — aynı emoji ikinci kez gönderilirse tepki kaldırılır.
func (m *Management) ReactToChatMessage(ctx context.Context, id, messageID, emoji string) (Result, error) {
	return m.http.request(ctx, "POST", "/v1/chat/conversations/"+seg(id)+"/messages/"+seg(messageID)+"/reactions", map[string]any{"emoji": emoji}, nil)
}

// ── Sohbet: ziyaretçi ve hazır yanıtlar ────────────────────────────────

func (m *Management) GetVisitor(ctx context.Context, id string) (Result, error) {
	return m.http.request(ctx, "GET", "/v1/chat/visitors/"+seg(id), nil, nil)
}

func (m *Management) UpdateVisitor(ctx context.Context, id string, input map[string]any) (Result, error) {
	return m.http.request(ctx, "PATCH", "/v1/chat/visitors/"+seg(id), input, nil)
}

func (m *Management) BanVisitor(ctx context.Context, id string) (Result, error) {
	return m.http.request(ctx, "POST", "/v1/chat/visitors/"+seg(id)+"/ban", nil, nil)
}

func (m *Management) ListCannedReplies(ctx context.Context) (Result, error) {
	return m.http.request(ctx, "GET", "/v1/chat/canned-replies", nil, nil)
}

func (m *Management) CreateCannedReply(ctx context.Context, input map[string]any) (Result, error) {
	return m.http.request(ctx, "POST", "/v1/chat/canned-replies", input, nil)
}

func (m *Management) UpdateCannedReply(ctx context.Context, id any, input map[string]any) (Result, error) {
	return m.http.request(ctx, "PATCH", "/v1/chat/canned-replies/"+seg(id), input, nil)
}

func (m *Management) DeleteCannedReply(ctx context.Context, id any) (Result, error) {
	return m.http.request(ctx, "DELETE", "/v1/chat/canned-replies/"+seg(id), nil, nil)
}

// ── Sohbet: tetikleyiciler ───────────────────────────────────────────────
// "Şu olduğunda şunu yap." Kural KAYITTA durur, kodda değil.

func (m *Management) ListChatTriggers(ctx context.Context) (Result, error) {
	return m.http.request(ctx, "GET", "/v1/chat/triggers", nil, nil)
}

func (m *Management) CreateChatTrigger(ctx context.Context, input map[string]any) (Result, error) {
	return m.http.request(ctx, "POST", "/v1/chat/triggers", input, nil)
}

func (m *Management) UpdateChatTrigger(ctx context.Context, id any, input map[string]any) (Result, error) {
	return m.http.request(ctx, "PATCH", "/v1/chat/triggers/"+seg(id), input, nil)
}

func (m *Management) DeleteChatTrigger(ctx context.Context, id any) (Result, error) {
	return m.http.request(ctx, "DELETE", "/v1/chat/triggers/"+seg(id), nil, nil)
}

// ── Sohbet: rapor ────────────────────────────────────────────────────────

// ChatReport yanıt/çözüm süresi, memnuniyet ve ajan kırılımını döner.
// Veri yoksa süreler null döner — 0 DEĞİL.
func (m *Management) ChatReport(ctx context.Context, rng string) (Result, error) {
	if rng == "" {
		rng = "30d"
	}

	return m.http.request(ctx, "GET", "/v1/chat/reports", nil, map[string]any{"range": rng})
}

// Uygulama uçları KALDIRILDI (1 Eyl 2026): sohbet ve push birer modül
// anahtarıdır — ListModuleKeys(ctx, "chat", nil).

func (m *Management) EmbedToken(ctx context.Context, input map[string]any) (Result, error) {
	return m.http.request(ctx, "POST", "/v1/embed/tokens", input, nil)
}

