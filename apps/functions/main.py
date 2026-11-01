from __future__ import annotations
import os
from datetime import datetime, timezone

import firebase_admin
from firebase_admin import credentials, firestore
from firebase_functions import https_fn, options
from flask import Flask, jsonify, redirect, request as flask_request
from dotenv import load_dotenv

from auth import require_admin, current_admin_email
from ai import generate_document, VALID_CLOSINGS, VALID_TYPE_PREFS
from sanitize import sanitize_html
import shortlinks
from storage_utils import MAX_IMAGE_BYTES, sniff_image_type, upload_image, load_image

# 로컬 개발용 설정은 .env.local (firebase deploy 에 포함되지 않음). 배포 환경은 Firebase 시크릿 사용
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env.local"))

# Firebase Admin 초기화
if not firebase_admin._apps:
    firebase_admin.initialize_app()



class _LazyFirestore:
    """Firestore 클라이언트를 첫 사용 시점에 생성.
    배포 중 함수 분석(import)은 자격 증명이 없는 환경에서도 성공해야 하므로 import 시점에는 만들지 않는다."""

    _client = None

    def __getattr__(self, name):
        if _LazyFirestore._client is None:
            _LazyFirestore._client = firestore.client()
        return getattr(_LazyFirestore._client, name)


db = _LazyFirestore()
DOCS_COLLECTION = "documents"

# Flask 앱 (Firebase Functions의 on_request로 래핑)
flask_app = Flask(__name__)

options.set_global_options(region=options.SupportedRegion.ASIA_NORTHEAST3)

# ── CORS 헬퍼 ──────────────────────────────────────────────────────────────────

def _cors_headers() -> dict:
    return {
        "Access-Control-Allow-Origin": os.getenv("ALLOWED_ORIGIN", "*"),
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
    }


def _preflight():
    return ("", 204, _cors_headers())


def _json(data, status=200):
    from flask import Response
    import json
    resp = Response(json.dumps(data, ensure_ascii=False, default=str),
                    status=status, mimetype="application/json")
    for k, v in _cors_headers().items():
        resp.headers[k] = v
    return resp


def _public_base() -> str:
    """단축 링크에 쓸 사이트 주소. PUBLIC_BASE_URL 우선, 없으면 요청의 Origin/Host."""
    explicit = os.getenv("PUBLIC_BASE_URL", "").strip().rstrip("/")
    if explicit:
        return explicit
    origin = flask_request.headers.get("Origin", "")
    if origin.startswith(("http://", "https://")):
        return origin.rstrip("/")
    host = flask_request.headers.get("X-Forwarded-Host") or flask_request.host
    scheme = "http" if host.startswith(("localhost", "127.0.0.1")) else "https"
    return f"{scheme}://{host}"


def _shorten(content: str) -> str:
    try:
        return shortlinks.shorten_links(db, content, _public_base())
    except Exception:
        return content  # 단축 실패해도 원본 링크로 저장/표시 (본문 생성·저장을 막지 않음)


# ── 문서 직렬화 ────────────────────────────────────────────────────────────────

VALID_LOGO_STYLES = ("full", "name")  # full: 로고 이미지 포함 / name: 교회 이름만


def _doc_to_dict(doc_id: str, data: dict) -> dict:
    return {
        "id": doc_id,
        "slug": data.get("slug", ""),
        "title": data.get("title", ""),
        "doc_type": data.get("doc_type", "알림"),
        "logo_style": data.get("logo_style") if data.get("logo_style") in VALID_LOGO_STYLES else "full",  # 기존 문서는 로고 포함
        "issued_date": data.get("issued_date", ""),
        "recipients": data.get("recipients", ""),
        "cc": data.get("cc", ""),
        "sender": data.get("sender", ""),
        "content": sanitize_html(data.get("content", "")),  # 기존 저장분도 출력 시 정리
        "raw_input": data.get("raw_input", ""),
        "is_published": data.get("is_published", True),
        "created_at": data.get("created_at", ""),
        "updated_at": data.get("updated_at", ""),
    }


# ── 라우팅 ─────────────────────────────────────────────────────────────────────

@flask_app.route("/s/<code>", methods=["GET"])
def short_redirect(code: str):
    """단축 링크 → 원래 주소로 이동 (관리자가 저장한 주소만 존재)."""
    url = shortlinks.resolve(db, code)
    if not url:
        return _json({"detail": "링크를 찾을 수 없습니다"}, 404)
    resp = redirect(url, code=302)
    # 코드→주소는 변하지 않으므로 Hosting CDN이 오래 캐시 (같은 링크 반복 접속 시 함수·Firestore를 호출하지 않음)
    resp.headers["Cache-Control"] = "public, max-age=3600, s-maxage=86400"
    resp.headers["Referrer-Policy"] = "no-referrer"
    return resp


@flask_app.route("/api/auth/me", methods=["GET", "OPTIONS"])
def auth_me():
    if flask_request.method == "OPTIONS":
        return _preflight()
    is_admin, err = require_admin(flask_request)
    if not is_admin:
        return _json({"detail": err}, 403 if "권한" in err else 401)
    return _json({"email": current_admin_email(flask_request)})


MAX_IMAGES = 6


@flask_app.route("/api/upload", methods=["POST", "OPTIONS"])
def upload():
    if flask_request.method == "OPTIONS":
        return _preflight()
    is_admin, err = require_admin(flask_request)
    if not is_admin:
        return _json({"detail": err}, 401)
    file = flask_request.files.get("file")
    if not file:
        return _json({"detail": "file 필드가 필요합니다"}, 400)
    data = file.read(MAX_IMAGE_BYTES + 1)
    if len(data) > MAX_IMAGE_BYTES:
        return _json({"detail": "이미지는 5MB 이하만 업로드할 수 있습니다"}, 413)
    media_type = sniff_image_type(data)
    if not media_type:
        return _json({"detail": "PNG, JPG, GIF, WEBP 이미지만 업로드할 수 있습니다"}, 400)
    try:
        return _json(upload_image(data, media_type), 201)
    except Exception as e:
        return _json({"detail": f"업로드 오류: {str(e)}"}, 500)


@flask_app.route("/api/generate", methods=["POST", "OPTIONS"])
def generate():
    if flask_request.method == "OPTIONS":
        return _preflight()
    is_admin, err = require_admin(flask_request)
    if not is_admin:
        return _json({"detail": err}, 401)
    body = flask_request.get_json(silent=True) or {}
    # AI가 유추 불가능한 필드만 필수로 받음 (제목·유형은 AI가 결정)
    required = ["issued_date", "recipients", "sender", "key_points"]
    for field in required:
        if not body.get(field):
            return _json({"detail": f"{field} 필드가 필요합니다"}, 400)
    doc_type_pref = body.get("doc_type_pref", "auto")
    closing = body.get("closing", "auto")
    if doc_type_pref not in VALID_TYPE_PREFS or closing not in VALID_CLOSINGS:
        return _json({"detail": "doc_type_pref 또는 closing 값이 올바르지 않습니다"}, 400)
    image_paths = body.get("images") or []
    if not isinstance(image_paths, list) or len(image_paths) > MAX_IMAGES:
        return _json({"detail": f"이미지는 최대 {MAX_IMAGES}장까지 첨부할 수 있습니다"}, 400)
    try:
        images = []
        for item in image_paths:
            path, mode = (item.get("path"), item.get("mode")) if isinstance(item, dict) else (item, None)
            im = load_image(str(path))
            im["mode"] = "attachment" if mode == "attachment" else "inline"
            images.append(im)
        result = generate_document(
            issued_date=body["issued_date"],
            recipients=body["recipients"],
            sender=body["sender"],
            key_points=body["key_points"],
            cc=body.get("cc", ""),
            images=images,
            doc_type_pref=doc_type_pref,
            closing=closing,
        )
        # result = {"title": ..., "doc_type": ..., "content": ...}
        # 단축 링크는 저장할 때만 만든다 (재생성·취소해도 사용되지 않는 링크가 남지 않도록)
        return _json(result)
    except Exception as e:
        return _json({"detail": f"AI 생성 오류: {str(e)}"}, 500)


@flask_app.route("/api/documents", methods=["GET", "OPTIONS"])
def list_documents():
    if flask_request.method == "OPTIONS":
        return _preflight()

    is_admin_req = flask_request.args.get("admin") == "1"
    is_admin = False
    if is_admin_req:
        ok, _ = require_admin(flask_request)
        is_admin = ok

    query = db.collection(DOCS_COLLECTION).order_by(
        "created_at", direction=firestore.Query.DESCENDING
    )
    if not is_admin:
        query = query.where("is_published", "==", True)

    docs = [_doc_to_dict(d.id, d.to_dict()) for d in query.stream()]
    return _json(docs)


@flask_app.route("/api/documents/<doc_id>", methods=["GET", "OPTIONS"])
def get_document(doc_id: str):
    if flask_request.method == "OPTIONS":
        return _preflight()
    ref = db.collection(DOCS_COLLECTION).document(doc_id)
    snap = ref.get()
    if not snap.exists:
        return _json({"detail": "문서를 찾을 수 없습니다"}, 404)
    data = snap.to_dict()
    # 비공개 문서는 관리자만 조회 가능. 존재 여부가 드러나지 않도록 404로 응답
    if not data.get("is_published", True):
        is_admin, _ = require_admin(flask_request)
        if not is_admin:
            return _json({"detail": "문서를 찾을 수 없습니다"}, 404)
    return _json(_doc_to_dict(snap.id, data))


@flask_app.route("/api/documents/slug/<slug>", methods=["GET", "OPTIONS"])
def get_document_by_slug(slug: str):
    if flask_request.method == "OPTIONS":
        return _preflight()
    results = (
        db.collection(DOCS_COLLECTION)
        .where("slug", "==", slug)
        .where("is_published", "==", True)
        .limit(1)
        .stream()
    )
    docs = list(results)
    if not docs:
        return _json({"detail": "공문을 찾을 수 없습니다"}, 404)
    return _json(_doc_to_dict(docs[0].id, docs[0].to_dict()))


@flask_app.route("/api/documents", methods=["POST"])
def create_document():
    is_admin, err = require_admin(flask_request)
    if not is_admin:
        return _json({"detail": err}, 401)
    body = flask_request.get_json(silent=True) or {}
    required = ["slug", "title", "doc_type", "issued_date", "recipients", "sender", "content"]
    for field in required:
        if not body.get(field):
            return _json({"detail": f"{field} 필드가 필요합니다"}, 400)

    # 슬러그 중복 확인
    existing = list(
        db.collection(DOCS_COLLECTION).where("slug", "==", body["slug"]).limit(1).stream()
    )
    if existing:
        return _json({"detail": "이미 존재하는 슬러그입니다"}, 409)

    now = datetime.now(timezone.utc).isoformat()
    content = _shorten(sanitize_html(body["content"]))
    data = {
        "slug": body["slug"],
        "title": body["title"],
        "doc_type": body.get("doc_type", "알림"),
        "logo_style": body.get("logo_style") if body.get("logo_style") in VALID_LOGO_STYLES else "name",
        "issued_date": body["issued_date"],
        "recipients": body["recipients"],
        "cc": body.get("cc", ""),
        "sender": body["sender"],
        "content": content,
        "link_codes": shortlinks.codes_in(db, content),
        "raw_input": body.get("raw_input", ""),
        "is_published": body.get("is_published", True),
        "created_at": now,
        "updated_at": now,
    }
    ref = db.collection(DOCS_COLLECTION).add(data)
    doc_id = ref[1].id
    return _json(_doc_to_dict(doc_id, data)), 201


@flask_app.route("/api/documents/<doc_id>", methods=["PUT", "OPTIONS"])
def update_document(doc_id: str):
    if flask_request.method == "OPTIONS":
        return _preflight()
    is_admin, err = require_admin(flask_request)
    if not is_admin:
        return _json({"detail": err}, 401)

    ref = db.collection(DOCS_COLLECTION).document(doc_id)
    snap = ref.get()
    if not snap.exists:
        return _json({"detail": "문서를 찾을 수 없습니다"}, 404)

    body = flask_request.get_json(silent=True) or {}
    allowed = ["slug", "title", "doc_type", "issued_date", "recipients",
               "cc", "sender", "content", "raw_input", "is_published", "logo_style"]
    updates = {k: v for k, v in body.items() if k in allowed}
    if "logo_style" in updates and updates["logo_style"] not in VALID_LOGO_STYLES:
        return _json({"detail": "logo_style 값이 올바르지 않습니다"}, 400)
    if "content" in updates:
        updates["content"] = _shorten(sanitize_html(updates["content"]))
        updates["link_codes"] = shortlinks.codes_in(db, updates["content"])

    # 슬러그 변경 시 중복 확인
    if "slug" in updates and updates["slug"] != snap.to_dict().get("slug"):
        existing = list(
            db.collection(DOCS_COLLECTION).where("slug", "==", updates["slug"]).limit(1).stream()
        )
        if existing:
            return _json({"detail": "이미 존재하는 슬러그입니다"}, 409)

    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    previous = snap.to_dict() or {}
    ref.update(updates)
    if "link_codes" in updates:
        # 이전 본문에 있었으나 새 본문에서 빠진 단축 링크 정리 (AI 재생성·수정으로 URL이 바뀐 경우)
        old_codes = previous.get("link_codes")
        if old_codes is None:
            old_codes = shortlinks.codes_in(db, previous.get("content", ""))
        shortlinks.release_unused(db, DOCS_COLLECTION, doc_id, set(old_codes) - set(updates["link_codes"]))
    updated = previous
    updated.update(updates)
    return _json(_doc_to_dict(doc_id, updated))


@flask_app.route("/api/documents/<doc_id>", methods=["DELETE", "OPTIONS"])
def delete_document(doc_id: str):
    if flask_request.method == "OPTIONS":
        return _preflight()
    is_admin, err = require_admin(flask_request)
    if not is_admin:
        return _json({"detail": err}, 401)

    ref = db.collection(DOCS_COLLECTION).document(doc_id)
    snap = ref.get()
    if not snap.exists:
        return _json({"detail": "문서를 찾을 수 없습니다"}, 404)
    data = snap.to_dict() or {}
    codes = data.get("link_codes")
    if codes is None:
        codes = shortlinks.codes_in(db, data.get("content", ""))
    ref.delete()
    shortlinks.release_unused(db, DOCS_COLLECTION, doc_id, set(codes))  # 이 문서만 쓰던 단축 링크 삭제
    return _json({"message": "삭제되었습니다"})


# ── Firebase Function 진입점 ───────────────────────────────────────────────────

@https_fn.on_request(
    secrets=["ANTHROPIC_API_KEY", "ADMIN_EMAILS"],
    cors=options.CorsOptions(
        cors_origins="*",
        cors_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    ),
    invoker="public",
    max_instances=5,  # 동시 실행 상한 — 트래픽 폭주·악의적 호출 시 비용 상한
)
def api(req: https_fn.Request) -> https_fn.Response:
    with flask_app.request_context(req.environ):
        return flask_app.full_dispatch_request()
