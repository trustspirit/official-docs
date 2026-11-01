"""주소록 — 직책(role) 단위로 수신자를 고르기 위한 연락처 처리."""
from __future__ import annotations
import csv
import io
import re

CONTACTS_COLLECTION = "contacts"

# 수신 그룹: 발송 화면에서 한 번에 켜고 끄는 단위. 직책 이름은 CSV의 "직책 이름" 값과 같아야 한다.
ROLE_GROUPS = [
    {"key": "area_seventy", "label": "지역칠십인", "roles": ["지역칠십인"]},
    {"key": "stake_district", "label": "스테이크 회장 / 지방부 회장", "roles": ["스테이크 회장", "지방부 회장"]},
    {"key": "bishop_branch", "label": "감독 / 지부 회장", "roles": ["감독", "지부 회장"]},
]
ALL_ROLES = [r for g in ROLE_GROUPS for r in g["roles"]]

_EMAIL_RE = re.compile(r"^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$")

# CSV 헤더 (교회 지도자 연락처 내보내기 형식)
COL_UNIT = "단위 조직 이름(현지 문자)"
COL_ROLE = "직책 이름"
COL_NAME = "개인 이름"
COL_PHONE = "전화번호 - 전화"
COL_EMAIL = "이메일 - 이메일"


def valid_email(value: str) -> bool:
    return bool(_EMAIL_RE.match(value or ""))


def parse_csv(text: str) -> tuple[list[dict], list[str]]:
    """CSV 텍스트 → (연락처 목록, 건너뛴 행 사유). 알 수 없는 직책·잘못된 이메일은 건너뛴다."""
    reader = csv.DictReader(io.StringIO(text.lstrip("﻿")))
    missing = [c for c in (COL_ROLE, COL_EMAIL) if c not in (reader.fieldnames or [])]
    if missing:
        raise ValueError(f"CSV에 필요한 열이 없습니다: {', '.join(missing)}")
    contacts: list[dict] = []
    skipped: list[str] = []
    seen: set[tuple[str, str]] = set()
    for i, row in enumerate(reader, start=2):
        role = (row.get(COL_ROLE) or "").strip()
        email = (row.get(COL_EMAIL) or "").strip().lower()
        name = (row.get(COL_NAME) or "").strip()
        if role not in ALL_ROLES:
            skipped.append(f"{i}행 {name or '(이름 없음)'}: 지원하지 않는 직책 '{role}'")
            continue
        if not valid_email(email):
            skipped.append(f"{i}행 {name or '(이름 없음)'}: 이메일이 올바르지 않음")
            continue
        if (role, email) in seen:
            continue
        seen.add((role, email))
        contacts.append({
            "unit": (row.get(COL_UNIT) or "").strip(),
            "role": role,
            "name": name,
            "phone": (row.get(COL_PHONE) or "").strip(),
            "email": email,
        })
    return contacts, skipped


def group_roles(keys: list[str]) -> list[str]:
    """선택된 그룹 key 목록 → 직책 목록. 알 수 없는 key 는 무시."""
    wanted = set(keys)
    return [r for g in ROLE_GROUPS if g["key"] in wanted for r in g["roles"]]


def unique_emails(contacts: list[dict]) -> list[str]:
    """같은 주소가 여러 직책에 있어도 한 번만 (대소문자 무시, 순서 유지)."""
    out: list[str] = []
    seen: set[str] = set()
    for c in contacts:
        e = (c.get("email") or "").strip().lower()
        if e and e not in seen:
            seen.add(e)
            out.append(e)
    return out
