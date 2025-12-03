#!/usr/bin/env python3
"""
Simple TCP test client to mimic ESP32 sending one packet and printing server response.

Usage:
    python3 test_client.py 192.168.1.100 5050 AA:BB:CC:11:22:33
"""
import socket
import sys
import time
import random

if len(sys.argv) < 4:
    print("Usage: python3 test_client.py <server_ip> <port> <mac> [temp] [hum] [moist] [soilt]")
    sys.exit(1)

server = sys.argv[1]
port = int(sys.argv[2])
mac = sys.argv[3]

# optional arguments
temp = sys.argv[4] if len(sys.argv) > 4 else f"{23.5 + random.uniform(-1,1):.2f}"
hum = sys.argv[5] if len(sys.argv) > 5 else f"{55 + random.uniform(-5,5):.2f}"
moist = sys.argv[6] if len(sys.argv) > 6 else f"{400 + random.randint(-30,30)}"
soilt = sys.argv[7] if len(sys.argv) > 7 else f"{20.0 + random.uniform(-1,1):.2f}"

packet = f"{mac};{temp};{hum};{moist};{soilt};OFF;OFF;"

print("Packet:", packet)
with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
    s.settimeout(3.0)
    try:
        s.connect((server, port))
        s.sendall(packet.encode())
        data = s.recv(1024)
        print("Response:", data.decode().strip())
    except Exception as e:
        print("Error:", e)
