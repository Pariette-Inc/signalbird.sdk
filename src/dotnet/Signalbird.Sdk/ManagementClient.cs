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

    public Task<SbResult> ListRadioProjectsAsync(CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Get, "/v1/radio/projects", null, null, ct);

    /// <summary>
    /// Dönen <c>secret</c> (<c>sbr_live_…</c>) YALNIZ burada görünür: sunucuda
    /// yalnız SHA-256 özeti saklanır.
    /// </summary>
    public Task<SbResult> CreateRadioProjectAsync(object input, CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Post, "/v1/radio/projects", input, null, ct);

    public Task<SbResult> GetRadioProjectAsync(object id, CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Get, $"/v1/radio/projects/{Transport.Seg(id)}", null, null, ct);

    public Task<SbResult> UpdateRadioProjectAsync(object id, object input, CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Patch, $"/v1/radio/projects/{Transport.Seg(id)}", input, null, ct);

    public Task<SbResult> DeleteRadioProjectAsync(object id, CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Delete, $"/v1/radio/projects/{Transport.Seg(id)}", null, null, ct);

    /// <summary>Gizli anahtarı yeniler; eski anahtar ANINDA geçersizleşir.</summary>
    public Task<SbResult> RotateRadioSecretAsync(object id, CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Post, $"/v1/radio/projects/{Transport.Seg(id)}/rotate", null, null, ct);

    // ── Telsiz: kanallar ─────────────────────────────────────────────────

    public Task<SbResult> CreateRadioChannelAsync(object projectId, object input, CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Post, $"/v1/radio/projects/{Transport.Seg(projectId)}/channels", input, null, ct);

    /// <summary><c>key</c> DEĞİŞMEZ — müşterinin kodundaki kanal adı ona bağlıdır.</summary>
    public Task<SbResult> UpdateRadioChannelAsync(object projectId, object channelId, object input, CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Patch, $"/v1/radio/projects/{Transport.Seg(projectId)}/channels/{Transport.Seg(channelId)}", input, null, ct);

    public Task<SbResult> DeleteRadioChannelAsync(object projectId, object channelId, CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Delete, $"/v1/radio/projects/{Transport.Seg(projectId)}/channels/{Transport.Seg(channelId)}", null, null, ct);

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

    // ── Uygulamalar ──────────────────────────────────────────────────────

    public Task<SbResult> ListAppsAsync(CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Get, "/v1/apps", null, null, ct);

    /// <summary>Yanıttaki <c>public_key</c> (<c>sbw_pub_…</c>) istemciye gömülür.</summary>
    public Task<SbResult> CreateAppAsync(object input, CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Post, "/v1/apps", input, null, ct);

    public Task<SbResult> GetAppAsync(object id, CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Get, $"/v1/apps/{Transport.Seg(id)}", null, null, ct);

    public Task<SbResult> UpdateAppAsync(object id, object input, CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Patch, $"/v1/apps/{Transport.Seg(id)}", input, null, ct);

    public Task<SbResult> DeleteAppAsync(object id, CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Delete, $"/v1/apps/{Transport.Seg(id)}", null, null, ct);

    /// <summary>Siteye gömülü eski anahtar ANINDA çalışmaz olur.</summary>
    public Task<SbResult> RotateAppKeyAsync(object id, CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Post, $"/v1/apps/{Transport.Seg(id)}/rotate-key", null, null, ct);

    public Task<SbResult> ListAppDevicesAsync(object id, IDictionary<string, object?>? query = null, CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Get, $"/v1/apps/{Transport.Seg(id)}/devices", null, query, ct);
}
