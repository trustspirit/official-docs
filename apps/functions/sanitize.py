from __future__ import annotations
import os
import re
from urllib.parse import parse_qs, quote, unquote, urlparse

import nh3

# 공문 본문에 허용하는 최소 태그 (AI 출력·편집기 입력 모두 서버에서 정리)
ALLOWED_TAGS = {
    "p", "h2", "h3", "ul", "ol", "li", "strong", "em", "b", "i", "u", "br",
    "div", "a", "figure", "img", "figcaption", "section",
}
ALLOWED_ATTRIBUTES = {
    "a": {"href"},
    "img": {"src", "alt"},
    "p": {"class"},
    "div": {"class"},
    "section": {"class"},
}
ALLOWED_CLASSES = {"note", "signature", "attachments"}


def _bucket_name() -> str | None:
    name = os.getenv("STORAGE_BUCKET")
    if name:
        return name
    try:  # 배포 환경: FIREBASE_CONFIG의 기본 버킷
        from firebase_admin import storage
        return storage.bucket().name
    except Exception:
        return None


def _storage_origins() -> set[tuple[str, str]]:
    origins = {("https", "firebasestorage.googleapis.com")}
    emulator = os.getenv("STORAGE_EMULATOR_HOST")
    if emulator:
        u = urlparse(emulator if emulator.startswith("http") else f"http://{emulator}")
        origins.add((u.scheme, u.netloc))
    return origins


_OBJECT_RE = re.compile(r"^uploads/[0-9a-f]{32}\.(png|jpg|gif|webp)$")
_TOKEN_RE = re.compile(r"^[0-9a-f]{32}$")


def _normalize_upload_url(value: str) -> str | None:
    """우리 버킷의 업로드 이미지 URL이면 검증된 구성요소로 다시 만든 URL을, 아니면 None을 반환.
    (스킴·호스트·버킷·객체명 형식·쿼리를 엄격히 확인하고 원본 문자열은 쓰지 않음)"""
    bucket = _bucket_name()
    if not bucket or any(c in value for c in "\\\t\r\n ") or any(ord(c) < 32 for c in value):
        return None
    try:
        u = urlparse(value)
    except ValueError:
        return None
    if (u.scheme, u.netloc) not in _storage_origins() or u.username or u.password or u.fragment or u.params:
        return None
    prefix = f"/v0/b/{bucket}/o/"
    if not u.path.startswith(prefix):
        return None
    name = unquote(u.path[len(prefix):])
    if not _OBJECT_RE.match(name):
        return None
    query = parse_qs(u.query, keep_blank_values=True, strict_parsing=False)
    if set(query) != {"alt", "token"} or query["alt"] != ["media"] or len(query["token"]) != 1 \
            or not _TOKEN_RE.match(query["token"][0]):
        return None
    return f"{u.scheme}://{u.netloc}{prefix}{quote(name, safe='')}?alt=media&token={query['token'][0]}"


def _attribute_filter(tag: str, attr: str, value: str):
    if tag == "img" and attr == "src":
        # 우리 Storage 업로드 URL만 허용 (외부 추적 이미지·data: 차단)
        return _normalize_upload_url(value)
    if attr == "class":
        kept = [c for c in value.split() if c in ALLOWED_CLASSES]
        return " ".join(kept) or None
    return value


def sanitize_html(html: str) -> str:
    return nh3.clean(
        html or "",
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRIBUTES,
        url_schemes={"http", "https", "mailto"},
        link_rel="noopener noreferrer",
        attribute_filter=_attribute_filter,
    )
