from __future__ import annotations
import os
from urllib.parse import urlparse

import nh3

# 공문 본문에 허용하는 최소 태그 (AI 출력·편집기 입력 모두 서버에서 정리)
ALLOWED_TAGS = {
    "p", "h2", "h3", "ul", "ol", "li", "strong", "em", "b", "i", "u", "br",
    "div", "a", "figure", "img", "figcaption",
}
ALLOWED_ATTRIBUTES = {
    "a": {"href"},
    "img": {"src", "alt"},
    "p": {"class"},
    "div": {"class"},
}
ALLOWED_CLASSES = {"note", "signature"}


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


def _is_own_upload_url(value: str) -> bool:
    """우리 버킷의 uploads/ 객체 다운로드 URL만 허용 (스킴·호스트·버킷·경로 정확히 일치)."""
    bucket = _bucket_name()
    if not bucket:
        return False
    try:
        u = urlparse(value)
    except ValueError:
        return False
    if (u.scheme, u.netloc) not in _storage_origins() or u.username or u.password:
        return False
    return u.path.startswith(f"/v0/b/{bucket}/o/uploads%2F") and "/" not in u.path.split("/o/", 1)[1]


def _attribute_filter(tag: str, attr: str, value: str):
    if tag == "img" and attr == "src":
        # 우리 Storage 업로드 URL만 허용 (외부 추적 이미지·data: 차단)
        return value if _is_own_upload_url(value) else None
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
