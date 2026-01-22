#!/usr/bin/env python3
"""Simple server for RalphGen with gallery API."""

import json
import os
import re
import uuid
import base64
from pathlib import Path
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse
from urllib.request import urlopen, Request
from urllib.error import URLError, HTTPError

GALLERY_DIR = Path(__file__).parent / "gallery"
GALLERY_DIR.mkdir(exist_ok=True)

MAX_GALLERY_ITEMS = 50
MAX_REQUEST_SIZE = 10 * 1024 * 1024  # 10MB max request size
MAX_PROMPT_LENGTH = 500  # Max prompt characters
Z_IMAGE_ENDPOINT = os.environ.get("Z_IMAGE_ENDPOINT", "http://localhost:8000/generate")

# UUID v4 pattern for validation
UUID_PATTERN = re.compile(r'^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$', re.IGNORECASE)


def is_valid_uuid(value: str) -> bool:
    """Validate that a string is a valid UUID v4."""
    if not value or not isinstance(value, str):
        return False
    return bool(UUID_PATTERN.match(value))


def sanitize_prompt(prompt: str) -> str:
    """Sanitize prompt text - limit length and remove control characters."""
    if not prompt or not isinstance(prompt, str):
        return ""
    # Remove control characters except newlines and tabs
    sanitized = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', prompt)
    return sanitized[:MAX_PROMPT_LENGTH]


def validate_base64_image(data: str) -> bytes | None:
    """Validate and decode base64 image data. Returns decoded bytes or None if invalid."""
    if not data or not isinstance(data, str):
        return None
    try:
        decoded = base64.b64decode(data, validate=True)
        # Check for PNG magic bytes
        if decoded[:8] == b'\x89PNG\r\n\x1a\n':
            return decoded
        # Check for JPEG magic bytes
        if decoded[:2] == b'\xff\xd8':
            return decoded
        return None
    except Exception:
        return None


def safe_gallery_path(image_id: str) -> Path | None:
    """Get a safe path within the gallery directory. Returns None if path would escape."""
    if not is_valid_uuid(image_id):
        return None
    path = GALLERY_DIR / f"{image_id}.png"
    # Resolve to absolute path and verify it's within gallery
    try:
        resolved = path.resolve()
        gallery_resolved = GALLERY_DIR.resolve()
        if not str(resolved).startswith(str(gallery_resolved)):
            return None
        return path
    except Exception:
        return None


class RalphGenHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)

        if parsed.path == "/api/config":
            self.send_config()
        elif parsed.path == "/api/gallery":
            self.send_gallery()
        else:
            super().do_GET()

    def send_config(self):
        """Return app configuration."""
        config = {
            "zImageEndpoint": Z_IMAGE_ENDPOINT
        }
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(config).encode())

    def do_POST(self):
        parsed = urlparse(self.path)

        if parsed.path == "/api/generate":
            self.proxy_generate()
        elif parsed.path == "/api/gallery":
            self.save_to_gallery()
        elif parsed.path == "/api/gallery/delete":
            self.delete_from_gallery()
        else:
            self.send_error(404)

    def proxy_generate(self):
        """Proxy image generation request to z-image backend."""
        content_length = int(self.headers.get("Content-Length", 0))
        if content_length <= 0 or content_length > 10000:
            self.send_error(413, "Request too large")
            return

        try:
            body = self.rfile.read(content_length)
            req = Request(
                Z_IMAGE_ENDPOINT,
                data=body,
                headers={"Content-Type": "application/json"}
            )
            with urlopen(req, timeout=120) as resp:
                result = resp.read()
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(result)
        except HTTPError as e:
            self.send_error(e.code, str(e.reason))
        except URLError as e:
            self.send_error(502, f"Backend error: {e.reason}")
        except Exception as e:
            self.send_error(500, str(e))

    def send_gallery(self):
        """Return list of gallery items."""
        items = []
        index_file = GALLERY_DIR / "index.json"

        if index_file.exists():
            items = json.loads(index_file.read_text())

        # Return last N items, newest first
        items = items[-MAX_GALLERY_ITEMS:]
        items.reverse()

        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(items).encode())

    def save_to_gallery(self):
        """Save an image to the gallery."""
        # Check content length
        content_length = int(self.headers.get("Content-Length", 0))
        if content_length <= 0 or content_length > MAX_REQUEST_SIZE:
            self.send_error(413, "Request too large")
            return

        try:
            body = self.rfile.read(content_length)
            data = json.loads(body)
        except (json.JSONDecodeError, Exception):
            self.send_error(400, "Invalid JSON")
            return

        image_data = data.get("image", "")
        prompt = sanitize_prompt(data.get("prompt", ""))

        # Extract base64 data from data URL
        if "," in image_data:
            image_data = image_data.split(",", 1)[1]

        # Validate and decode image
        image_bytes = validate_base64_image(image_data)
        if image_bytes is None:
            self.send_error(400, "Invalid image data")
            return

        # Generate UUID and get safe path
        image_id = str(uuid.uuid4())
        image_path = safe_gallery_path(image_id)
        if image_path is None:
            self.send_error(500, "Failed to create image path")
            return

        image_path.write_bytes(image_bytes)

        # Update index
        index_file = GALLERY_DIR / "index.json"
        items = []
        if index_file.exists():
            try:
                items = json.loads(index_file.read_text())
            except json.JSONDecodeError:
                items = []

        # Validate timestamp
        timestamp = data.get("timestamp", 0)
        if not isinstance(timestamp, (int, float)) or timestamp < 0:
            timestamp = 0

        items.append({
            "id": image_id,
            "prompt": prompt,
            "timestamp": int(timestamp),
            "image": f"/gallery/{image_id}.png"
        })

        # Keep only last N items
        if len(items) > MAX_GALLERY_ITEMS:
            # Remove old images safely
            for old_item in items[:-MAX_GALLERY_ITEMS]:
                old_id = old_item.get("id", "")
                old_path = safe_gallery_path(old_id)
                if old_path:
                    old_path.unlink(missing_ok=True)
            items = items[-MAX_GALLERY_ITEMS:]

        index_file.write_text(json.dumps(items, indent=2))

        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({"success": True, "id": image_id}).encode())

    def delete_from_gallery(self):
        """Delete an image from the gallery."""
        content_length = int(self.headers.get("Content-Length", 0))
        if content_length <= 0 or content_length > 1024:  # Delete requests should be small
            self.send_error(413, "Request too large")
            return

        try:
            body = self.rfile.read(content_length)
            data = json.loads(body)
        except (json.JSONDecodeError, Exception):
            self.send_error(400, "Invalid JSON")
            return

        image_id = data.get("id", "")

        # Validate UUID to prevent path traversal
        if not is_valid_uuid(image_id):
            self.send_error(400, "Invalid image ID")
            return

        # Get safe path and remove image file
        image_path = safe_gallery_path(image_id)
        if image_path:
            image_path.unlink(missing_ok=True)

        # Update index
        index_file = GALLERY_DIR / "index.json"
        items = []
        if index_file.exists():
            try:
                items = json.loads(index_file.read_text())
            except json.JSONDecodeError:
                items = []

        items = [item for item in items if item.get("id") != image_id]
        index_file.write_text(json.dumps(items, indent=2))

        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({"success": True}).encode())


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8080"))
    server = HTTPServer(("", port), RalphGenHandler)
    print(f"RalphGen server running at http://localhost:{port}")
    server.serve_forever()
