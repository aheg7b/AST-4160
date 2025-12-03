from flask import Flask, render_template, request, jsonify
from tcp_server import start_tcp, DATA, DEVICE_NAMES
import json

app = Flask(__name__)
DATA_FILE = "devices.json"

start_tcp()

@app.route("/")
def dashboard():
    return render_template("dashboard.html")

@app.route("/data")
def get_data():
    return jsonify(DATA)

@app.route("/rename", methods=["POST"])
def rename():
    mac = request.form.get("mac")
    new_name = request.form.get("name")
    if mac and new_name:
        DEVICE_NAMES[mac] = new_name
        with open(DATA_FILE, "w") as f:
            json.dump(DEVICE_NAMES, f)
    return "OK"

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True, use_reloader=False)
