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
        api_key: str,
        base_url: Optional[str] = None,
        timeout: float = 15.0,
        throw_on_error: bool = False,
        debug: bool = False,
    ):
        if not api_key:
            raise SignalbirdError("Signalbird: api_key zorunlu.", 0, "NO_KEY")

        if not api_key.startswith("sb_"):
            raise SignalbirdError(
                "Signalbird: yönetim istemcisi takım API anahtarı ister (sb_…).",
                0,
                "WRONG_KEY_TYPE",
            )

        self._http = Transport(api_key, base_url or DEFAULT_BASE_URL, timeout, throw_on_error, debug)

    # ── Telsiz: projeler ─────────────────────────────────────────────────

    def radio_summary(self) -> Result:
        return self._http.request("GET", "/v1/radio/summary")

    def radio_events(self, query: Optional[Mapping[str, Any]] = None) -> Result:
        return self._http.request("GET", "/v1/radio/events", None, query)

    def list_radio_projects(self) -> Result:
        return self._http.request("GET", "/v1/radio/projects")

    def create_radio_project(self, input: Mapping[str, Any]) -> Result:
        """Dönen ``secret`` (``sbr_live_…``) YALNIZ burada görünür; saklayın."""
        return self._http.request("POST", "/v1/radio/projects", input)

    def get_radio_project(self, id: Any) -> Result:
        return self._http.request("GET", f"/v1/radio/projects/{seg(id)}")

    def update_radio_project(self, id: Any, input: Mapping[str, Any]) -> Result:
        return self._http.request("PATCH", f"/v1/radio/projects/{seg(id)}", input)

    def delete_radio_project(self, id: Any) -> Result:
        return self._http.request("DELETE", f"/v1/radio/projects/{seg(id)}")

    def rotate_radio_secret(self, id: Any) -> Result:
        """Gizli anahtarı yeniler; eski anahtar ANINDA geçersizleşir."""
        return self._http.request("POST", f"/v1/radio/projects/{seg(id)}/rotate")

    # ── Telsiz: kanallar ─────────────────────────────────────────────────

    def create_radio_channel(self, project_id: Any, input: Mapping[str, Any]) -> Result:
        return self._http.request("POST", f"/v1/radio/projects/{seg(project_id)}/channels", input)

    def update_radio_channel(self, project_id: Any, channel_id: Any, input: Mapping[str, Any]) -> Result:
        """``key`` DEĞİŞMEZ — müşterinin kodundaki kanal adı ona bağlıdır."""
        return self._http.request(
            "PATCH", f"/v1/radio/projects/{seg(project_id)}/channels/{seg(channel_id)}", input
        )

    def delete_radio_channel(self, project_id: Any, channel_id: Any) -> Result:
        return self._http.request(
            "DELETE", f"/v1/radio/projects/{seg(project_id)}/channels/{seg(channel_id)}"
        )

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

    def list_apps(self) -> Result:
        return self._http.request("GET", "/v1/apps")

    def create_app(self, input: Mapping[str, Any]) -> Result:
        """Yanıttaki ``public_key`` (``sbw_pub_…``) istemciye gömülür."""
        return self._http.request("POST", "/v1/apps", input)

    def get_app(self, id: Any) -> Result:
        return self._http.request("GET", f"/v1/apps/{seg(id)}")

    def update_app(self, id: Any, input: Mapping[str, Any]) -> Result:
        return self._http.request("PATCH", f"/v1/apps/{seg(id)}", input)

    def delete_app(self, id: Any) -> Result:
        return self._http.request("DELETE", f"/v1/apps/{seg(id)}")

    def rotate_app_key(self, id: Any) -> Result:
        """Siteye gömülü eski anahtar ANINDA çalışmaz olur."""
        return self._http.request("POST", f"/v1/apps/{seg(id)}/rotate-key")

    def embed_token(self, input: Mapping[str, Any]) -> Result:
        """Gömme jetonu — Signalbird ekranını kendi panelinizde göstermek için.

        120 saniye yaşar ve tek kullanımlıktır; anahtar `embed:issue` kapsamı ister.
        """
        return self._http.request("POST", "/v1/embed/tokens", dict(input))

    def list_app_devices(self, id: Any, query: Optional[Mapping[str, Any]] = None) -> Result:
        return self._http.request("GET", f"/v1/apps/{seg(id)}/devices", None, query)
