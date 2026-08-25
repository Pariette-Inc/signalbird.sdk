using System;
using System.Globalization;
using System.Security.Cryptography;
using System.Text;

namespace Signalbird.Sdk;

/// <summary>
/// Mesaj olay webhook'larının imza doğrulaması.
///
/// <para>
/// İki kural, ikisi de kritik: doğrulama HAM GÖVDE üzerinde yapılır (modelin
/// deserialize edilip yeniden serialize edilmesi imzayı bozar — ASP.NET
/// Core'da <c>EnableBuffering()</c> ile ham gövdeyi okuyun) ve karşılaştırma
/// sabit zamanlıdır.
/// </para>
///
/// <para>Sözleşme: docs/CONTRACT.md § 8.6</para>
/// </summary>
public static class Webhook
{
    private const string Prefix = "sha256=";

    public static bool Verify(string rawBody, string? signatureHeader, string secret)
        => Verify(Encoding.UTF8.GetBytes(rawBody ?? string.Empty), signatureHeader, secret);

    public static bool Verify(byte[] rawBody, string? signatureHeader, string secret)
    {
        if (string.IsNullOrEmpty(signatureHeader) || string.IsNullOrEmpty(secret))
        {
            return false;
        }

        if (!signatureHeader!.StartsWith(Prefix, StringComparison.Ordinal))
        {
            return false;
        }

        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        var expected = ToHex(hmac.ComputeHash(rawBody));
        var received = signatureHeader.Substring(Prefix.Length);

        return CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(expected),
            Encoding.UTF8.GetBytes(received));
    }

    /// <summary>
    /// Bayt dizisini küçük harf onaltılığa çevirir.
    /// </summary>
    /// <remarks>
    /// <c>Convert.ToHexString</c> .NET 5 ile geldi; `netstandard2.1` hedefinde
    /// yoktur. Elle yazmak, hedefi net8.0'a daraltmaktan ucuz: kütüphaneyi
    /// .NET Framework ve Xamarin tüketicileri de kullanabilsin.
    /// </remarks>
    private static string ToHex(byte[] bytes)
    {
        var builder = new StringBuilder(bytes.Length * 2);

        foreach (var b in bytes)
        {
            builder.Append(b.ToString("x2", CultureInfo.InvariantCulture));
        }

        return builder.ToString();
    }
}
