/*
 * Smart Soil Probe — ESP32 firmware
 * Sensors:
 *   1. Capacitive soil moisture  -> AOUT -> GPIO34 (analog)
 *   2. Waterproof temperature    -> DS18B20 data -> GPIO4  (4.7k pull-up to 3.3V)
 *   3. Soil pH (PH-4502C)        -> PO   -> GPIO35 (analog)
 *   4. Optional air humidity     -> DHT22/11 -> GPIO32
 *
 * Output: one JSON line over USB serial (115200 baud) every 2 seconds, plus an
 * immediate reading when it receives a "SCAN" command (sent by the dashboard
 * "Scan Soil" button).
 *
 * Example line:
 *   {"deviceId":"esp32-probe-001","soilMoisture":62.3,"soilTemperature":28.4,"soilPH":6.08,"airHumidity":74}
 */

#include <OneWire.h>
#include <DallasTemperature.h>

#if __has_include(<DHT.h>)
#include <DHT.h>
#define HAS_DHT 1
#else
#define HAS_DHT 0
#endif

// ---------- wiring / calibration constants ----------
#define PIN_MOISTURE 34   // capacitive soil moisture analog out
#define PIN_TEMP     4    // DS18B20 data
#define PIN_PH       35   // PH-4502C analog PO
#define PIN_DHT      32   // optional DHT22/11
#define SERIAL_BAUD  115200

// Calibrate the capacitive sensor (units: mV from analogReadMilliVolts).
//   MOISTURE_DRY_MV : reading when the probe is held in air
//   MOISTURE_WET_MV : reading when the probe is inserted fully in water
// Typical capacitive-sensor values are DRY ~ 2850, WET ~ 1150 (3.3V).
#define MOISTURE_DRY_MV 2850
#define MOISTURE_WET_MV 1150

// PH-4502C linear calibration (units: mV).
//   PH_MID_POINT_MV : output voltage when the probe is in pH-7 buffer (adjust the trimmer to ~2500, i.e. mid range)
//   PH_MV_PER_PH    : mV of change per pH unit (typical PH-4502C ≈ 177)
// Example: at 2.50 V the pH is 7.0; each -0.177 V (177 mV) below that raises pH by 1.
#define PH_MID_POINT_MV 2500
#define PH_MV_PER_PH    177

#define SERIAL_SCAN_CMD "SCAN"

OneWire oneWire(PIN_TEMP);
DallasTemperature tempSensors(&oneWire);
#if HAS_DHT
DHT dht(PIN_DHT, DHT22);
#endif

// 12-bit 0-4095 ADC spans 0-3300 mV on the ESP32 ADC1.
long analogMilliVolts(int pin) {
  return (long)analogRead(pin) * 3300L / 4095L;
}

long clip(long v, long minV, long maxV) {
  if (v < minV) return minV;
  if (v > maxV) return maxV;
  return v;
}

float readMoisturePercent() {
  long mv = analogMilliVolts(PIN_MOISTURE);
  long span = MOISTURE_DRY_MV - MOISTURE_WET_MV;
  if (span <= 0) return 0;
  float pct = 100.0 * (MOISTURE_DRY_MV - clip(mv, MOISTURE_WET_MV, MOISTURE_DRY_MV)) / span;
  return pct;
}

float readPH() {
  long mv = analogMilliVolts(PIN_PH);
  float ph = 7.0 + (PH_MID_POINT_MV - mv) / (float)PH_MV_PER_PH;
  return ph;
}

float readSoilTemperature() {
  tempSensors.requestTemperatures();
  float c = tempSensors.getTempCByIndex(0);
  return (c == DEVICE_DISCONNECTED_C) ? NAN : c;
}

void printReading() {
  float moisture = readMoisturePercent();
  float temp = readSoilTemperature();
  float ph = readPH();

  Serial.print("{\"deviceId\":\"esp32-probe-001\",\"location\":\"demo-field\"");
  Serial.print(",\"soilMoisture\":");
  if (isnan(moisture)) Serial.print("null"); else Serial.print(moisture, 1);
  Serial.print(",\"soilTemperature\":");
  if (isnan(temp)) Serial.print("null"); else Serial.print(temp, 1);
  Serial.print(",\"soilPH\":");
  if (isnan(ph)) Serial.print("null"); else Serial.print(ph, 2);
#if HAS_DHT
  Serial.print(",\"airHumidity\":");
  Serial.print(dht.readHumidity());
#endif
  Serial.println("}");
}

void setup() {
  Serial.begin(SERIAL_BAUD);
  tempSensors.begin();
#if HAS_DHT
  dht.begin();
#endif
  delay(1500); // let DHT / sensors settle
}

void loop() {
  static unsigned long lastPrint = 0;
  unsigned long now = millis();

  // handle an incoming "SCAN" command from the dashboard
  while (Serial.available() > 0) {
    String line = Serial.readStringUntil('\n');
    line.trim();
    if (line.equals(SERIAL_SCAN_CMD)) printReading();
  }

  if (now - lastPrint >= 2000UL) {
    lastPrint = now;
    printReading();
  }
}