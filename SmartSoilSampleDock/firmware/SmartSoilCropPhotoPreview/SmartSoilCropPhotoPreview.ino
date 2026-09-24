#include <Arduino.h>
#include <SPI.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ST7789.h>
#include "CropPhotoAssets.h"

constexpr uint8_t TFT_CS = 25;
constexpr uint8_t TFT_DC = 26;
constexpr uint8_t TFT_RST = 33;
constexpr uint8_t TFT_MOSI = 23;
constexpr uint8_t TFT_SCK = 18;
constexpr uint8_t START_PIN = 13;
constexpr uint8_t NEXT_PIN = 14;
constexpr uint16_t BG = 0x10A3;
constexpr uint16_t TEXT = 0xFFFF;
constexpr uint16_t MUTED = 0xB596;
constexpr uint16_t ACCENT = 0x5EAC;

Adafruit_ST7789 tft(&SPI, TFT_CS, TFT_DC, TFT_RST);
uint8_t currentCrop = 0;

struct ButtonState {
  bool raw = HIGH;
  bool stable = HIGH;
  uint32_t changedAt = 0;
};

ButtonState startButton;
ButtonState nextButton;

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

void drawCrop() {
  const CropPhotoMeta &crop = CROP_PHOTOS[currentCrop];
  tft.fillScreen(BG);
  tft.setTextWrap(false);
  tft.setTextColor(TEXT, BG);
  tft.setTextSize(2);
  tft.setCursor(12, 10);
  tft.print(crop.name);
  tft.drawFastHLine(12, 35, 296, ACCENT);

  tft.setTextSize(1);
  tft.setTextColor(MUTED, BG);
  tft.setCursor(12, 44);
  tft.print("PHOTO PREVIEW  ");
  tft.print(currentCrop + 1);
  tft.print("/");
  tft.print(CROP_PHOTO_COUNT);

  tft.drawRect(12, 66, CROP_PHOTO_WIDTH + 4, CROP_PHOTO_HEIGHT + 4, ACCENT);
  if (crop.pixels) {
    tft.drawRGBBitmap(14, 68, crop.pixels, CROP_PHOTO_WIDTH, CROP_PHOTO_HEIGHT);
  } else {
    tft.setCursor(31, 107);
    tft.print("NO PHOTO");
  }

  tft.setTextColor(TEXT, BG);
  tft.setCursor(149, 68);
  tft.print("pH: ");
  tft.print(crop.ph_min, 1);
  tft.print("-");
  tft.print(crop.ph_max, 1);
  tft.setCursor(149, 94);
  tft.print("Soil T: ");
  tft.print(crop.temp_min);
  tft.print("-");
  tft.print(crop.temp_max);
  tft.print(" C");
  tft.setCursor(149, 120);
  tft.print("VWC*: ");
  tft.print(crop.vwc_min);
  tft.print("-");
  tft.print(crop.vwc_max);
  tft.print("%");

  tft.setTextColor(MUTED, BG);
  tft.setCursor(12, 177);
  tft.print("* Unverified DOCX reference range");
  tft.setCursor(12, 194);
  tft.print("No live sensor recommendation");
  tft.drawFastHLine(12, 212, 296, ACCENT);
  tft.setCursor(12, 222);
  tft.print("START: FIRST       NEXT: NEXT CROP");
}

void setup() {
  Serial.begin(115200);
  pinMode(START_PIN, INPUT_PULLUP);
  pinMode(NEXT_PIN, INPUT_PULLUP);
  SPI.begin(TFT_SCK, -1, TFT_MOSI, TFT_CS);
  tft.init(240, 320);
  tft.setSPISpeed(10000000);
  tft.setRotation(1);
  drawCrop();
  Serial.println("Crop photo preview only. Start=GPIO13, Next=GPIO14, both to GND.");
  Serial.println("Serial controls: s=first crop, n=next crop.");
}

void loop() {
  if (pressed(START_PIN, startButton)) {
    currentCrop = 0;
    drawCrop();
  }
  if (pressed(NEXT_PIN, nextButton)) {
    currentCrop = (currentCrop + 1) % CROP_PHOTO_COUNT;
    drawCrop();
  }
  if (Serial.available()) {
    char command = Serial.read();
    if (command == 's' || command == 'S') currentCrop = 0;
    else if (command == 'n' || command == 'N') currentCrop = (currentCrop + 1) % CROP_PHOTO_COUNT;
    else return;
    drawCrop();
  }
  delay(5);
}
