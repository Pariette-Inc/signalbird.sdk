"""Partner istemcisi — BEŞİNCİ yüzey.

Signalbird'ü kendi ürününün içinde satan sözleşmeli platform (veribenim,
submitcms) müşterisini bununla sağlar ve yetkilendirir.

Bu, "Admin yüzeyi OLMAYACAK" kuralının BİLİNÇLİ istisnasıdır ve istisna
olduğu için ayrı anahtar türü taşır (``sbp_live_…``). Kural, müşterinin kendi
anahtarıyla (``sb_``) şirket açamaması içindi; o kural aynen duruyor.

Partner SÜPER YÖNETİCİ DEĞİLDİR: yalnız kendi açtığı company'lere erişir,
başkasınınki 404 döner.

Sözleşme: docs/CONTRACT.md § 12
"""

from __future__ import annotations

from typing import Any, Mapping, Optional

from ._http import DEFAULT_BASE_URL, Result, SignalbirdError, Transport, seg


class SignalbirdPartner:
    def __init__(
        self,
        api_key: str,
        base_url: Optional[str] = None,
        timeout: float = 15.0,
        throw_on_error: bool = False,
        debug: bool = False,
    ):
        if not api_key:
            raise SignalbirdError("Signalbird: api_key zorunlu.", 0, "NO_KEY")

        if not api_key.startswith("sbp_live_"):
            raise SignalbirdError(
                "Signalbird: partner istemcisi partner anahtarı ister (sbp_live_…). "
                "Takım (sb_…), Telsiz (sbr_…) ve uygulama (sbw_pub_…) anahtarları burada çalışmaz.",
                0,
                "WRONG_KEY_TYPE",
            )

        self._http = Transport(api_key, base_url or DEFAULT_BASE_URL, timeout, throw_on_error, debug)

    # ── Müşteri ──────────────────────────────────────────────────────────

    def create_company(self, input: Mapping[str, Any]) -> Result:
        """Company + takım + owner açar. **Idempotenttir**: aynı ``external_id``
        ile ikinci çağrı yeni kayıt açmaz. ``keys`` yalnız ilk oluşturmada döner.
        """
        return self._http.request("POST", "/v1/partner/companies", input)

    def list_companies(self, query: Optional[Mapping[str, Any]] = None) -> Result:
        return self._http.request("GET", "/v1/partner/companies", None, query)

    def get_company(self, external_id: str) -> Result:
        return self._http.request("GET", f"/v1/partner/companies/{seg(external_id)}")

    def update_company(self, external_id: str, input: Mapping[str, Any]) -> Result:
        return self._http.request("PATCH", f"/v1/partner/companies/{seg(external_id)}", input)

    def suspend_company(self, external_id: str) -> Result:
        """Askıya alır — SİLMEZ. İzleme ve mesaj geçmişi durur."""
        return self._http.request("DELETE", f"/v1/partner/companies/{seg(external_id)}")

    def rotate_key(self, external_id: str, type: str) -> Result:
        return self._http.request(
            "POST", f"/v1/partner/companies/{seg(external_id)}/keys/rotate", {"type": type}
        )

    # ── Domain ───────────────────────────────────────────────────────────

    def add_domain(self, company_external_id: str, input: Mapping[str, Any]) -> Result:
        """Domain ekler ve (istenirse) izlemeye alır.

        Kayıt ``verified_via='partner'`` ile doğar: izleme, sohbet ve push için
        yeter — **e-posta/SMS kampanyası için TXT şarttır**. Yanıttaki ``dns``
        kaydını yayınlayıp :meth:`verify_domain` çağırmak kapıyı açar.
        """
        return self._http.request("POST", f"/v1/partner/companies/{seg(company_external_id)}/domains", input)

    def list_domains(self, company_external_id: str) -> Result:
        return self._http.request("GET", f"/v1/partner/companies/{seg(company_external_id)}/domains")

    def get_domain(self, external_id: str) -> Result:
        return self._http.request("GET", f"/v1/partner/domains/{seg(external_id)}")

    def verify_domain(self, external_id: str) -> Result:
        return self._http.request("POST", f"/v1/partner/domains/{seg(external_id)}/verify")

    def remove_domain(self, external_id: str) -> Result:
        return self._http.request("DELETE", f"/v1/partner/domains/{seg(external_id)}")

    def domain_uptime(self, external_id: str, range: str = "24h") -> Result:
        return self._http.request(
            "GET", f"/v1/partner/domains/{seg(external_id)}/uptime", None, {"range": range}
        )

    def company_uptime(self, company_external_id: str, range: str = "24h") -> Result:
        """Tek istekte tüm domainler — liste ekranı N+1 atmasın."""
        return self._http.request(
            "GET", f"/v1/partner/companies/{seg(company_external_id)}/uptime", None, {"range": range}
        )

    # ── Mesaj günlüğü ────────────────────────────────────────────────────
    # Salt okur; alıcı maskeli, gövde yok (MESSAGING_UNIFICATION §5.1).

    def list_messages(self, company_external_id: str, query: dict | None = None) -> Result:
        return self._http.request(
            "GET", f"/v1/partner/companies/{seg(company_external_id)}/messages", None, query or {}
        )

    def get_message(self, company_external_id: str, message_id: str) -> Result:
        return self._http.request(
            "GET", f"/v1/partner/companies/{seg(company_external_id)}/messages/{seg(message_id)}"
        )

    def message_summary(self, company_external_id: str, range: str = "7d") -> Result:
        return self._http.request(
            "GET", f"/v1/partner/companies/{seg(company_external_id)}/message-summary", None, {"range": range}
        )

    # ── Modül yetkisi ────────────────────────────────────────────────────

    def list_modules(self, company_external_id: str) -> Result:
        return self._http.request("GET", f"/v1/partner/companies/{seg(company_external_id)}/modules")

    def grant_module(self, company_external_id: str, input: Mapping[str, Any]) -> Result:
        """"Bu müşteri şu modül için ödeme yaptı, kullanabilir." """
        return self._http.request("POST", f"/v1/partner/companies/{seg(company_external_id)}/modules", input)

    def revoke_module(self, company_external_id: str, module: str) -> Result:
        """Yalnız partner'ın KENDİ verdiği hakkı geri alır; plan hakkına dokunmaz."""
        return self._http.request(
            "DELETE", f"/v1/partner/companies/{seg(company_external_id)}/modules/{seg(module)}"
        )

    # ── Kullanıcı ────────────────────────────────────────────────────────

    def create_user(self, company_external_id: str, input: Mapping[str, Any]) -> Result:
        return self._http.request("POST", f"/v1/partner/companies/{seg(company_external_id)}/users", input)

    def list_users(self, company_external_id: str) -> Result:
        return self._http.request("GET", f"/v1/partner/companies/{seg(company_external_id)}/users")

    def remove_user(self, company_external_id: str, user_external_id: str) -> Result:
        """Üyeliği kaldırır, kişinin Signalbird hesabını SİLMEZ."""
        return self._http.request(
            "DELETE",
            f"/v1/partner/companies/{seg(company_external_id)}/users/{seg(user_external_id)}",
        )

    # ── Gömme ────────────────────────────────────────────────────────────

    def create_embed_token(self, company_external_id: str, input: Mapping[str, Any]) -> Result:
        """Panel ekranını partner sayfasına gömmek için kısa ömürlü jeton.

        120 saniye yaşar ve TEK KULLANIMLIKTIR — jeton URL'de gider, log ve
        ``Referer`` başlığına düşer.
        """
        return self._http.request("POST", f"/v1/partner/companies/{seg(company_external_id)}/embed", input)
