"""Ortak taşıma katmanı.

Bağımlılığı yoktur: standart kütüphanenin ``urllib``'i kullanılır. Bir SDK'nın
``requests`` sürümü dayatması, müşterinin bağımlılık çözümlemesini kilitleyen
en sık sebeptir — bir log/gönderim kütüphanesi bunu yapmamalı.

Zarf ve hata kodları diğer dillerle BİREBİR aynıdır (docs/CONTRACT.md § 8.2).
"""

from __future__ import annotations

import json
import socket
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Mapping, Optional

DEFAULT_BASE_URL = "https://signalbird.io/api"


class SignalbirdError(Exception):
    """``throw_on_error=True`` iken fırlatılır."""

    def __init__(self, message: str, status: int = 0, code: Optional[str] = None, body: Any = None):
        super().__init__(message)
        self.status = status
        self.code = code
        self.body = body


class Result(dict):
    """``{ok, status, data, code, message}`` zarfı.

    ``dict``'ten türer ki hem ``result["data"]`` hem ``result.ok`` çalışsın;
    diğer dillerdeki alan adlarıyla birebir kalır.
    """

    @property
    def ok(self) -> bool:
        return bool(self.get("ok"))

    @property
    def status(self) -> int:
        return int(self.get("status", 0))

    @property
    def data(self) -> Any:
        return self.get("data")

    @property
    def code(self) -> Optional[str]:
        return self.get("code")

    @property
    def message(self) -> Optional[str]:
        return self.get("message")


def build_query(query: Optional[Mapping[str, Any]]) -> str:
    """``None`` alanlar atlanır; diziler ``key[]=`` biçiminde gider."""
    if not query:
        return ""

    pairs = []

    for key, value in query.items():
        if value is None:
            continue

        if isinstance(value, (list, tuple, set)):
            for item in value:
                pairs.append((f"{key}[]", _stringify(item)))
        else:
            pairs.append((key, _stringify(value)))

    return "?" + urllib.parse.urlencode(pairs) if pairs else ""


def _stringify(value: Any) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"

    return str(value)


class Transport:
    """Anahtarlı istemcilerin ortak HTTP katmanı."""

    def __init__(self, api_key: str, base_url: str, timeout: float, throw_on_error: bool, debug: bool):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.throw_on_error = throw_on_error
        self.debug = debug

    def request(
        self,
        method: str,
        path: str,
        body: Optional[Mapping[str, Any]] = None,
        query: Optional[Mapping[str, Any]] = None,
        auth_header: str = "Authorization",
        auth_prefix: str = "Bearer ",
    ) -> Result:
        url = self.base_url + path + build_query(query)
        payload = None
        headers = {
            "Accept": "application/json",
            auth_header: f"{auth_prefix}{self.api_key}",
        }

        if body is not None:
            payload = json.dumps(_drop_none(body), ensure_ascii=False).encode("utf-8")
            headers["Content-Type"] = "application/json"

        request = urllib.request.Request(url, data=payload, headers=headers, method=method)

        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                return self._success(response.status, _decode(response.read()))
        except urllib.error.HTTPError as error:
            data = _decode(error.read())
            status = int(error.code)

            # API `{message, code}` döner; Laravel doğrulama hatası `{message,
            # errors}` döner (kodsuz) — onu VALIDATION_ERROR sayarız.
            code = None
            message = None

            if isinstance(data, dict):
                code = data.get("code") if isinstance(data.get("code"), str) else None
                message = data.get("message") if isinstance(data.get("message"), str) else None

            if not code:
                code = (
                    "VALIDATION_ERROR"
                    if status == 422
                    else "API_KEY_INVALID"
                    if status == 401
                    else f"HTTP_{status}"
                )

            return self._fail(status, code, message or f"HTTP {status}", data)
        except socket.timeout:
            return self._fail(0, "TIMEOUT", "request timed out", None)
        except urllib.error.URLError as error:
            reason = getattr(error, "reason", error)

            if isinstance(reason, socket.timeout):
                return self._fail(0, "TIMEOUT", "request timed out", None)

            return self._fail(0, "NETWORK_ERROR", str(reason), None)

    def _success(self, status: int, data: Any) -> Result:
        return Result(ok=True, status=status, data=data, code=None, message=None)

    def _fail(self, status: int, code: str, message: str, data: Any) -> Result:
        if self.throw_on_error:
            raise SignalbirdError(f"Signalbird: {code} — {message}", status, code, data)

        if self.debug:
            print(f"[signalbird] {code} (HTTP {status}): {message}")

        return Result(ok=False, status=status, data=data, code=code, message=message)


def _decode(raw: bytes) -> Any:
    if not raw:
        return None

    text = raw.decode("utf-8", errors="replace")

    try:
        return json.loads(text)
    except ValueError:
        return text


def _drop_none(body: Mapping[str, Any]) -> dict:
    """``None`` alanlar gövdeden atılır: "gönderilmedi" ile "null yapıldı" aynı şey değil."""
    return {key: value for key, value in body.items() if value is not None}


def seg(value: Any) -> str:
    """Yol parçası — kimlikler URL'e gömülmeden önce kodlanır."""
    return urllib.parse.quote(str(value), safe="")
