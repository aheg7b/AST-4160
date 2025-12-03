from flask import Flask, render_template, request, jsonify, abort
import threading
from tcp_server import start_tcp, DATA
from offline_monitor import start_offline_monitor
from device_manager import load_devices, save_devices
from collections import deque
import time

app = Flask(__name__)
DEVICE_NAMES = load_devices()

@app.template_filter('friendly_ts')
def friendly_ts_filter(ts_str):
    """
    Jinja filter to return the raw timestamp string; formatting is done client-side.
    Keep server-side simple.
    """
    return ts_str

@app.route("/")
def dashboard():
    # Ensure each device shows friendly name from devices.json (in case user renames)
    for mac, info in DATA.items():
        info["name"] = DEVICE_NAMES.get(mac, info.get("name", mac))
    return render_template("dashboard.html", devices=DATA)

@app.route("/control", methods=["POST"])
def control():
    req = request.get_json()
    mac = req.get("mac")
    device = req.get("device")
    state = req.get("state")

    if not mac or not device or state is None:
        return jsonify({"status": "error", "reason": "invalid payload"}), 400

    # Save command so tcp_server will return it to the device on next connect.
    if mac in DATA:
        DATA[mac][f"{device.upper()}_CMD"] = state
        return jsonify({"status": "ok"})
    else:
        return jsonify({"status": "error", "reason": "unknown device"}), 404

@app.route("/rename", methods=["POST"])
def rename():
    """
    Endpoint to rename a device. Payload: { mac: "...", name: "tomatoes" }
    """
    req = request.get_json()
    mac = req.get("mac")
    name = req.get("name")
    if not mac or name is None:
        return jsonify({"status":"error","reason":"invalid payload"}), 400

    DEVICE_NAMES[mac] = name
    save_devices(DEVICE_NAMES)
    # update runtime DATA if present
    if mac in DATA:
        DATA[mac]["name"] = name
    return jsonify({"status":"ok"})

@app.route("/charts/<mac>")
def charts_page(mac):
    if mac not in DATA:
        abort(404)
    return render_template("charts.html", mac=mac, name=DATA[mac].get("name", mac))

@app.route("/api/history/<mac>")
def api_history(mac):
    """
    Return JSON history for the device (list of points: ts, TEMP, HUM, MOIST, SOILT)
    Convert deque to list.
    """
    if mac not in DATA:
        return jsonify({"status":"error", "reason":"unknown device"}), 404
    hist = DATA[mac].get("history", [])
    # convert deque to list of simple dicts
    hist_list = list(hist) if not isinstance(hist, list) else hist
    return jsonify({"status":"ok", "history": hist_list})

if __name__ == "__main__":
    # Shared runtime DATA dict
    runtime_data = DATA

    # Start TCP server (daemon thread)
    threading.Thread(target=start_tcp, args=(runtime_data,), daemon=True).start()

    # Start offline monitor (daemon thread)
    threading.Thread(target=start_offline_monitor, args=(runtime_data,), daemon=True).start()

    # Start Flask UI
    app.run(host="0.0.0.0", port=8080, debug=False)
