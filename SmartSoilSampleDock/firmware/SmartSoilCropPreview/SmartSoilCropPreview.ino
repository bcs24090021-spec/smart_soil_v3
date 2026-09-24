#include <Arduino.h>
#include <SPI.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ST7789.h>
#include "ScreenAsset.h"

constexpr uint8_t TFT_CS = 25;
constexpr uint8_t TFT_DC = 26;
constexpr uint8_t TFT_RST = 33;
constexpr uint8_t TFT_MOSI = 23;
constexpr uint8_t TFT_SCK = 18;
Adafruit_ST7789 tft(&SPI, TFT_CS, TFT_DC, TFT_RST);

void setup() {
  Serial.begin(115200);
  SPI.begin(TFT_SCK, -1, TFT_MOSI, TFT_CS);
  tft.init(240, 320);
  tft.setSPISpeed(10000000);
  tft.setRotation(1);
  tft.fillScreen(ST77XX_BLACK);
  tft.drawRGBBitmap(0, 0, SCREEN_ASSET, 320, 240);
  Serial.println("STATIC UI PREVIEW ONLY: sample values, no sensors, AI or upload.");
}

void loop() {
  delay(50);
}
