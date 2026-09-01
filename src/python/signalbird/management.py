"""Yönetim (Management) istemcisi — sunucu tarafı.

Müşterinin panelde tıklayarak yaptığı her şeyi kodla yapar: Telsiz projesi ve
kanalı açar, olay akışını okur, sohbet gelen kutusunu işler, uygulama kaydı ve
cihaz listesi yönetir.

Bu ADMIN yüzeyi DEĞİLDİR: anahtar tek bir takıma bağlıdır ve yalnız o takımın
kayıtlarına dokunur.

Sözleşme: docs/CONTRACT.md § 10
"""

from __future__ import annotations

from typing import Any, Mapping, Optional

from ._http import DEFAULT_BASE_URL, Result, SignalbirdError, Transport, seg


class SignalbirdManagement:
    def __init__(
        self,
        domain_key: str,
        base_url: Optional[str] = None,
        timeout: float = 15.0,
        throw_on_error: bool = False,
        debug: bool = False,
    ):
        if not domain_key:
            raise SignalbirdError("Signalbird: domain_key zorunlu.", 0, "NO_KEY")

        if not domain_key.startswith("sb_secret_live_"):
            raise SignalbirdError(
                "Signalbird: yönetim istemcisi GİZLİ domain anahtarı ister (sb_secret_live_…).",
                0,
                "WRONG_KEY_TYPE",
            )

        self._http = Transport(domain_key, base_url or DEFAULT_BASE_URL, timeout, throw_on_error, debug)

    # ── Telsiz: projeler ─────────────────────────────────────────────────

    def radio_summary(self) -> Result:
        return self._http.request("GET", "/v1/radio/summary")

    def radio_events(self, query: Optional[Mapping[str, Any]] = None) -> Result:
        return self._http.request("GET", "/v1/radio/events", None, query)

    # ── Modül anahtarları ────────────────────────────────────────────────
    #
    # Telsiz projesi/kanalı ve uygulama kaydı 1 Eyl 2026'da kaldırıldı
    # (../signalbird.api/docs/KEY_ARCHITECTURE_2026-09-01.md §3). Beş modülün
    # (logger, email, sms, push, chat) hepsi aynı gövdeyi kullanır.

    def list_module_keys(self, module: str, query: Optional[Mapping[str, Any]] = None) -> Result:
        return self._http.request("GET", f"/v1/modules/{seg(module)}/keys", None, query)

    def get_module_key(self, module: str, id: Any) -> Result:
        return self._http.request("GET", f"/v1/modules/{seg(module)}/keys/{seg(id)}")

    def create_module_key(self, module: str, input: Mapping[str, Any]) -> Result:
        """``key`` verilmezse başlıktan üretilir; çakışırsa sonuna sayı eklenir."""
        return self._http.request("POST", f"/v1/modules/{seg(module)}/keys", input)

    def update_module_key(self, module: str, id: Any, input: Mapping[str, Any]) -> Result:
        """``key`` DEĞİŞTİRİLEBİLİR: eski ad 30 gün daha kabul edilir."""
        return self._http.request("PATCH", f"/v1/modules/{seg(module)}/keys/{seg(id)}", input)

    def delete_module_key(self, module: str, id: Any) -> Result:
        return self._http.request("DELETE", f"/v1/modules/{seg(module)}/keys/{seg(id)}")

    def list_module_key_devices(self, module: str, id: Any, query: Optional[Mapping[str, Any]] = None) -> Result:
        """Push kanalına kayıtlı cihazlar; token MASKELİ döner."""
        return self._http.request("GET", f"/v1/modules/{seg(module)}/keys/{seg(id)}/devices", None, query)

    # ── Sohbet: gelen kutusu ─────────────────────────────────────────────

    def chat_summary(self) -> Result:
        return self._http.request("GET", "/v1/chat/summary")

    def chat_updates(self) -> Result:
        return self._http.request("GET", "/v1/chat/updates")

    def list_conversations(self, query: Optional[Mapping[str, Any]] = None) -> Result:
        return self._http.request("GET", "/v1/chat/conversations", None, query)

    def get_conversation(self, id: str) -> Result:
        return self._http.request("GET", f"/v1/chat/conversations/{seg(id)}")

    def list_conversation_messages(self, id: str, query: Optional[Mapping[str, Any]] = None) -> Result:
        return self._http.request("GET", f"/v1/chat/conversations/{seg(id)}/messages", None, query)

    def start_conversation(self, input: Mapping[str, Any]) -> Result:
        """Proaktif sohbet — ziyaretçi yazmadan ajan başlatır."""
        return self._http.request("POST", "/v1/chat/conversations", input)

    def update_conversation(self, id: str, input: Mapping[str, Any]) -> Result:
        return self._http.request("PATCH", f"/v1/chat/conversations/{seg(id)}", input)

    def set_conversation_status(self, id: str, status: str) -> Result:
        return self._http.request("POST", f"/v1/chat/conversations/{seg(id)}/status", {"status": status})

    def assign_conversation(self, id: str, user_id: Optional[int] = None) -> Result:
        return self._http.request("POST", f"/v1/chat/conversations/{seg(id)}/assign", {"user_id": user_id})

    def read_conversation(self, id: str, last_message_id: Optional[str] = None) -> Result:
        return self._http.request(
            "POST", f"/v1/chat/conversations/{seg(id)}/read", {"last_message_id": last_message_id}
        )

    def set_typing(self, id: str, is_typing: bool) -> Result:
        return self._http.request(
            "POST", f"/v1/chat/conversations/{seg(id)}/typing", {"is_typing": is_typing}
        )

    def reply(self, id: str, input: Mapping[str, Any]) -> Result:
        return self._http.request("POST", f"/v1/chat/conversations/{seg(id)}/messages", input)

    def edit_chat_message(self, id: str, message_id: str, body: str) -> Result:
        return self._http.request(
            "PATCH", f"/v1/chat/conversations/{seg(id)}/messages/{seg(message_id)}", {"body": body}
        )

    def delete_chat_message(self, id: str, message_id: str) -> Result:
        return self._http.request(
            "DELETE", f"/v1/chat/conversations/{seg(id)}/messages/{seg(message_id)}"
        )

    def react_to_chat_message(self, id: str, message_id: str, emoji: str) -> Result:
        """Aynı emoji ikinci kez gönderilirse tepki kaldırılır."""
        return self._http.request(
            "POST",
            f"/v1/chat/conversations/{seg(id)}/messages/{seg(message_id)}/reactions",
            {"emoji": emoji},
        )

    # ── Sohbet: ziyaretçi ve hazır yanıtlar ──────────────────────────────

    def get_visitor(self, id: str) -> Result:
        return self._http.request("GET", f"/v1/chat/visitors/{seg(id)}")

    def update_visitor(self, id: str, input: Mapping[str, Any]) -> Result:
        return self._http.request("PATCH", f"/v1/chat/visitors/{seg(id)}", input)

    def ban_visitor(self, id: str) -> Result:
        return self._http.request("POST", f"/v1/chat/visitors/{seg(id)}/ban")

    def list_canned_replies(self) -> Result:
        return self._http.request("GET", "/v1/chat/canned-replies")

    def create_canned_reply(self, input: Mapping[str, Any]) -> Result:
        return self._http.request("POST", "/v1/chat/canned-replies", input)

    def update_canned_reply(self, id: Any, input: Mapping[str, Any]) -> Result:
        return self._http.request("PATCH", f"/v1/chat/canned-replies/{seg(id)}", input)

    def delete_canned_reply(self, id: Any) -> Result:
        return self._http.request("DELETE", f"/v1/chat/canned-replies/{seg(id)}")

    # ── Sohbet: tetikleyiciler ───────────────────────────────────────────
    # "Şu olduğunda şunu yap." Kural KAYITTA durur, kodda değil.

    def list_chat_triggers(self) -> Result:
        return self._http.request("GET", "/v1/chat/triggers")

    def create_chat_trigger(self, input: Mapping[str, Any]) -> Result:
        return self._http.request("POST", "/v1/chat/triggers", input)

    def update_chat_trigger(self, id: Any, input: Mapping[str, Any]) -> Result:
        return self._http.request("PATCH", f"/v1/chat/triggers/{seg(id)}", input)

    def delete_chat_trigger(self, id: Any) -> Result:
        return self._http.request("DELETE", f"/v1/chat/triggers/{seg(id)}")

    # ── Sohbet: rapor ────────────────────────────────────────────────────

    def chat_report(self, range: str = "30d") -> Result:
        """Yanıt/çözüm süresi, memnuniyet, ajan kırılımı.

        Veri yoksa süreler ``None`` döner — 0 DEĞİL.
        """
        return self._http.request("GET", "/v1/chat/reports", None, {"range": range})

    # ── Uygulamalar ──────────────────────────────────────────────────────

    # Uygulama uçları KALDIRILDI (1 Eyl 2026): sohbet ve push birer modül
    # anahtarıdır — list_module_keys('chat'), list_module_keys('push').

    def embed_token(self, input: Mapping[str, Any]) -> Result:
        """Gömme jetonu — Signalbird ekranını kendi panelinizde göstermek için.

        120 saniye yaşar ve tek kullanımlıktır; anahtar `embed:issue` kapsamı ister.
        """
        return self._http.request("POST", "/v1/embed/tokens", dict(input))

