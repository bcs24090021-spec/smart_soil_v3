#include <Arduino.h>
#include <Preferences.h>
#include <SPI.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ST7789.h>
#include <math.h>

// PH4502C PO must pass through a voltage divider before reaching GPIO34.
// Never allow the ESP32 ADC pin to exceed 3.3 V.
constexpr uint8_t PH_ADC_PIN = 34;
constexpr uint8_t TFT_CS = 25;
constexpr uint8_t TFT_DC = 26;
constexpr uint8_t TFT_RST = 33;
constexpr uint8_t TFT_MOSI = 23;
constexpr uint8_t TFT_SCK = 18;
constexpr int16_t TFT_WIDTH = 320;
constexpr int16_t TFT_HEIGHT = 240;
constexpr uint32_t SERIAL_BAUD = 115200;
constexpr uint32_t READ_INTERVAL_MS = 1000;
constexpr uint32_t WARMUP_MS = 30000;
constexpr size_t SAMPLE_COUNT = 41;
constexpr size_t TRIM_COUNT = 5;
constexpr float ADC_MIN_MV = 50.0f;
constexpr float ADC_MAX_MV = 3150.0f;
constexpr float MAX_STABLE_SPREAD_MV = 35.0f;
constexpr float MIN_CALIBRATION_GAP_MV = 30.0f;

struct PhReading {
  uint16_t raw;
  float millivolts;
  float spreadMv;
  bool adcOk;
  bool stable;
};

Preferences preferences;
Adafruit_ST7789 tft(&SPI, TFT_CS, TFT_DC, TFT_RST);
float calibration918Mv = NAN;
float calibration4Mv = NAN;
uint32_t lastReadMs = 0;
PhReading latestReading = {};
bool haveReading = false;
bool tftReady = false;
String commandBuffer;

void drawTftFrame() {
  const uint16_t panel = tft.color565(18, 25, 31);
  const uint16_t muted = tft.color565(145, 165, 175);

  tft.fillScreen(ST77XX_BLACK);
  tft.fillRect(0, 0, TFT_WIDTH, 38, tft.color565(7, 78, 63));
  tft.setTextColor(ST77XX_WHITE);
  tft.setTextSize(2);
  tft.setCursor(12, 11);
  tft.print("SMART SOIL | PH TEST");

  tft.fillRect(10, 48, 184, 181, panel);
  tft.setTextColor(muted);
  tft.setTextSize(1);
  tft.setCursor(24, 62);
  tft.print("CURRENT PH");
  tft.setCursor(24, 199);
  tft.print("Two-point calibrated result");

  tft.setCursor(210, 55);
  tft.print("ADC INPUT");
  tft.setCursor(210, 105);
  tft.print("NOISE SPREAD");
  tft.setCursor(210, 155);
  tft.print("SENSOR STATE");
  tft.setCursor(210, 207);
  tft.print("CAL:");
}

void setupTft() {
  SPI.begin(TFT_SCK, -1, TFT_MOSI, TFT_CS);
  tft.init(240, 320);
  tft.setSPISpeed(10000000);
  tft.setRotation(1);
  tft.setTextWrap(false);

  // Visible startup test: red, green, blue confirms power and SPI framing.
  tft.fillScreen(ST77XX_RED);
  delay(250);
  tft.fillScreen(ST77XX_GREEN);
  delay(250);
  tft.fillScreen(ST77XX_BLUE);
  delay(250);

  tftReady = true;
  drawTftFrame();
  Serial.println("ST7789 initialized: 320x240 landscape.");
}

void sortValues(uint32_t *values, size_t count) {
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

PhReading readPhInput() {
  uint32_t rawSamples[SAMPLE_COUNT];
  uint32_t mvSamples[SAMPLE_COUNT];

  analogRead(PH_ADC_PIN); // Discard the first conversion after idle time.
  delay(5);

  for (size_t i = 0; i < SAMPLE_COUNT; ++i) {
    rawSamples[i] = analogRead(PH_ADC_PIN);
    mvSamples[i] = analogReadMilliVolts(PH_ADC_PIN);
    delay(10);
  }

  sortValues(rawSamples, SAMPLE_COUNT);
  sortValues(mvSamples, SAMPLE_COUNT);

  uint32_t rawSum = 0;
  uint32_t mvSum = 0;
  const size_t first = TRIM_COUNT;
  const size_t last = SAMPLE_COUNT - TRIM_COUNT;
  const size_t kept = last - first;
  for (size_t i = first; i < last; ++i) {
    rawSum += rawSamples[i];
    mvSum += mvSamples[i];
  }

  PhReading reading;
  reading.raw = rawSum / kept;
  reading.millivolts = mvSum / static_cast<float>(kept);
  reading.spreadMv = mvSamples[SAMPLE_COUNT - 1] - mvSamples[0];
  reading.adcOk = reading.millivolts >= ADC_MIN_MV
                  && reading.millivolts <= ADC_MAX_MV
                  && reading.raw > 10 && reading.raw < 4085;
  reading.stable = reading.adcOk
                   && reading.spreadMv <= MAX_STABLE_SPREAD_MV;
  return reading;
}

bool calibrationComplete() {
  return isfinite(calibration918Mv) && isfinite(calibration4Mv)
         && calibration4Mv - calibration918Mv >= MIN_CALIBRATION_GAP_MV;
}

float calculatePh(float millivolts) {
  if (!calibrationComplete()) return NAN;
  return 4.0f + (millivolts - calibration4Mv)
                * (9.18f - 4.0f) / (calibration918Mv - calibration4Mv);
}

const char *calibrationLabel() {
  if (calibrationComplete()) return "READY";
  if (isfinite(calibration918Mv)) return "9.18+ 4-";
  if (isfinite(calibration4Mv)) return "9.18- 4+";
  return "9.18- 4-";
}

void updateTft(const PhReading &reading) {
  if (!tftReady) return;

  const bool warmingUp = millis() < WARMUP_MS;
  const float ph = calculatePh(reading.millivolts);
  const bool phPlausible = isfinite(ph) && ph >= 0.0f && ph <= 14.0f;
  uint16_t stateColor = ST77XX_GREEN;
  const char *stateText = "STABLE";
  if (!reading.adcOk) {
    stateColor = ST77XX_RED;
    stateText = "RANGE ERROR";
  } else if (warmingUp) {
    stateColor = ST77XX_YELLOW;
    stateText = "WARMING UP";
  } else if (!reading.stable) {
    stateColor = ST77XX_ORANGE;
    stateText = "CHECKING";
  }

  const uint16_t panel = tft.color565(18, 25, 31);
  const uint16_t muted = tft.color565(145, 165, 175);
  const uint16_t accent = tft.color565(54, 211, 153);

  // Clear only changing value regions. The static frame is never redrawn,
  // which prevents the full-screen flash visible with fillScreen().
  tft.fillRect(18, 80, 168, 110, panel);
  tft.fillRect(204, 68, 112, 27, ST77XX_BLACK);
  tft.fillRect(204, 118, 112, 27, ST77XX_BLACK);
  tft.fillRect(204, 168, 112, 27, ST77XX_BLACK);
  tft.fillRect(238, 202, 78, 22, ST77XX_BLACK);

  if (!calibrationComplete()) {
    tft.setTextColor(ST77XX_CYAN);
    tft.setTextSize(2);
    tft.setCursor(24, 105);
    tft.print("UNCALIBRATED");
    tft.setTextSize(1);
    tft.setTextColor(muted);
    tft.setCursor(24, 145);
    tft.print("Use CAL918 and CAL4");
  } else if (!phPlausible) {
    tft.setTextColor(ST77XX_RED);
    tft.setTextSize(3);
    tft.setCursor(24, 105);
    tft.print("ERROR");
  } else {
    tft.setTextColor(accent);
    tft.setTextSize(5);
    tft.setCursor(24, 95);
    tft.print(ph, 2);
  }

  tft.setTextSize(2);
  tft.setTextColor(ST77XX_WHITE);
  tft.setCursor(210, 70);
  tft.print(reading.millivolts, 0);
  tft.print(" mV");

  tft.setTextSize(2);
  tft.setTextColor(reading.stable ? ST77XX_WHITE : ST77XX_ORANGE);
  tft.setCursor(210, 120);
  tft.print(reading.spreadMv, 0);
  tft.print(" mV");

  tft.setTextSize(strlen(stateText) > 8 ? 1 : 2);
  tft.setTextColor(stateColor);
  tft.setCursor(210, 170);
  tft.print(stateText);

  tft.setTextSize(1);
  tft.setTextColor(calibrationComplete() ? accent : ST77XX_YELLOW);
  tft.setCursor(238, 207);
  tft.print(calibrationLabel());
}

void printHelp() {
  Serial.println();
  Serial.println("PH4502C + E201-C TEST COMMANDS");
  Serial.println("  HELP   - show commands");
  Serial.println("  STATUS - show saved calibration");
  Serial.println("  CAL918 - save current stable reading as pH 9.18");
  Serial.println("  CAL4   - save current stable reading as pH 4.00");
  Serial.println("  CLEAR  - erase pH calibration");
  Serial.println();
  Serial.println("Calibration order: rinse -> pH 9.18 buffer -> CAL918 -> rinse");
  Serial.println("                   -> pH 4.00 buffer -> CAL4.");
  Serial.println("Set Serial Monitor to 115200 baud and Newline.");
  Serial.println();
}

void printCalibrationStatus() {
  Serial.print("CAL918 = ");
  if (isfinite(calibration918Mv)) Serial.print(calibration918Mv, 1);
  else Serial.print("NOT SET");
  Serial.println(" mV");

  Serial.print("CAL4 = ");
  if (isfinite(calibration4Mv)) Serial.print(calibration4Mv, 1);
  else Serial.print("NOT SET");
  Serial.println(" mV");

  Serial.print("Calibration = ");
  Serial.println(calibrationComplete() ? "READY" : "INCOMPLETE");
}

bool canSaveCalibration() {
  if (!haveReading) {
    Serial.println("CAL ERROR: no reading yet.");
    return false;
  }
  if (!latestReading.adcOk) {
    Serial.println("CAL ERROR: ADC voltage is outside the safe reading range.");
    return false;
  }
  if (!latestReading.stable) {
    Serial.println("CAL ERROR: signal is noisy. Wait and try again.");
    return false;
  }
  if (millis() < WARMUP_MS) {
    Serial.println("CAL ERROR: wait until the 30-second warm-up is complete.");
    return false;
  }
  return true;
}

void saveCalibration(const char *key, float value) {
  preferences.putFloat(key, value);
  if (strcmp(key, "cal918") == 0) calibration918Mv = value;
  else calibration4Mv = value;
  Serial.printf("Saved %s = %.1f mV\n", key, value);
  printCalibrationStatus();
}

void processCommand(String command) {
  command.trim();
  command.toUpperCase();
  if (command.length() == 0) return;

  if (command == "HELP" || command == "?") {
    printHelp();
  } else if (command == "STATUS") {
    printCalibrationStatus();
  } else if (command == "CAL918" || command == "9.18") {
    if (canSaveCalibration()) saveCalibration("cal918", latestReading.millivolts);
  } else if (command == "CAL4" || command == "4") {
    if (canSaveCalibration()) saveCalibration("cal4", latestReading.millivolts);
  } else if (command == "CLEAR") {
    preferences.remove("cal918");
    preferences.remove("cal7");
    preferences.remove("cal4");
    calibration918Mv = NAN;
    calibration4Mv = NAN;
    Serial.println("Calibration erased.");
  } else {
    Serial.print("Unknown command: ");
    Serial.println(command);
    Serial.println("Type HELP for the command list.");
  }
}

void readSerialCommands() {
  while (Serial.available()) {
    char c = static_cast<char>(Serial.read());
    if (c == '\n' || c == '\r') {
      if (commandBuffer.length() > 0) {
        processCommand(commandBuffer);
        commandBuffer = "";
      }
    } else if (commandBuffer.length() < 24) {
      commandBuffer += c;
    }
  }
}

void printReading(const PhReading &reading) {
  const bool warmingUp = millis() < WARMUP_MS;
  float ph = calculatePh(reading.millivolts);
  bool phPlausible = isfinite(ph) && ph >= 0.0f && ph <= 14.0f;

  Serial.print("raw=");
  Serial.print(reading.raw);
  Serial.print("  adc=");
  Serial.print(reading.millivolts, 1);
  Serial.print("mV  spread=");
  Serial.print(reading.spreadMv, 1);
  Serial.print("mV  status=");

  if (!reading.adcOk) Serial.print("ADC_RANGE_ERROR");
  else if (warmingUp) Serial.print("WARMING_UP");
  else if (!reading.stable) Serial.print("CHECKING_SIGNAL");
  else Serial.print("STABLE");

  Serial.print("  pH=");
  if (!calibrationComplete()) Serial.println("UNCALIBRATED");
  else if (!phPlausible) Serial.println("OUT_OF_RANGE");
  else Serial.println(ph, 2);

  updateTft(reading);
}

void setup() {
  Serial.begin(SERIAL_BAUD);
  delay(500);

  pinMode(PH_ADC_PIN, INPUT);
  analogReadResolution(12);
  analogSetPinAttenuation(PH_ADC_PIN, ADC_11db);

  setupTft();

  preferences.begin("smartsoilph", false);
  calibration918Mv = preferences.getFloat("cal918", NAN);
  calibration4Mv = preferences.getFloat("cal4", NAN);

  Serial.println();
  Serial.println("SmartSoil PH4502C + E201-C test starting");
  Serial.println("ESP32 ADC: GPIO34, maximum allowed voltage: 3.3 V");
  Serial.println("PH4502C PO must use a hardware voltage divider.");
  Serial.println("The program will not report pH until two-point calibration is complete.");
  printCalibrationStatus();
  printHelp();
}

void loop() {
  readSerialCommands();

  uint32_t now = millis();
  if (now - lastReadMs >= READ_INTERVAL_MS) {
    lastReadMs = now;
    latestReading = readPhInput();
    haveReading = true;
    printReading(latestReading);
  }
}
