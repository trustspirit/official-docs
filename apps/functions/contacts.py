"""주소록 — 직책(role) 단위로 수신자를 고르기 위한 연락처 처리."""
from __future__ import annotations
import csv
import io
import re

CONTACTS_COLLECTION = "contacts"

# 미리 정의한 수신 그룹: 여러 직책을 체크박스 하나로 묶고 표시 순서를 정한다.
# 여기에 없는 직책도 주소록에 있으면 build_groups() 가 직책별 그룹을 자동으로 만든다.
ROLE_GROUPS = [
    {"key": "area_seventy", "label": "지역칠십인", "roles": ["지역칠십인"]},
    {"key": "stake_district", "label": "스테이크 회장 / 지방부 회장", "roles": ["스테이크 회장", "지방부 회장"]},
    {"key": "bishop_branch", "label": "감독 / 지부 회장", "roles": ["감독", "지부 회장"]},
    {"key": "clerk", "label": "와드 서기 / 지부 서기", "roles": ["와드 서기", "지부 서기"]},
    {"key": "single_adult", "label": "독신 성인 대표 / 고문",
     "roles": ["스테이크 독신 성인 대표", "스테이크 독신 성인 고문", "지방부 독신 성인 고문"]},
]
ALL_ROLES = [r for g in ROLE_GROUPS for r in g["roles"]]

# 지도자 연락처 CSV 가져오기에서 받는 직책 (내보내기에 다른 부름이 많이 섞여 있어 제한한다)
LEADER_CSV_ROLES = ["지역칠십인", "스테이크 회장", "지방부 회장", "감독", "지부 회장"]
MAX_ROLE_LEN = 50

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
        if role not in LEADER_CSV_ROLES:
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


def valid_role(value: str) -> bool:
    return 0 < len(value) <= MAX_ROLE_LEN


def build_groups(contacts: list[dict]) -> list[dict]:
    """주소록 → 발송 화면 체크박스 목록.

    미리 정의한 그룹은 연락처가 있을 때만, 그 외 직책은 'role:<직책>' key 로 하나씩 만든다.
    """
    present = {c.get("role", "") for c in contacts} - {""}
    groups = [g for g in ROLE_GROUPS if present & set(g["roles"])]
    extra = sorted(present - set(ALL_ROLES))
    groups += [{"key": f"role:{r}", "label": r, "roles": [r]} for r in extra]
    return groups


def group_roles(keys: list[str], groups: list[dict]) -> list[str]:
    """선택된 그룹 key 목록 → 직책 목록. 알 수 없는 key 는 무시."""
    wanted = set(keys)
    return [r for g in groups if g["key"] in wanted for r in g["roles"]]


def stake_options(contacts: list[dict]) -> list[str]:
    """주소록에 있는 스테이크/지방부 목록 (가나다순). 미지정은 포함하지 않는다."""
    return sorted({(c.get("stake") or "").strip() for c in contacts} - {""})


def fill_stakes(contacts: list[dict], known: list[dict]) -> None:
    """stake 가 빈 연락처를, 같은 단위(unit)를 가진 기존 연락처의 stake 로 채운다 (제자리 수정)."""
    unit_stake = {c.get("unit", ""): c["stake"] for c in known if c.get("stake") and c.get("unit")}
    for s in stake_options(known):
        unit_stake.setdefault(s, s)  # 단위가 스테이크 자체인 경우 (스테이크 회장 등)
    for c in contacts:
        if not c.get("stake"):
            c["stake"] = unit_stake.get(c.get("unit", ""), "")


def filter_recipients(contacts: list[dict], roles: list[str], stakes: list[str]) -> list[dict]:
    """직책 그룹 ∩ 스테이크. stakes 가 비면 전체, '' 은 '스테이크 미지정' 연락처를 뜻한다."""
    role_set, stake_set = set(roles), set(stakes)
    return [c for c in contacts
            if c.get("role") in role_set and (not stake_set or (c.get("stake") or "") in stake_set)]


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
