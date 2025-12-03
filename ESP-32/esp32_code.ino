#include <WiFi.h>
#include <Wire.h>
#include <Adafruit_SHT31.h>      // FS304-SHT
#include <Adafruit_MCP9808.h>    // Digital soil temp probe

// ===== WiFi & Server =====
const char* ssid = "YOUR_SSID";
const char* password = "YOUR_PASSWORD";
const char* serverIP = "RASPBERRY_PI_IP";
const uint16_t serverPort = 5050;
WiFiClient client;

// ===== Sensors =====
Adafruit_SHT31 sht31 = Adafruit_SHT31();
Adafruit_MCP9808 soilTemp = Adafruit_MCP9808();

#define LIGHT_SENSOR_PIN 34        // MH light sensor analog
#define SOIL_MOISTURE_PIN 35       // SM100 analog
#define PUMP_PIN 25
#define LIGHT_PIN 26

// Device MAC
String deviceMAC;

// Timing
unsigned long lastSend = 0;
const unsigned long SEND_INTERVAL = 5000;

// Pump / Light state
String pumpState = "AUTO";
String lightState = "AUTO";

void setup() {
  Serial.begin(115200);
  Wire.begin();
  
  pinMode(LIGHT_SENSOR_PIN, INPUT);
  pinMode(SOIL_MOISTURE_PIN, INPUT);
  pinMode(PUMP_PIN, OUTPUT);
  pinMode(LIGHT_PIN, OUTPUT);

  if (!sht31.begin(0x44)) Serial.println("SHT31 not found!");
  if (!soilTemp.begin(0x18)) Serial.println("Soil temp probe not found!");

  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected");
  deviceMAC = WiFi.macAddress();
}

void loop() {
  unsigned long now = millis();

  // Read sensors
  float temp = sht31.readTemperature();
  float humidity = sht31.readHumidity();
  float soilTemperature = soilTemp.readTempC();
  int soilMoisture = analogRead(SOIL_MOISTURE_PIN);
  int lightVal = analogRead(LIGHT_SENSOR_PIN);

  // Control Pump (AUTO only)
  if (pumpState == "AUTO") {
    digitalWrite(PUMP_PIN, soilMoisture < 400 ? HIGH : LOW);
  } else {
    digitalWrite(PUMP_PIN, pumpState == "ON" ? HIGH : LOW);
  }

  // Control Light (AUTO only)
  if (lightState == "AUTO") {
    digitalWrite(LIGHT_PIN, lightVal < 300 ? HIGH : LOW);
  } else {
    digitalWrite(LIGHT_PIN, lightState == "ON" ? HIGH : LOW);
  }

  // Send data periodically
  if (now - lastSend > SEND_INTERVAL) {
    lastSend = now;
    sendData(temp, humidity, soilMoisture, soilTemperature, lightVal);
  }

  // Handle commands from UI
  if (client.connected() && client.available()) {
    String cmd = client.readStringUntil('\n');
    handleCommand(cmd);
  }
}

void sendData(float temp, float hum, int soilMoist, float soilTempC, int lightVal) {
  if (!client.connected()) {
    client.connect(serverIP, serverPort);
  }

  String dataPacket = deviceMAC + ";" + String(temp, 1) + ";" + String(hum, 1) + ";" +
                      String(soilMoist) + ";" + String(soilTempC,1) + ";" +
                      pumpState + ";" + lightState + ";" + String(lightVal);

  client.println(dataPacket);
  Serial.println("Sent: " + dataPacket);
}

void handleCommand(String cmd) {
  cmd.trim();
  // Command examples: PUMP=ON, PUMP=OFF, PUMP=AUTO, LIGHT=ON, LIGHT=OFF, LIGHT=AUTO
  if (cmd.startsWith("PUMP=")) pumpState = cmd.substring(5);
  if (cmd.startsWith("LIGHT=")) lightState = cmd.substring(6);
}
