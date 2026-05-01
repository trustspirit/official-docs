from __future__ import annotations
import os
from datetime import datetime, timezone

import firebase_admin
from firebase_admin import credentials, firestore
from firebase_functions import https_fn, options
from flask import Flask, jsonify, request as flask_request
from dotenv import load_dotenv

from auth import (
    create_access_token, verify_token,
    require_admin, ADMIN_USERNAME, ADMIN_PASSWORD,
)
from ai import generate_document_content

load_dotenv()

# Firebase Admin 초기화
if not firebase_admin._apps:
    firebase_admin.initialize_app()

db = firestore.client()
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


# ── 문서 직렬화 ────────────────────────────────────────────────────────────────

def _doc_to_dict(doc_id: str, data: dict) -> dict:
    return {
        "id": doc_id,
        "slug": data.get("slug", ""),
        "title": data.get("title", ""),
        "doc_type": data.get("doc_type", "알림"),
        "issued_date": data.get("issued_date", ""),
        "recipients": data.get("recipients", ""),
        "cc": data.get("cc", ""),
        "sender": data.get("sender", ""),
        "content": data.get("content", ""),
        "raw_input": data.get("raw_input", ""),
        "is_published": data.get("is_published", True),
        "created_at": data.get("created_at", ""),
        "updated_at": data.get("updated_at", ""),
    }


# ── 라우팅 ─────────────────────────────────────────────────────────────────────

@flask_app.route("/api/auth/login", methods=["POST", "OPTIONS"])
def auth_login():
    if flask_request.method == "OPTIONS":
        return _preflight()
    body = flask_request.get_json(silent=True) or {}
    if body.get("username") != ADMIN_USERNAME or body.get("password") != ADMIN_PASSWORD:
        return _json({"detail": "아이디 또는 비밀번호가 올바르지 않습니다"}, 401)
    token = create_access_token({"sub": body["username"]})
    return _json({"access_token": token, "token_type": "bearer"})


@flask_app.route("/api/auth/me", methods=["GET", "OPTIONS"])
def auth_me():
    if flask_request.method == "OPTIONS":
        return _preflight()
    is_admin, err = require_admin(flask_request)
    if not is_admin:
        return _json({"detail": err}, 401)
    return _json({"username": ADMIN_USERNAME})


@flask_app.route("/api/auth/logout", methods=["POST", "OPTIONS"])
def auth_logout():
    if flask_request.method == "OPTIONS":
        return _preflight()
    return _json({"message": "로그아웃되었습니다"})


@flask_app.route("/api/generate", methods=["POST", "OPTIONS"])
def generate():
    if flask_request.method == "OPTIONS":
        return _preflight()
    is_admin, err = require_admin(flask_request)
    if not is_admin:
        return _json({"detail": err}, 401)
    body = flask_request.get_json(silent=True) or {}
    required = ["title", "doc_type", "issued_date", "recipients", "sender", "key_points"]
    for field in required:
        if not body.get(field):
            return _json({"detail": f"{field} 필드가 필요합니다"}, 400)
    try:
        html = generate_document_content(
            title=body["title"],
            doc_type=body["doc_type"],
            issued_date=body["issued_date"],
            recipients=body["recipients"],
            sender=body["sender"],
            key_points=body["key_points"],
            cc=body.get("cc", ""),
        )
        return _json({"content": html})
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
    return _json(_doc_to_dict(snap.id, snap.to_dict()))


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
    data = {
        "slug": body["slug"],
        "title": body["title"],
        "doc_type": body.get("doc_type", "알림"),
        "issued_date": body["issued_date"],
        "recipients": body["recipients"],
        "cc": body.get("cc", ""),
        "sender": body["sender"],
        "content": body["content"],
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
               "cc", "sender", "content", "raw_input", "is_published"]
    updates = {k: v for k, v in body.items() if k in allowed}

    # 슬러그 변경 시 중복 확인
    if "slug" in updates and updates["slug"] != snap.to_dict().get("slug"):
        existing = list(
            db.collection(DOCS_COLLECTION).where("slug", "==", updates["slug"]).limit(1).stream()
        )
        if existing:
            return _json({"detail": "이미 존재하는 슬러그입니다"}, 409)

    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    ref.update(updates)
    updated = snap.to_dict()
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
    if not ref.get().exists:
        return _json({"detail": "문서를 찾을 수 없습니다"}, 404)
    ref.delete()
    return _json({"message": "삭제되었습니다"})


# ── Firebase Function 진입점 ───────────────────────────────────────────────────

@https_fn.on_request(
    cors=options.CorsOptions(
        cors_origins="*",
        cors_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    ),
    invoker="public",
)
def api(req: https_fn.Request) -> https_fn.Response:
    with flask_app.request_context(req.environ):
        return flask_app.full_dispatch_request()
