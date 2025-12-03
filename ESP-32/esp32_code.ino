#include <WiFi.h>
#include <DHT.h>

//////////////////////
// WiFi & Server
//////////////////////
const char* ssid = "YOUR_SSID";
const char* password = "YOUR_PASSWORD";
const char* serverIP = "192.168.1.100";  // Raspberry Pi IP
const uint16_t serverPort = 5050;

//////////////////////
// Device info
//////////////////////
String myMac;
String pump_state = "OFF";   // can be ON/OFF/AUTO (dashboard logic)
String light_state = "OFF";

//////////////////////
// Sensor pins
//////////////////////
#define DHTPIN 4
#define DHTTYPE DHT11
DHT dht(DHTPIN, DHTTYPE);

#define LIGHTPIN 34      // MH light sensor
#define SOILMOISTPIN 35  // SM100 soil moisture
#define SOILTEMPPIN 32   // FS304-SHT analog output

//////////////////////
// Pump / Light GPIO
//////////////////////
#define PUMP_PIN 26
#define LIGHT_PIN 27

void setup() {
  Serial.begin(115200);
  delay(100);

  pinMode(PUMP_PIN, OUTPUT);
  pinMode(LIGHT_PIN, OUTPUT);

  digitalWrite(PUMP_PIN, LOW);
  digitalWrite(LIGHT_PIN, LOW);

  WiFi.begin(ssid, password);
  Serial.printf("Connecting to WiFi: %s\n", ssid);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected!");
  myMac = WiFi.macAddress();
  Serial.printf("MAC: %s\n", myMac.c_str());

  dht.begin();
}

void loop() {
  // Read sensors
  float temp = dht.readTemperature();
  float hum = dht.readHumidity();
  int soilMoist = analogRead(SOILMOISTPIN);  
  int lightVal = analogRead(LIGHTPIN);       
  int soilTemp = analogRead(SOILTEMPPIN);    

  // Build packet
  String packet = "";
  packet += myMac + ";";
  packet += isnan(temp) ? "0" : String(temp,1) + ";";
  packet += isnan(hum) ? "0" : String(hum,1) + ";";
  packet += String(soilMoist) + ";";
  packet += String(soilTemp) + ";";
  packet += String(lightVal) + ";";   // light sensor
  packet += pump_state + ";";
  packet += light_state + ";";

  Serial.println("Sending packet:");
  Serial.println(packet);

  WiFiClient client;
  if (!client.connect(serverIP, serverPort, 2000)) {
    Serial.println("Connection failed");
  } else {
    client.print(packet);

    // Read server response
    String resp = "";
    unsigned long start = millis();
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
      int first = resp.indexOf(';');
      if (first > 0) {
        String pumpCmd = resp.substring(0, first);
        int second = resp.indexOf(';', first+1);
        String lightCmd = (second > first) ? resp.substring(first+1, second) : "";
        pumpCmd.trim(); lightCmd.trim();
        if (pumpCmd == "ON" || pumpCmd == "OFF" || pumpCmd == "AUTO") pump_state = pumpCmd;
        if (lightCmd == "ON" || lightCmd == "OFF" || lightCmd == "AUTO") light_state = lightCmd;
      }
    }

    // Apply GPIO states (ON/OFF only; AUTO handled on server)
    digitalWrite(PUMP_PIN, pump_state=="ON" ? HIGH : LOW);
    digitalWrite(LIGHT_PIN, light_state=="ON" ? HIGH : LOW);

    client.stop();
  }

  delay(10000);  // send every 10 sec
}
