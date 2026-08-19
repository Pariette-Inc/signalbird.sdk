using System;
using Microsoft.Extensions.DependencyInjection;

namespace Signalbird.Sdk;

/// <summary>
/// ASP.NET Core / Generic Host bağlantısı.
///
/// <para>
/// Üç istemci <c>IHttpClientFactory</c> üzerinden kurulur: her istemcinin kendi
/// <see cref="System.Net.Http.HttpClient"/>'ını <c>new</c>'lemesi soket
/// tükenmesinin klasik sebebidir ve .NET'te en sık yapılan hatadır.
/// </para>
///
/// <code>
/// builder.Services.AddSignalbird(options =>
/// {
///     options.ApiKey = builder.Configuration["Signalbird:RadioKey"]!;
///     options.Source = "api-01";
/// });
///
/// builder.Services.AddSignalbirdManagement(options =>
///     options.ApiKey = builder.Configuration["Signalbird:ApiKey"]!);
/// </code>
/// </summary>
public static class ServiceCollectionExtensions
{
    /// <summary>Telsiz istemcisi (<c>sbr_live_…</c>).</summary>
    public static IServiceCollection AddSignalbird(this IServiceCollection services, Action<SignalbirdOptions> configure)
    {
        var options = new SignalbirdOptions();
        configure(options);

        services.AddHttpClient("signalbird.radio", client => client.Timeout = options.Timeout);

        services.AddSingleton(provider => new SignalbirdClient(
            options,
            provider.GetRequiredService<System.Net.Http.IHttpClientFactory>().CreateClient("signalbird.radio")));

        return services;
    }

    /// <summary>Gönderim istemcisi (<c>sb_…</c>).</summary>
    public static IServiceCollection AddSignalbirdMessaging(this IServiceCollection services, Action<SignalbirdKeyOptions> configure)
    {
        var options = new SignalbirdKeyOptions();
        configure(options);

        services.AddHttpClient("signalbird.messaging", client => client.Timeout = options.Timeout);

        services.AddSingleton(provider => new MessagingClient(
            options,
            provider.GetRequiredService<System.Net.Http.IHttpClientFactory>().CreateClient("signalbird.messaging")));

        return services;
    }

    /// <summary>Yönetim istemcisi (<c>sb_…</c> + <c>radio|chat|apps</c> scope'ları).</summary>
    public static IServiceCollection AddSignalbirdManagement(this IServiceCollection services, Action<SignalbirdKeyOptions> configure)
    {
        var options = new SignalbirdKeyOptions();
        configure(options);

        services.AddHttpClient("signalbird.management", client => client.Timeout = options.Timeout);

        services.AddSingleton(provider => new ManagementClient(
            options,
            provider.GetRequiredService<System.Net.Http.IHttpClientFactory>().CreateClient("signalbird.management")));

        return services;
    }
}
