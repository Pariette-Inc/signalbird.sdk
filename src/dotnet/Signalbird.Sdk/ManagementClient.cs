using System.Collections.Generic;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;

namespace Signalbird.Sdk;

/// <summary>
/// Yönetim (Management) istemcisi.
///
/// <para>
/// Müşterinin panelde tıklayarak yaptığı her şeyi kodla yapar: Telsiz projesi
/// ve kanalı, sohbet gelen kutusu, uygulama kaydı ve cihaz listesi.
/// </para>
///
/// <para>
/// Bu ADMIN yüzeyi DEĞİLDİR: anahtar tek bir takıma bağlıdır ve yalnız o
/// takımın kayıtlarına dokunur; başka takımın kaydı 404 döner.
/// </para>
///
/// <para>Sözleşme: docs/CONTRACT.md § 10</para>
/// </summary>
public sealed class ManagementClient
{
    private readonly Transport _http;

    public ManagementClient(SignalbirdKeyOptions options, HttpClient? http = null)
    {
        _http = KeyTransport.Create(options, "yönetim", http);
    }

    // ── Telsiz: projeler ─────────────────────────────────────────────────

    public Task<SbResult> RadioSummaryAsync(CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Get, "/v1/radio/summary", null, null, ct);

    public Task<SbResult> RadioEventsAsync(IDictionary<string, object?>? query = null, CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Get, "/v1/radio/events", null, query, ct);

    // ── Modül anahtarları ────────────────────────────────────────────────
    //
    // Telsiz projesi/kanalı ve uygulama kaydı 1 Eyl 2026'da kaldırıldı
    // (../signalbird.api/docs/KEY_ARCHITECTURE_2026-09-01.md §3).

    public Task<SbResult> ListModuleKeysAsync(string module, IDictionary<string, object?>? query = null, CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Get, $"/v1/modules/{Transport.Seg(module)}/keys", null, query, ct);

    public Task<SbResult> GetModuleKeyAsync(string module, object id, CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Get, $"/v1/modules/{Transport.Seg(module)}/keys/{Transport.Seg(id)}", null, null, ct);

    /// <summary>`key` verilmezse başlıktan üretilir; çakışırsa sonuna sayı eklenir.</summary>
    public Task<SbResult> CreateModuleKeyAsync(string module, IDictionary<string, object?> input, CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Post, $"/v1/modules/{Transport.Seg(module)}/keys", input, null, ct);

    /// <summary>`key` DEĞİŞTİRİLEBİLİR: eski ad 30 gün daha kabul edilir.</summary>
    public Task<SbResult> UpdateModuleKeyAsync(string module, object id, IDictionary<string, object?> input, CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Patch, $"/v1/modules/{Transport.Seg(module)}/keys/{Transport.Seg(id)}", input, null, ct);

    public Task<SbResult> DeleteModuleKeyAsync(string module, object id, CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Delete, $"/v1/modules/{Transport.Seg(module)}/keys/{Transport.Seg(id)}", null, null, ct);

    /// <summary>Push kanalının cihazları; token MASKELİ döner.</summary>
    public Task<SbResult> ListModuleKeyDevicesAsync(string module, object id, IDictionary<string, object?>? query = null, CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Get, $"/v1/modules/{Transport.Seg(module)}/keys/{Transport.Seg(id)}/devices", null, query, ct);

    // ── Sohbet: gelen kutusu ─────────────────────────────────────────────

    public Task<SbResult> ChatSummaryAsync(CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Get, "/v1/chat/summary", null, null, ct);

    public Task<SbResult> ChatUpdatesAsync(CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Get, "/v1/chat/updates", null, null, ct);

    public Task<SbResult> ListConversationsAsync(IDictionary<string, object?>? query = null, CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Get, "/v1/chat/conversations", null, query, ct);

    public Task<SbResult> GetConversationAsync(string id, CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Get, $"/v1/chat/conversations/{Transport.Seg(id)}", null, null, ct);

    /// <summary><c>after</c> imleci <c>cm_…</c> mesaj kimliğidir.</summary>
    public Task<SbResult> ListConversationMessagesAsync(string id, IDictionary<string, object?>? query = null, CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Get, $"/v1/chat/conversations/{Transport.Seg(id)}/messages", null, query, ct);

    /// <summary>Proaktif sohbet — ziyaretçi yazmadan ajan başlatır.</summary>
    public Task<SbResult> StartConversationAsync(object input, CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Post, "/v1/chat/conversations", input, null, ct);

    public Task<SbResult> UpdateConversationAsync(string id, object input, CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Patch, $"/v1/chat/conversations/{Transport.Seg(id)}", input, null, ct);

    public Task<SbResult> SetConversationStatusAsync(string id, string status, CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Post, $"/v1/chat/conversations/{Transport.Seg(id)}/status", new { status }, null, ct);

    /// <summary><paramref name="userId"/> boşsa anahtarın sahibine atanır.</summary>
    public Task<SbResult> AssignConversationAsync(string id, int? userId = null, CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Post, $"/v1/chat/conversations/{Transport.Seg(id)}/assign", new { user_id = userId }, null, ct);

    public Task<SbResult> ReadConversationAsync(string id, string? lastMessageId = null, CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Post, $"/v1/chat/conversations/{Transport.Seg(id)}/read", new { last_message_id = lastMessageId }, null, ct);

    public Task<SbResult> SetTypingAsync(string id, bool isTyping, CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Post, $"/v1/chat/conversations/{Transport.Seg(id)}/typing", new { is_typing = isTyping }, null, ct);

    /// <summary><c>is_internal</c> true ise iç nottur ve ziyaretçiye ASLA gitmez.</summary>
    public Task<SbResult> ReplyAsync(string id, object input, CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Post, $"/v1/chat/conversations/{Transport.Seg(id)}/messages", input, null, ct);

    public Task<SbResult> EditChatMessageAsync(string id, string messageId, string body, CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Patch, $"/v1/chat/conversations/{Transport.Seg(id)}/messages/{Transport.Seg(messageId)}", new { body }, null, ct);

    public Task<SbResult> DeleteChatMessageAsync(string id, string messageId, CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Delete, $"/v1/chat/conversations/{Transport.Seg(id)}/messages/{Transport.Seg(messageId)}", null, null, ct);

    /// <summary>Aynı emoji ikinci kez gönderilirse tepki kaldırılır.</summary>
    public Task<SbResult> ReactToChatMessageAsync(string id, string messageId, string emoji, CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Post, $"/v1/chat/conversations/{Transport.Seg(id)}/messages/{Transport.Seg(messageId)}/reactions", new { emoji }, null, ct);

    // ── Sohbet: ziyaretçi ve hazır yanıtlar ──────────────────────────────

    public Task<SbResult> GetVisitorAsync(string id, CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Get, $"/v1/chat/visitors/{Transport.Seg(id)}", null, null, ct);

    public Task<SbResult> UpdateVisitorAsync(string id, object input, CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Patch, $"/v1/chat/visitors/{Transport.Seg(id)}", input, null, ct);

    public Task<SbResult> BanVisitorAsync(string id, CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Post, $"/v1/chat/visitors/{Transport.Seg(id)}/ban", null, null, ct);

    public Task<SbResult> ListCannedRepliesAsync(CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Get, "/v1/chat/canned-replies", null, null, ct);

    public Task<SbResult> CreateCannedReplyAsync(object input, CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Post, "/v1/chat/canned-replies", input, null, ct);

    public Task<SbResult> UpdateCannedReplyAsync(object id, object input, CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Patch, $"/v1/chat/canned-replies/{Transport.Seg(id)}", input, null, ct);

    public Task<SbResult> DeleteCannedReplyAsync(object id, CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Delete, $"/v1/chat/canned-replies/{Transport.Seg(id)}", null, null, ct);

    // ── Sohbet: tetikleyiciler ────────────────────────────────────────────
    // "Şu olduğunda şunu yap." Kural KAYITTA durur, kodda değil.

    public Task<SbResult> ListChatTriggersAsync(CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Get, "/v1/chat/triggers", null, null, ct);

    public Task<SbResult> CreateChatTriggerAsync(object input, CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Post, "/v1/chat/triggers", input, null, ct);

    public Task<SbResult> UpdateChatTriggerAsync(object id, object input, CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Patch, $"/v1/chat/triggers/{Transport.Seg(id)}", input, null, ct);

    public Task<SbResult> DeleteChatTriggerAsync(object id, CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Delete, $"/v1/chat/triggers/{Transport.Seg(id)}", null, null, ct);

    // ── Sohbet: rapor ─────────────────────────────────────────────────────

    /// <summary>
    /// Yanıt/çözüm süresi, memnuniyet ve ajan kırılımı.
    /// Veri yoksa süreler null döner — 0 DEĞİL.
    /// </summary>
    public Task<SbResult> ChatReportAsync(string range = "30d", CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Get, "/v1/chat/reports", null,
            new Dictionary<string, object?> { ["range"] = range }, ct);

    // Uygulama uçları KALDIRILDI (1 Eyl 2026): sohbet ve push birer modül
    // anahtarıdır — ListModuleKeysAsync("chat").

    public Task<SbResult> EmbedTokenAsync(IDictionary<string, object?> input, CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Post, "/v1/embed/tokens", input, null, ct);
}
