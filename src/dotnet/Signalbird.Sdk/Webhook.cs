using System;
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
        var expected = Convert.ToHexString(hmac.ComputeHash(rawBody)).ToLowerInvariant();
        var received = signatureHeader[Prefix.Length..];

        return CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(expected),
            Encoding.UTF8.GetBytes(received));
    }
}
