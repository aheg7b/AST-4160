/*
  ESP32 TCP client demo for Crop Monitor
  - Connects to WiFi
  - Connects to Raspberry Pi TCP server at serverIP:5050
  - Sends a packet in the format:
      MAC;TEMP-C;HUMIDITY;SOIL MOISTURE;SOIL TEMP;PUMP ON/OFF;LIGHT ON/OFF;
    Example:
      AA:BB:CC:DD:EE:FF;23.5;55;420;21.2;OFF;OFF;
  - Reads response: PUMP_CMD;LIGHT_CMD;
  - Prints the response and acts (example: toggles internal flags)
  - Configure SSID/PASS and SERVER_IP below.
*/

#include <WiFi.h>

const char* ssid     = "YOUR_SSID";
const char* password = "YOUR_PASSWORD";

const char* serverIP = "192.168.1.100"; // set to your Pi IP
const uint16_t serverPort = 5050;

// device MAC (or use WiFi.macAddress())
String myMac;

bool pump_state = false;
bool light_state = false;

void setup() {
  Serial.begin(115200);
  delay(100);

  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  Serial.printf("Connecting to %s\n", ssid);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  Serial.println("WiFi connected");
  myMac = WiFi.macAddress();
  Serial.printf("MAC: %s\n", myMac.c_str());
}

void loop() {
  // build sample sensor data (in your real code read real sensors)
  float temp = 23.0 + random(-50,50)/100.0; // 22.5..23.5
  float hum = 45.0 + random(-100,100)/100.0;
  int soil_moist = 400 + random(-50,50);
  float soil_temp = 20.0 + random(-50,50)/100.0;

  String packet = "";
  packet += myMac + ";";
  packet += String(temp, 2) + ";";
  packet += String(hum, 2) + ";";
  packet += String(soil_moist) + ";";
  packet += String(soil_temp, 2) + ";";
  packet += (pump_state ? "ON" : "OFF") + String(";");  // current state
  packet += (light_state ? "ON" : "OFF") + String(";");

  Serial.printf("Connecting to %s:%u ...\n", serverIP, serverPort);
  WiFiClient client;
  if (!client.connect(serverIP, serverPort, 2000)) {
    Serial.println("Connection failed");
  } else {
    Serial.println("Connected, sending packet:");
    Serial.println(packet);
    client.print(packet);

    // wait for response with timeout
    unsigned long start = millis();
    String resp = "";
    while (millis() - start < 2000) {
      while (client.available()) {
        char c = client.read();
        resp += c;
      }
      if (resp.length() > 0) break;
      delay(10);
    }

    resp.trim();
    if (resp.length() > 0) {
      Serial.printf("Response: %s\n", resp.c_str());
      // expected: PUMP_CMD;LIGHT_CMD;
      int first = resp.indexOf(';');
      if (first > 0) {
        String pumpCmd = resp.substring(0, first);
        int second = resp.indexOf(';', first+1);
        String lightCmd = (second > first) ? resp.substring(first+1, second) : "";
        pumpCmd.trim(); lightCmd.trim();
        Serial.printf("PumpCmd=%s LightCmd=%s\n", pumpCmd.c_str(), lightCmd.c_str());
        if (pumpCmd == "ON") pump_state = true;
        else if (pumpCmd == "OFF") pump_state = false;
        if (lightCmd == "ON") light_state = true;
        else if (lightCmd == "OFF") light_state = false;
      }
    } else {
      Serial.println("No response from server.");
    }
    client.stop();
  }

  // in real code you might set GPIO pins for pump/light here
  Serial.printf("Local pump_state=%s light_state=%s\n", pump_state ? "ON":"OFF", light_state ? "ON":"OFF");

  // send every 10 seconds
  delay(10000);
}
