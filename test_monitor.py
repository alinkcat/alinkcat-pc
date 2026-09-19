#!/usr/bin/env python3
"""
Test the ailinkcat PC WebSocket monitor data flow.

Acts as a phone client: connects, handshakes, subscribes, and
prints every monitor.update message it receives.

Usage:
  python3 test_monitor.py <PC_IP> <pairing_code>

Example:
  python3 test_monitor.py 192.168.1.100 123456
"""

import sys
import json
import time
import threading
from datetime import datetime

try:
    import websocket
except ImportError:
    print("Install websocket-client first:")
    print("  pip3 install websocket-client")
    sys.exit(1)


def ts():
    return datetime.now().strftime("%H:%M:%S.%f")[:-3]


def main():
    if len(sys.argv) < 3:
        print(f"Usage: {sys.argv[0]} <PC_IP> <pairing_code>")
        print(f"Example: {sys.argv[0]} 192.168.1.100 123456")
        sys.exit(1)

    host = sys.argv[1]
    code = sys.argv[2]
    port = 9527
    url = f"ws://{host}:{port}"

    print(f"[{ts()}] Connecting to {url} ...")

    ws = None
    got_data = {"count": 0}
    stop = threading.Event()

    def on_open(ws_):
        print(f"[{ts()}] WebSocket connected ✓")
        # send handshake
        handshake = {
            "jsonrpc": "2.0",
            "method": "handshake",
            "params": {
                "deviceName": "PythonTestClient",
                "appVersion": "0.0.1-test",
                "pairingCode": code,
            },
            "id": 1,
        }
        ws_.send(json.dumps(handshake))
        print(f"[{ts()}] Sent handshake (pairingCode={code})")

    def on_message(ws_, message):
        try:
            data = json.loads(message)
        except json.JSONDecodeError:
            print(f"[{ts()}] << non-JSON: {message[:200]}")
            return

        method = data.get("method", "")
        has_result = "result" in data
        has_error = "error" in data
        msg_id = data.get("id")

        # handshake response
        if has_result and msg_id == 1:
            result = data["result"]
            print(f"[{ts()}] Handshake OK ✓")
            print(f"         server: {result.get('serverName', '?')} "
                  f"v{result.get('serverVersion', '?')}")
            print(f"         deviceId: {result.get('deviceId', '?')}")
            print(f"         themes: {result.get('themeList', [])}")

            # subscribe to monitor data
            sub = {
                "jsonrpc": "2.0",
                "method": "monitor.subscribe",
                "params": {
                    "sources": ["cpu", "memory", "network",
                                "disk", "uptime", "battery"]
                },
                "id": 2,
            }
            ws_.send(json.dumps(sub))
            print(f"[{ts()}] Sent monitor.subscribe")
            print(f"[{ts()}] Waiting for monitor.update pushes...\n")
            return

        # subscribe response
        if has_result and msg_id == 2:
            print(f"[{ts()}] Subscribe confirmed: {data['result']}")
            return

        # monitor data push
        if method == "monitor.update":
            got_data["count"] += 1
            p = data.get("params", {})
            cpu = p.get("cpu")
            mem = p.get("memory")
            disk = p.get("disk")
            up = p.get("upload", "")
            down = p.get("download", "")
            uptime = p.get("uptime")
            batt = p.get("battery")

            batt_str = ""
            if batt and isinstance(batt, dict):
                batt_str = (f" | battery: {batt.get('level', '?')}%"
                            f" charging={batt.get('charging', '?')}")

            print(f"[{ts()}] #{got_data['count']:>3} "
                  f"CPU={cpu} MEM={mem} DISK={disk} "
                  f"NET={up}/{down} UP={uptime}{batt_str}")

            # check for null values
            nulls = []
            if cpu is None: nulls.append("cpu")
            if mem is None: nulls.append("memory")
            if disk is None: nulls.append("disk")
            if not up: nulls.append("upload")
            if not down: nulls.append("download")
            if uptime is None: nulls.append("uptime")
            if batt is None: nulls.append("battery")
            if nulls:
                print(f"         ⚠️  null fields: {', '.join(nulls)}")
            return

        # error
        if has_error:
            err = data["error"]
            print(f"[{ts()}] ✗ ERROR: {err}")
            return

        # anything else
        print(f"[{ts()}] << {data}")

    def on_error(ws_, error):
        print(f"[{ts()}] WebSocket error: {error}")

    def on_close(ws_, code_, reason):
        print(f"[{ts()}] WebSocket closed (code={code_} reason={reason})")
        stop.set()

    ws = websocket.WebSocketApp(
        url,
        on_open=on_open,
        on_message=on_message,
        on_error=on_error,
        on_close=on_close,
    )

    # run with timeout
    def run():
        ws.run_forever(ping_interval=5, ping_timeout=3)

    t = threading.Thread(target=run, daemon=True)
    t.start()

    # wait up to 30 seconds
    t.join(timeout=30)

    if got_data["count"] == 0:
        print(f"\n[{ts()}] ✗ No monitor.update received in 30s")
        print("  Possible causes:")
        print("  1. PC app not running or port 9527 blocked")
        print("  2. Pairing code mismatch")
        print("  3. Monitor scheduler not starting (check PC terminal for errors)")
        print("  4. All metrics returning None (check [Collector] debug output)")
        sys.exit(1)
    elif got_data["count"] < 5:
        print(f"\n[{ts()}] ⚠ Only {got_data['count']} updates in 30s (expected ~30)")
    else:
        print(f"\n[{ts()}] ✓ Received {got_data['count']} updates in ~30s")


if __name__ == "__main__":
    main()
