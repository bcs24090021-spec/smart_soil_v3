#pragma once

#include <stdint.h>

enum class DemoMoistureBand : uint8_t { Dry, Moderate, Wet };

inline DemoMoistureBand demoSensorBand(float index) {
  return index < 30.0f ? DemoMoistureBand::Dry
       : index < 70.0f ? DemoMoistureBand::Moderate
                       : DemoMoistureBand::Wet;
}

inline DemoMoistureBand demoCropBand(uint8_t vwcMin, uint8_t vwcMax) {
  uint16_t midpointTwice = uint16_t(vwcMin) + vwcMax;
  return midpointTwice <= 60 ? DemoMoistureBand::Dry
       : midpointTwice <= 88 ? DemoMoistureBand::Moderate
                             : DemoMoistureBand::Wet;
}

inline const char *demoBandName(DemoMoistureBand band) {
  switch (band) {
    case DemoMoistureBand::Dry: return "Dry";
    case DemoMoistureBand::Moderate: return "Moderate";
    case DemoMoistureBand::Wet: return "Wet";
  }
  return "Unknown";
}

inline uint8_t demoMatchScore(float sampleTemp, float wetnessIndex,
                             uint8_t tempMin, uint8_t tempMax,
                             uint8_t vwcMin, uint8_t vwcMax) {
  uint8_t score = sampleTemp >= tempMin && sampleTemp <= tempMax ? 2 : 0;
  int8_t bandDistance = int8_t(demoSensorBand(wetnessIndex)) -
                        int8_t(demoCropBand(vwcMin, vwcMax));
  if (bandDistance < 0) bandDistance = -bandDistance;
  score += bandDistance == 0 ? 2 : bandDistance == 1 ? 1 : 0;
  return score;
}
