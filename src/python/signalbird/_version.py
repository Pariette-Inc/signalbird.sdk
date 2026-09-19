"""SDK sürümü ve sürüm bildirimi - docs/CONTRACT.md § 14.

Her istek ``X-Signalbird-Sdk: python/<sürüm>`` taşır. API yanıtta
``Signalbird-Sdk-Status`` (current | outdated | unsupported) ve
``Signalbird-Sdk-Latest`` döner; eskiyse süreç başına BİR KEZ ``signalbird``
logger'ına uyarı yazılır. İstisna fırlatılmaz, istek sonucu değişmez.

``__version__`` satırını ``scripts/sync-version.mjs`` kökteki VERSION
dosyasından yazar - elle değiştirmeyin.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

__version__ = "2.6.0"

HEADER = "X-Signalbird-Sdk"

_warned = False


def header_value() -> str:
    return f"python/{__version__}"


def note(headers: Optional[Any]) -> None:
    """Yanıt başlıklarına bakar (``.get`` destekleyen her şey); eskiyse bir kez uyarır."""
    global _warned

    if _warned or headers is None:
        return

    try:
        status = headers.get("Signalbird-Sdk-Status")

        if status not in ("outdated", "unsupported"):
            return

        _warned = True
        latest = headers.get("Signalbird-Sdk-Latest") or "?"

        if status == "unsupported":
            message = (
                f"[signalbird] Bu SDK sürümü ({__version__}) artık desteklenmiyor. "
                f"Son sürüm: {latest}. pip install -U signalbird"
            )
        else:
            message = f"[signalbird] Yeni SDK sürümü var: {latest} (kurulu: {__version__})."

        logging.getLogger("signalbird").warning(message)
    except Exception:  # noqa: BLE001 - uyarı isteği asla bozmamalı
        pass


def _reset_warning() -> None:
    """Yalnız testler için."""
    global _warned
    _warned = False
