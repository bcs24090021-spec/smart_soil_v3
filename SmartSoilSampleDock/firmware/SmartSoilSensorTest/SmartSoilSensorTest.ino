#include <Arduino.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <DHT.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <math.h>

constexpr uint8_t SAMPLE_TEMP_PIN = 4;
constexpr uint8_t AIR_SENSOR_PIN = 27;
constexpr uint8_t PH_ADC_PIN = 34;
constexpr uint8_t SOIL_ADC_PIN = 35;
constexpr uint8_t OLED_SDA_PIN = 21;
constexpr uint8_t OLED_SCL_PIN = 22;
constexpr uint32_t READ_INTERVAL_MS = 3000;

// Enable only after verifying the interface board and safe ADC input voltage.
constexpr bool PH_ENABLED = false;
// Enter measured ADC-side millivolts from pH 7 and pH 4 buffer solutions.
constexpr float PH7_MV = NAN;
constexpr float PH4_MV = NAN;

OneWire oneWire(SAMPLE_TEMP_PIN);
DallasTemperature sampleSensor(&oneWire);
DHT airSensor(AIR_SENSOR_PIN, DHT22);
uint32_t lastReadMs = 0;
Adafruit_SSD1306 display(128, 64, &Wire, -1);
bool oledReady = false;

void setupDisplay() {
  Wire.begin(OLED_SDA_PIN, OLED_SCL_PIN);
  Wire.setTimeOut(50);
  uint8_t address = 0;
  Serial.println("I2C scan:");
  for (uint8_t i = 1; i < 127; ++i) {
    Wire.beginTransmission(i);
    if (Wire.endTransmission() == 0) {
      Serial.printf("  Device at 0x%02X\n", i);
      if (address == 0 && (i == 0x3C || i == 0x3D)) address = i;
    }
  }
  if (address == 0) {
    Serial.println("OLED not detected; check 3V3/GND/SDA21/SCL22. Sensors continue.");
    return;
  }
  oledReady = display.begin(SSD1306_SWITCHCAPVCC, address, false, false);
  if (!oledReady) {
    Serial.println("OLED buffer initialization failed; sensors continue.");
    return;
  }
  Serial.println("OLED initialized with assumed SSD1306 driver; verify visible image.");
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setTextWrap(false);
  display.setCursor(0, 0);
  display.println("SMART SOIL");
  display.println("Reading sensors...");
  display.display();
}

void displayReading(const char *label, float value, const char *unit) {
  display.print(label);
  if (isfinite(value)) {
    display.print(value, 1);
    display.println(unit);
  } else display.println("ERR");
}

void updateDisplay(float sampleTemp, float airTemp, float airHumidity,
                   uint16_t soilRaw, float soilMv, bool soilInRange,
                   float ph) {
  if (!oledReady) return;
  display.clearDisplay();
  display.setCursor(0, 0);
  display.println("SMART SOIL");
  displayReading("Sample: ", sampleTemp, " C");
  displayReading("Air:    ", airTemp, " C");
  displayReading("Air RH: ", airHumidity, " %");
  display.print("Soil raw: ");
  display.println(soilRaw);
  display.print("Soil mV: ");
  display.print(soilMv, 0);
  if (!soilInRange) display.print(" RANGE!");
  display.println();
  display.print("pH: ");
  if (isfinite(ph)) display.println(ph, 2);
  else if (!PH_ENABLED) display.println("OFF");
  else display.println("-- (see serial)");
  display.println("Soil: uncalibrated");
  display.display();
}

void printNumber(float value, uint8_t decimals = 2) {
  if (isfinite(value)) Serial.print(value, decimals);
  else Serial.print("null");
}

void readSensors() {
  sampleSensor.requestTemperatures();
  float sampleTemp = sampleSensor.getTempCByIndex(0);
  bool sampleValid = isfinite(sampleTemp) && sampleTemp != DEVICE_DISCONNECTED_C
                     && sampleTemp >= -55 && sampleTemp <= 125;
  float airTemp = airSensor.readTemperature();
  float airHumidity = airSensor.readHumidity();
  bool airValid = isfinite(airTemp) && isfinite(airHumidity)
                  && airTemp >= -40 && airTemp <= 80
                  && airHumidity >= 0 && airHumidity <= 100;

  uint32_t soilRawSum = 0;
  uint32_t soilMvSum = 0;
  for (int i = 0; i < 32; ++i) {
    soilRawSum += analogRead(SOIL_ADC_PIN);
    soilMvSum += analogReadMilliVolts(SOIL_ADC_PIN);
    delay(2);
  }
  uint16_t soilRaw = soilRawSum / 32;
  float soilMv = soilMvSum / 32.0f;
  bool soilInRange = soilMv >= 100 && soilMv <= 2900;

  Serial.print("{\"sample_temperature_c\":");
  printNumber(sampleValid ? sampleTemp : NAN);
  Serial.print(",\"sample_status\":\"");
  Serial.print(sampleValid ? "ok" : "sensor_error");
  Serial.print("\",\"air_temperature_c\":");
  printNumber(airValid ? airTemp : NAN);
  Serial.print(",\"air_humidity_pct\":");
  printNumber(airValid ? airHumidity : NAN);
  Serial.print(",\"air_status\":\"");
  Serial.print(airValid ? "ok" : "sensor_error");
  Serial.print("\",\"soil_moisture_pct\":null,\"soil_adc_raw\":");
  Serial.print(soilRaw);
  Serial.print(",\"soil_adc_mv\":");
  printNumber(soilMv, 1);
  Serial.print(",\"soil_status\":\"");
  Serial.print(soilInRange ? "uncalibrated_connection_unverified" : "adc_out_of_range");
  Serial.print("\",\"ph_adc_mv\":");

  float ph = NAN;
  const char *phStatus = "disabled";
  if (PH_ENABLED) {
    uint32_t sum = 0;
    uint32_t minMv = UINT32_MAX;
    uint32_t maxMv = 0;
    for (int i = 0; i < 32; ++i) {
      uint32_t mv = analogReadMilliVolts(PH_ADC_PIN);
      sum += mv;
      minMv = min(minMv, mv);
      maxMv = max(maxMv, mv);
      delay(5);
    }
    float mv = sum / 32.0f;
    printNumber(mv, 1);
    bool calibrated = isfinite(PH7_MV) && isfinite(PH4_MV)
                      && PH7_MV >= 100 && PH7_MV <= 2900
                      && PH4_MV >= 100 && PH4_MV <= 2900
                      && fabsf(PH7_MV - PH4_MV) >= 100;
    if (minMv < 100 || maxMv > 2900) phStatus = "adc_out_of_range";
    else if (maxMv - minMv > 50) phStatus = "unstable";
    else if (!calibrated) phStatus = "uncalibrated";
    else {
      ph = 7.0f + (mv - PH7_MV) * (4.0f - 7.0f) / (PH4_MV - PH7_MV);
      if (!isfinite(ph) || ph < 0 || ph > 14) {
        ph = NAN;
        phStatus = "ph_out_of_range";
      } else phStatus = "estimate_calibrated";
    }
  } else Serial.print("null");
  Serial.print(",\"ph\":");
  printNumber(ph);
  Serial.print(",\"ph_status\":\"");
  Serial.print(phStatus);
  Serial.println("\"}");
  updateDisplay(sampleValid ? sampleTemp : NAN, airValid ? airTemp : NAN,
                airValid ? airHumidity : NAN, soilRaw, soilMv, soilInRange, ph);
}

void setup() {
  Serial.begin(115200);
  sampleSensor.begin();
  sampleSensor.setResolution(12);
  airSensor.begin();
  pinMode(SOIL_ADC_PIN, INPUT);
  analogReadResolution(12);
  analogSetPinAttenuation(SOIL_ADC_PIN, ADC_11db);
  setupDisplay();
  if (PH_ENABLED) {
    pinMode(PH_ADC_PIN, INPUT);
    analogReadResolution(12);
    analogSetPinAttenuation(PH_ADC_PIN, ADC_11db);
  }
  Serial.println("SmartSoil sensor test: DHT22 measures AIR humidity, not soil moisture.");
  Serial.println("pH requires a safe interface board and buffer calibration; no AI or WiFi enabled.");
  lastReadMs = millis();
}

void loop() {
  if (millis() - lastReadMs >= READ_INTERVAL_MS) {
    lastReadMs = millis();
    readSensors();
  }
}
