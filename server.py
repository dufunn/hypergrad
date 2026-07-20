#!/usr/bin/env python3
"""Local launcher and same-origin place-search bridge for the dashboard."""

from __future__ import annotations

import argparse
import json
import os
import re
import secrets
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import webbrowser
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


ROOT = Path(__file__).resolve().parent
PHOTON_URL = "https://photon.komoot.io/api/"
CACHE_TTL_SECONDS = 600
FRIEND_STORE = ROOT / "friend-spaces.local.json"
_cache: dict[str, tuple[float, bytes]] = {}
_cache_lock = threading.Lock()
_friend_store_lock = threading.Lock()


def _load_friend_spaces() -> dict[str, dict]:
    try:
        payload = json.loads(FRIEND_STORE.read_text(encoding="utf-8"))
        return payload if isinstance(payload, dict) else {}
    except (FileNotFoundError, OSError, ValueError):
        return {}


def _save_friend_spaces(spaces: dict[str, dict]) -> None:
    temporary = FRIEND_STORE.with_suffix(".tmp")
    temporary.write_text(json.dumps(spaces, ensure_ascii=False, indent=2), encoding="utf-8")
    temporary.replace(FRIEND_STORE)


class DashboardHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self) -> None:  # noqa: N802 - inherited HTTP API
        parsed = urllib.parse.urlsplit(self.path)
        if parsed.path == "/runtime-config.js":
            self._send_runtime_config()
            return
        if parsed.path == "/api/search":
            self._search_places(parsed.query)
            return
        if parsed.path == "/api/friend-spaces":
            self._send_json_object({"status": "ok", "service": "friend-spaces"})
            return
        if parsed.path.startswith("/api/friend-spaces/"):
            self._get_friend_space(parsed.path.rsplit("/", 1)[-1])
            return
        super().do_GET()

    def _send_runtime_config(self) -> None:
        supabase = {key: value for key, value in {
            "url": os.environ.get("SUPABASE_URL", "").strip(),
            "anonKey": os.environ.get("SUPABASE_PUBLISHABLE_KEY", "").strip(),
        }.items() if value}
        amap = {key: value for key, value in {
            "key": os.environ.get("AMAP_KEY", "").strip(),
            "securityJsCode": os.environ.get("AMAP_SECURITY_JS_CODE", "").strip(),
        }.items() if value}
        source = (
            f"window.SUPABASE_CONFIG=Object.assign({{}},window.SUPABASE_CONFIG||{{}},{json.dumps(supabase)});\n"
            f"window.AMAP_CONFIG=Object.assign({{}},window.AMAP_CONFIG||{{}},{json.dumps(amap)});\n"
        ).encode("utf-8")
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "application/javascript; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(source)))
        self.end_headers()
        self.wfile.write(source)

    def do_POST(self) -> None:  # noqa: N802 - inherited HTTP API
        parsed = urllib.parse.urlsplit(self.path)
        if parsed.path == "/api/friend-spaces":
            self._create_friend_space()
            return
        self._json_error(HTTPStatus.NOT_FOUND, "接口不存在。")

    def do_PUT(self) -> None:  # noqa: N802 - inherited HTTP API
        parsed = urllib.parse.urlsplit(self.path)
        if parsed.path.startswith("/api/friend-spaces/"):
            self._update_friend_space(parsed.path.rsplit("/", 1)[-1])
            return
        self._json_error(HTTPStatus.NOT_FOUND, "接口不存在。")

    def do_DELETE(self) -> None:  # noqa: N802 - inherited HTTP API
        parsed = urllib.parse.urlsplit(self.path)
        if parsed.path.startswith("/api/friend-spaces/"):
            self._delete_friend_space(parsed.path.rsplit("/", 1)[-1])
            return
        self._json_error(HTTPStatus.NOT_FOUND, "接口不存在。")

    def _read_json_body(self) -> dict | None:
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if length <= 0 or length > 512_000:
            self._json_error(HTTPStatus.BAD_REQUEST, "请求内容无效。")
            return None
        try:
            payload = json.loads(self.rfile.read(length))
        except (ValueError, UnicodeDecodeError):
            self._json_error(HTTPStatus.BAD_REQUEST, "请求内容不是有效 JSON。")
            return None
        if not isinstance(payload, dict):
            self._json_error(HTTPStatus.BAD_REQUEST, "请求内容格式无效。")
            return None
        return payload

    def _sanitize_friend_space(self, payload: dict) -> dict | None:
        display_name = str(payload.get("displayName") or "朋友").strip()[:24] or "朋友"
        raw_points = payload.get("points")
        if not isinstance(raw_points, list) or len(raw_points) > 300:
            self._json_error(HTTPStatus.BAD_REQUEST, "共享点位数量无效。")
            return None
        points = []
        for index, raw_point in enumerate(raw_points):
            if not isinstance(raw_point, dict):
                continue
            try:
                lng = round(float(raw_point.get("lng")), 6)
                lat = round(float(raw_point.get("lat")), 6)
            except (TypeError, ValueError):
                continue
            if not (-180 <= lng <= 180 and -90 <= lat <= 90):
                continue
            points.append({
                "id": str(raw_point.get("id") or f"point-{index}")[:80],
                "city": str(raw_point.get("city") or "")[:40],
                "lng": lng,
                "lat": lat,
            })
        return {"displayName": display_name, "points": points}

    def _create_friend_space(self) -> None:
        payload = self._read_json_body()
        if payload is None:
            return
        sanitized = self._sanitize_friend_space(payload)
        if sanitized is None:
            return
        with _friend_store_lock:
            spaces = _load_friend_spaces()
            code = secrets.token_hex(6).upper()
            while code in spaces:
                code = secrets.token_hex(6).upper()
            token = secrets.token_urlsafe(32)
            updated_at = int(time.time())
            spaces[code] = {**sanitized, "token": token, "updatedAt": updated_at}
            _save_friend_spaces(spaces)
        self._send_json_object({"code": code, "ownerToken": token, "updatedAt": updated_at}, status=HTTPStatus.CREATED)

    def _update_friend_space(self, raw_code: str) -> None:
        code = raw_code.strip().upper()
        if not re.fullmatch(r"[A-Z0-9]{6,12}", code):
            self._json_error(HTTPStatus.NOT_FOUND, "共享码不存在。")
            return
        payload = self._read_json_body()
        if payload is None:
            return
        sanitized = self._sanitize_friend_space(payload)
        if sanitized is None:
            return
        authorization = self.headers.get("Authorization", "")
        token = authorization.removeprefix("Bearer ").strip()
        with _friend_store_lock:
            spaces = _load_friend_spaces()
            existing = spaces.get(code)
            if not existing:
                self._json_error(HTTPStatus.NOT_FOUND, "共享码不存在。")
                return
            if not token or not secrets.compare_digest(token, str(existing.get("token") or "")):
                self._json_error(HTTPStatus.FORBIDDEN, "没有权限更新这个共享空间。")
                return
            updated_at = int(time.time())
            spaces[code] = {**sanitized, "token": existing["token"], "updatedAt": updated_at}
            _save_friend_spaces(spaces)
        self._send_json_object({"code": code, "updatedAt": updated_at})

    def _get_friend_space(self, raw_code: str) -> None:
        code = raw_code.strip().upper()
        if not re.fullmatch(r"[A-Z0-9]{6,12}", code):
            self._json_error(HTTPStatus.NOT_FOUND, "共享码不存在。")
            return
        with _friend_store_lock:
            space = _load_friend_spaces().get(code)
        if not space:
            self._json_error(HTTPStatus.NOT_FOUND, "共享码不存在。")
            return
        self._send_json_object({
            "code": code,
            "displayName": space.get("displayName") or "朋友",
            "points": space.get("points") or [],
            "updatedAt": space.get("updatedAt"),
        })

    def _delete_friend_space(self, raw_code: str) -> None:
        code = raw_code.strip().upper()
        if not re.fullmatch(r"[A-Z0-9]{6,12}", code):
            self._json_error(HTTPStatus.NOT_FOUND, "共享码不存在。")
            return
        authorization = self.headers.get("Authorization", "")
        token = authorization.removeprefix("Bearer ").strip()
        with _friend_store_lock:
            spaces = _load_friend_spaces()
            existing = spaces.get(code)
            if not existing:
                self._json_error(HTTPStatus.NOT_FOUND, "共享码不存在。")
                return
            if not token or not secrets.compare_digest(token, str(existing.get("token") or "")):
                self._json_error(HTTPStatus.FORBIDDEN, "没有权限停止这个共享空间。")
                return
            spaces.pop(code, None)
            _save_friend_spaces(spaces)
        self._send_json_object({"code": code, "deleted": True})

    def _search_places(self, raw_query: str) -> None:
        query = urllib.parse.parse_qs(raw_query)
        term = (query.get("q") or [""])[0].strip()
        if len(term) < 2 or len(term) > 160:
            self._json_error(HTTPStatus.BAD_REQUEST, "请输入 2–160 个字符的地点名称。")
            return

        try:
            limit = min(max(int((query.get("limit") or ["8"])[0]), 1), 8)
        except ValueError:
            limit = 8
        allowed = {
            "q": term,
            "limit": limit,
            "countrycode": "CN",
        }
        for key in ("lat", "lon", "zoom", "location_bias_scale"):
            value = (query.get(key) or [""])[0]
            if value:
                allowed[key] = value

        upstream_url = f"{PHOTON_URL}?{urllib.parse.urlencode(allowed)}"
        now = time.time()
        with _cache_lock:
            cached = _cache.get(upstream_url)
        if cached and now - cached[0] < CACHE_TTL_SECONDS:
            self._send_json(cached[1], cache_status="HIT")
            return

        request = urllib.request.Request(
            upstream_url,
            headers={
                "Accept": "application/geo+json, application/json",
                "User-Agent": "CampusBaseDashboard/1.0 (personal local dashboard)",
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=12) as response:
                payload = response.read(2_000_000)
            json.loads(payload)
        except (urllib.error.URLError, TimeoutError, ValueError) as error:
            self.log_error("Place search failed: %s", error)
            self._json_error(HTTPStatus.BAD_GATEWAY, "地点搜索服务暂时不可用。")
            return

        with _cache_lock:
            _cache[upstream_url] = (now, payload)
        self._send_json(payload, cache_status="MISS")

    def _send_json(self, payload: bytes, cache_status: str | None = None) -> None:
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "application/geo+json; charset=utf-8")
        self.send_header("Cache-Control", "private, max-age=300")
        if cache_status:
            self.send_header("X-Dashboard-Cache", cache_status)
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def _send_json_object(self, value: dict, status: HTTPStatus = HTTPStatus.OK) -> None:
        payload = json.dumps(value, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def _json_error(self, status: HTTPStatus, message: str) -> None:
        payload = json.dumps({"error": message}, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)


def main() -> None:
    parser = argparse.ArgumentParser(description="启动校招 Base 地图看板")
    parser.add_argument("--host", default=os.environ.get("HOST", "127.0.0.1"))
    parser.add_argument("--port", default=int(os.environ.get("PORT", "4175")), type=int)
    parser.add_argument("--open", action="store_true", dest="open_browser")
    args = parser.parse_args()

    url = f"http://{args.host}:{args.port}/"
    server = ThreadingHTTPServer((args.host, args.port), DashboardHandler)
    print(f"校招 Base 地图看板已启动：{url}")
    print("保持此窗口开启；按 Control-C 可停止。")
    if args.open_browser:
        threading.Timer(0.5, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
