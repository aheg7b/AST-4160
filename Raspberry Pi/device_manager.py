import json
import os

DEVICE_FILE = "devices.json"

def load_devices():
    """Return a dict mapping MAC -> friendly name (or MAC if unknown)."""
    if not os.path.exists(DEVICE_FILE):
        return {}
    try:
        with open(DEVICE_FILE, "r") as f:
            return json.load(f)
    except Exception:
        return {}

def save_devices(mapping):
    """Write the mapping to devices.json (pretty printed)."""
    with open(DEVICE_FILE, "w") as f:
        json.dump(mapping, f, indent=4)
