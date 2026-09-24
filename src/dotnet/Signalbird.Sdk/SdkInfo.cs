using System;
using System.Linq;
using System.Net.Http;
using System.Threading;

namespace Signalbird.Sdk;

/// <summary>
/// SDK sürümü ve sürüm bildirimi (docs/CONTRACT.md § 14).
///
/// Her istek <c>X-Signalbird-Sdk: dotnet/&lt;sürüm&gt;</c> taşır. API yanıtta
/// <c>Signalbird-Sdk-Status</c> (current | outdated | unsupported) döner;
/// SDK eskiyse süreç başına BİR KEZ standart hata akışına uyarı yazılır.
/// İstisna fırlatılmaz, istek sonucu değişmez.
///
/// <see cref="Version"/> satırını <c>scripts/sync-version.mjs</c> kökteki
/// VERSION dosyasından yazar - elle değiştirmeyin.
/// </summary>
public static class SdkInfo
{
    /// <summary>Kurulu SDK sürümü.</summary>
    public const string Version = "2.7.0";

    internal const string Header = "X-Signalbird-Sdk";

    internal static string HeaderValue => "dotnet/" + Version;

    private static int _warned;

    internal static void Note(HttpResponseMessage response)
    {
        try
        {
            if (Volatile.Read(ref _warned) == 1
                || !response.Headers.TryGetValues("Signalbird-Sdk-Status", out var values))
            {
                return;
            }

            var status = values.FirstOrDefault();

            if (status != "outdated" && status != "unsupported")
            {
                return;
            }

            if (Interlocked.Exchange(ref _warned, 1) == 1)
            {
                return;
            }

            var latest = response.Headers.TryGetValues("Signalbird-Sdk-Latest", out var l) ? l.FirstOrDefault() ?? "?" : "?";

            Console.Error.WriteLine(status == "unsupported"
                ? $"[signalbird] Bu SDK sürümü ({Version}) artık desteklenmiyor. Son sürüm: {latest}. dotnet add package Signalbird.Sdk"
                : $"[signalbird] Yeni SDK sürümü var: {latest} (kurulu: {Version}).");
        }
        catch
        {
            // uyarı isteği asla bozmamalı
        }
    }
}
