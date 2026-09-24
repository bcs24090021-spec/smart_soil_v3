#include <Arduino.h>
#include <OneWire.h>
#include <DallasTemperature.h>

constexpr uint8_t DATA_PIN = 4;
constexpr uint32_t INTERVAL_MS = 3000;
OneWire bus(DATA_PIN);
DallasTemperature sensor(&bus);
uint32_t lastRead = 0;
uint32_t reads = 0;
uint32_t failures = 0;

void setup() {
  Serial.begin(115200);
  sensor.begin();
  Serial.println("DS18B20 ONLY: VDD=3V3, GND=GND, DATA=GPIO4.");
  Serial.println("Use 4.7k pull-up between DATA and 3V3. No OLED initialization.");
  lastRead = millis();
}

void loop() {
  if (millis() - lastRead < INTERVAL_MS) return;
  lastRead = millis();
  ++reads;
  // Rediscover to allow recovery after an initially missing probe.
  sensor.begin();
  uint8_t count = sensor.getDeviceCount();
  Serial.printf("uptime_ms=%lu read=%lu devices=%u ",
                (unsigned long)millis(), (unsigned long)reads, count);
  DeviceAddress address;
  if (!count || !sensor.getAddress(address, 0)) {
    ++failures;
    Serial.printf("ERROR: no sensor. Check GPIO4, pull-up and power. failures=%lu\n",
                  (unsigned long)failures);
    return;
  }
  Serial.print("rom=");
  for (uint8_t i = 0; i < 8; ++i) Serial.printf("%02X", address[i]);
  if (address[0] != 0x28) {
    ++failures;
    Serial.println(" ERROR: unexpected family; expected DS18B20 (28).");
    return;
  }
  if (sensor.isParasitePowerMode()) {
    ++failures;
    Serial.println(" ERROR: parasite mode detected. Verify separate VDD supply.");
    return;
  }
  sensor.setResolution(address, 12);
  sensor.setWaitForConversion(true);
  sensor.requestTemperatures();
  float temperature = sensor.getTempC(address);
  if (!isfinite(temperature) || temperature == DEVICE_DISCONNECTED_C
      || temperature < -55 || temperature > 125) {
    ++failures;
    Serial.printf(" ERROR: temperature read failed. failures=%lu\n", (unsigned long)failures);
    return;
  }
  Serial.printf(" temperature_c=%.2f status=ok failures=%lu", temperature,
                (unsigned long)failures);
  if (temperature == 85.0f) Serial.print(" NOTE: 85C can be a power-on default; verify conversion/power.");
  Serial.println();
}
