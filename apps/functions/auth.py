from __future__ import annotations
import hmac
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt
from flask import Request

ALGORITHM = "HS256"
MIN_SECRET_KEY_LENGTH = 32


class AuthNotConfigured(RuntimeError):
    """ADMIN_PASSWORD / SECRET_KEY 가 설정되지 않았을 때 (기본값으로 폴백하지 않음)."""


# 환경변수는 import 시점이 아니라 호출 시점에 읽는다.
# (import 시점에 읽으면 load_dotenv()·Firebase 시크릿 주입 전에 값이 고정됨)
def get_admin_username() -> str:
    return os.getenv("ADMIN_USERNAME", "admin")


def _admin_password() -> str:
    pw = os.getenv("ADMIN_PASSWORD", "")
    if not pw:
        raise AuthNotConfigured("ADMIN_PASSWORD 가 설정되지 않았습니다")
    return pw


def _secret_key() -> str:
    key = os.getenv("SECRET_KEY", "")
    if len(key) < MIN_SECRET_KEY_LENGTH:
        raise AuthNotConfigured(f"SECRET_KEY 가 설정되지 않았거나 {MIN_SECRET_KEY_LENGTH}자 미만입니다")
    return key


def _token_ttl_minutes() -> int:
    return int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "480"))


def _safe_eq(a: object, b: str) -> bool:
    """타이밍 공격을 피하는 문자열 비교 (입력이 문자열이 아니면 불일치)."""
    return isinstance(a, str) and hmac.compare_digest(a.encode(), b.encode())


def check_credentials(username: object, password: object) -> bool:
    """자격 증명 검증. 설정이 없으면 AuthNotConfigured."""
    expected_pw = _admin_password()
    user_ok = _safe_eq(username, get_admin_username())
    pw_ok = _safe_eq(password, expected_pw)
    return user_ok and pw_ok


def create_access_token(data: dict) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=_token_ttl_minutes())
    to_encode = {**data, "exp": expire}
    return jwt.encode(to_encode, _secret_key(), algorithm=ALGORITHM)


def verify_token(token: str) -> Optional[str]:
    try:
        payload = jwt.decode(token, _secret_key(), algorithms=[ALGORITHM])
        return payload.get("sub")
    except (JWTError, AuthNotConfigured):
        return None


def get_token_from_request(req: Request) -> Optional[str]:
    auth = req.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:]
    return None


def require_admin(req: Request) -> tuple[bool, str]:
    """Returns (is_admin, error_message)"""
    token = get_token_from_request(req)
    if not token:
        return False, "인증이 필요합니다"
    username = verify_token(token)
    if not _safe_eq(username, get_admin_username()):
        return False, "유효하지 않은 토큰입니다"
    return True, ""
