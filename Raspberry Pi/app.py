import threading
import socket
import time
import csv
from flask import Flask, jsonify, render_template, request, send_from_directory
from collections import defaultdict

app = Flask(__name__)

UDP_IP = "0.0.0.0"
UDP_PORT = 4210

devices = {}
device_lock = threading.Lock()

# CSV logging
csv_file = "device_log.csv"
csv_lock = threading.Lock()

# UDP listener thread
def udp_listener():
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    sock.bind((UDP_IP, UDP_PORT))
    print(f"[UDP] Listening on port {UDP_PORT}")

    while True:
        data, addr = sock.recvfrom(1024)
        now = time.time()
        msg = data.decode('utf-8').strip()
        # Expected format:
        # mac;tempC;tempF;mic;X;Y;Z
        # example: a1:b2:c3:d4:e5:f6;00.00;32.00;-90.54;00.15;00.25;-01.25

        try:
            parts = msg.split(";")
            if len(parts) != 7:
                print(f"[UDP] Invalid packet format: {msg}")
                continue

            mac = parts[0].lower()
            tempC = parts[1]
            tempF = parts[2]
            mic = parts[3]
            x = parts[4]
            y = parts[5]
            z = parts[6]

            with device_lock:
                device = devices.get(mac, {
                    "mac": mac,
                    "name": mac,
                    "last_seen": 0,
                    "last_ping": None,
                    "tempC": None,
                    "tempF": None,
                    "mic": None,
                    "x": None,
                    "y": None,
                    "z": None,
                    "history": []
                })

                # Calculate ping if possible
                last_time = device["last_seen"]
                ping = None
                if last_time:
                    ping = int((now - last_time) * 1000)  # ms

                device.update({
                    "last_seen": now,
                    "last_ping": ping,
                    "tempC": tempC,
                    "tempF": tempF,
                    "mic": mic,
                    "x": x,
                    "y": y,
                    "z": z,
                })

                devices[mac] = device

                # Log to CSV
                with csv_lock:
                    with open(csv_file, mode='a', newline='') as f:
                        writer = csv.writer(f)
                        writer.writerow([time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(now)),
                                         mac, tempC, tempF, mic, x, y, z])

            print(f"[UDP] {mac} → ping={ping}ms, data=[{tempC}, {tempF}, {mic}, {x}, {y}, {z}]")

        except Exception as e:
            print(f"[UDP] Exception parsing data: {e}")

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/data')
def get_data():
    with device_lock:
        # Remove offline devices based on last_seen threshold (optional)
        now = time.time()
        offline_threshold = float(request.args.get('offline_threshold', '5'))
        result = []
        for d in devices.values():
            offline = (now - d['last_seen']) > offline_threshold
            entry = {
                "mac": d['mac'],
                "name": d.get('name', d['mac']),
                "last_seen": d['last_seen'],
                "ping": d['last_ping'],
                "tempC": d['tempC'] if not offline else "------",
                "tempF": d['tempF'] if not offline else "------",
                "mic": d['mic'] if not offline else "------",
                "x": d['x'] if not offline else "------",
                "y": d['y'] if not offline else "------",
                "z": d['z'] if not offline else "------",
                "offline": offline
            }
            result.append(entry)
    return jsonify(result)

@app.route('/api/rename', methods=['POST'])
def rename_device():
    data = request.json
    mac = data.get('mac')
    new_name = data.get('name')
    if not mac or not new_name:
        return jsonify({"success": False, "error": "Missing mac or name"}), 400

    with device_lock:
        if mac in devices:
            devices[mac]['name'] = new_name
            return jsonify({"success": True})
        else:
            return jsonify({"success": False, "error": "Device not found"}), 404

# To serve static files (if needed)
@app.route('/static/<path:path>')
def send_static(path):
    return send_from_directory('static', path)

if __name__ == "__main__":
    # Start UDP listener thread
    udp_thread = threading.Thread(target=udp_listener, daemon=True)
    udp_thread.start()

    # Run Flask app
    app.run(host='0.0.0.0', port=5000, debug=True, use_reloader=False)
