let twinModulePromise = null;

export async function createDigitalTwin(canvas, result) {
  if (!twinModulePromise) twinModulePromise = import("./three-plant.js");
  const { DigitalTwin } = await twinModulePromise;
  const twin = new DigitalTwin(canvas);
  twin.setReading(result);
  return twin;
}