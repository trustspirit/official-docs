"""긴 URL을 사이트 내부 단축 링크(/s/<코드>)로 바꾼다. 외부 단축 서비스에 주소를 보내지 않는다."""
from __future__ import annotations
import hashlib
import html
import re
from datetime import datetime, timezone

LONG_URL = 50  # 이 길이를 넘는 URL만 단축
COLLECTION = "short_links"
CODE_RE = re.compile(r"^[0-9A-Za-z]{7,12}$")
_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
_LINK_RE = re.compile(r'<a href="([^"]+)"([^>]*)>(.*?)</a>', re.S)
_URLISH_TEXT = re.compile(r"^(https?://|www\.)", re.I)


def _code(url: str, length: int) -> str:
    n = int.from_bytes(hashlib.sha256(url.encode("utf-8")).digest(), "big")
    out = []
    while n and len(out) < 12:
        n, r = divmod(n, 62)
        out.append(_ALPHABET[r])
    return "".join(out)[:length]


def get_or_create_code(db, url: str) -> str:
    """같은 URL은 항상 같은 코드(멱등). 해시 충돌 시 코드를 늘려 재시도."""
    for length in range(7, 13):
        code = _code(url, length)
        ref = db.collection(COLLECTION).document(code)
        snap = ref.get()
        if not snap.exists:
            ref.set({"url": url, "created_at": datetime.now(timezone.utc).isoformat()})
            return code
        if (snap.to_dict() or {}).get("url") == url:
            return code
    raise RuntimeError("단축 코드를 만들 수 없습니다")


def resolve(db, code: str) -> str | None:
    if not CODE_RE.match(code or ""):
        return None
    snap = db.collection(COLLECTION).document(code).get()
    url = (snap.to_dict() or {}).get("url") if snap.exists else None
    return url if url and url.startswith(("http://", "https://")) else None


def shorten_links(db, content: str, base_url: str) -> str:
    """정리된 HTML의 <a> 중 긴 외부 URL을 단축 링크로 교체. 링크 문구가 URL 그대로면 문구도 단축 주소로 바꾼다."""
    base = (base_url or "").rstrip("/")
    if not base:
        return content

    def repl(m: re.Match) -> str:
        url = html.unescape(m.group(1))
        if not url.startswith(("http://", "https://")) or len(url) <= LONG_URL or url.startswith(base + "/s/"):
            return m.group(0)
        short = f"{base}/s/{get_or_create_code(db, url)}"
        text = m.group(3)
        plain = html.unescape(re.sub(r"<[^>]+>", "", text)).strip()
        new_text = html.escape(short) if (plain == url or _URLISH_TEXT.match(plain)) else text
        return f'<a href="{html.escape(short)}"{m.group(2)}>{new_text}</a>'

    return _LINK_RE.sub(repl, content or "")
