import json
import os
import sys
from typing import Tuple

try:
    import requests
    HAS_REQUESTS = True
except Exception:
    import urllib.request
    import urllib.error
    HAS_REQUESTS = False


def _load_example() -> dict:
    script_dir = os.path.dirname(os.path.abspath(__file__))
    example_path = os.path.join(script_dir, "example.json")
    if not os.path.exists(example_path):
        raise FileNotFoundError(f"example.json not found at {example_path}")
    with open(example_path, "r", encoding="utf-8") as f:
        return json.load(f)


def _post_json_requests(url: str, payload: dict) -> Tuple[int, dict]:
    resp = requests.post(url, json=payload, timeout=60)
    try:
        return resp.status_code, resp.json()
    except Exception:
        return resp.status_code, {"raw": resp.text}


def _post_json_urllib(url: str, payload: dict) -> Tuple[int, dict]:
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            status = resp.getcode()
            raw = resp.read()
            try:
                return status, json.loads(raw.decode("utf-8"))
            except Exception:
                return status, {"raw": raw.decode("utf-8", errors="replace")}
    except urllib.error.HTTPError as e:
        try:
            body = e.read()
            return e.code, json.loads(body.decode("utf-8"))
        except Exception:
            return e.code, {"raw": str(e)}


def run_test(server_url: str = "http://127.0.0.1:5000"):
    """Send example.json to a remote server and print the response.

    server_url: base URL like http://127.0.0.1:5000 or http://192.168.1.20:5000
    """
    example = _load_example()
    payload = {"data": example}

    endpoint = "/generate"
    url = server_url.rstrip("/") + endpoint

    print(f"Sending to {url} ...")
    try:
        if HAS_REQUESTS:
            status, body = _post_json_requests(url, payload)
        else:
            status, body = _post_json_urllib(url, payload)
    except Exception as e:
        print("Request failed:", e)
        return

    print("Status:", status)
    print(json.dumps(body, ensure_ascii=False, indent=2))

    if isinstance(body, dict) and body.get("ok") and "result" in body:
        print("\n--- Сгенерированный текст ---")
        print(body["result"])


if __name__ == "__main__":
    server = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:5000"
    run_test(server)