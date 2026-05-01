from __future__ import annotations
import os
from openai import OpenAI

SYSTEM_PROMPT = """당신은 예수 그리스도 후기 성도 교회의 공식 공문(公文) 작성 전문가입니다.
핵심 내용과 기본 정보를 바탕으로 공문의 제목, 문서 유형, 본문을 작성하여 JSON으로 반환합니다.

[공문 작성 원칙]
1. 격식체를 사용합니다: ~하십시오, ~바랍니다, ~예정입니다, ~드립니다, ~하도록 해 주시기 바랍니다
2. 첫 단락에서 공문의 목적과 핵심 내용을 명확히 제시합니다
3. 내용을 논리적 순서로 구성하며, 필요 시 소제목으로 구분합니다
4. 행동 지침이나 안내사항은 구체적이고 명확하게 기술합니다
5. 날짜·시간·장소 등 구체적 정보는 <strong> 태그로 강조합니다
6. 교회 문화와 정서에 맞는 존경과 따뜻함이 담긴 표현을 사용합니다
7. 불필요한 서론이나 반복 없이 간결하게 작성합니다

[문서 유형 선택 기준]
- 알림: 일정·행사·변경 사항 등 정보 전달
- 공지: 중요한 사항을 공식적으로 알릴 때
- 지시: 특정 행동이나 준수 사항을 요청할 때
- 요청: 협조·지원·참여를 부탁할 때
- 기타: 위 분류에 해당하지 않는 경우

[본문 HTML 출력 형식 — 반드시 이 태그만 사용]
- 소제목: <h2>
- 하위 소제목: <h3>
- 단락: <p>
- 비순서 목록: <ul><li>
- 순서 목록: <ol><li>
- 강조 텍스트: <strong>
- 참고/주석: <p class="note"><em>내용</em></p>

[반환 형식 — 반드시 아래 JSON 구조로만 출력]
{
  "title": "공문 제목 (간결하고 명확하게)",
  "doc_type": "알림 | 공지 | 지시 | 요청 | 기타 중 하나",
  "content": "<p>HTML 본문...</p>"
}

JSON 외 다른 텍스트, 마크다운, 코드 블록은 절대 포함하지 마십시오."""


def generate_document(
    issued_date: str,
    recipients: str,
    sender: str,
    key_points: str,
    cc: str = "",
) -> dict:
    """제목·문서유형·본문을 AI가 생성. {"title", "doc_type", "content"} 반환."""
    import json

    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    user_message = f"""다음 정보를 바탕으로 공문을 작성하십시오.

발행일: {issued_date}
수신: {recipients}
참조: {cc or "없음"}
발신: {sender}

핵심 내용:
{key_points}"""

    response = client.chat.completions.create(
        model="gpt-4o",
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ],
        temperature=0.3,
    )
    raw = response.choices[0].message.content.strip()
    result = json.loads(raw)

    # 필수 키 검증
    for key in ("title", "doc_type", "content"):
        if key not in result:
            raise ValueError(f"AI 응답에 '{key}' 필드가 없습니다")

    return result
