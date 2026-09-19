#!/usr/bin/env python3
"""
Test ailinkcat PC WebSocket monitor — zero dependencies, stdlib only.

Usage:
  python3 test_monitor.py <PC_IP> <pairing_code>

Example:
  python3 test_monitor.py 127.0.0.1 2819
"""

import socket
import struct
import os
import json
import time
import hashlib
import base64
import sys
import threading
from datetime import datetime


def ts():
    return datetime.now().strftime("%H:%M:%S.%f")[:-3]


# ── minimal WebSocket client (RFC 6455) ──────────────────────────

def ws_handshake(sock):
    """Send HTTP upgrade, read 101 response."""
    key = base64.b64encode(os.urandom(16)).decode()
    req = (
        f"GET / HTTP/1.1\r\n"
        f"Host: {sock.getpeername()[0]}\r\n"
        f"Upgrade: websocket\r\n"
        f"Connection: Upgrade\r\n"
        f"Sec-WebSocket-Key: {key}\r\n"
        f"Sec-WebSocket-Version: 13\r\n"
        f"\r\n"
    )
    sock.sendall(req.encode())

    # read response headers
    buf = b""
    while b"\r\n\r\n" not in buf:
        chunk = sock.recv(4096)
        if not chunk:
            raise ConnectionError("handshake: connection closed")
        buf += chunk

    status = buf.split(b"\r\n")[0].decode()
    if "101" not in status:
        raise ConnectionError(f"handshake failed: {status}")

    # check accept key (optional, just verify it's there)
    accept = None
    for line in buf.split(b"\r\n"):
        if line.lower().startswith(b"sec-websocket-accept:"):
            accept = line.split(b":", 1)[1].strip().decode()
    expected = base64.b64encode(
        hashlib.sha1((key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").encode()).digest()
    ).decode()
    if accept and accept != expected:
        print(f"[{ts()}] ⚠ accept key mismatch (ignoring)")

    return buf


def ws_send(sock, text):
    """Send a text frame (client → server, must be masked)."""
    payload = text.encode("utf-8")
    mask_key = os.urandom(4)
    masked = bytearray(len(payload))
    for i, b in enumerate(payload):
        masked[i] = b ^ mask_key[i % 4]

    # frame header
    header = bytearray()
    header.append(0x81)  # FIN + text opcode
    length = len(payload)
    if length < 126:
        header.append(0x80 | length)  # MASK bit set
    elif length < 65536:
        header.append(0x80 | 126)
        header.extend(struct.pack(">H", length))
    else:
        header.append(0x80 | 127)
        header.extend(struct.pack(">Q", length))
    header.extend(mask_key)
    header.extend(masked)
    sock.sendall(header)


def ws_recv(sock):
    """Read one WebSocket frame. Returns text or None on close."""
    # read first 2 bytes
    hdr = _recv_exact(sock, 2)
    if hdr is None:
        return None

    fin = hdr[0] & 0x80
    opcode = hdr[0] & 0x0F
    masked = hdr[1] & 0x80
    length = hdr[1] & 0x7F

    if length == 126:
        ext = _recv_exact(sock, 2)
        length = struct.unpack(">H", ext)[0]
    elif length == 127:
        ext = _recv_exact(sock, 8)
        length = struct.unpack(">Q", ext)[0]

    if masked:
        mask_key = _recv_exact(sock, 4)

    payload = _recv_exact(sock, length) if length > 0 else b""
    if masked and payload:
        payload = bytes(payload[i] ^ mask_key[i % 4] for i in range(len(payload)))

    if opcode == 0x8:  # close
        return None
    if opcode == 0x9:  # ping → send pong
        ws_send_raw_pong(sock, payload)
        return ws_recv(sock)  # read next frame
    if opcode == 0xA:  # pong
        return ws_recv(sock)

    return payload.decode("utf-8", errors="replace") if payload else ""


def _recv_exact(sock, n):
    buf = b""
    while len(buf) < n:
        chunk = sock.recv(n - len(buf))
        if not chunk:
            return None
        buf += chunk
    return buf


def ws_send_raw_pong(sock, data):
    header = bytearray()
    header.append(0x8A)  # FIN + pong
    header.append(len(data))
    header.extend(data)
    sock.sendall(header)


# ── main test ─────────────────────────────────────────────────────

def main():
    if len(sys.argv) < 3:
        print(f"Usage: {sys.argv[0]} <PC_IP> <pairing_code>")
        print(f"Example: {sys.argv[0]} 127.0.0.1 2819")
        sys.exit(1)

    host = sys.argv[1]
    code = sys.argv[2]
    port = 9527

    print(f"[{ts()}] Connecting to {host}:{port} ...")
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(10)
    try:
        sock.connect((host, port))
    except Exception as e:
        print(f"[{ts()}] ✗ Cannot connect: {e}")
        print("  Is the PC app running? Check port 9527.")
        sys.exit(1)

    try:
        ws_handshake(sock)
    except Exception as e:
        print(f"[{ts()}] ✗ WebSocket upgrade failed: {e}")
        sys.exit(1)
    print(f"[{ts()}] WebSocket connected ✓")

    sock.settimeout(35)

    # send handshake
    handshake = {
        "jsonrpc": "2.0",
        "method": "handshake",
        "params": {
            "deviceName": "PythonTest",
            "appVersion": "0.0.1-test",
            "pairingCode": code,
        },
        "id": 1,
    }
    ws_send(sock, json.dumps(handshake))
    print(f"[{ts()}] Sent handshake (code={code})")

    got_data = {"count": 0}
    subscribed = [False]

    while True:
        try:
            msg = ws_recv(sock)
        except socket.timeout:
            if got_data["count"] == 0:
                print(f"\n[{ts()}] ✗ No data received in 35s")
                print("  Check PC terminal for [Collector] / [Monitor] logs.")
            break
        except Exception as e:
            print(f"[{ts()}] Connection error: {e}")
            break

        if msg is None:
            print(f"[{ts()}] Connection closed by server")
            break

        if not msg:
            continue

        try:
            data = json.loads(msg)
        except json.JSONDecodeError:
            continue

        method = data.get("method", "")
        msg_id = data.get("id")
        has_result = "result" in data
        has_error = "error" in data

        # handshake response
        if has_result and msg_id == 1:
            r = data["result"]
            print(f"[{ts()}] Handshake OK ✓")
            print(f"         server: {r.get('serverName', '?')} v{r.get('serverVersion', '?')}")
            print(f"         deviceId: {r.get('deviceId', '?')}")
            print(f"         themes: {r.get('themeList', [])}")

            # subscribe
            sub = {
                "jsonrpc": "2.0",
                "method": "monitor.subscribe",
                "params": {
                    "sources": ["cpu", "memory", "network",
                                "disk", "uptime", "battery"]
                },
                "id": 2,
            }
            ws_send(sock, json.dumps(sub))
            print(f"[{ts()}] Sent monitor.subscribe")
            print(f"[{ts()}] Waiting for data...\n")
            subscribed[0] = True
            continue

        # subscribe response
        if has_result and msg_id == 2:
            print(f"[{ts()}] Subscribe confirmed: {data['result']}")
            continue

        # error
        if has_error:
            print(f"[{ts()}] ✗ ERROR: {data['error']}")
            continue

        # monitor data
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
            if batt is not None:
                if isinstance(batt, dict):
                    batt_str = (f" | batt: {batt.get('level', '?')}%"
                                f" chg={batt.get('charging', '?')}")
                else:
                    batt_str = f" | batt: {batt}%"

            nulls = []
            if cpu is None: nulls.append("cpu")
            if mem is None: nulls.append("memory")
            if disk is None: nulls.append("disk")
            if not up: nulls.append("upload")
            if not down: nulls.append("download")
            if uptime is None: nulls.append("uptime")
            if batt is None: nulls.append("battery")
            warn = f" ⚠ nulls: {','.join(nulls)}" if nulls else ""

            n = got_data["count"]
            print(f"[{ts()}] #{n:>3} CPU={cpu} MEM={mem} DISK={disk} "
                  f"NET=↑{up} ↓{down} UP={uptime}{batt_str}{warn}")

            if n >= 20:
                print(f"\n[{ts()}] ✓ Got 20 updates, data flow is working")
                break

    if got_data["count"] == 0:
        print(f"\n[{ts()}] ✗ No monitor.update received")
        print("  Check PC terminal for:")
        print("    [Monitor] tick=N clients=N subs=N pushed=N ...")
        print("    [Collector] cpu=... mem=... ...")
    elif got_data["count"] < 5:
        print(f"\n[{ts()}] ⚠ Only {got_data['count']} updates (expected 20+)")
    else:
        print(f"\n[{ts()}] ✓ {got_data['count']} updates received")

    sock.close()


if __name__ == "__main__":
    main()
