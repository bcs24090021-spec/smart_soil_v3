#include <Arduino.h>
#include <SPI.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ST7789.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <DHT.h>
#include <Preferences.h>
#include <math.h>
#include "WetnessReference.h"
#include "DemoRanking.h"
#include "../SmartSoilCropPhotoPreview/CropPhotoAssets.h"

constexpr uint8_t TFT_CS = 25;
constexpr uint8_t TFT_DC = 26;
constexpr uint8_t TFT_RST = 33;
constexpr uint8_t TFT_MOSI = 23;
constexpr uint8_t TFT_SCK = 18;
constexpr uint8_t TEMP_PIN = 4;
constexpr uint8_t DHT_PIN = 27;
constexpr uint8_t SOIL_PIN = 35;
constexpr uint8_t PH_PIN = 34;
constexpr uint8_t START_PIN = 13;
constexpr uint8_t NEXT_PIN = 14;
constexpr uint32_t INTERVAL_MS = 3000;
constexpr uint32_t PH_WARMUP_MS = 30000;
constexpr uint32_t PH_ESTIMATE_MAX_SPREAD_MV = 300;
constexpr size_t PH_HISTORY_SIZE = 5;
// Recorded on this ESP32 with the current voltage divider; prototype only.
constexpr float RECORDED_PH4_MV = 2226.7f;
constexpr float RECORDED_PH918_MV = 1944.0f;
constexpr uint16_t BACKGROUND = ST77XX_BLACK;
constexpr uint16_t MUTED = 0xAD55;
constexpr uint16_t PHOTO_BG = 0x10A3;
constexpr uint16_t PHOTO_ACCENT = 0x5EAC;

Adafruit_ST7789 tft(&SPI, TFT_CS, TFT_DC, TFT_RST);
OneWire oneWire(TEMP_PIN);
DallasTemperature temperatureSensor(&oneWire);
DHT airSensor(DHT_PIN, DHT22);
Preferences phPreferences;
float calibration918Mv = NAN;
float calibration4Mv = NAN;
bool phUsesRecordedValue = false;
uint32_t phMvHistory[PH_HISTORY_SIZE] = {};
size_t phHistoryCount = 0;
size_t phHistoryNext = 0;
uint32_t lastReadMs = 0;
uint32_t readingCount = 0;
enum class ScreenPage : uint8_t { Cover, Data, Summary, First, Second, Third };
ScreenPage screenPage = ScreenPage::Cover;
uint8_t topCrops[3] = {0, 1, 2};
uint8_t topScores[3] = {0, 0, 0};
uint8_t scoreMaximum = 4;
bool resultLocked = false;

struct ButtonState {
  bool raw = HIGH;
  bool stable = HIGH;
  uint32_t changedAt = 0;
};

ButtonState startButton;
ButtonState nextButton;

struct LatestReading {
  float sample = NAN;
  float air = NAN;
  float humidity = NAN;
  float soilMv = NAN;
  float wetness = NAN;
  float phMv = NAN;
  float ph = NAN;
  uint16_t soilRaw = 0;
  bool sampleOk = false;
  bool airOk = false;
  bool humidityOk = false;
  bool soilInRange = false;
  bool outsideReferences = false;
  bool phInRange = false;
  bool phOk = false;
  uint32_t phSpread = 0;
  bool available = false;
};

LatestReading latest;
LatestReading resultSnapshot;
uint32_t resultReading = 0;
String serialCommandBuffer;

void textAt(int16_t x, int16_t y, const char *text, uint16_t color, uint8_t size) {
  tft.setCursor(x, y);
  tft.setTextSize(size);
  tft.setTextColor(color, BACKGROUND);
  tft.print(text);
}

void drawCover() {
  const uint16_t coverBg = tft.color565(8, 29, 26);
  const uint16_t green = tft.color565(77, 211, 151);
  const uint16_t gold = tft.color565(232, 188, 105);
  const uint16_t soft = tft.color565(174, 196, 183);

  tft.fillScreen(coverBg);
  tft.setTextSize(1);
  tft.setTextColor(green);
  tft.setCursor(12, 12);
  tft.print("FIELD SAMPLE / 01");
  tft.setTextColor(gold);
  tft.setCursor(279, 12);
  tft.print("V1");

  tft.drawRect(98, 29, CROP_PHOTO_WIDTH + 4, CROP_PHOTO_HEIGHT + 4, green);
  tft.drawRGBBitmap(100, 31, CROP_PHOTOS[0].pixels,
                    CROP_PHOTO_WIDTH, CROP_PHOTO_HEIGHT);

  tft.setTextSize(3);
  tft.setTextColor(ST77XX_WHITE);
  tft.setCursor(70, 139);
  tft.print("SMART SOIL");
  tft.setTextSize(1);
  tft.setTextColor(soft);
  tft.setCursor(88, 179);
  tft.print("PORTABLE SOIL SCREENING");
  tft.drawFastHLine(12, 204, 296, green);
  tft.setTextColor(gold);
  tft.setCursor(94, 218);
  tft.print("PRESS START TO MEASURE");
}

void drawFrame() {
  tft.fillScreen(BACKGROUND);
  textAt(12, 10, "SMART SOIL", ST77XX_CYAN, 2);
  tft.drawFastHLine(12, 35, 296, MUTED);
  textAt(12, 49, "Sample temp", MUTED, 1);
  textAt(12, 83, "Air temp", MUTED, 1);
  textAt(12, 117, "Air humidity", MUTED, 1);
  textAt(12, 151, "Soil ADC", MUTED, 1);
  textAt(12, 185, "Wetness index", MUTED, 1);
  textAt(12, 209, "pH / ADC", MUTED, 1);
  textAt(140, 209, "Reading...", MUTED, 1);
  textAt(12, 230, "INDEX NOT VWC | NEXT: DEMO TOP 3", MUTED, 1);
}

void showValue(int16_t y, float value, const char *unit) {
  tft.fillRect(140, y - 3, 174, 25, BACKGROUND);
  tft.setCursor(140, y);
  tft.setTextSize(2);
  tft.setTextColor(isfinite(value) ? ST77XX_WHITE : ST77XX_RED, BACKGROUND);
  if (isfinite(value)) {
    tft.print(value, 1);
    tft.print(unit);
  } else tft.print("ERR");
}

void serialNumber(float value) {
  if (isfinite(value)) Serial.print(value, 2);
  else Serial.print("null");
}

void sortSamples(uint32_t *values, size_t count) {
  for (size_t i = 1; i < count; ++i) {
    uint32_t value = values[i];
    size_t j = i;
    while (j > 0 && values[j - 1] > value) {
      values[j] = values[j - 1];
      --j;
    }
    values[j] = value;
  }
}

float smoothedPhMv(float millivolts) {
  phMvHistory[phHistoryNext] = static_cast<uint32_t>(millivolts + 0.5f);
  phHistoryNext = (phHistoryNext + 1) % PH_HISTORY_SIZE;
  if (phHistoryCount < PH_HISTORY_SIZE) ++phHistoryCount;
  uint32_t ordered[PH_HISTORY_SIZE];
  for (size_t i = 0; i < phHistoryCount; ++i) ordered[i] = phMvHistory[i];
  sortSamples(ordered, phHistoryCount);
  return ordered[phHistoryCount / 2];
}

bool pressed(uint8_t pin, ButtonState &state) {
  bool value = digitalRead(pin);
  if (value != state.raw) {
    state.raw = value;
    state.changedAt = millis();
  }
  if (millis() - state.changedAt >= 40 && value != state.stable) {
    state.stable = value;
    return value == LOW;
  }
  return false;
}

void renderLatest() {
  if (!latest.available || screenPage != ScreenPage::Data) return;
  showValue(45, latest.sampleOk ? latest.sample : NAN, " C");
  showValue(79, latest.airOk ? latest.air : NAN, " C");
  showValue(113, latest.humidityOk ? latest.humidity : NAN, " %RH");
  tft.fillRect(140, 143, 174, 30, BACKGROUND);
  tft.setCursor(140, 147);
  tft.setTextSize(2);
  tft.setTextColor(latest.soilInRange ? ST77XX_WHITE : ST77XX_RED, BACKGROUND);
  tft.print(latest.soilRaw);
  tft.setTextSize(1);
  tft.setCursor(140, 166);
  tft.print(latest.soilMv, 0);
  tft.print(latest.soilInRange ? " mV (raw)" : " mV RANGE!");
  tft.fillRect(140, 178, 174, 25, BACKGROUND);
  tft.setCursor(140, 181);
  tft.setTextSize(2);
  tft.setTextColor(latest.soilInRange ? ST77XX_CYAN : ST77XX_RED, BACKGROUND);
  if (latest.soilInRange) {
    tft.print(latest.wetness, 0);
    tft.print(" /100");
    if (latest.outsideReferences) tft.print("*");
  } else tft.print("ERR");

  tft.fillRect(140, 205, 174, 20, BACKGROUND);
  tft.setCursor(140, 209);
  tft.setTextSize(1);
  tft.setTextColor(latest.phOk ? ST77XX_GREEN : ST77XX_YELLOW, BACKGROUND);
  if (latest.phOk) {
    tft.print("~");
    tft.print(latest.ph, 1);
    tft.print(" pH est");
  } else {
    tft.print(latest.phMv, 0);
    tft.print(!latest.phInRange ? "mV RANGE!" : "mV CHECKING");
  }
}

void captureDemoResult() {
  resultSnapshot = latest;
  resultReading = readingCount;
  scoreMaximum = resultSnapshot.phOk ? 6 : 4;
  for (uint8_t slot = 0; slot < 3; ++slot) {
    topCrops[slot] = UINT8_MAX;
    topScores[slot] = 0;
  }
  for (uint8_t cropIndex = 0; cropIndex < CROP_PHOTO_COUNT; ++cropIndex) {
    const CropPhotoMeta &crop = CROP_PHOTOS[cropIndex];
    uint8_t score = demoMatchScore(resultSnapshot.sample, resultSnapshot.wetness,
                                   crop.temp_min, crop.temp_max,
                                   crop.vwc_min, crop.vwc_max);
    if (resultSnapshot.phOk && resultSnapshot.ph >= crop.ph_min &&
        resultSnapshot.ph <= crop.ph_max) score += 2;
    for (uint8_t slot = 0; slot < 3; ++slot) {
      if (topCrops[slot] == UINT8_MAX || score > topScores[slot]) {
        for (uint8_t lower = 2; lower > slot; --lower) {
          topCrops[lower] = topCrops[lower - 1];
          topScores[lower] = topScores[lower - 1];
        }
        topCrops[slot] = cropIndex;
        topScores[slot] = score;
        break;
      }
    }
  }
}

void drawDemoSummary() {
  tft.fillScreen(PHOTO_BG);
  tft.setTextWrap(false);
  tft.setTextColor(ST77XX_WHITE, PHOTO_BG);
  tft.setTextSize(2);
  tft.setCursor(12, 10);
  tft.print("TOP 3 CROPS");
  tft.drawFastHLine(12, 35, 296, PHOTO_ACCENT);
  for (uint8_t rank = 0; rank < 3; ++rank) {
    int16_t y = 70 + 48 * rank;
    tft.drawRoundRect(8, y - 11, 304, 36, 6, 0x3206);
    tft.setTextColor(PHOTO_ACCENT, PHOTO_BG);
    tft.setTextSize(2);
    tft.setCursor(12, y);
    tft.print(rank + 1);
    tft.setTextColor(ST77XX_WHITE, PHOTO_BG);
    tft.setCursor(38, y);
    tft.print(CROP_PHOTOS[topCrops[rank]].name);
    if (rank < 2) tft.drawFastHLine(12, y + 30, 296, 0x3206);
  }
  tft.setTextSize(1);
  tft.setTextColor(MUTED, PHOTO_BG);
  tft.drawFastHLine(12, 216, 296, PHOTO_ACCENT);
  tft.setCursor(12, 225);
  tft.print("START: NEW SAMPLE   NEXT: DETAILS");
}

void drawDemoDetail(uint8_t rank) {
  const CropPhotoMeta &crop = CROP_PHOTOS[topCrops[rank]];
  tft.fillScreen(PHOTO_BG);
  tft.setTextWrap(false);
  tft.setTextColor(ST77XX_WHITE, PHOTO_BG);
  tft.setTextSize(2);
  tft.setCursor(12, 10);
  tft.print(crop.name);
  tft.drawFastHLine(12, 35, 296, PHOTO_ACCENT);
  tft.setTextSize(1);
  tft.setTextColor(MUTED, PHOTO_BG);
  tft.setCursor(12, 44);
  tft.print("CROP PHOTO  |  TOP ");
  tft.print(rank + 1);
  tft.print(" / 3");
  tft.fillRoundRect(70, 55, 180, 132, 8, 0x18E3);
  tft.drawRoundRect(70, 55, 180, 132, 8, PHOTO_ACCENT);
  tft.drawRect(98, 66, CROP_PHOTO_WIDTH + 4, CROP_PHOTO_HEIGHT + 4, PHOTO_ACCENT);
  if (crop.pixels) {
    tft.drawRGBBitmap(100, 68, crop.pixels, CROP_PHOTO_WIDTH, CROP_PHOTO_HEIGHT);
  } else {
    tft.setCursor(117, 107);
    tft.print("NO PHOTO");
  }
  tft.setTextColor(MUTED, PHOTO_BG);
  tft.setCursor(12, 199);
  tft.print("PHOTO PREVIEW");
  tft.drawFastHLine(12, 211, 296, PHOTO_ACCENT);
  tft.setCursor(12, 225);
  tft.print("START: NEW SAMPLE   NEXT: CONTINUE");
}

void startMeasurementView() {
  screenPage = ScreenPage::Data;
  readingCount = 0;
  resultLocked = false;
  latest = LatestReading{};
  phHistoryCount = 0;
  phHistoryNext = 0;
  drawFrame();
  lastReadMs = millis() - INTERVAL_MS;
}

void nextView() {
  if (screenPage == ScreenPage::Cover) return;
  if (screenPage == ScreenPage::Data) {
    if (!latest.available || !latest.sampleOk || !latest.soilInRange) {
      tft.fillRect(12, 226, 296, 14, BACKGROUND);
      textAt(12, 230, "WAIT FOR SOIL + TEMP READING", ST77XX_RED, 1);
      return;
    }
    if (!resultLocked) {
      captureDemoResult();
      resultLocked = true;
    }
    screenPage = ScreenPage::Summary;
    drawDemoSummary();
    return;
  }
  screenPage = screenPage == ScreenPage::Third ? ScreenPage::Data
              : ScreenPage(uint8_t(screenPage) + 1);
  if (screenPage == ScreenPage::Data) {
    drawFrame();
    renderLatest();
  } else drawDemoDetail(uint8_t(screenPage) - uint8_t(ScreenPage::First));
}

void readAndDisplay() {
  ++readingCount;
  temperatureSensor.requestTemperatures();
  float sample = temperatureSensor.getTempCByIndex(0);
  bool sampleOk = isfinite(sample) && sample != DEVICE_DISCONNECTED_C
                  && sample >= -55 && sample <= 125;
  float air = airSensor.readTemperature();
  float humidity = airSensor.readHumidity();
  bool airOk = isfinite(air) && air >= -40 && air <= 80;
  bool humidityOk = isfinite(humidity) && humidity >= 0 && humidity <= 100;
  uint32_t rawSum = 0;
  uint32_t mvSum = 0;
  for (int i = 0; i < 32; ++i) {
    rawSum += analogRead(SOIL_PIN);
    mvSum += analogReadMilliVolts(SOIL_PIN);
    delay(2);
  }
  uint16_t raw = rawSum / 32;
  float mv = mvSum / 32.0f;
  bool soilInRange = raw > 10 && raw < 4085 && mv >= 100 && mv <= 2900;
  float wetness = soilInRange ? relativeWetnessIndex(raw) : NAN;
  bool outsideReferences = outsideWetnessReferences(raw);
  const char *soilStatus = !soilInRange ? "adc_out_of_range"
                           : outsideReferences ? "demo_outside_sample_references"
                                               : "demo_sample_reference_index";

  constexpr size_t PH_SAMPLE_COUNT = 41;
  constexpr size_t PH_TRIM_COUNT = 5;
  uint32_t phRawSamples[PH_SAMPLE_COUNT];
  uint32_t phMvSamples[PH_SAMPLE_COUNT];
  // This checks readings only; hardware divider protection is still required.
  analogRead(PH_PIN);
  delay(5);
  for (size_t i = 0; i < PH_SAMPLE_COUNT; ++i) {
    phRawSamples[i] = analogRead(PH_PIN);
    phMvSamples[i] = analogReadMilliVolts(PH_PIN);
    delay(10);
  }
  sortSamples(phRawSamples, PH_SAMPLE_COUNT);
  sortSamples(phMvSamples, PH_SAMPLE_COUNT);
  uint32_t phRawSum = 0;
  uint32_t phMvSum = 0;
  for (size_t i = PH_TRIM_COUNT; i < PH_SAMPLE_COUNT - PH_TRIM_COUNT; ++i) {
    phRawSum += phRawSamples[i];
    phMvSum += phMvSamples[i];
  }
  uint16_t phRaw = phRawSum / (PH_SAMPLE_COUNT - 2 * PH_TRIM_COUNT);
  float phMv = phMvSum / float(PH_SAMPLE_COUNT - 2 * PH_TRIM_COUNT);
  uint32_t phSpread = phMvSamples[PH_SAMPLE_COUNT - 1] - phMvSamples[0];
  bool phInRange = phRaw > 10 && phRaw < 4085 && phMv >= 50 && phMv <= 3150;
  float phEstimateMv = phInRange ? smoothedPhMv(phMv) : NAN;
  bool phCalibrated = isfinite(calibration918Mv) && isfinite(calibration4Mv) &&
                      calibration4Mv - calibration918Mv >= 30.0f;
  float ph = phCalibrated ? 4.0f + (phEstimateMv - calibration4Mv) *
                           (9.18f - 4.0f) / (calibration918Mv - calibration4Mv) : NAN;
  bool phOk = phInRange && phSpread <= PH_ESTIMATE_MAX_SPREAD_MV &&
              millis() >= PH_WARMUP_MS &&
              isfinite(ph) && ph >= 0.0f && ph <= 14.0f;
  const char *phStatus = !phInRange ? "adc_out_of_range"
                         : millis() < PH_WARMUP_MS ? "warming_up"
                         : phSpread > PH_ESTIMATE_MAX_SPREAD_MV ? "checking_signal"
                         : !phCalibrated ? "uncalibrated"
                         : !phOk ? "ph_out_of_range"
                         : phSpread > 35 ? "noisy_estimate" : "estimate";

  latest.sample = sample;
  latest.air = air;
  latest.humidity = humidity;
  latest.soilMv = mv;
  latest.wetness = wetness;
  latest.phMv = phMv;
  latest.ph = phOk ? ph : NAN;
  latest.soilRaw = raw;
  latest.sampleOk = sampleOk;
  latest.airOk = airOk;
  latest.humidityOk = humidityOk;
  latest.soilInRange = soilInRange;
  latest.outsideReferences = outsideReferences;
  latest.phInRange = phInRange;
  latest.phOk = phOk;
  latest.phSpread = phSpread;
  latest.available = true;
  renderLatest();

  // Compatibility fields consumed by the Smart Soil v2 Dashboard.
  Serial.print("{\"deviceId\":\"esp32-probe-001\",\"location\":\"demo-field\",\"soilPH\":");
  serialNumber(phOk ? ph : NAN);
  Serial.print(",\"soilMoisture\":");
  serialNumber(soilInRange ? wetness : NAN);
  Serial.print(",\"soilTemperature\":");
  serialNumber(sampleOk ? sample : NAN);
  Serial.print(",\"airHumidity\":");
  serialNumber(humidityOk ? humidity : NAN);
  Serial.print(",\"rainfall\":0,\"nitrogen\":null,\"phosphorus\":null,\"potassium\":null");
  Serial.print(",\"sample_temperature_c\":");
  serialNumber(sampleOk ? sample : NAN);
  Serial.print(",\"sample_status\":\"");
  Serial.print(sampleOk ? "ok" : "sensor_error");
  Serial.print("\",\"air_temperature_c\":");
  serialNumber(airOk ? air : NAN);
  Serial.print(",\"air_humidity_pct\":");
  serialNumber(humidityOk ? humidity : NAN);
  Serial.print(",\"air_status\":\"");
  Serial.print(airOk && humidityOk ? "ok" : "sensor_error");
  Serial.print("\",\"soil_adc_raw\":");
  Serial.print(raw);
  Serial.print(",\"soil_adc_mv\":");
  serialNumber(mv);
  Serial.print(",\"soil_status\":\"");
  Serial.print(soilStatus);
  Serial.print("\",\"soil_wetness_index\":");
  serialNumber(wetness);
  Serial.print(",\"ph_adc_mv\":");
  serialNumber(phMv);
  Serial.printf(",\"ph_adc_spread_mv\":%lu,\"ph_status\":\"%s\",\"soil_reference_dry_raw\":%d,\"soil_reference_wet_raw\":%d,\"soil_moisture_pct\":null,\"ph\":",
                (unsigned long)phSpread, phStatus,
                SOIL_DRY_REFERENCE, SOIL_WET_REFERENCE);
  serialNumber(phOk ? ph : NAN);
  Serial.print(",\"ph_calibration\":\"");
  Serial.print(phUsesRecordedValue ? "recorded_values_unverified" : "saved_points_unverified");
  Serial.print("\"");
  Serial.printf(",\"reading\":%lu,\"uptime_ms\":%lu}\n",
                (unsigned long)readingCount, (unsigned long)millis());

  // Lock the same reading that the Dashboard receives after START. NEXT only
  // changes the TFT page, so the two recommendations cannot drift apart.
  if (!resultLocked && sampleOk && soilInRange && !outsideReferences) {
    captureDemoResult();
    resultLocked = true;
  }
}

void setup() {
  Serial.begin(115200);
  temperatureSensor.begin();
  temperatureSensor.setResolution(12);
  airSensor.begin();
  pinMode(SOIL_PIN, INPUT);
  pinMode(PH_PIN, INPUT);
  pinMode(START_PIN, INPUT_PULLUP);
  pinMode(NEXT_PIN, INPUT_PULLUP);
  analogReadResolution(12);
  analogSetPinAttenuation(SOIL_PIN, ADC_11db);
  analogSetPinAttenuation(PH_PIN, ADC_11db);
  phPreferences.begin("smartsoilph", true);
  calibration918Mv = phPreferences.getFloat("cal918", NAN);
  calibration4Mv = phPreferences.getFloat("cal4", NAN);
  phPreferences.end();
  if (!isfinite(calibration918Mv)) {
    calibration918Mv = RECORDED_PH918_MV;
    phUsesRecordedValue = true;
  }
  if (!isfinite(calibration4Mv)) {
    calibration4Mv = RECORDED_PH4_MV;
    phUsesRecordedValue = true;
  }
  SPI.begin(TFT_SCK, -1, TFT_MOSI, TFT_CS);
  tft.init(240, 320);
  tft.setSPISpeed(10000000);
  tft.setRotation(1);
  tft.setTextWrap(false);
  drawCover();
  Serial.println("ST7789 240x320 assumed, landscape 320x240. Cover shown until START.");
  Serial.println("DHT22 = AIR humidity. Soil index is NOT water content. pH is an unverified prototype estimate.");
  Serial.printf("pH reference: pH4 %.1f mV, pH9.18 %.1f mV (%s).\n",
                calibration4Mv, calibration918Mv,
                phUsesRecordedValue ? "recorded fallback" : "saved points");
  Serial.println("START GPIO13 = new sample; NEXT GPIO14 = demo top 3/details. Serial controls: s/n.");
  lastReadMs = millis() - INTERVAL_MS;
}

void loop() {
  if (pressed(START_PIN, startButton)) startMeasurementView();
  if (pressed(NEXT_PIN, nextButton)) nextView();
  while (Serial.available()) {
    char command = static_cast<char>(Serial.read());
    if (command == '\n' || command == '\r') {
      serialCommandBuffer.trim();
      if (serialCommandBuffer.equalsIgnoreCase("SCAN") || serialCommandBuffer.equalsIgnoreCase("START") ||
          serialCommandBuffer.equalsIgnoreCase("S")) {
        startMeasurementView();
        lastReadMs = millis() - INTERVAL_MS;
      } else if (serialCommandBuffer.equalsIgnoreCase("NEXT") || serialCommandBuffer.equalsIgnoreCase("N")) {
        nextView();
      }
      serialCommandBuffer = "";
    } else if (serialCommandBuffer.length() < 24) {
      serialCommandBuffer += command;
    }
  }
  if (millis() - lastReadMs >= INTERVAL_MS) {
    lastReadMs = millis();
    readAndDisplay();
  }
}
