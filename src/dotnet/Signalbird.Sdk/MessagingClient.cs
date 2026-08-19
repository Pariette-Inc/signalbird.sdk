using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;

namespace Signalbird.Sdk;

public sealed class SignalbirdKeyOptions
{
    /// <summary>Takım API anahtarı (<c>sb_…</c>). Telsiz anahtarı burada çalışmaz.</summary>
    public string ApiKey { get; set; } = string.Empty;

    public string BaseUrl { get; set; } = "https://signalbird.io/api";

    /// <summary>Varsayılan 15 sn — toplu kişi yükleme uzun sürebilir.</summary>
    public TimeSpan Timeout { get; set; } = TimeSpan.FromSeconds(15);

    public bool ThrowOnError { get; set; }
}

/// <summary>
/// Gönderim (Messaging) istemcisi: e-posta/SMS/push, kişi, liste, kampanya, mesaj.
///
/// <para>
/// <c>class</c> alanı (<c>transactional</c> | <c>commercial</c>) ZORUNLUDUR ve
/// varsayılanı yoktur — hukuki kapı çağıranın elindedir.
/// </para>
///
/// <para>Sözleşme: docs/CONTRACT.md § 8</para>
/// </summary>
public sealed class MessagingClient
{
    /// <summary>Toplu kişi yüklemede tek istekteki üst sınır.</summary>
    public const int BulkChunk = 1000;

    private readonly Transport _http;

    public MessagingClient(SignalbirdKeyOptions options, HttpClient? http = null)
    {
        _http = KeyTransport.Create(options, "gönderim", http);
    }

    // ── Gönderim ─────────────────────────────────────────────────────────

    public Task<SbResult> SendEmailAsync(object input, CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Post, "/v1/email/send", input, null, ct);

    public Task<SbResult> SendSmsAsync(object input, CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Post, "/v1/sms/send", input, null, ct);

    /// <summary>Parça/karakter hesabı — kota harcamaz.</summary>
    public Task<SbResult> PreviewSmsAsync(string body, CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Post, "/v1/sms/preview", new { body }, null, ct);

    public Task<SbResult> SendPushAsync(object input, CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Post, "/v1/push/send", input, null, ct);

    // ── Kişiler ──────────────────────────────────────────────────────────

    public Task<SbResult> ListContactsAsync(IDictionary<string, object?>? query = null, CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Get, "/v1/contacts", null, query, ct);

    public Task<SbResult> CreateContactAsync(object contact, CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Post, "/v1/contacts", contact, null, ct);

    public Task<SbResult> UpdateContactAsync(object id, object contact, CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Patch, $"/v1/contacts/{Transport.Seg(id)}", contact, null, ct);

    public Task<SbResult> DeleteContactAsync(object id, CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Delete, $"/v1/contacts/{Transport.Seg(id)}", null, null, ct);

    /// <summary>
    /// 1000'lik parçalar hâlinde SIRAYLA yükler — paralel değil: aynı e-posta
    /// iki parçadaysa yarış olmasın. Bir parça başarısız olursa o noktada durulur.
    /// </summary>
    public async Task<SbResult> BulkContactsAsync(
        IEnumerable<object> contacts,
        IDictionary<string, object?>? extra = null,
        CancellationToken ct = default)
    {
        var rows = contacts.ToList();

        if (rows.Count == 0)
        {
            return new SbResult { Ok = true, Status = 200 };
        }

        SbResult last = new() { Ok = true, Status = 200 };

        for (var start = 0; start < rows.Count; start += BulkChunk)
        {
            var chunk = rows.Skip(start).Take(BulkChunk).ToList();
            var payload = new Dictionary<string, object?>(extra ?? new Dictionary<string, object?>())
            {
                ["contacts"] = chunk,
            };

            last = await _http.RequestAsync(HttpMethod.Post, "/v1/contacts/bulk", payload, null, ct).ConfigureAwait(false);

            if (!last.Ok)
            {
                return last;
            }
        }

        return last;
    }

    // ── Listeler ─────────────────────────────────────────────────────────

    public Task<SbResult> ListContactListsAsync(CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Get, "/v1/contact-lists", null, null, ct);

    public Task<SbResult> CreateContactListAsync(object input, CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Post, "/v1/contact-lists", input, null, ct);

    public Task<SbResult> DeleteContactListAsync(object id, CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Delete, $"/v1/contact-lists/{Transport.Seg(id)}", null, null, ct);

    // ── Kampanyalar ──────────────────────────────────────────────────────

    public Task<SbResult> ListCampaignsAsync(IDictionary<string, object?>? query = null, CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Get, "/v1/campaigns", null, query, ct);

    /// <summary>Buradan çıkan her ileti ZORUNLU <c>commercial</c>'dır.</summary>
    public Task<SbResult> CreateCampaignAsync(object input, CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Post, "/v1/campaigns", input, null, ct);

    public Task<SbResult> GetCampaignAsync(object id, CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Get, $"/v1/campaigns/{Transport.Seg(id)}", null, null, ct);

    public Task<SbResult> CancelCampaignAsync(object id, CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Post, $"/v1/campaigns/{Transport.Seg(id)}/cancel", null, null, ct);

    public Task<SbResult> ListCampaignMessagesAsync(object id, IDictionary<string, object?>? query = null, CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Get, $"/v1/campaigns/{Transport.Seg(id)}/messages", null, query, ct);

    /// <summary>
    /// Sayfaları gezer; büyük kampanyada tüm listeyi belleğe almaz.
    /// </summary>
    public async IAsyncEnumerable<System.Text.Json.JsonElement> IterateCampaignMessagesAsync(
        object id,
        IDictionary<string, object?>? query = null,
        [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken ct = default)
    {
        var page = 1;

        while (true)
        {
            var current = new Dictionary<string, object?>(query ?? new Dictionary<string, object?>())
            {
                ["page"] = page,
            };

            var result = await ListCampaignMessagesAsync(id, current, ct).ConfigureAwait(false);

            if (!result.Ok || result.Data is null)
            {
                yield break;
            }

            if (!result.Data.Value.TryGetProperty("data", out var rows) ||
                rows.ValueKind != System.Text.Json.JsonValueKind.Array)
            {
                yield break;
            }

            var count = 0;

            foreach (var row in rows.EnumerateArray())
            {
                count++;
                yield return row;
            }

            var lastPage = result.Data.Value.TryGetProperty("last_page", out var last) && last.ValueKind == System.Text.Json.JsonValueKind.Number
                ? last.GetInt32()
                : 0;

            if (count == 0 || (lastPage > 0 && page >= lastPage))
            {
                yield break;
            }

            page++;
        }
    }

    // ── Mesajlar ─────────────────────────────────────────────────────────

    public Task<SbResult> ListMessagesAsync(IDictionary<string, object?>? query = null, CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Get, "/v1/messages", null, query, ct);

    public Task<SbResult> GetMessageAsync(string id, CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Get, $"/v1/messages/{Transport.Seg(id)}", null, null, ct);
}

internal static class KeyTransport
{
    /// <summary>
    /// Takım anahtarını doğrular ve taşımayı kurar.
    ///
    /// <para>
    /// Telsiz (<c>sbr_</c>) ya da uygulama (<c>sbw_pub_</c>) anahtarı verilirse
    /// her istek 401 döner; kurulum anında söylemek haftalar sonra bulunacak
    /// hatayı önler.
    /// </para>
    /// </summary>
    internal static Transport Create(SignalbirdKeyOptions options, string surface, HttpClient? http)
    {
        if (string.IsNullOrEmpty(options.ApiKey))
        {
            throw new SignalbirdException("Signalbird: ApiKey zorunlu.", 0, "NO_KEY");
        }

        if (!options.ApiKey.StartsWith("sb_", StringComparison.Ordinal))
        {
            throw new SignalbirdException(
                $"Signalbird: {surface} istemcisi takım API anahtarı ister (sb_…). Telsiz (sbr_…) ve uygulama (sbw_pub_…) anahtarları burada çalışmaz.",
                0,
                "WRONG_KEY_TYPE");
        }

        return new Transport(options.ApiKey, options.BaseUrl, options.Timeout, options.ThrowOnError, http);
    }
}
