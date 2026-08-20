using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;

namespace Signalbird.Sdk;

/// <summary>
/// Partner istemcisinin kurulumu. Anahtar <c>sbp_live_…</c>'dir; takım
/// anahtarı (<c>sb_…</c>) burada çalışmaz.
/// </summary>
public sealed class SignalbirdPartnerOptions
{
    /// <summary>Sözleşmeli partner anahtarı (<c>sbp_live_…</c>). Tarayıcıya İNMEZ.</summary>
    public string ApiKey { get; set; } = string.Empty;

    public string BaseUrl { get; set; } = "https://signalbird.io/api";

    public TimeSpan Timeout { get; set; } = TimeSpan.FromSeconds(15);

    public bool ThrowOnError { get; set; }
}

/// <summary>
/// Partner istemcisi — BEŞİNCİ yüzey.
///
/// <para>
/// Signalbird'ü kendi ürününün içinde satan sözleşmeli platform (veribenim,
/// submitcms) müşterisini bununla sağlar ve yetkilendirir.
/// </para>
///
/// <para>
/// Bu, "Admin yüzeyi OLMAYACAK" kuralının BİLİNÇLİ istisnasıdır ve istisna
/// olduğu için ayrı anahtar türü taşır. Kural, müşterinin kendi anahtarıyla
/// (<c>sb_…</c>) şirket açamaması içindi; o kural aynen duruyor.
/// </para>
///
/// <para>
/// Partner SÜPER YÖNETİCİ DEĞİLDİR: yalnız kendi açtığı company'lere erişir,
/// başkasınınki 404 döner.
/// </para>
///
/// <para>Sözleşme: docs/CONTRACT.md § 12</para>
/// </summary>
public sealed class PartnerClient
{
    private readonly Transport _http;

    public PartnerClient(SignalbirdPartnerOptions options, HttpClient? http = null)
    {
        if (string.IsNullOrEmpty(options.ApiKey))
        {
            throw new SignalbirdException("Signalbird: ApiKey zorunlu.", 0, "NO_KEY");
        }

        if (!options.ApiKey.StartsWith("sbp_live_", StringComparison.Ordinal))
        {
            throw new SignalbirdException(
                "Signalbird: partner istemcisi partner anahtarı ister (sbp_live_…). "
                + "Takım (sb_…), Telsiz (sbr_…) ve uygulama (sbw_pub_…) anahtarları burada çalışmaz.",
                0,
                "WRONG_KEY_TYPE");
        }

        _http = new Transport(options.ApiKey, options.BaseUrl, options.Timeout, options.ThrowOnError, http);
    }

    // ── Müşteri ───────────────────────────────────────────────────────────

    /// <summary>
    /// Company + takım + owner açar. IDEMPOTENTTİR: aynı <c>external_id</c> ile
    /// ikinci çağrı yeni kayıt açmaz. <c>keys</c> yalnız ilk oluşturmada döner.
    /// </summary>
    public Task<SbResult> CreateCompanyAsync(object input, CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Post, "/v1/partner/companies", input, null, ct);

    public Task<SbResult> ListCompaniesAsync(IDictionary<string, object?>? query = null, CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Get, "/v1/partner/companies", null, query, ct);

    public Task<SbResult> GetCompanyAsync(object externalId, CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Get, $"/v1/partner/companies/{Transport.Seg(externalId)}", null, null, ct);

    public Task<SbResult> UpdateCompanyAsync(object externalId, object input, CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Patch, $"/v1/partner/companies/{Transport.Seg(externalId)}", input, null, ct);

    /// <summary>Askıya alır — SİLMEZ. İzleme ve mesaj geçmişi durur.</summary>
    public Task<SbResult> SuspendCompanyAsync(object externalId, CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Delete, $"/v1/partner/companies/{Transport.Seg(externalId)}", null, null, ct);

    public Task<SbResult> RotateKeyAsync(object externalId, string type, CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Post, $"/v1/partner/companies/{Transport.Seg(externalId)}/keys/rotate",
            new Dictionary<string, object?> { ["type"] = type }, null, ct);

    // ── Domain ────────────────────────────────────────────────────────────

    /// <summary>
    /// Domain ekler ve (istenirse) izlemeye alır. Kayıt
    /// <c>verified_via='partner'</c> ile doğar: izleme, sohbet ve push için
    /// yeter — e-posta/SMS KAMPANYASI için TXT şarttır.
    /// </summary>
    public Task<SbResult> AddDomainAsync(object companyExternalId, object input, CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Post, $"/v1/partner/companies/{Transport.Seg(companyExternalId)}/domains", input, null, ct);

    public Task<SbResult> ListDomainsAsync(object companyExternalId, CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Get, $"/v1/partner/companies/{Transport.Seg(companyExternalId)}/domains", null, null, ct);

    public Task<SbResult> GetDomainAsync(object externalId, CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Get, $"/v1/partner/domains/{Transport.Seg(externalId)}", null, null, ct);

    public Task<SbResult> VerifyDomainAsync(object externalId, CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Post, $"/v1/partner/domains/{Transport.Seg(externalId)}/verify", null, null, ct);

    public Task<SbResult> RemoveDomainAsync(object externalId, CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Delete, $"/v1/partner/domains/{Transport.Seg(externalId)}", null, null, ct);

    /// <summary>Hiç kontrol yoksa <c>uptime</c> null döner, %100 DEĞİL.</summary>
    public Task<SbResult> DomainUptimeAsync(object externalId, string range = "24h", CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Get, $"/v1/partner/domains/{Transport.Seg(externalId)}/uptime", null,
            new Dictionary<string, object?> { ["range"] = range }, ct);

    /// <summary>Tek istekte tüm domainler — liste ekranı N+1 atmasın.</summary>
    public Task<SbResult> CompanyUptimeAsync(object companyExternalId, string range = "24h", CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Get, $"/v1/partner/companies/{Transport.Seg(companyExternalId)}/uptime", null,
            new Dictionary<string, object?> { ["range"] = range }, ct);

    // ── Modül yetkisi ─────────────────────────────────────────────────────

    public Task<SbResult> ListModulesAsync(object companyExternalId, CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Get, $"/v1/partner/companies/{Transport.Seg(companyExternalId)}/modules", null, null, ct);

    /// <summary>"Bu müşteri şu modül için ödeme yaptı, kullanabilir."</summary>
    public Task<SbResult> GrantModuleAsync(object companyExternalId, object input, CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Post, $"/v1/partner/companies/{Transport.Seg(companyExternalId)}/modules", input, null, ct);

    /// <summary>Yalnız partner'ın KENDİ verdiği hakkı geri alır; plan hakkına dokunmaz.</summary>
    public Task<SbResult> RevokeModuleAsync(object companyExternalId, string module, CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Delete,
            $"/v1/partner/companies/{Transport.Seg(companyExternalId)}/modules/{Transport.Seg(module)}", null, null, ct);

    // ── Kullanıcı ─────────────────────────────────────────────────────────

    public Task<SbResult> CreateUserAsync(object companyExternalId, object input, CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Post, $"/v1/partner/companies/{Transport.Seg(companyExternalId)}/users", input, null, ct);

    public Task<SbResult> ListUsersAsync(object companyExternalId, CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Get, $"/v1/partner/companies/{Transport.Seg(companyExternalId)}/users", null, null, ct);

    /// <summary>Üyeliği kaldırır, kişinin Signalbird hesabını SİLMEZ.</summary>
    public Task<SbResult> RemoveUserAsync(object companyExternalId, object userExternalId, CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Delete,
            $"/v1/partner/companies/{Transport.Seg(companyExternalId)}/users/{Transport.Seg(userExternalId)}", null, null, ct);

    // ── Gömme ─────────────────────────────────────────────────────────────

    /// <summary>
    /// Panel ekranını partner sayfasına gömmek için kısa ömürlü jeton:
    /// 120 saniye yaşar ve TEK KULLANIMLIKTIR — jeton URL'de gider, log ve
    /// <c>Referer</c> başlığına düşer.
    /// </summary>
    public Task<SbResult> CreateEmbedTokenAsync(object companyExternalId, object input, CancellationToken ct = default)
        => _http.RequestAsync(HttpMethod.Post, $"/v1/partner/companies/{Transport.Seg(companyExternalId)}/embed", input, null, ct);
}
