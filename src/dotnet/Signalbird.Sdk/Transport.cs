using System;
using System.Collections;
using System.Collections.Generic;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace Signalbird.Sdk;

/// <summary>
/// Her metodun döndüğü zarf. Başarısızlık istisna değil, veridir: bir logu
/// gönderememek ya da bir kaydı okuyamamak uygulamanın ASIL işini
/// durdurmamalı.
/// </summary>
public sealed class SbResult
{
    public bool Ok { get; init; }

    public int Status { get; init; }

    /// <summary>Ham JSON gövde. <see cref="Into{T}"/> ile çözülür.</summary>
    public JsonElement? Data { get; init; }

    public string? Code { get; init; }

    public string? Message { get; init; }

    /// <summary>Gövdeyi verilen tipe çözer; gövde yoksa <c>default</c>.</summary>
    public T? Into<T>()
    {
        if (Data is null)
        {
            return default;
        }

        return Data.Value.Deserialize<T>(SignalbirdJson.Options);
    }
}

/// <summary><c>ThrowOnError</c> açıkken fırlatılır.</summary>
public sealed class SignalbirdException : Exception
{
    public SignalbirdException(string message, int status = 0, string? code = null, string? body = null)
        : base(message)
    {
        Status = status;
        Code = code;
        Body = body;
    }

    public int Status { get; }

    public string? Code { get; }

    public string? Body { get; }
}

internal static class SignalbirdJson
{
    internal static readonly JsonSerializerOptions Options = new()
    {
        PropertyNameCaseInsensitive = true,
        // Alan adları API ile BİREBİR aynıdır (snake_case); SDK yeniden
        // adlandırmaz, çünkü belgede görülen adın kodda başka olması
        // kazandırdığı zamandan fazlasını götürür.
        DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull,
    };
}

/// <summary>
/// Anahtarlı istemcilerin ortak HTTP katmanı.
///
/// <para>
/// <see cref="HttpClient"/> dışarıdan verilebilir: ASP.NET Core'da
/// <c>IHttpClientFactory</c> zaten bağlantı havuzunu yönetir ve her istemcinin
/// kendi <see cref="HttpClient"/>'ını kurması soket tükenmesinin klasik
/// sebebidir.
/// </para>
/// </summary>
internal sealed class Transport
{
    private readonly HttpClient _http;
    private readonly string _apiKey;
    private readonly string _baseUrl;
    private readonly bool _throwOnError;

    internal Transport(string apiKey, string baseUrl, TimeSpan timeout, bool throwOnError, HttpClient? http = null)
    {
        _apiKey = apiKey;
        _baseUrl = baseUrl.TrimEnd('/');
        _throwOnError = throwOnError;
        _http = http ?? new HttpClient();

        if (http is null)
        {
            _http.Timeout = timeout;
        }
    }

    internal async Task<SbResult> RequestAsync(
        HttpMethod method,
        string path,
        object? body = null,
        IDictionary<string, object?>? query = null,
        CancellationToken cancellationToken = default)
    {
        using var request = new HttpRequestMessage(method, _baseUrl + path + BuildQuery(query));
        request.Headers.TryAddWithoutValidation("Accept", "application/json");
        request.Headers.TryAddWithoutValidation("Authorization", "Bearer " + _apiKey);

        if (body is not null)
        {
            var json = JsonSerializer.Serialize(body, SignalbirdJson.Options);
            request.Content = new StringContent(json, Encoding.UTF8, "application/json");
        }

        HttpResponseMessage response;

        try
        {
            response = await _http.SendAsync(request, cancellationToken).ConfigureAwait(false);
        }
        catch (TaskCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            return Fail(0, "TIMEOUT", "request timed out", null);
        }
        catch (HttpRequestException error)
        {
            return Fail(0, "NETWORK_ERROR", error.Message, null);
        }

        using (response)
        {
            // `ReadAsStringAsync(CancellationToken)` aşırı yüklemesi .NET 5 ile
            // geldi; `netstandard2.1` hedefinde yalnız parametresiz sürüm var.
            // Gövde okuması zaten istek zaman aşımının içindedir, iptal
            // edilebilirlik burada kaybolmuyor.
#if NET5_0_OR_GREATER
            var text = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
#else
            var text = await response.Content.ReadAsStringAsync().ConfigureAwait(false);
#endif
            JsonElement? data = null;

            if (!string.IsNullOrWhiteSpace(text))
            {
                try
                {
                    data = JsonDocument.Parse(text).RootElement.Clone();
                }
                catch (JsonException)
                {
                    data = null;
                }
            }

            var status = (int)response.StatusCode;

            if (response.IsSuccessStatusCode)
            {
                return new SbResult { Ok = true, Status = status, Data = data };
            }

            // API `{message, code}` döner; Laravel doğrulama hatası `{message,
            // errors}` döner (kodsuz) — onu VALIDATION_ERROR sayarız.
            var code = ReadString(data, "code")
                       ?? status switch
                       {
                           422 => "VALIDATION_ERROR",
                           401 => "API_KEY_INVALID",
                           _ => $"HTTP_{status}",
                       };

            var message = ReadString(data, "message") ?? $"HTTP {status}";

            return Fail(status, code, message, text);
        }
    }

    private SbResult Fail(int status, string code, string message, string? body)
    {
        if (_throwOnError)
        {
            throw new SignalbirdException($"Signalbird: {code} — {message}", status, code, body);
        }

        return new SbResult { Ok = false, Status = status, Code = code, Message = message };
    }

    private static string? ReadString(JsonElement? data, string property)
    {
        if (data is null || data.Value.ValueKind != JsonValueKind.Object)
        {
            return null;
        }

        if (!data.Value.TryGetProperty(property, out var value) || value.ValueKind != JsonValueKind.String)
        {
            return null;
        }

        var text = value.GetString();

        return string.IsNullOrEmpty(text) ? null : text;
    }

    /// <summary><c>null</c> alanlar atlanır; diziler <c>key[]=</c> biçiminde gider.</summary>
    internal static string BuildQuery(IDictionary<string, object?>? query)
    {
        if (query is null || query.Count == 0)
        {
            return string.Empty;
        }

        var pairs = new List<string>();

        foreach (var pair in query)
        {
            if (pair.Value is null)
            {
                continue;
            }

            if (pair.Value is string text)
            {
                pairs.Add(Encode(pair.Key) + "=" + Encode(text));
                continue;
            }

            if (pair.Value is IEnumerable items and not string)
            {
                foreach (var item in items)
                {
                    pairs.Add(Encode(pair.Key + "[]") + "=" + Encode(Stringify(item)));
                }

                continue;
            }

            pairs.Add(Encode(pair.Key) + "=" + Encode(Stringify(pair.Value)));
        }

        return pairs.Count == 0 ? string.Empty : "?" + string.Join("&", pairs);
    }

    private static string Stringify(object? value) => value switch
    {
        null => string.Empty,
        bool flag => flag ? "true" : "false",
        _ => value.ToString() ?? string.Empty,
    };

    private static string Encode(string value) => Uri.EscapeDataString(value);

    /// <summary>Yol parçası — kimlikler URL'e gömülmeden önce kodlanır.</summary>
    internal static string Seg(object value) => Uri.EscapeDataString(value.ToString() ?? string.Empty);
}
