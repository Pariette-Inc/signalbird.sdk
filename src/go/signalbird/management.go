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

func (m *Management) ListRadioProjects(ctx context.Context) (Result, error) {
	return m.http.request(ctx, "GET", "/v1/radio/projects", nil, nil)
}

// CreateRadioProject — dönen secret (sbr_live_…) YALNIZ burada görünür;
// sunucuda yalnız SHA-256 özeti saklanır.
func (m *Management) CreateRadioProject(ctx context.Context, input map[string]any) (Result, error) {
	return m.http.request(ctx, "POST", "/v1/radio/projects", input, nil)
}

func (m *Management) GetRadioProject(ctx context.Context, id any) (Result, error) {
	return m.http.request(ctx, "GET", "/v1/radio/projects/"+seg(id), nil, nil)
}

func (m *Management) UpdateRadioProject(ctx context.Context, id any, input map[string]any) (Result, error) {
	return m.http.request(ctx, "PATCH", "/v1/radio/projects/"+seg(id), input, nil)
}

func (m *Management) DeleteRadioProject(ctx context.Context, id any) (Result, error) {
	return m.http.request(ctx, "DELETE", "/v1/radio/projects/"+seg(id), nil, nil)
}

// RotateRadioSecret — eski anahtar ANINDA geçersizleşir.
func (m *Management) RotateRadioSecret(ctx context.Context, id any) (Result, error) {
	return m.http.request(ctx, "POST", "/v1/radio/projects/"+seg(id)+"/rotate", nil, nil)
}

// ── Telsiz: kanallar ───────────────────────────────────────────────────

func (m *Management) CreateRadioChannel(ctx context.Context, projectID any, input map[string]any) (Result, error) {
	return m.http.request(ctx, "POST", "/v1/radio/projects/"+seg(projectID)+"/channels", input, nil)
}

// UpdateRadioChannel — key DEĞİŞMEZ: müşterinin kodundaki kanal adı ona bağlıdır.
func (m *Management) UpdateRadioChannel(ctx context.Context, projectID, channelID any, input map[string]any) (Result, error) {
	return m.http.request(ctx, "PATCH", "/v1/radio/projects/"+seg(projectID)+"/channels/"+seg(channelID), input, nil)
}

func (m *Management) DeleteRadioChannel(ctx context.Context, projectID, channelID any) (Result, error) {
	return m.http.request(ctx, "DELETE", "/v1/radio/projects/"+seg(projectID)+"/channels/"+seg(channelID), nil, nil)
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

// ── Uygulamalar ────────────────────────────────────────────────────────

func (m *Management) ListApps(ctx context.Context) (Result, error) {
	return m.http.request(ctx, "GET", "/v1/apps", nil, nil)
}

// CreateApp — yanıttaki public_key (sbw_pub_…) istemciye gömülür; gizli değildir.
func (m *Management) CreateApp(ctx context.Context, input map[string]any) (Result, error) {
	return m.http.request(ctx, "POST", "/v1/apps", input, nil)
}

func (m *Management) GetApp(ctx context.Context, id any) (Result, error) {
	return m.http.request(ctx, "GET", "/v1/apps/"+seg(id), nil, nil)
}

func (m *Management) UpdateApp(ctx context.Context, id any, input map[string]any) (Result, error) {
	return m.http.request(ctx, "PATCH", "/v1/apps/"+seg(id), input, nil)
}

func (m *Management) DeleteApp(ctx context.Context, id any) (Result, error) {
	return m.http.request(ctx, "DELETE", "/v1/apps/"+seg(id), nil, nil)
}

// RotateAppKey — siteye gömülü eski anahtar ANINDA çalışmaz olur.
func (m *Management) RotateAppKey(ctx context.Context, id any) (Result, error) {
	return m.http.request(ctx, "POST", "/v1/apps/"+seg(id)+"/rotate-key", nil, nil)
}

func (m *Management) ListAppDevices(ctx context.Context, id any, query Query) (Result, error) {
	return m.http.request(ctx, "GET", "/v1/apps/"+seg(id)+"/devices", nil, query)
}
