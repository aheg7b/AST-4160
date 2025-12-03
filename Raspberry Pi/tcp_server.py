import socket
import threading
import time
from device_manager import load_devices, save_devices

HOST = "0.0.0.0"
PORT = 5050

# This module exposes DATA (a runtime dict) that app.py will import and use.
DATA = {}
DEVICE_NAMES = load_devices()

def handle_client(conn, addr):
    """
    Expect a single packet from ESP-32:
      MAC;TEMP-C;HUMIDITY;SOIL MOISTURE;SOIL TEMP;PUMP ON/OFF;LIGHT ON/OFF;
    Respond with:
      PUMP_CMD;LIGHT_CMD;
    """
    try:
        with conn:
            raw = conn.recv(1024).decode().strip()
            if not raw:
                return
            parts = raw.split(";")
            # minimum expected fields: MAC, TEMP, HUM, MOIST, SOILT, PUMP, LIGHT
            if len(parts) < 7:
                return

            mac, temp, hum, moist, soilt, pump, light = parts[:7]

            # ensure friendly name exists
            if mac not in DEVICE_NAMES:
                DEVICE_NAMES[mac] = mac
                save_devices(DEVICE_NAMES)

            # update runtime data
            DATA[mac] = {
                "name": DEVICE_NAMES.get(mac, mac),
                "TEMP": temp,
                "HUM": hum,
                "MOIST": moist,
                "SOILT": soilt,
                "PUMP": pump,
                "LIGHT": light,
                "online": True,
                "last_seen": time.strftime("%Y-%m-%d %H:%M:%S")
            }

            # Check for pending commands; default to current state if none.
            pump_cmd = DATA[mac].get("PUMP_CMD", pump)
            light_cmd = DATA[mac].get("LIGHT_CMD", light)
            response = f"{pump_cmd};{light_cmd};"
            conn.sendall(response.encode())

            # small pause to ensure send completes (connection closes afterwards)
            time.sleep(0.05)

    except Exception as e:
        # optional: log error to stdout for debugging
        print(f"Error handling client {addr}: {e}")

def start_tcp(DATA_ref):
    """
    Start the TCP server (blocks). DATA_ref should be the central runtime dict
    that will be shared with the Flask app (pass the same dict instance).
    """
    global DATA
    DATA = DATA_ref

    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server.bind((HOST, PORT))
    server.listen()
    print(f"TCP server running on {HOST}:{PORT}")

    while True:
        conn, addr = server.accept()
        threading.Thread(target=handle_client, args=(conn, addr), daemon=True).start()
