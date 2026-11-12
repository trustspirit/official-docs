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


_TAG_SPLIT_RE = re.compile(r"(<[^>]*>)")
# URL은 ASCII 문자만 (한글 조사가 바로 붙어도 링크에 포함되지 않도록), 이메일은 URL 뒤에 시도
# 전화번호: 국내 휴대폰·지역번호·인터넷전화(070/050x)·대표번호(15xx 등, 하이픈 필수)·국제(+로 시작).
# 날짜(2026-03-18)·계좌번호 등과 섞이지 않도록 국번 형식을 제한하고 앞뒤에 숫자가 붙어 있으면 제외한다.
_SEP = r"[-.\s]"
_PHONE = (
    r"(?<![0-9A-Za-z+])(?:"
    r"\+\d{1,3}" + _SEP + r"?\(?0?\d{1,4}\)?" + _SEP + r"?\d{3,4}" + _SEP + r"?\d{4}"  # +82 10-1234-5678
    r"|\(?(?:01[016789]|02|0[3-6][1-5]|070|050\d)\)?" + _SEP + r"?\d{3,4}" + _SEP + r"?\d{4}"  # 010-1234-5678
    r"|1[5-9]\d{2}-\d{4}"  # 1588-1234
    r")(?![0-9A-Za-z])"
)
_AUTOLINK_RE = re.compile(
    r"(?P<url>(?:https?://|www\.)[A-Za-z0-9\-._~:/?#\[\]@!$&'()*+,;=%]+)"
    r"|(?P<email>[A-Za-z0-9._%+\-]+@[A-Za-z0-9\-]+(?:\.[A-Za-z0-9\-]+)*\.[A-Za-z]{2,})"
    rf"|(?P<phone>{_PHONE})"
)
_TRAILING = ".,;:!?)]}'"


def _link(m: re.Match) -> str:
    if m.group("email"):
        e = m.group("email")
        return f'<a href="mailto:{e}">{e}</a>'
    if m.group("phone"):
        p = m.group("phone")
        digits = re.sub(r"[^\d]", "", p)
        if p.startswith("+"):
            digits = "+" + digits
        return f'<a href="tel:{digits}">{p}</a>'
    url = m.group("url")
    tail = ""
    while url and url[-1] in _TRAILING:
        # 균형 잡힌 괄호는 URL의 일부로 유지
        if url[-1] == ")" and url.count("(") >= url.count(")"):
            break
        tail = url[-1] + tail
        url = url[:-1]
    if url.endswith("&amp") or not url:
        return m.group(0)
    href = url if url.startswith("http") else f"https://{url}"
    return f'<a href="{href}">{url}</a>{tail}'


def autolink(html: str) -> str:
    """정리된 HTML의 텍스트에서 URL·이메일·전화번호를 링크로 변환 (이미 <a> 안이면 건너뜀)."""
    out, depth = [], 0
    for part in _TAG_SPLIT_RE.split(html):
        if part.startswith("<") and part.endswith(">"):
            low = part.lower()
            if re.match(r"<a[\s>]", low):
                depth += 1
            elif low.startswith("</a"):
                depth = max(0, depth - 1)
            out.append(part)
        else:
            out.append(part if depth else _AUTOLINK_RE.sub(_link, part))
    return "".join(out)


def _clean(html: str) -> str:
    return nh3.clean(
        html or "",
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRIBUTES,
        url_schemes={"http", "https", "mailto", "tel"},
        link_rel="noopener noreferrer",
        attribute_filter=_attribute_filter,
    )


def sanitize_html(html: str) -> str:
    # 1) 정리 → 2) 본문 텍스트의 URL·이메일 자동 링크 → 3) 새 링크도 같은 규칙으로 재정리(rel 부여)
    return _clean(autolink(_clean(html)))
