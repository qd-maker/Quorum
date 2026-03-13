#!/usr/bin/env python3
import json
import sys
import time
from urllib.request import Request, urlopen

BASE = sys.argv[1] if len(sys.argv) > 1 else "https://quorum.heyqi.xyz"


def post_json(path, payload, timeout=180):
    req = Request(
        BASE + path,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
    )
    return urlopen(req, timeout=timeout)


def test_health():
    with urlopen(BASE + "/health", timeout=30) as r:
        data = r.read().decode("utf-8")
        assert '"status":"ok"' in data, data
    print("[ok] health")


def test_chat_validation():
    try:
        with post_json("/api/chat", {}, timeout=30) as r:
            body = r.read().decode("utf-8")
            print(body)
    except Exception as e:
        text = str(e)
        if "422" not in text:
            raise
    print("[ok] chat route reachable")


def test_discuss_consensus():
    payload = {
        "topic": "测试讨论与共识链路是否完整",
        "models": ["gpt-4o", "gemini-2.0-flash", "grok-2", "deepseek-chat"],
        "rounds": 1,
    }
    with post_json("/api/discuss", payload, timeout=180) as r:
        got_consensus = False
        got_done = False
        started = time.time()
        for raw in r:
            line = raw.decode("utf-8", errors="ignore").strip()
            if not line.startswith("data: "):
                continue
            payload = line[6:].strip()
            if not payload:
                continue
            if '"type": "consensus_chunk"' in payload or '"type":"consensus_chunk"' in payload:
                got_consensus = True
            if '"type": "done"' in payload or '"type":"done"' in payload:
                got_done = True
                break
            if time.time() - started > 180:
                break
        assert got_consensus, "discuss returned no consensus_chunk"
        assert got_done, "discuss returned no done event"
    print("[ok] discuss consensus")


if __name__ == "__main__":
    test_health()
    test_chat_validation()
    test_discuss_consensus()
    print("all smoke tests passed")
