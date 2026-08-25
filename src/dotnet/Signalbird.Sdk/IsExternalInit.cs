// `init` erişimcisi için derleyici desteği (netstandard hedefleri).
//
// `public int Ok { get; init; }` yazmak, derleyicinin
// `System.Runtime.CompilerServices.IsExternalInit` tipini görmesini gerektirir.
// Bu tip .NET 5 ile BCL'e girdi; `netstandard2.1` hedefinde YOKTUR ve derleme
// "CS0518: Predefined type ... is not defined" ile kırılır.
//
// Çözüm, .NET ekibinin kendi önerdiği yoldur: tipi kütüphane içinde `internal`
// olarak tanımlamak. `internal` olması şart — `public` olsaydı tüketicinin
// projesinde aynı tiple çakışır ve bu kez ONUN derlemesi kırılırdı.
//
// Koşul `!NET5_0_OR_GREATER`: net8.0 hedefinde tip zaten BCL'de var ve ikinci
// bir tanım "duplicate definition" hatası verir.
#if !NET5_0_OR_GREATER

// ReSharper disable once CheckNamespace
namespace System.Runtime.CompilerServices
{
    using System.ComponentModel;

    /// <summary>Derleyicinin `init` erişimcisi için aradığı işaret tipi.</summary>
    [EditorBrowsable(EditorBrowsableState.Never)]
    internal static class IsExternalInit
    {
    }
}

#endif
