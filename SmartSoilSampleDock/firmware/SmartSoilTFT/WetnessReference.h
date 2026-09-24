#pragma once

// User-measured sample references, not absolute water-content calibration.
constexpr int SOIL_DRY_REFERENCE = 2646;
constexpr int SOIL_WET_REFERENCE = 1756;
static_assert(SOIL_DRY_REFERENCE > SOIL_WET_REFERENCE, "Invalid wetness references");

inline float relativeWetnessIndex(int raw) {
  float index = 100.0f * (SOIL_DRY_REFERENCE - raw)
                / (SOIL_DRY_REFERENCE - SOIL_WET_REFERENCE);
  return index < 0 ? 0 : (index > 100 ? 100 : index);
}

inline bool outsideWetnessReferences(int raw) {
  return raw > SOIL_DRY_REFERENCE || raw < SOIL_WET_REFERENCE;
}
