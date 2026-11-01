from __future__ import annotations
import os
import json
import re

from sanitize import sanitize_html

SYSTEM_PROMPT = """당신은 예수 그리스도 후기 성도 교회 본부가 전 세계 지도자들에게 보내는 공식 공문(Communication Library)의 한국어 판 작성 전문가입니다.
입력된 정보와 핵심 내용을 바탕으로, 실제 교회 공문과 같은 문체·구성의 공문을 작성하여 JSON으로 반환합니다.

[문서 유형 — doc_type은 반드시 "Letter" 또는 "Notice" 중 하나]
- Letter: 제일회장단 등 지도부가 보내는 서한. 정책·교리·조직 변경, 지침, 권고 등 비중 있는 내용.
  · 본문 첫 줄을 <p>사랑하는 형제 자매 여러분,</p> 로 시작합니다.
  · 마지막은 끝인사(예: <p>여러분의 진실한,</p> 또는 <p>진심을 담아,</p>) 다음에 서명을 둡니다.
  · 서명은 <div class="signature"><p>…</p><p>…</p></div> 형태로, 입력된 '발신' 항목의 각 줄을 <p> 하나씩 그대로 사용합니다. 이름을 지어내지 마십시오.
- Notice: 부서·위원회가 보내는 공지. 행사 안내, 자료 공개, 일정·방법 변경, 알림 등.
  · 인사말과 서명 없이 바로 본문을 시작합니다. ('발신'은 화면에 From으로 별도 표시되므로 본문에 쓰지 않습니다.)
유형은 핵심 내용의 성격(지도부의 서한인지, 부서의 공지인지)과 발신 정보를 보고 판단합니다.

[제목]
- 간결한 명사형 제목. 예: "청녀 연령 그룹 명칭", "교회 활동 안전 지침", "『가정과 교회를 위한 찬송가』 새로운 수록곡 모음 공개", "스테이크 및 와드 지도자를 위한 2027년 계획 안내서".

[문체]
- 정중한 격식체: ~합니다, ~입니다, ~바랍니다, ~권장합니다, ~예정입니다, ~하시기 바랍니다.
- 첫 단락에서 목적(무엇이, 언제부터, 누구에게 해당하는지)을 바로 밝힙니다. 변경 사항은 시행 시기(예: "즉시 시행됩니다")를 분명히 씁니다.
- 교회 용어를 사용합니다: 감독단, 지부 회장단, 스테이크 회장단, 와드 평의회, 『일반 지침서』, 복음 자료실, 지도자 및 서기 참고 자료 등.
- 근거가 되는 지침서·성경 참조는 본문에 (『일반 지침서』, 13.2.2.2 참조), (빌립보서 4:4 참조) 형식으로 괄호 안에 씁니다. 입력에 없는 장·절 번호나 URL은 지어내지 마십시오.
- 단락은 짧게(2~4문장), 불필요한 수식과 반복 없이 씁니다. 날짜·시간·장소 등 핵심 정보는 <strong>으로 강조해도 좋지만 남용하지 마십시오.

[추가 정보 섹션 — 내용이 많거나 질문이 예상될 때만]
- 시행 시기, 자주 묻는 질문, 세부 절차, 일정표처럼 본문(서한/공지) 뒤에 덧붙일 상세 내용이 있으면 서명 다음에 <h2>Additional Information</h2> 로 구분하여 작성합니다.
- 그 안에서 주제별로 <h3> 소제목을 쓰고, 질문과 답변은 질문을 <h3>(질문 형태, 예: "기존 반 회장단은 해임되고 다시 부름받아야 합니까?"), 답을 <p>로 씁니다.
- 핵심 내용이 짧고 단순하면 이 섹션을 만들지 마십시오.

[본문 HTML — 아래 태그만 사용]
- 단락 <p>, 소제목 <h2>/<h3>, 목록 <ul><li> / <ol><li>, 강조 <strong>, 서명 <div class="signature">, 참고 <p class="note">, 이미지 <figure><img><figcaption>
- 목록 항목은 "주제어. 설명" 또는 "주제어—설명"처럼 앞부분을 <strong>으로 강조할 수 있습니다.
- 수신·참조·발신·날짜·제목은 화면 머리말에 따로 표시되므로 본문에 반복하지 않습니다.

[첨부 이미지가 있는 경우]
- 사용자 메시지에 이미지 목록(IMG_1, IMG_2 …)이 안내됩니다. 모든 이미지는 직접 보고 포스터·캡처·표·일정 등에 담긴 정보를 확인해 공문 내용에 정확히 반영합니다. 이미지에서 읽은 날짜·장소·명칭을 임의로 바꾸거나 지어내지 마십시오. 읽기 어려운 부분은 추측하지 말고 생략합니다.
- 이미지마다 처리 방식이 지정됩니다.
  · [본문 삽입]: 본문의 알맞은 위치에 정확히 한 번씩 삽입합니다. 형식: <figure><img src="IMG_1" alt="이미지 내용 설명"><figcaption>짧은 설명(선택)</figcaption></figure>
    src에는 반드시 안내된 이름(IMG_1, IMG_2 …)만 쓰고 다른 URL은 쓰지 않습니다.
  · [첨부]: 공문 뒤에 별도 첨부 페이지로 붙으므로 본문에는 <img>나 <figure>로 넣지 마십시오. 대신 이미지의 맥락을 참고해 본문을 작성하고, 필요하면 "자세한 내용은 첨부 자료를 참조하시기 바랍니다."처럼 첨부를 언급할 수 있습니다.
- 이미지에 이미 들어 있는 글을 본문에서 장황하게 다시 옮기지 말고, 필요한 핵심만 정리합니다.

[반환 형식 — 반드시 아래 JSON 구조로만 출력]
{
  "title": "공문 제목",
  "doc_type": "Letter 또는 Notice",
  "content": "<p>HTML 본문...</p>"
}

JSON 외 다른 텍스트, 마크다운, 코드 블록은 절대 포함하지 마십시오."""


def _build_user_message(issued_date: str, recipients: str, sender: str,
                        key_points: str, cc: str, images: list[dict] | None = None) -> str:
    images_note = ""
    if images:
        lines = []
        for i, im in enumerate(images, 1):
            how = "첨부 — 공문 뒤에 별도 첨부 페이지로 붙음, 본문에 삽입하지 말 것" if im.get("mode") == "attachment" \
                else "본문 삽입 — 본문의 알맞은 위치에 넣을 것"
            lines.append(f"- IMG_{i}: [{how}]")
        images_note = f"\n\n첨부된 이미지 {len(images)}장 (순서대로 첨부됨). 모든 이미지의 내용을 확인해 공문에 반영하십시오.\n" + "\n".join(lines)
    return f"""다음 정보를 바탕으로 공문을 작성하십시오.

발행일: {issued_date}
수신: {recipients}
참조: {cc or "없음"}
발신: {sender}

핵심 내용:
{key_points}{images_note}"""


def _provider() -> str:
    """AI_PROVIDER 환경변수 우선. 없으면 Anthropic 키가 있을 때 anthropic, 아니면 openai."""
    explicit = os.getenv("AI_PROVIDER", "").strip().lower()
    if explicit in ("anthropic", "openai"):
        return explicit
    return "anthropic" if os.getenv("ANTHROPIC_API_KEY") else "openai"


def _call_anthropic(user_message: str, images: list[dict]) -> str:
    import anthropic
    import base64

    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    # Opus 5.5는 temperature 지정 불가 / thinking 항상 켜짐 → effort로만 조절
    response = client.messages.create(
        model=os.getenv("ANTHROPIC_MODEL", "claude-opus-5-5"),
        max_tokens=16000,
        output_config={"effort": os.getenv("ANTHROPIC_EFFORT", "medium")},
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": [
            *({"type": "image", "source": {"type": "base64",
                                           "media_type": im["media_type"],
                                           "data": base64.b64encode(im["data"]).decode()}}
              for im in images),
            {"type": "text", "text": user_message},
        ]}],
    )
    if response.stop_reason == "refusal":
        raise ValueError("AI가 요청을 처리하지 않았습니다. 입력 내용을 확인해 주세요")
    if response.stop_reason == "max_tokens":
        raise ValueError("AI 응답이 길이 제한으로 잘렸습니다")
    return "".join(b.text for b in response.content if b.type == "text")


def _call_openai(user_message: str, images: list[dict]) -> str:
    from openai import OpenAI
    import base64

    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    response = client.chat.completions.create(
        model=os.getenv("OPENAI_MODEL", "gpt-4o"),
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": [
                *({"type": "image_url", "image_url": {
                    "url": f"data:{im['media_type']};base64,{base64.b64encode(im['data']).decode()}"}}
                  for im in images),
                {"type": "text", "text": user_message},
            ]},
        ],
        temperature=0.3,
    )
    return response.choices[0].message.content


def _parse_json(raw: str) -> dict:
    """코드 블록 등이 섞여도 첫 JSON 객체를 추출."""
    raw = raw.strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        if not match:
            raise ValueError("AI 응답에서 JSON을 찾을 수 없습니다")
        return json.loads(match.group(0))


def embed_images(content: str, images: list[dict]) -> str:
    """본문삽입 이미지는 IMG_n을 URL로 치환(안 쓰인 것은 본문 끝에 추가),
    첨부 이미지는 본문에서 제거하고 공문 뒤 '첨부' 섹션으로 붙인다."""
    # IMG_1이 IMG_10의 앞부분과 겹치지 않도록 큰 번호부터 처리
    used = set()
    for i in range(len(images), 0, -1):
        url = images[i - 1]["url"]
        token = f"IMG_{i}"
        if images[i - 1].get("mode") == "attachment":
            # 모델이 지시를 어기고 본문에 넣었다면 해당 figure/img를 제거 (첨부 섹션에서 한 번만 표시)
            content = re.sub(rf'<figure[^>]*>(?:(?!</figure>).)*?["\']{token}["\'](?:(?!</figure>).)*?</figure>', "", content, flags=re.S)
            content = re.sub(rf'<img[^>]*["\']{token}["\'][^>]*>', "", content)
            continue
        if f'"{token}"' in content or f"'{token}'" in content:
            used.add(i)
            content = content.replace(f'"{token}"', f'"{url}"').replace(f"'{token}'", f'"{url}"')
    for i, im in enumerate(images, 1):
        if im.get("mode") != "attachment" and i not in used:
            content += f'<figure><img src="{im["url"]}" alt=""></figure>'
    attachments = [im for im in images if im.get("mode") == "attachment"]
    if attachments:
        figs = "".join(
            f'<figure><img src="{im["url"]}" alt="첨부 {n}"><figcaption>첨부 {n}</figcaption></figure>'
            for n, im in enumerate(attachments, 1)
        )
        content += f'<section class="attachments"><h2>첨부</h2>{figs}</section>'
    return content


def generate_document(
    issued_date: str,
    recipients: str,
    sender: str,
    key_points: str,
    cc: str = "",
    images: list[dict] | None = None,
) -> dict:
    """제목·문서유형·본문을 AI가 생성. {"title", "doc_type", "content"} 반환."""
    images = images or []
    user_message = _build_user_message(issued_date, recipients, sender, key_points, cc, images)
    call = _call_anthropic if _provider() == "anthropic" else _call_openai
    result = _parse_json(call(user_message, images))

    # 필수 키 검증
    for key in ("title", "doc_type", "content"):
        if key not in result:
            raise ValueError(f"AI 응답에 '{key}' 필드가 없습니다")

    if images:
        result["content"] = embed_images(result["content"], images)
    # 이미지·입력 속 지시문으로 조작된 출력이 저장된 XSS가 되지 않도록 허용 태그만 남김
    result["content"] = sanitize_html(result["content"])
    return result
