from __future__ import annotations
import os
import uuid
from urllib.parse import quote

from firebase_admin import storage

MAX_IMAGE_BYTES = 5 * 1024 * 1024  # Claude API 이미지당 5MB 제한과 동일
UPLOAD_PREFIX = "uploads/"


def sniff_image_type(data: bytes) -> str | None:
    """Content-Type 헤더를 믿지 않고 파일 시그니처로 이미지 형식을 판별."""
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data[:6] in (b"GIF87a", b"GIF89a"):
        return "image/gif"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


def _bucket():
    return storage.bucket(os.getenv("STORAGE_BUCKET") or None)


def _download_url(bucket_name: str, path: str, token: str) -> str:
    emulator = os.getenv("STORAGE_EMULATOR_HOST")
    if emulator:
        base = emulator if emulator.startswith("http") else f"http://{emulator}"
    else:
        base = "https://firebasestorage.googleapis.com"
    return f"{base}/v0/b/{bucket_name}/o/{quote(path, safe='')}?alt=media&token={token}"


def upload_image(data: bytes, media_type: str) -> dict:
    """이미지를 Storage에 저장하고 {path, url, media_type} 반환. 규칙 없이도 열리도록 다운로드 토큰 URL 사용."""
    ext = {"image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp"}[media_type]
    path = f"{UPLOAD_PREFIX}{uuid.uuid4().hex}.{ext}"
    token = uuid.uuid4().hex
    bucket = _bucket()
    blob = bucket.blob(path)
    blob.metadata = {"firebaseStorageDownloadTokens": token}
    blob.upload_from_string(data, content_type=media_type)
    return {"path": path, "url": _download_url(bucket.name, path, token), "media_type": media_type}


def load_image(path: str) -> dict:
    """업로드된 이미지를 읽어 {data, media_type, url} 반환. uploads/ 밖의 경로는 거부."""
    if not path.startswith(UPLOAD_PREFIX) or ".." in path:
        raise ValueError("잘못된 이미지 경로입니다")
    bucket = _bucket()
    blob = bucket.blob(path)
    if not blob.exists():
        raise ValueError("업로드된 이미지를 찾을 수 없습니다")
    blob.reload()
    token = (blob.metadata or {}).get("firebaseStorageDownloadTokens", "")
    return {
        "data": blob.download_as_bytes(),
        "media_type": blob.content_type,
        "url": _download_url(bucket.name, path, token),
    }
