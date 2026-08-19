"""Telsiz (Radio) istemcisi — sunucu tarafı.

Django, FastAPI, Flask, Celery işçileri ve düz betikler buradan yazar.
Varsayılan davranış SESSİZ HATA'dır: telsiz erişilemezse müşterinin ödeme
akışı çökmemeli.

Sözleşme: docs/CONTRACT.md § 1–7
"""

from __future__ import annotations

import os
from typing import Any, Iterable, Mapping, Optional

from ._http import DEFAULT_BASE_URL, Result, SignalbirdError, Transport

LEVELS = ("debug", "info", "warn", "error", "critical")


class SignalbirdClient:
    def __init__(
        self,
        api_key: str,
        base_url: Optional[str] = None,
        source: Optional[str] = None,
        timeout: float = 5.0,
        throw_on_error: bool = False,
        debug: bool = False,
    ):
        if not api_key:
            raise SignalbirdError("Signalbird: api_key zorunlu.", 0, "NO_KEY")

        # Açık anahtarın sunucuda kullanılması sessiz bir güvenlik hatasıdır:
        # çalışır görünür ama kanal kısıtına takılır. Baştan söylüyoruz.
        if api_key.startswith("sbr_pub_"):
            raise SignalbirdError(
                "Signalbird: sunucu istemcisine tarayıcı anahtarı (sbr_pub_…) verildi. "
                "Sunucu anahtarı (sbr_live_…) kullanın.",
                0,
                "WRONG_KEY_TYPE",
            )

        self.source = source
        self._http = Transport(api_key, base_url or DEFAULT_BASE_URL, timeout, throw_on_error, debug)

    def log(
        self,
        channel: str,
        message: str,
        level: Optional[str] = None,
        context: Optional[Mapping[str, Any]] = None,
    ) -> Result:
        return self._http.request(
            "POST",
            "/v1/radio/log",
            {
                "channel": channel,
                "message": message,
                "level": level,
                "context": context,
                "source": self.source,
            },
        )

    def debug(self, channel: str, message: str, context: Optional[Mapping[str, Any]] = None) -> Result:
        return self.log(channel, message, "debug", context)

    def info(self, channel: str, message: str, context: Optional[Mapping[str, Any]] = None) -> Result:
        return self.log(channel, message, "info", context)

    def warn(self, channel: str, message: str, context: Optional[Mapping[str, Any]] = None) -> Result:
        return self.log(channel, message, "warn", context)

    def error(self, channel: str, message: str, context: Optional[Mapping[str, Any]] = None) -> Result:
        return self.log(channel, message, "error", context)

    def critical(self, channel: str, message: str, context: Optional[Mapping[str, Any]] = None) -> Result:
        return self.log(channel, message, "critical", context)

    def batch(self, events: Iterable[Mapping[str, Any]]) -> Result:
        """En fazla 100 kayıt; sonuç satır satır döner.

        Kısmi başarı normaldir (kota tam ortada dolabilir). Başarısız satırlar
        YENİDEN DENENMEZ: aynı logu iki kez yazmak da bir maliyettir.
        """
        rows = []

        for event in list(events)[:100]:
            rows.append(
                {
                    "channel": event.get("channel"),
                    "message": event.get("message"),
                    "level": event.get("level"),
                    "context": event.get("context"),
                    "source": event.get("source") or self.source,
                }
            )

        return self._http.request("POST", "/v1/radio/log/batch", {"events": rows})


_singleton: Optional[SignalbirdClient] = None


def signalbird(**overrides: Any) -> SignalbirdClient:
    """Ortam değişkeninden kurulan paylaşımlı istemci (``SIGNALBIRD_KEY``)."""
    global _singleton

    if _singleton is not None and not overrides:
        return _singleton

    client = SignalbirdClient(
        api_key=overrides.pop("api_key", None) or os.getenv("SIGNALBIRD_KEY", ""),
        base_url=overrides.pop("base_url", None) or os.getenv("SIGNALBIRD_URL"),
        source=overrides.pop("source", None) or os.getenv("SIGNALBIRD_SOURCE"),
        **overrides,
    )

    if not overrides:
        _singleton = client

    return client


def reset_signalbird() -> None:
    """Test ve sıcak yeniden yükleme için tekil istemciyi sıfırlar."""
    global _singleton
    _singleton = None
