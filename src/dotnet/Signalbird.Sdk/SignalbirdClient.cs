using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;

namespace Signalbird.Sdk;

/// <summary>Beş seviye. Fazlası eklenmez: kanal ayarını anlaşılır tutar.</summary>
public static class SignalbirdLevel
{
    public const string Debug = "debug";
    public const string Info = "info";
    public const string Warn = "warn";
    public const string Error = "error";
    public const string Critical = "critical";
}

public sealed class SignalbirdOptions
{
    /// <summary>Sunucu anahtarı (<c>sbr_live_…</c>). Tarayıcıya GÖMÜLEMEZ.</summary>
    public string ApiKey { get; set; } = string.Empty;

    public string BaseUrl { get; set; } = "https://live.signalbird.io/api";

    /// <summary>Her olaya eklenen köken adı (sunucu ya da servis adı).</summary>
    public string? Source { get; set; }

    /// <summary>Varsayılan 5 sn — bir log çağrısı isteği bekletmemeli.</summary>
    public TimeSpan Timeout { get; set; } = TimeSpan.FromSeconds(5);

    /// <summary>Varsayılan kapalı: telsiz erişilemezse ödeme akışı çökmemeli.</summary>
    public bool ThrowOnError { get; set; }
}

public sealed class LogEvent
{
    public string Channel { get; set; } = string.Empty;

    public string Message { get; set; } = string.Empty;

    public string? Level { get; set; }

    public IDictionary<string, object?>? Context { get; set; }

    public string? Source { get; set; }
}

/// <summary>
/// Telsiz (Radio) istemcisi — log ve olay yazar.
///
/// <para>Sözleşme: docs/CONTRACT.md § 1–7</para>
/// </summary>
public sealed class SignalbirdClient
{
    private readonly Transport _http;
    private readonly string? _source;

    public SignalbirdClient(SignalbirdOptions options, HttpClient? http = null)
    {
        if (string.IsNullOrEmpty(options.ApiKey))
        {
            throw new SignalbirdException("Signalbird: ApiKey zorunlu.", 0, "NO_KEY");
        }

        // Açık anahtarın sunucuda kullanılması sessiz bir güvenlik hatasıdır:
        // çalışır görünür, sonra kanal kısıtına takılır. Baştan söylüyoruz.
        if (options.ApiKey.StartsWith("sbr_pub_", StringComparison.Ordinal))
        {
            throw new SignalbirdException(
                "Signalbird: sunucu istemcisine tarayıcı anahtarı (sbr_pub_…) verildi. Sunucu anahtarı (sbr_live_…) kullanın.",
                0,
                "WRONG_KEY_TYPE");
        }

        _source = options.Source;
        _http = new Transport(options.ApiKey, options.BaseUrl, options.Timeout, options.ThrowOnError, http);
    }

    /// <summary>Seviye verilmezse kanalın kendi varsayılanı geçerlidir.</summary>
    public Task<SbResult> LogAsync(
        string channel,
        string message,
        string? level = null,
        IDictionary<string, object?>? context = null,
        CancellationToken cancellationToken = default)
        => _http.RequestAsync(
            HttpMethod.Post,
            "/v1/radio/log",
            new LogEvent { Channel = channel, Message = message, Level = level, Context = context, Source = _source },
            null,
            cancellationToken);

    public Task<SbResult> DebugAsync(string channel, string message, IDictionary<string, object?>? context = null, CancellationToken cancellationToken = default)
        => LogAsync(channel, message, SignalbirdLevel.Debug, context, cancellationToken);

    public Task<SbResult> InfoAsync(string channel, string message, IDictionary<string, object?>? context = null, CancellationToken cancellationToken = default)
        => LogAsync(channel, message, SignalbirdLevel.Info, context, cancellationToken);

    public Task<SbResult> WarnAsync(string channel, string message, IDictionary<string, object?>? context = null, CancellationToken cancellationToken = default)
        => LogAsync(channel, message, SignalbirdLevel.Warn, context, cancellationToken);

    public Task<SbResult> ErrorAsync(string channel, string message, IDictionary<string, object?>? context = null, CancellationToken cancellationToken = default)
        => LogAsync(channel, message, SignalbirdLevel.Error, context, cancellationToken);

    public Task<SbResult> CriticalAsync(string channel, string message, IDictionary<string, object?>? context = null, CancellationToken cancellationToken = default)
        => LogAsync(channel, message, SignalbirdLevel.Critical, context, cancellationToken);

    /// <summary>
    /// En fazla 100 kayıt, satır satır sonuç. Kısmi başarı normaldir (kota tam
    /// ortada dolabilir); başarısız satırlar YENİDEN DENENMEZ.
    /// </summary>
    public Task<SbResult> BatchAsync(IEnumerable<LogEvent> events, CancellationToken cancellationToken = default)
    {
        var rows = events.Take(100)
            .Select(e => new LogEvent
            {
                Channel = e.Channel,
                Message = e.Message,
                Level = e.Level,
                Context = e.Context,
                Source = e.Source ?? _source,
            })
            .ToList();

        return _http.RequestAsync(HttpMethod.Post, "/v1/radio/log/batch", new { events = rows }, null, cancellationToken);
    }
}
