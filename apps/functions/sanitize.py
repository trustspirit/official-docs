from __future__ import annotations
import os

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


def _storage_prefixes() -> tuple[str, ...]:
    prefixes = ["https://firebasestorage.googleapis.com/v0/b/"]
    emulator = os.getenv("STORAGE_EMULATOR_HOST")
    if emulator:
        base = emulator if emulator.startswith("http") else f"http://{emulator}"
        prefixes.append(f"{base}/v0/b/")
    return tuple(prefixes)


def _attribute_filter(tag: str, attr: str, value: str):
    if tag == "img" and attr == "src":
        # 우리 Storage 업로드 URL만 허용 (외부 추적 이미지·data: 차단)
        return value if value.startswith(_storage_prefixes()) else None
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
