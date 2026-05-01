from __future__ import annotations
import os
from datetime import datetime, timedelta
from typing import Optional

from jose import JWTError, jwt
from flask import Request

SECRET_KEY = os.getenv("SECRET_KEY", "fallback-secret-key-change-in-production")
ALGORITHM = "HS256"
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "changeme123")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "480"))


def create_access_token(data: dict) -> str:
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode = {**data, "exp": expire}
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def verify_token(token: str) -> Optional[str]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload.get("sub")
    except JWTError:
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
    if username != ADMIN_USERNAME:
        return False, "유효하지 않은 토큰입니다"
    return True, ""
