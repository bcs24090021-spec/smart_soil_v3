/*
  Smart Soil Probe AI - ESP32 MVP firmware starter
  Hardware from the implementation brief:
    Moisture AO -> GPIO34
    DS18B20 DATA -> GPIO4 (4.7k pull-up to 3.3V)
    pH PO/AO -> GPIO35 (verify module output voltage before connecting)
    SHT31 SDA -> GPIO21, SCL -> GPIO22
    OLED shares the same I2C bus (optional)

  Before deployment: calibrate the pH probe with pH 4.01 / 6.86 / 9.18 buffers.
  This firmware intentionally sends a reading payload; it does not claim lab accuracy.
*/

#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <Adafruit_SHT31.h>

const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* API_URL = "http://YOUR_COMPUTER_IP:4173/api/readings";

constexpr int MOISTURE_PIN = 34;
constexpr int PH_PIN = 35;
constexpr int DS18B20_PIN = 4;
constexpr unsigned long SEND_INTERVAL_MS = 10000;

OneWire oneWire(DS18B20_PIN);
DallasTemperature soilThermometer(&oneWire);
Adafruit_SHT31 sht31 = Adafruit_SHT31();
unsigned long lastSend = 0;

float readMoisturePercent() {
  // Calibrate these ADC endpoints against the physical capacitive sensor.
  const int dryAdc = 3200;
  const int wetAdc = 1200;
  return constrain((dryAdc - analogRead(MOISTURE_PIN)) * 100.0f / (dryAdc - wetAdc), 0.0f, 100.0f);
}

float readPH() {
  // Placeholder linear conversion. Replace with a calibrated slope/intercept.
  const float voltage = analogRead(PH_PIN) * 3.3f / 4095.0f;
  return 7.0f + (2.5f - voltage) * 3.0f;
}

String makePayload(float soilPH, float moisture, float soilTemperature, float humidity) {
  String payload = "{";
  payload += "\"deviceId\":\"probe-001\",\"location\":\"field-device\",";
  payload += "\"soilPH\":" + String(soilPH, 2) + ",";
  payload += "\"soilMoisture\":" + String(moisture, 1) + ",";
  payload += "\"soilTemperature\":" + String(soilTemperature, 1) + ",";
  payload += "\"airHumidity\":" + String(humidity, 1) + ",";
  payload += "\"rainfall\":0,\"nitrogen\":null,\"phosphorus\":null,\"potassium\":null";
  payload += "}";
  return payload;
}

void sendReading() {
  soilThermometer.requestTemperatures();
  const float soilTemperature = soilThermometer.getTempCByIndex(0);
  const float humidity = sht31.readHumidity();
  const String payload = makePayload(readPH(), readMoisturePercent(), soilTemperature, humidity);

  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(API_URL);
    http.addHeader("Content-Type", "application/json");
    const int status = http.POST(payload);
    Serial.printf("POST %d: %s\n", status, payload.c_str());
    http.end();
  }
}

void setup() {
  Serial.begin(115200);
  analogReadResolution(12);
  Wire.begin(21, 22);
  soilThermometer.begin();
  sht31.begin(0x44);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  Serial.println(WiFi.localIP());
}

void loop() {
  if (millis() - lastSend >= SEND_INTERVAL_MS) {
    lastSend = millis();
    sendReading();
  }
}

