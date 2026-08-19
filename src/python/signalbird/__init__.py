"""Signalbird SDK — Python.

Üç sunucu yüzeyi, üç istemci; anahtarları ve kapıları farklıdır:

    from signalbird import SignalbirdClient, SignalbirdMessaging, SignalbirdManagement

    radio = SignalbirdClient(api_key="sbr_live_…")          # log yazma
    send  = SignalbirdMessaging(api_key="sb_…")             # e-posta/SMS/push
    admin = SignalbirdManagement(api_key="sb_…")            # proje/sohbet/uygulama

Ortam değişkeninden kısayol::

    from signalbird import signalbird
    signalbird().critical("critical", "ödeme servisi yanıt vermiyor")

Bağımlılığı yoktur (standart kütüphane). Retry yoktur: aynı iletiyi iki kez
göndermek hiç göndermemekten pahalıdır.
"""

from ._http import DEFAULT_BASE_URL, Result, SignalbirdError
from .client import LEVELS, SignalbirdClient, reset_signalbird, signalbird
from .management import SignalbirdManagement
from .messaging import SignalbirdMessaging
from .webhook import verify_webhook

__version__ = "1.2.0"

__all__ = [
    "SignalbirdClient",
    "SignalbirdMessaging",
    "SignalbirdManagement",
    "SignalbirdError",
    "Result",
    "DEFAULT_BASE_URL",
    "LEVELS",
    "signalbird",
    "reset_signalbird",
    "verify_webhook",
    "__version__",
]
