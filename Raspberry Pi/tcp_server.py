import socket
import threading
import json
from datetime import datetime
from flask import Flask, render_template, request

app = Flask(__name__)

DATA_FILE = "devices.json"
DEVICE_NAMES = {}
DATA = {}  # store latest device info
HISTORY = {}  # store historical data

# Load device names
try:
    with open(DATA_FILE,"r") as f:
        DEVICE_NAMES = json.load(f)
except:
    DEVICE_NAMES = {}

TCP_IP = "0.0.0.0"
TCP_PORT = 5050

def parse_float_safe(val):
    try:
        return float(val)
    except:
        return 0

def handle_client(conn, addr):
    try:
        data = conn.recv(1024).decode().strip()
        if not data: return
        parts = data.split(";")
        if len(parts) < 8: return

        mac, temp, hum, moist, soilt, light_val, pump, light = parts[:8]

        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        entry = DATA.get(mac, {})
        entry.update({
            "name": DEVICE_NAMES.get(mac, mac),
            "TEMP": temp,
            "HUM": hum,
            "MOIST": moist,
            "SOILT": soilt,
            "LIGHT_VAL": light_val,
            "PUMP": pump,
            "LIGHT": light,
            "online": True,
            "last_seen": now_str
        })
        DATA[mac] = entry

        # add to history
        hist_point = {
            "ts": now_str,
            "TEMP": parse_float_safe(temp),
            "HUM": parse_float_safe(hum),
            "MOIST": parse_float_safe(moist),
            "SOILT": parse_float_safe(soilt),
            "LIGHT_VAL": parse_float_safe(light_val),
            "PUMP": pump,
            "LIGHT": light
        }
        HISTORY.setdefault(mac, []).append(hist_point)
        if len(HISTORY[mac])>200:
            HISTORY[mac] = HISTORY[mac][-200:]

        # Prepare response (handle AUTO mode)
        pump_cmd = pump
        light_cmd = light

        if pump_cmd=="AUTO":
            pump_cmd = "ON" if parse_float_safe(moist)<350 else "OFF"
        if light_cmd=="AUTO":
            light_cmd = "ON" if parse_float_safe(light_val)<100 else "OFF"

        response = f"{pump_cmd};{light_cmd};"
        conn.sendall(response.encode())
    finally:
        conn.close()

def tcp_server():
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind((TCP_IP, TCP_PORT))
    s.listen(5)
    print(f"TCP server listening on {TCP_IP}:{TCP_PORT}")
    while True:
        conn, addr = s.accept()
        threading.Thread(target=handle_client,args=(conn,addr)).start()

@app.route("/")
def index():
    return render_template("index.html", data=DATA)

@app.route("/rename", methods=["POST"])
def rename():
    mac = request.form.get("mac")
    new_name = request.form.get("name")
    if mac and new_name:
        DEVICE_NAMES[mac] = new_name
        with open(DATA_FILE,"w") as f:
            json.dump(DEVICE_NAMES,f)
    return "OK"

if __name__=="__main__":
    threading.Thread(target=tcp_server,daemon=True).start()
    app.run(host="0.0.0.0",port=5000,debug=True)
