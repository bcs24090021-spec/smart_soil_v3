#include <cassert>

#include "../SmartSoilTFT/DemoRanking.h"

int main() {
  assert(demoSensorBand(0) == DemoMoistureBand::Dry);
  assert(demoSensorBand(29.9f) == DemoMoistureBand::Dry);
  assert(demoSensorBand(30) == DemoMoistureBand::Moderate);
  assert(demoSensorBand(70) == DemoMoistureBand::Wet);
  assert(demoCropBand(20, 35) == DemoMoistureBand::Dry);
  assert(demoCropBand(25, 40) == DemoMoistureBand::Moderate);
  assert(demoCropBand(70, 90) == DemoMoistureBand::Wet);
  assert(demoMatchScore(28, 50, 24, 30, 25, 40) == 4);
  assert(demoMatchScore(28, 80, 24, 30, 25, 40) == 3);
  assert(demoMatchScore(28, 80, 24, 30, 20, 35) == 2);
  assert(demoMatchScore(35, 50, 24, 30, 25, 40) == 2);
}
