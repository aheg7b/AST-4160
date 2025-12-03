#include <WiFi.h>
#include <Wire.h>
#include <Adafruit_SHT31.h>
#include <DHT.h>

// ===== DHT11 (Air Temp/Humidity) =====
#define DHTPIN 33
#define DHTTYPE DHT11
DHT dht(DHTPIN, DHTTYPE);

// ===== SHT31 (FS304) for Soil Temp/Humidity =====
Adafruit_SHT31 sht31 = Adafruit_SHT31();

// ===== WiFi & Server =====
const char* ssid = "YOUR_SSID";
const char* password = "YOUR_PASSWORD";
const char* serverIP = "192.168.86.25";
const uint16_t serverPort = 5050;
WiFiClient client;

// ===== Sensors & Actuators =====
#define LIGHT_SENSOR_PIN 34
#define SOIL_MOISTURE_PIN 35
#define PUMP_PIN 25
#define LIGHT_PIN 26
#define ERROR_LED 2

String deviceMAC;

// Timing
unsigned long lastSend = 0;
unsigned long lastSuccess = 0;
const unsigned long SEND_INTERVAL = 5000;
const unsigned long ERROR_TIMEOUT = 15000;

// Pump / Light state
String pumpState = "AUTO";
String lightState = "AUTO";

void setup() {
  Serial.begin(115200);
  Wire.begin();

  // Initialize sensors
  dht.begin();
  if (!sht31.begin(0x44)) Serial.println("Error: SHT31 not found!");

  pinMode(LIGHT_SENSOR_PIN, INPUT);
  pinMode(SOIL_MOISTURE_PIN, INPUT);
  pinMode(PUMP_PIN, OUTPUT);
  pinMode(LIGHT_PIN, OUTPUT);
  pinMode(ERROR_LED, OUTPUT);

  // Connect WiFi
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected");
  deviceMAC = WiFi.macAddress();
}

void loop() {
  unsigned long now = millis();

  // Read Air Temp/Humidity (DHT11)
  float airTemp = dht.readTemperature();
  float airHum = dht.readHumidity();

  // Read Soil Temp/Humidity (SHT31)
  float soilTemp = sht31.readTemperature();
  float soilHum = sht31.readHumidity(); // optional
  int soilMoisture = analogRead(SOIL_MOISTURE_PIN);
  int lightVal = analogRead(LIGHT_SENSOR_PIN);

  // Control Pump
  if (pumpState == "AUTO") digitalWrite(PUMP_PIN, soilMoisture < 400 ? HIGH : LOW);
  else digitalWrite(PUMP_PIN, pumpState == "ON" ? HIGH : LOW);

  // Control Light
  if (lightState == "AUTO") digitalWrite(LIGHT_PIN, lightVal < 300 ? HIGH : LOW);
  else digitalWrite(LIGHT_PIN, lightState == "ON" ? HIGH : LOW);

  // Send data periodically
  if (now - lastSend > SEND_INTERVAL) {
    lastSend = now;
    if (sendData(airTemp, airHum, soilTemp, soilHum, soilMoisture, lightVal)) {
      lastSuccess = now;
    }
  }

  // Handle incoming commands
  if (client.connected() && client.available()) {
    String cmd = client.readStringUntil('\n');
    handleCommand(cmd);
  }

  // Error LED logic
  digitalWrite(ERROR_LED, (now - lastSuccess > ERROR_TIMEOUT) ? HIGH : LOW);
}

bool sendData(float airTemp, float airHum, float soilTemp, float soilHum, int soilMoist, int lightVal) {
  if (!client.connected()) {
    if (!client.connect(serverIP, serverPort)) {
      Serial.println("Error: Cannot connect to server");
      return false;
    }
  }

  // Format: MAC;AIR TEMP;AIR HUM;SOIL TEMP;SOIL HUM;SOIL MOIST;PUMP;LIGHT;LIGHT_SENSOR
  String dataPacket = deviceMAC + ";" + String(airTemp, 1) + ";" + String(airHum, 1) + ";" +
                      String(soilTemp, 1) + ";" + String(soilHum, 1) + ";" +
                      String(soilMoist) + ";" + pumpState + ";" + lightState + ";" + String(lightVal);

  client.println(dataPacket);
  Serial.println("Sent: " + dataPacket);
  return true;
}

void handleCommand(String cmd) {
  cmd.trim();
  if (cmd.startsWith("PUMP=")) pumpState = cmd.substring(5);
  if (cmd.startsWith("LIGHT=")) lightState = cmd.substring(6);
}
