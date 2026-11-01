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


def build_message(*, sender: str, subject: str, body: str, bcc: list[str],
                  link: str | None = None, pdf: bytes | None = None, pdf_name: str = "document.pdf") -> EmailMessage:
    subject = " ".join(subject.split())  # 줄바꿈 제거 (헤더 주입 방지)
    text = body.strip()
    if link:
        text += f"\n\n공문 보기: {link}"
    paragraphs = "".join(
        f"<p style=\"margin:0 0 1em;line-height:1.7\">{html.escape(p).replace(chr(10), '<br>')}</p>"
        for p in text.split("\n\n") if p.strip()
    )
    if link:  # 링크는 클릭 가능하게
        paragraphs = paragraphs.replace(html.escape(link), f'<a href="{html.escape(link, quote=True)}">{html.escape(link)}</a>')

    msg = EmailMessage(policy=SMTP)
    msg["From"] = sender
    msg["To"] = sender  # 수신자 노출 방지: 받는 사람은 발송자 본인, 실제 수신자는 모두 BCC
    msg["Bcc"] = ", ".join(bcc)
    msg["Subject"] = subject
    msg.set_content(text)
    msg.add_alternative(f"<div style=\"font-family:sans-serif;font-size:15px\">{paragraphs}</div>", subtype="html")
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
