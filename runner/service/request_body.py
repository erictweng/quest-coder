"""Bounded HTTP request-body readers for the runner gateway."""
from __future__ import annotations

from typing import Any


class RequestBodyError(ValueError):
    pass


class RequestBodyTooLarge(RequestBodyError):
    pass


def read_bounded_body(stream: Any, headers: Any, limit: int) -> bytes:
    transfer_encoding = (headers.get("transfer-encoding") or "").lower()
    if transfer_encoding:
        if transfer_encoding != "chunked":
            raise RequestBodyError("unsupported transfer encoding")
        return _read_chunked(stream, limit)
    raw_length = headers.get("content-length")
    if raw_length is None:
        raise RequestBodyError("content-length or chunked transfer encoding is required")
    try:
        length = int(raw_length)
    except ValueError as exc:
        raise RequestBodyError("invalid content-length") from exc
    if length <= 0:
        raise RequestBodyError("request body is required")
    if length > limit:
        raise RequestBodyTooLarge("request too large")
    body = stream.read(length)
    if len(body) != length:
        raise RequestBodyError("incomplete request body")
    return body


def _read_chunked(stream: Any, limit: int) -> bytes:
    body = bytearray()
    while True:
        line = stream.readline(128)
        if not line or len(line) >= 128 or not line.endswith(b"\r\n"):
            raise RequestBodyError("invalid chunk framing")
        try:
            size = int(line[:-2].split(b";", 1)[0], 16)
        except ValueError as exc:
            raise RequestBodyError("invalid chunk size") from exc
        if size < 0:
            raise RequestBodyError("invalid chunk size")
        if size == 0:
            while True:
                trailer = stream.readline(4096)
                if trailer == b"\r\n":
                    return bytes(body)
                if not trailer or len(trailer) >= 4096:
                    raise RequestBodyError("invalid chunk trailer")
        if len(body) + size > limit:
            raise RequestBodyTooLarge("request too large")
        chunk = stream.read(size)
        if len(chunk) != size or stream.read(2) != b"\r\n":
            raise RequestBodyError("incomplete chunk")
        body.extend(chunk)
