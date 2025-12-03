import time

def start_offline_monitor(DATA, offline_seconds=15, poll_interval=5):
    """
    Periodically mark devices offline if not seen within offline_seconds.
    Mutates DATA in-place (expects DATA[mac]['last_seen'] as "YYYY-MM-DD HH:MM:SS")
    """
    while True:
        now = time.time()
        for mac, entry in list(DATA.items()):
            try:
                last = time.mktime(time.strptime(entry["last_seen"], "%Y-%m-%d %H:%M:%S"))
                entry["online"] = ((now - last) < offline_seconds)
            except Exception:
                # If timestamp parsing fails, mark offline
                entry["online"] = False
        time.sleep(poll_interval)
