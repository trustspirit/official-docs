from __future__ import annotations
import os
from typing import Optional

from firebase_admin import auth as fb_auth
from flask import Request


class AuthNotConfigured(RuntimeError):
    """ADMIN_EMAILS 가 비어 있을 때 (아무도 관리자로 인정하지 않음)."""


def admin_emails() -> set[str]:
    """관리자로 허용할 Google 계정 이메일 (쉼표·공백·줄바꿈 구분, 대소문자 무시).
    환경변수는 import 시점이 아니라 호출 시점에 읽는다."""
    raw = os.getenv("ADMIN_EMAILS", "")
    emails = {e.strip().lower() for e in raw.replace(",", " ").split() if e.strip()}
    if not emails:
        raise AuthNotConfigured("ADMIN_EMAILS 가 설정되지 않았습니다")
    return emails


def get_token_from_request(req: Request) -> Optional[str]:
    auth = req.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:]
    return None


def verify_admin_token(token: str) -> Optional[str]:
    """Firebase ID 토큰을 검증하고, Google 로그인한 허용 이메일이면 그 이메일을 반환."""
    try:
        decoded = fb_auth.verify_id_token(token)
    except Exception:  # 만료·위조·형식 오류 등 모두 거부
        return None
    email = (decoded.get("email") or "").lower()
    provider = (decoded.get("firebase") or {}).get("sign_in_provider")
    if provider != "google.com" or not decoded.get("email_verified") or not email:
        return None
    return email if email in admin_emails() else None


def require_admin(req: Request) -> tuple[bool, str]:
    """Returns (is_admin, error_message)"""
    token = get_token_from_request(req)
    if not token:
        return False, "인증이 필요합니다"
    try:
        email = verify_admin_token(token)
    except AuthNotConfigured as e:
        print(f"[auth] 설정 오류: {e}")
        return False, "서버 인증 설정이 완료되지 않았습니다"
    if not email:
        return False, "관리자 권한이 없는 계정입니다"
    return True, ""


def current_admin_email(req: Request) -> Optional[str]:
    token = get_token_from_request(req)
    try:
        return verify_admin_token(token) if token else None
    except AuthNotConfigured:
        return None
