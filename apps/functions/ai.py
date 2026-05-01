from __future__ import annotations
import os
from openai import OpenAI

SYSTEM_PROMPT = """당신은 예수 그리스도 후기 성도 교회의 공식 공문(公文) 작성 전문가입니다.
입력된 핵심 내용과 공문 정보를 교회 공식 공문 형식과 어법에 맞게 정리하여 HTML 형식으로 출력합니다.

[공문 작성 원칙]
1. 격식체를 사용합니다: ~하십시오, ~바랍니다, ~예정입니다, ~드립니다, ~하도록 해 주시기 바랍니다
2. 첫 단락에서 공문의 목적과 핵심 내용을 명확히 제시합니다
3. 내용을 논리적 순서로 구성하며, 필요 시 소제목으로 구분합니다
4. 행동 지침이나 안내사항은 구체적이고 명확하게 기술합니다
5. 날짜·시간·장소 등 구체적 정보는 <strong> 태그로 강조합니다
6. 교회 문화와 정서에 맞는 존경과 따뜻함이 담긴 표현을 사용합니다
7. 불필요한 서론이나 반복 없이 간결하게 작성합니다

[HTML 출력 형식 — 반드시 이 태그만 사용]
- 소제목: <h2>
- 하위 소제목: <h3>
- 단락: <p>
- 비순서 목록: <ul><li>
- 순서 목록: <ol><li>
- 강조 텍스트: <strong>
- 참고/주석: <p class="note"><em>내용</em></p>

[사용 가능한 공문 어휘 예시]
- "~하도록 해 주시기 바랍니다"
- "~를 고려해 주시기 바랍니다"
- "~에서 확인하시기 바랍니다"
- "~를 참조하십시오"
- "~할 예정입니다"
- "~를 안내드립니다"
- "이에 따라 ~하시기 바랍니다"
- "문의 사항이 있으시면 ~에 연락하여 주시기 바랍니다"

반드시 HTML 태그로만 구성된 본문만 출력하십시오. 마크다운, 코드 블록(```), 설명 문구는 절대 포함하지 마십시오."""


def generate_document_content(
    title: str,
    doc_type: str,
    issued_date: str,
    recipients: str,
    sender: str,
    key_points: str,
    cc: str = "",
) -> str:
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    user_message = f"""다음 정보를 바탕으로 공문 본문을 작성하십시오.

제목: {title}
문서 유형: {doc_type}
발행일: {issued_date}
수신: {recipients}
참조: {cc or "없음"}
발신: {sender}

핵심 내용 (이 내용을 공문 형식으로 정리해 주십시오):
{key_points}"""

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ],
        temperature=0.3,
    )
    return response.choices[0].message.content.strip()
