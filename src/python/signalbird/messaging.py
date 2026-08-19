"""Gönderim (Messaging) istemcisi — sunucu tarafı.

Takım API anahtarıyla (``sb_…``) e-posta/SMS/push gönderir, kişi ve liste
yönetir, kampanya açar, mesaj durumlarını okur.

Metot adları diğer dillerle birebir aynıdır; Python'da snake_case yazılır
(``send_email`` ↔ ``sendEmail``) — bir dilin kendi yazım geleneğini bozmak,
paritenin sağladığı kolaylıktan fazlasını götürür.

Sözleşme: docs/CONTRACT.md § 8
"""

from __future__ import annotations

from typing import Any, Iterator, Mapping, Optional, Sequence

from ._http import DEFAULT_BASE_URL, Result, SignalbirdError, Transport, seg

BULK_CHUNK = 1000


class SignalbirdMessaging:
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

        # Telsiz (`sbr_`) ya da uygulama (`sbw_pub_`) anahtarı buraya verilirse
        # her istek 401 döner; kurulumda söylemek haftalar sonra bulunacak
        # hatayı önler.
        if not api_key.startswith("sb_"):
            raise SignalbirdError(
                "Signalbird: gönderim istemcisi takım API anahtarı ister (sb_…).",
                0,
                "WRONG_KEY_TYPE",
            )

        self._http = Transport(api_key, base_url or DEFAULT_BASE_URL, timeout, throw_on_error, debug)

    # ── Gönderim ─────────────────────────────────────────────────────────

    def send_email(self, input: Mapping[str, Any]) -> Result:
        return self._http.request("POST", "/v1/email/send", input)

    def send_sms(self, input: Mapping[str, Any]) -> Result:
        return self._http.request("POST", "/v1/sms/send", input)

    def preview_sms(self, body: str) -> Result:
        """SMS parça/karakter hesabı — kota harcamaz."""
        return self._http.request("POST", "/v1/sms/preview", {"body": body})

    def send_push(self, input: Mapping[str, Any]) -> Result:
        return self._http.request("POST", "/v1/push/send", input)

    # ── Kişiler ──────────────────────────────────────────────────────────

    def list_contacts(self, query: Optional[Mapping[str, Any]] = None) -> Result:
        return self._http.request("GET", "/v1/contacts", None, query)

    def create_contact(self, contact: Mapping[str, Any]) -> Result:
        return self._http.request("POST", "/v1/contacts", contact)

    def update_contact(self, id: Any, contact: Mapping[str, Any]) -> Result:
        return self._http.request("PATCH", f"/v1/contacts/{seg(id)}", contact)

    def delete_contact(self, id: Any) -> Result:
        return self._http.request("DELETE", f"/v1/contacts/{seg(id)}")

    def bulk_contacts(self, input: Mapping[str, Any]) -> Result:
        """1000'lik parçalar hâlinde SIRAYLA yükler.

        Paralel değil: aynı e-posta iki parçadaysa yarış olmasın. Bir parça
        başarısız olursa o noktada durulur ve o ana kadar biriken sayımlar
        döner — yarısı yüklenmiş bir listeyi "başarısız" diye atmak, hangi
        kişinin girdiğini bilmemek demektir.
        """
        contacts: Sequence[Mapping[str, Any]] = list(input.get("contacts") or [])
        rest = {key: value for key, value in input.items() if key != "contacts"}

        totals = {"imported": 0, "updated": 0, "skipped": []}

        if not contacts:
            return Result(ok=True, status=200, data=totals, code=None, message=None)

        for start in range(0, len(contacts), BULK_CHUNK):
            chunk = contacts[start : start + BULK_CHUNK]
            result = self._http.request("POST", "/v1/contacts/bulk", {**rest, "contacts": list(chunk)})

            if not result.ok:
                return Result(
                    ok=False,
                    status=result.status,
                    data=totals,
                    code=result.code,
                    message=result.message,
                )

            data = result.data if isinstance(result.data, dict) else {}
            totals["imported"] += int(data.get("imported") or 0)
            totals["updated"] += int(data.get("updated") or 0)
            totals["skipped"].extend(data.get("skipped") or [])

        return Result(ok=True, status=200, data=totals, code=None, message=None)

    # ── Listeler ─────────────────────────────────────────────────────────

    def list_contact_lists(self) -> Result:
        return self._http.request("GET", "/v1/contact-lists")

    def create_contact_list(self, input: Mapping[str, Any]) -> Result:
        return self._http.request("POST", "/v1/contact-lists", input)

    def delete_contact_list(self, id: Any) -> Result:
        return self._http.request("DELETE", f"/v1/contact-lists/{seg(id)}")

    # ── Kampanyalar ──────────────────────────────────────────────────────

    def list_campaigns(self, query: Optional[Mapping[str, Any]] = None) -> Result:
        return self._http.request("GET", "/v1/campaigns", None, query)

    def create_campaign(self, input: Mapping[str, Any]) -> Result:
        return self._http.request("POST", "/v1/campaigns", input)

    def get_campaign(self, id: Any) -> Result:
        return self._http.request("GET", f"/v1/campaigns/{seg(id)}")

    def cancel_campaign(self, id: Any) -> Result:
        return self._http.request("POST", f"/v1/campaigns/{seg(id)}/cancel")

    def list_campaign_messages(self, id: Any, query: Optional[Mapping[str, Any]] = None) -> Result:
        return self._http.request("GET", f"/v1/campaigns/{seg(id)}/messages", None, query)

    def iterate_campaign_messages(
        self, id: Any, query: Optional[Mapping[str, Any]] = None
    ) -> Iterator[Mapping[str, Any]]:
        """Sayfa sayfa gezer; büyük kampanyada tüm listeyi belleğe almaz."""
        page = int((query or {}).get("page") or 1)

        while True:
            result = self.list_campaign_messages(id, {**(query or {}), "page": page})

            if not result.ok:
                return

            data = result.data if isinstance(result.data, dict) else {}
            rows = data.get("data") or []

            for row in rows:
                yield row

            last = data.get("last_page")

            if not rows or (last is not None and page >= int(last)):
                return

            page += 1

    # ── Mesajlar ─────────────────────────────────────────────────────────

    def list_messages(self, query: Optional[Mapping[str, Any]] = None) -> Result:
        return self._http.request("GET", "/v1/messages", None, query)

    def get_message(self, id: str) -> Result:
        return self._http.request("GET", f"/v1/messages/{seg(id)}")
