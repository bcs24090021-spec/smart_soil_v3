#include <cassert>
#include <cmath>
#include "../SmartSoilTFT/WetnessReference.h"

int main() {
  assert(relativeWetnessIndex(2646) == 0);
  assert(relativeWetnessIndex(1756) == 100);
  assert(std::fabs(relativeWetnessIndex(2201) - 50) < 0.001f);
  assert(relativeWetnessIndex(3031) == 0);
  assert(relativeWetnessIndex(1500) == 100);
  assert(outsideWetnessReferences(3031));
  assert(outsideWetnessReferences(1500));
  assert(!outsideWetnessReferences(2646));
  assert(!outsideWetnessReferences(1756));
  assert(!outsideWetnessReferences(2201));
}
