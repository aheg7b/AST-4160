import socket
import time
import random

TCP_IP = "127.0.0.1"  # Raspberry Pi IP
TCP_PORT = 5050

# Simulated devices
DEVICES = [
    {"mac": "AA:BB:CC:01", "name": "Tomatoes"},
    {"mac": "AA:BB:CC:02", "name": "Lettuce"},
    {"mac": "AA:BB:CC:03", "name": "Peppers"},
    {"mac": "AA:BB:CC:04", "name": "Corn"},
    {"mac": "GAGE IS GAY 1", "name": "Weed"},
    {"mac": "GAGE IS GAY 2", "name": "Weed"},
    {"mac": "GAGE IS GAY 3", "name": "Weed"},
]

STATES = ["ON", "OFF", "AUTO"]

def generate_data(device):
    temp = round(random.uniform(15, 35), 1)
    hum = round(random.uniform(30, 90), 1)
    soil_moist = random.randint(200, 800)
    soil_temp = round(random.uniform(15, 30), 1)
    light_val = random.randint(0, 1023)
    pump_state = random.choice(STATES)
    light_state = random.choice(STATES)

    packet = f"{device['mac']};{temp};{hum};{soil_moist};{soil_temp};{light_val};{pump_state};{light_state};"
    return packet

def send_packet(packet):
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(2)
            s.connect((TCP_IP, TCP_PORT))
            s.sendall(packet.encode())

            # Read response
            resp = s.recv(1024).decode().strip()
            if resp:
                print(f"Server response: {resp}")
    except Exception as e:
        print(f"Error sending packet: {e}")

if __name__ == "__main__":
    print("Starting ESP32 simulator for 3 devices...")
    while True:
        for device in DEVICES:
            pkt = generate_data(device)
            print(f"Sending from {device['name']}: {pkt}")
            send_packet(pkt)
        time.sleep(10)  # send every 1 seconds
