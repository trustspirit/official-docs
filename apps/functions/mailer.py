"""공문 메일 발송 — Gmail SMTP(앱 비밀번호). 수신자는 모두 BCC 로 넣는다."""
from __future__ import annotations
import html
import os
import smtplib
from email.message import EmailMessage
from email.policy import SMTP

MAX_PDF_BYTES = 7 * 1024 * 1024  # 요청 크기·메일 용량(Gmail 25MB) 여유


class MailNotConfigured(Exception):
    pass


def _credentials() -> tuple[str, str]:
    user = os.getenv("SMTP_USER", "").strip()
    password = os.getenv("SMTP_APP_PASSWORD", "").replace(" ", "")  # 앱 비밀번호는 4자씩 공백으로 표시됨
    if not user or not password:
        raise MailNotConfigured("SMTP_USER / SMTP_APP_PASSWORD 가 설정되지 않았습니다")
    return user, password


def sender_address() -> str:
    return _credentials()[0]


ACCENT = "#3a7a9a"
FONT = "-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',Arial,sans-serif"


def render_html(*, title: str, message: str, logo_url: str | None, button_url: str | None,
                button_label: str = "공문 보기", band: str = "지역칠십인 공문") -> str:
    """공문 안내 메일 본문(HTML). 메일 클라이언트 호환을 위해 표 레이아웃 + 인라인 스타일만 사용."""
    e = html.escape
    paragraphs = "".join(
        f'<p class="t-body" style="margin:0 0 14px;font-size:15px;line-height:1.75;color:#34363a;text-align:left;word-break:keep-all">'
        f'{e(p).replace(chr(10), "<br>")}</p>'
        for p in message.strip().split("\n\n") if p.strip()
    )
    logo = (f'<img src="{e(logo_url, quote=True)}" width="170" alt="예수 그리스도 후기 성도 교회" '
            f'style="display:block;margin:0 auto;border:0;height:auto">') if logo_url else ""
    button = (
        f'<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:26px auto 8px"><tr>'
        f'<td align="center" bgcolor="{ACCENT}" style="background:{ACCENT}">'
        f'<a href="{e(button_url, quote=True)}" style="display:inline-block;padding:15px 48px;font-family:{FONT};'
        f'font-size:16px;color:#ffffff;text-decoration:none">{e(button_label)}</a></td></tr></table>'
    ) if button_url else ""
    return f"""<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light only">
<style>
:root{{color-scheme:light only;supported-color-schemes:light only}}
@media (prefers-color-scheme: dark){{
 body,.bg-outer{{background:#eef0f0 !important}}
 .bg-card{{background:#ffffff !important;background-image:linear-gradient(#ffffff,#ffffff) !important}}
 .t-body{{color:#34363a !important}} .t-title{{color:#1f2124 !important}} .t-band{{color:#8a8d91 !important}}
}}
 /* Outlook(웹·모바일·Mac)의 다크 모드 전용 선택자 — 배경은 data-ogsb, 글자색은 data-ogsc */
[data-ogsb] .bg-outer,[data-ogsb] body{{background-color:#eef0f0 !important}}
[data-ogsb] .bg-card{{background-color:#ffffff !important;background-image:linear-gradient(#ffffff,#ffffff) !important}}
[data-ogsc] .t-body{{color:#34363a !important}} [data-ogsc] .t-title{{color:#1f2124 !important}} [data-ogsc] .t-band{{color:#8a8d91 !important}}
</style><title>{e(title)}</title></head>
<body class="bg-outer" style="margin:0;padding:0;background:#eef0f0;background-image:linear-gradient(#eef0f0,#eef0f0)">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#eef0f0" class="bg-outer" style="background:#eef0f0;background-image:linear-gradient(#eef0f0,#eef0f0)"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" class="bg-card" style="width:100%;max-width:600px;background:#ffffff;background-image:linear-gradient(#ffffff,#ffffff);font-family:{FONT}">
<tr><td style="height:6px;line-height:6px;font-size:0;background:{ACCENT}">&nbsp;</td></tr>
<tr><td align="center" class="bg-card" bgcolor="#ffffff" style="padding:30px 24px 24px;border-bottom:1px solid #e6e8e8;background:#ffffff;background-image:linear-gradient(#ffffff,#ffffff)">{logo}</td></tr>
<tr><td align="center" class="bg-card t-band" bgcolor="#ffffff" style="padding:13px 24px;border-bottom:1px solid #e6e8e8;font-size:14px;color:#8a8d91;background:#ffffff;background-image:linear-gradient(#ffffff,#ffffff)">{e(band)}</td></tr>
<tr><td class="bg-card" bgcolor="#ffffff" style="padding:34px 36px 30px;background:#ffffff;background-image:linear-gradient(#ffffff,#ffffff)">
<h1 class="t-title" style="margin:0 0 22px;font-size:21px;line-height:1.45;font-weight:600;color:#1f2124;text-align:left;word-break:keep-all">{e(title)}</h1>
{paragraphs}{button}
</td></tr>
</table></td></tr></table></body></html>"""


def build_message(*, sender: str, subject: str, title: str, body: str, bcc: list[str],
                  link: str | None = None, logo_url: str | None = None,
                  pdf: bytes | None = None, pdf_name: str = "document.pdf") -> EmailMessage:
    subject = " ".join(subject.split())  # 줄바꿈 제거 (헤더 주입 방지)
    text = body.strip()
    if link:
        text += f"\n\n공문 보기: {link}"

    msg = EmailMessage(policy=SMTP)
    msg["From"] = sender
    msg["To"] = sender  # 수신자 노출 방지: 받는 사람은 발송자 본인, 실제 수신자는 모두 BCC
    msg["Bcc"] = ", ".join(bcc)
    msg["Subject"] = subject
    msg.set_content(text)
    msg.add_alternative(
        render_html(title=title or subject, message=body, logo_url=logo_url, button_url=link),
        subtype="html",
    )
    if pdf:
        msg.add_attachment(pdf, maintype="application", subtype="pdf", filename=pdf_name)
    return msg


def send(msg: EmailMessage, bcc: list[str]) -> None:
    user, password = _credentials()
    host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    port = int(os.getenv("SMTP_PORT", "465"))
    with smtplib.SMTP_SSL(host, port, timeout=30) as smtp:
        smtp.login(user, password)
        # send_message 는 Bcc 헤더를 봉투 수신자에 쓰고 전달되는 메일에서는 제거한다
        smtp.send_message(msg, from_addr=user, to_addrs=[user, *bcc])
