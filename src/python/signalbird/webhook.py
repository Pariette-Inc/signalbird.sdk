"""Webhook imza doğrulaması.

Mesaj olay webhook'ları (``message.*``, ``campaign.*``)
``X-Signalbird-Signature: sha256=<hex hmac-sha256(raw_body, secret)>`` taşır.

İki kural, ikisi de kritik:
  * Doğrulama HAM GÖVDE üzerinde yapılır. JSON'u çözüp yeniden serileştirmek
    imzayı bozar — Python'da ``request.json`` okuyup ``json.dumps`` etmek en
    sık düşülen tuzaktır.
  * Karşılaştırma sabit zamanlıdır (``hmac.compare_digest``).

Sözleşme: docs/CONTRACT.md § 8.6
"""

from __future__ import annotations

import hashlib
import hmac
from typing import Optional, Union


def verify_webhook(raw_body: Union[str, bytes], signature_header: Optional[str], secret: str) -> bool:
    if not signature_header or not secret:
        return False

    if not signature_header.startswith("sha256="):
        return False

    body = raw_body.encode("utf-8") if isinstance(raw_body, str) else raw_body
    expected = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()

    return hmac.compare_digest(expected, signature_header[len("sha256=") :])
